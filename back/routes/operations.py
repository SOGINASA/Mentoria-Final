"""Network-wide operational control center for the operations role."""

from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from constants import ROLE_MANAGER, ROLE_SENDER, STATUS_DRAFT
from models import Store, User, WriteOff
from platform_models import PlatformTask, Shift, SupportCase, Timecard
from services.permissions import can_access_store, scoped_store_ids
from utils.auth_helpers import get_current_user, permission_required
from utils.platform_helpers import utcnow

operations_bp = Blueprint('operations', __name__)


@operations_bp.get('/workspace')
@permission_required('operations.workspace')
def workspace():
    actor = get_current_user()
    days = min(30, max(7, request.args.get('days', 14, type=int) or 14))
    requested_store_id = request.args.get('store_id', type=int)
    if requested_store_id and not can_access_store(actor, requested_store_id):
        return jsonify({'error': 'Нет доступа к торговой точке'}), 403
    allowed_store_ids = scoped_store_ids(actor)
    selected_ids = {requested_store_id} if requested_store_id else allowed_store_ids

    def within_scope(store_id):
        return selected_ids is None or store_id in selected_ids

    stores_query = Store.query.filter_by(is_active=True).order_by(Store.name)
    if allowed_store_ids is not None:
        stores_query = stores_query.filter(Store.id.in_(list(allowed_store_ids)))
    stores = stores_query.all()
    visible_stores = [item for item in stores if not requested_store_id or item.id == requested_store_id]

    now = utcnow()
    today_start = datetime.combine(now.date(), datetime.min.time())
    today_end = today_start + timedelta(days=1)
    period_start = today_start - timedelta(days=days - 1)
    store_ids = {item.id for item in visible_stores}

    users = [item for item in User.query.filter(
        User.is_active.is_(True), User.role.in_((ROLE_SENDER, ROLE_MANAGER)),
    ).all() if item.store_id in store_ids]
    shifts = [item for item in Shift.query.filter(
        Shift.starts_at >= today_start, Shift.starts_at < today_end,
        Shift.status == 'published',
    ).all() if within_scope(item.store_id)]
    overdue_tasks = [item for item in PlatformTask.query.filter(
        PlatformTask.status.in_(('active', 'in_progress')), PlatformTask.due_at < now,
    ).all() if within_scope(item.store_id)]
    period_tasks = [item for item in PlatformTask.query.filter(
        PlatformTask.created_at >= period_start,
    ).all() if within_scope(item.store_id)]
    submitted_cards = [item for item in Timecard.query.filter_by(status='submitted').all()
                       if within_scope(item.store_id)]
    open_cards = [item for item in Timecard.query.filter_by(status='open').all()
                  if within_scope(item.store_id)]
    cases = [item for item in SupportCase.query.filter(
        SupportCase.status.in_(('open', 'in_progress')),
    ).all() if within_scope(item.store_id)]
    writeoffs = [item for item in WriteOff.query.filter(
        WriteOff.created_at >= period_start, WriteOff.status != STATUS_DRAFT,
    ).all() if within_scope(item.store_id)]

    def uncovered_slots(shift):
        assigned = len([item for item in shift.assignments if item.status == 'confirmed'])
        return max(0, shift.headcount - assigned)

    store_rows = []
    alerts = []
    for store in visible_stores:
        store_shifts = [item for item in shifts if item.store_id == store.id]
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
            'team': len([item for item in users if item.store_id == store.id]),
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

    trend = []
    for offset in range(days):
        day = (period_start + timedelta(days=offset)).date()
        trend.append({
            'date': day.isoformat(),
            'completed_tasks': len([item for item in period_tasks
                                    if item.completed_at and item.completed_at.date() == day]),
            'writeoffs': len([item for item in writeoffs if item.created_at.date() == day]),
        })

    completed_tasks = len([item for item in period_tasks if item.status in ('completed', 'approved')])
    return jsonify({
        'period': {'days': days, 'from': period_start.date().isoformat(), 'to': now.date().isoformat()},
        'stores': [item.to_dict() for item in stores],
        'store_summaries': sorted(store_rows, key=lambda item: (-item['attention_count'], item['name'])),
        'alerts': sorted(alerts, key=lambda item: (item['severity'] != 'critical', -item['count']))[:100],
        'analytics': {
            'active_stores': len(visible_stores),
            'active_employees': len(users),
            'today_shifts': len(shifts),
            'uncovered_slots': sum(uncovered_slots(item) for item in shifts),
            'overdue_tasks': len(overdue_tasks),
            'submitted_timecards': len(submitted_cards),
            'open_timecards': len(open_cards),
            'open_cases': len(cases),
            'writeoffs': len(writeoffs),
            'tasks_created': len(period_tasks),
            'tasks_completed': completed_tasks,
            'task_completion_percent': round(completed_tasks * 100 / len(period_tasks)) if period_tasks else 0,
        },
        'trend': trend,
        'generated_at': now.isoformat() + 'Z',
    })
