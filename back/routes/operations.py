"""Network-wide operational control center for the operations role."""

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, jsonify, request

from constants import ROLE_MANAGER, ROLE_SENDER, STATUS_DRAFT
from models import Employee, Store, User, WriteOff
from platform_models import PlatformTask, Shift, SupportCase, Timecard
from services.permissions import can_access_store, scoped_store_ids
from utils.auth_helpers import get_current_user, permission_required
from utils.platform_helpers import utcnow

operations_bp = Blueprint('operations', __name__)


def _utc_naive(value):
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _store_period(store, now, days):
    try:
        store_timezone = ZoneInfo(store.timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f'Неизвестный часовой пояс точки: {store.timezone}') from exc
    local_now = now.replace(tzinfo=timezone.utc).astimezone(store_timezone)
    local_today = local_now.date()
    local_start = datetime.combine(local_today, time.min, tzinfo=store_timezone)
    local_end = local_start + timedelta(days=1)
    return {
        'timezone': store_timezone,
        'today': local_today,
        'today_start': _utc_naive(local_start),
        'today_end': _utc_naive(local_end),
        'period_start': _utc_naive(local_start - timedelta(days=days - 1)),
    }


def _local_date(value, store_period):
    if value is None:
        return None
    aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    return aware.astimezone(store_period['timezone']).date()


@operations_bp.get('/workspace')
@permission_required('operations.workspace')
def workspace():
    actor = get_current_user()
    days = min(30, max(7, request.args.get('days', 14, type=int) or 14))
    requested_store_id = request.args.get('store_id', type=int)
    if requested_store_id and not can_access_store(actor, requested_store_id):
        return jsonify({'error': 'Нет доступа к торговой точке'}), 403
    allowed_store_ids = scoped_store_ids(actor)

    stores_query = Store.query.filter_by(is_active=True).order_by(Store.name)
    if allowed_store_ids is not None:
        stores_query = stores_query.filter(Store.id.in_(list(allowed_store_ids)))
    stores = stores_query.all()
    visible_stores = [item for item in stores if not requested_store_id or item.id == requested_store_id]

    if requested_store_id and not visible_stores:
        return jsonify({'error': 'Торговая точка не найдена или неактивна'}), 400

    now = utcnow()
    try:
        store_periods = {item.id: _store_period(item, now, days) for item in visible_stores}
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    store_ids = {item.id for item in visible_stores}

    active_users = [item for item in User.query.filter(
        User.is_active.is_(True), User.role.in_((ROLE_SENDER, ROLE_MANAGER)),
    ).all()]
    directory = [item for item in Employee.query.filter_by(is_active=True).all()
                 if item.store_id in store_ids]
    shifts = [item for item in Shift.query.filter_by(status='published').all()
              if item.store_id in store_ids
              and item.starts_at < store_periods[item.store_id]['today_end']
              and item.ends_at > store_periods[item.store_id]['today_start']]
    overdue_tasks = [item for item in PlatformTask.query.filter(
        PlatformTask.status.in_(('active', 'in_progress')), PlatformTask.due_at < now,
    ).all() if item.store_id in store_ids]
    scoped_tasks = [item for item in PlatformTask.query.all() if item.store_id in store_ids]

    def in_period(value, store_id):
        period = store_periods[store_id]
        return value is not None and period['period_start'] <= _utc_naive(value) <= now

    created_tasks = [item for item in scoped_tasks if in_period(item.created_at, item.store_id)]
    completed_tasks = [item for item in scoped_tasks if in_period(item.completed_at, item.store_id)]
    period_task_ids = {item.id for item in created_tasks} | {item.id for item in completed_tasks}
    period_tasks = [item for item in scoped_tasks if item.id in period_task_ids]
    submitted_cards = [item for item in Timecard.query.filter_by(status='submitted').all()
                       if item.store_id in store_ids]
    open_cards = [item for item in Timecard.query.filter_by(status='open').all()
                  if item.store_id in store_ids]
    cases = [item for item in SupportCase.query.filter(
        SupportCase.status.in_(('open', 'in_progress')),
    ).all() if item.store_id in store_ids]
    writeoffs = [item for item in WriteOff.query.filter(WriteOff.status != STATUS_DRAFT).all()
                 if item.store_id in store_ids and in_period(item.created_at, item.store_id)]

    def uncovered_slots(shift):
        assigned = len([item for item in shift.assignments if item.status == 'confirmed'])
        return max(0, shift.headcount - assigned)

    store_rows = []
    alerts = []
    user_by_employee_id = {item.employee_id: item for item in active_users if item.employee_id}
    active_directory_ids = {item.id for item in directory}
    network_team_ids = set()
    for store in visible_stores:
        store_shifts = [item for item in shifts if item.store_id == store.id]
        team_ids = {
            f'user-{user_by_employee_id[item.id].id}' if item.id in user_by_employee_id
            else f'employee-{item.id}'
            for item in directory if item.store_id == store.id
        }
        team_ids.update(
            f'user-{item.id}' for item in active_users
            if item.store_id == store.id and item.employee_id not in active_directory_ids
        )
        team_ids.update(
            f'user-{assignment.user_id}' for shift in store_shifts for assignment in shift.assignments
            if assignment.status == 'confirmed'
        )
        network_team_ids.update(team_ids)
        uncovered = sum(uncovered_slots(item) for item in store_shifts)
        store_overdue = len([item for item in overdue_tasks if item.store_id == store.id])
        store_cards = len([item for item in submitted_cards if item.store_id == store.id])
        store_cases = len([item for item in cases if item.store_id == store.id])
        store_writeoffs = len([item for item in writeoffs if item.store_id == store.id])
        attention = uncovered + store_overdue + store_cards + store_cases
        store_rows.append({
            'store_id': store.id,
            'name': store.name,
            'address': store.address,
            'team': len(team_ids),
            'today_shifts': len(store_shifts),
            'uncovered_slots': uncovered,
            'overdue_tasks': store_overdue,
            'submitted_timecards': store_cards,
            'open_cases': store_cases,
            'writeoffs': store_writeoffs,
            'attention_count': attention,
        })
        for kind, count, title, action_url in (
            ('coverage', uncovered, 'Не закрыты места в сменах', '/app/management'),
            ('tasks', store_overdue, 'Просрочены операционные задачи', '/app/management'),
            ('timecards', store_cards, 'Табели ожидают решения', '/app/approvals'),
            ('cases', store_cases, 'Открыты обращения сотрудников', '/app/support'),
        ):
            if count:
                alerts.append({
                    'id': f'{kind}-{store.id}', 'kind': kind, 'store_id': store.id,
                    'store_name': store.name, 'title': title, 'count': count,
                    'severity': 'critical' if kind == 'coverage' or count >= 5 else 'warning',
                    'action_url': action_url,
                })

    reference_today = (next(iter(store_periods.values()))['today']
                       if store_periods else now.date())
    trend_by_offset = {
        offset: {'date': (reference_today - timedelta(days=offset)).isoformat(),
                 'completed_tasks': 0, 'writeoffs': 0}
        for offset in range(days)
    }
    for item in completed_tasks:
        local_day = _local_date(item.completed_at, store_periods[item.store_id])
        offset = (store_periods[item.store_id]['today'] - local_day).days
        if offset in trend_by_offset:
            trend_by_offset[offset]['completed_tasks'] += 1
    for item in writeoffs:
        local_day = _local_date(item.created_at, store_periods[item.store_id])
        offset = (store_periods[item.store_id]['today'] - local_day).days
        if offset in trend_by_offset:
            trend_by_offset[offset]['writeoffs'] += 1
    trend = [trend_by_offset[offset] for offset in reversed(range(days))]

    relevant_task_count = len(period_tasks)
    completed_task_count = len(completed_tasks)
    period_from = min((item['today'] - timedelta(days=days - 1)
                       for item in store_periods.values()), default=now.date())
    period_to = max((item['today'] for item in store_periods.values()), default=now.date())
    return jsonify({
        'period': {'days': days, 'from': period_from.isoformat(), 'to': period_to.isoformat()},
        'stores': [item.to_dict() for item in stores],
        'store_summaries': sorted(store_rows, key=lambda item: (-item['attention_count'], item['name'])),
        'alerts': sorted(alerts, key=lambda item: (item['severity'] != 'critical', -item['count']))[:100],
        'analytics': {
            'active_stores': len(visible_stores),
            'active_employees': len(network_team_ids),
            'today_shifts': len(shifts),
            'uncovered_slots': sum(uncovered_slots(item) for item in shifts),
            'overdue_tasks': len(overdue_tasks),
            'submitted_timecards': len(submitted_cards),
            'open_timecards': len(open_cards),
            'open_cases': len(cases),
            'writeoffs': len(writeoffs),
            'tasks_created': len(created_tasks),
            'tasks_completed': completed_task_count,
            'tasks_in_period': relevant_task_count,
            'task_completion_percent': round(completed_task_count * 100 / relevant_task_count)
            if relevant_task_count else 0,
        },
        'trend': trend,
        'generated_at': now.isoformat() + 'Z',
    })
