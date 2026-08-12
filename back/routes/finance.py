"""Finance workspace built from approved timecards without fabricated pay rates."""

import csv
import io
from datetime import datetime

from flask import Blueprint, Response, jsonify, request

from constants import ROLE_MANAGER, ROLE_SENDER
from models import Store, User, db
from platform_models import TimeCorrectionRequest, Timecard
from services.audit import audit
from services.permissions import can_access_store, scoped_store_ids
from utils.auth_helpers import get_current_user, permission_required

finance_bp = Blueprint('finance', __name__)


def _period(value):
    value = value or datetime.utcnow().strftime('%Y-%m')
    try:
        start = datetime.strptime(value, '%Y-%m')
    except ValueError as exc:
        raise ValueError('Период должен быть в формате YYYY-MM') from exc
    end = datetime(start.year + (start.month == 12), 1 if start.month == 12 else start.month + 1, 1)
    return value, start, end


def _scoped_data(finance_user, period_value, requested_store_id=None):
    period_value, start, end = _period(period_value)
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
    users = [item for item in User.query.filter(
        User.is_active.is_(True), User.role.in_((ROLE_SENDER, ROLE_MANAGER)),
    ).order_by(User.full_name).all() if within_scope(item.store_id)]
    user_ids = {item.id for item in users}
    cards = [item for item in Timecard.query.filter(
        Timecard.clock_in_at >= start, Timecard.clock_in_at < end,
    ).order_by(Timecard.clock_in_at).all() if item.user_id in user_ids and within_scope(item.store_id)]
    card_ids = {item.id for item in cards}
    corrections = [item for item in TimeCorrectionRequest.query.filter_by(status='pending').all()
                   if item.timecard_id in card_ids]

    cards_by_user = {}
    for card in cards:
        cards_by_user.setdefault(card.user_id, []).append(card)
    employees = []
    for user in users:
        own_cards = cards_by_user.get(user.id, [])
        approved = [item for item in own_cards if item.status in ('approved', 'corrected')]
        submitted = [item for item in own_cards if item.status == 'submitted']
        rejected = [item for item in own_cards if item.status == 'rejected']
        opened = [item for item in own_cards if item.status == 'open']
        if submitted or rejected or opened:
            readiness = 'attention'
        elif approved:
            readiness = 'ready'
        else:
            readiness = 'no_data'
        employees.append({
            'id': user.id,
            'full_name': user.full_name,
            'role': user.role,
            'store_id': user.store_id,
            'approved_minutes': sum(item.worked_minutes or 0 for item in approved),
            'pending_minutes': sum(item.worked_minutes or 0 for item in submitted),
            'approved_timecards': len(approved),
            'pending_timecards': len(submitted),
            'rejected_timecards': len(rejected),
            'open_timecards': len(opened),
            'readiness': readiness,
        })

    store_summaries = []
    for store in stores:
        if requested_store_id and store.id != requested_store_id:
            continue
        members = [item for item in employees if item['store_id'] == store.id]
        store_summaries.append({
            'store_id': store.id,
            'name': store.name,
            'employees': len(members),
            'approved_minutes': sum(item['approved_minutes'] for item in members),
            'pending_minutes': sum(item['pending_minutes'] for item in members),
            'ready_employees': len([item for item in members if item['readiness'] == 'ready']),
            'attention_employees': len([item for item in members if item['readiness'] == 'attention']),
        })
    return period_value, stores, employees, corrections, store_summaries


@finance_bp.get('/workspace')
@permission_required('finance.workspace')
def workspace():
    finance_user = get_current_user()
    try:
        period, stores, employees, corrections, store_summaries = _scoped_data(
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
        period, stores, employees, _, _ = _scoped_data(
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
    for item in employees:
        if item['approved_minutes'] <= 0:
            continue
        writer.writerow([
            period, item['id'], item['full_name'], store_names.get(item['store_id'], ''),
            item['approved_minutes'], f"{item['approved_minutes'] / 60:.2f}", item['readiness'],
        ])
    audit(finance_user, 'finance.hours_exported', 'finance_period', payload={
        'period': period, 'store_id': request.args.get('store_id', type=int),
        'rows': len([item for item in employees if item['approved_minutes'] > 0]),
    })
    db.session.commit()
    return Response(output.getvalue(), mimetype='text/csv; charset=utf-8', headers={
        'Content-Disposition': f'attachment; filename=bahandi-hours-{period}.csv',
    })
