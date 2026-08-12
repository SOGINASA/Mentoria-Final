"""Finance workspace built from approved timecards without fabricated pay rates."""

import csv
import io
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, Response, jsonify, request

from constants import ROLE_MANAGER, ROLE_SENDER
from models import Employee, Store, User, db
from platform_models import TimeCorrectionRequest, Timecard
from services.audit import audit
from services.permissions import can_access_store, scoped_store_ids
from utils.auth_helpers import feature_required, get_current_user, permission_required

finance_bp = Blueprint('finance', __name__)


@finance_bp.before_request
@feature_required('staff_platform')
def require_staff_platform():
    pass


def _period(value, timezone_name='UTC'):
    try:
        store_timezone = ZoneInfo(timezone_name)
        value = value or datetime.now(store_timezone).strftime('%Y-%m')
        local_start = datetime.strptime(value, '%Y-%m').replace(tzinfo=store_timezone)
        local_end = datetime(
            local_start.year + (local_start.month == 12),
            1 if local_start.month == 12 else local_start.month + 1,
            1,
            tzinfo=local_start.tzinfo,
        )
    except ValueError as exc:
        raise ValueError('Период должен быть в формате YYYY-MM') from exc
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f'Неизвестный часовой пояс точки: {timezone_name}') from exc
    return (
        value,
        local_start.astimezone(timezone.utc).replace(tzinfo=None),
        local_end.astimezone(timezone.utc).replace(tzinfo=None),
    )


def _timecard_stats(cards):
    approved = [item for item in cards if item.status in ('approved', 'corrected')]
    submitted = [item for item in cards if item.status == 'submitted']
    rejected = [item for item in cards if item.status == 'rejected']
    opened = [item for item in cards if item.status == 'open']
    if submitted or rejected or opened:
        readiness = 'attention'
    elif approved:
        readiness = 'ready'
    else:
        readiness = 'no_data'
    return {
        'approved_minutes': sum(item.worked_minutes or 0 for item in approved),
        'pending_minutes': sum(item.worked_minutes or 0 for item in submitted),
        'approved_timecards': len(approved),
        'pending_timecards': len(submitted),
        'rejected_timecards': len(rejected),
        'open_timecards': len(opened),
        'readiness': readiness,
    }


def _scoped_data(finance_user, period_value, requested_store_id=None):
    if requested_store_id and not can_access_store(finance_user, requested_store_id):
        raise PermissionError('Нет доступа к торговой точке')
    allowed_store_ids = scoped_store_ids(finance_user)
    selected_ids = {requested_store_id} if requested_store_id else allowed_store_ids

    def within_scope(store_id):
        return selected_ids is None or store_id in selected_ids

    stores_query = Store.query.filter_by(is_active=True).order_by(Store.name)
    if allowed_store_ids is not None:
        stores_query = stores_query.filter(Store.id.in_(list(allowed_store_ids)))
    stores = stores_query.all()
    selected_stores = [item for item in stores if within_scope(item.id)]
    if requested_store_id and not selected_stores:
        raise ValueError('Торговая точка не найдена или неактивна')

    period_filters = []
    normalized_period = None
    for store in selected_stores:
        normalized_period, start, end = _period(period_value, store.timezone)
        period_filters.append(db.and_(
            Timecard.store_id == store.id,
            Timecard.clock_in_at >= start,
            Timecard.clock_in_at < end,
        ))
    normalized_period = normalized_period or _period(period_value)[0]
    cards = (Timecard.query.filter(db.or_(*period_filters)).order_by(Timecard.clock_in_at).all()
             if period_filters else [])
    card_ids = {item.id for item in cards}
    corrections = [item for item in TimeCorrectionRequest.query.filter_by(status='pending').all()
                   if item.timecard_id in card_ids]

    cards_by_user = {}
    cards_by_user_store = {}
    for card in cards:
        cards_by_user.setdefault(card.user_id, []).append(card)
        cards_by_user_store.setdefault((card.user_id, card.store_id), []).append(card)

    card_user_ids = set(cards_by_user)
    all_users = User.query.order_by(User.full_name).all()
    users = [item for item in all_users if (
        item.id in card_user_ids
        or (item.is_active and item.role in (ROLE_SENDER, ROLE_MANAGER) and within_scope(item.store_id))
    )]
    user_by_employee_id = {
        item.employee_id: item for item in all_users
        if item.employee_id and (item.is_active or item.id in card_user_ids)
    }
    directory_query = Employee.query.filter_by(is_active=True).order_by(Employee.full_name)
    if selected_ids is not None:
        directory_query = directory_query.filter(Employee.store_id.in_(list(selected_ids)))
    directory = directory_query.all()

    people = []
    linked_user_ids = set()
    for employee in directory:
        user = user_by_employee_id.get(employee.id)
        if user:
            linked_user_ids.add(user.id)
        people.append({
            'key': f'user-{user.id}' if user else f'employee-{employee.id}',
            'id': user.id if user else f'employee-{employee.id}',
            'user_id': user.id if user else None,
            'employee_id': employee.id,
            'full_name': employee.full_name,
            'position': employee.position,
            'role': user.role if user else 'employee',
            'home_store_id': employee.store_id,
            'has_account': user is not None,
        })
    for user in users:
        if user.id in linked_user_ids:
            continue
        people.append({
            'key': f'user-{user.id}',
            'id': user.id,
            'user_id': user.id,
            'employee_id': None,
            'full_name': user.full_name,
            'position': None,
            'role': user.role,
            'home_store_id': user.store_id,
            'has_account': True,
        })

    employees = []
    for person in people:
        own_cards = cards_by_user.get(person['user_id'], []) if person['user_id'] else []
        worked_store_ids = sorted({item.store_id for item in own_cards})
        display_store_id = (
            requested_store_id
            or (worked_store_ids[0] if len(worked_store_ids) == 1 else person['home_store_id'])
        )
        employees.append({
            **{key: value for key, value in person.items() if key not in ('key', 'home_store_id')},
            'store_id': display_store_id,
            'home_store_id': person['home_store_id'],
            'worked_store_ids': worked_store_ids,
            **_timecard_stats(own_cards),
        })
    employees.sort(key=lambda item: item['full_name'].casefold())

    store_summaries = []
    store_rows = []
    for store in selected_stores:
        members = []
        for person in people:
            store_cards = (cards_by_user_store.get((person['user_id'], store.id), [])
                           if person['user_id'] else [])
            if person['home_store_id'] != store.id and not store_cards:
                continue
            members.append({
                **{key: value for key, value in person.items() if key not in ('key', 'home_store_id')},
                'store_id': store.id,
                'home_store_id': person['home_store_id'],
                **_timecard_stats(store_cards),
            })
        store_rows.extend(members)
        store_summaries.append({
            'store_id': store.id,
            'name': store.name,
            'employees': len(members),
            'approved_minutes': sum(item['approved_minutes'] for item in members),
            'pending_minutes': sum(item['pending_minutes'] for item in members),
            'ready_employees': len([item for item in members if item['readiness'] == 'ready']),
            'attention_employees': len([item for item in members if item['readiness'] == 'attention']),
        })
    return normalized_period, stores, employees, corrections, store_summaries, store_rows


@finance_bp.get('/workspace')
@permission_required('finance.workspace')
def workspace():
    finance_user = get_current_user()
    try:
        period, stores, employees, corrections, store_summaries, _ = _scoped_data(
            finance_user, request.args.get('month'), request.args.get('store_id', type=int),
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    approved_minutes = sum(item['approved_minutes'] for item in employees)
    pending_minutes = sum(item['pending_minutes'] for item in employees)
    ready = len([item for item in employees if item['readiness'] == 'ready'])
    return jsonify({
        'period': period,
        'stores': [item.to_dict() for item in stores],
        'employees': employees,
        'analytics': {
            'approved_minutes': approved_minutes,
            'pending_minutes': pending_minutes,
            'ready_employees': ready,
            'attention_employees': len([item for item in employees if item['readiness'] == 'attention']),
            'no_data_employees': len([item for item in employees if item['readiness'] == 'no_data']),
            'pending_corrections': len(corrections),
            'readiness_percent': round(ready * 100 / len(employees)) if employees else 0,
            'stores': store_summaries,
        },
        'payroll_connected': False,
    })


@finance_bp.get('/export')
@permission_required('finance.workspace')
def export_confirmed_hours():
    finance_user = get_current_user()
    try:
        period, stores, _, _, _, store_rows = _scoped_data(
            finance_user, request.args.get('month'), request.args.get('store_id', type=int),
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    store_names = {item.id: item.name for item in stores}
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(['Период', 'ID сотрудника', 'Сотрудник', 'Торговая точка',
                     'Подтверждено минут', 'Подтверждено часов', 'Статус готовности'])
    for item in store_rows:
        if item['approved_minutes'] <= 0:
            continue
        writer.writerow([
            period, item['employee_id'] or item['user_id'], item['full_name'],
            store_names.get(item['store_id'], ''),
            item['approved_minutes'], f"{item['approved_minutes'] / 60:.2f}", item['readiness'],
        ])
    audit(finance_user, 'finance.hours_exported', 'finance_period', payload={
        'period': period, 'store_id': request.args.get('store_id', type=int),
        'rows': len([item for item in store_rows if item['approved_minutes'] > 0]),
    })
    db.session.commit()
    return Response(output.getvalue(), mimetype='text/csv; charset=utf-8', headers={
        'Content-Disposition': f'attachment; filename=bahandi-hours-{period}.csv',
    })
