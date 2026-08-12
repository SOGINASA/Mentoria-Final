"""Shift scheduling, assignment and employee requests."""

from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import IntegrityError

from constants import ROLE_MANAGER, ROLE_SENDER
from models import User, db
from platform_models import Shift, ShiftAssignment, ShiftRequest
from services.audit import audit
from services.idempotency import idempotent_mutation
from services.notifications import notify
from services.permissions import can_access_store
from utils.auth_helpers import get_current_user, permission_required
from utils.platform_helpers import expected_version, parse_datetime, utcnow

shifts_bp = Blueprint('shifts', __name__)


def _overlap(user_id, starts_at, ends_at, exclude_shift_id=None):
    query = (ShiftAssignment.query.join(Shift)
             .filter(ShiftAssignment.user_id == user_id,
                     ShiftAssignment.status == 'confirmed',
                     Shift.status != 'cancelled',
                     Shift.starts_at < ends_at, Shift.ends_at > starts_at))
    if exclude_shift_id:
        query = query.filter(Shift.id != exclude_shift_id)
    return query.first()


def _validate_shift(data, existing=None):
    starts_at = parse_datetime(data.get('starts_at'), 'starts_at', required=existing is None)
    ends_at = parse_datetime(data.get('ends_at'), 'ends_at', required=existing is None)
    starts_at = starts_at or existing.starts_at
    ends_at = ends_at or existing.ends_at
    if ends_at <= starts_at:
        raise ValueError('Окончание смены должно быть позже начала')
    if (ends_at - starts_at) > timedelta(hours=24):
        raise ValueError('Смена не может длиться больше 24 часов')
    headcount = int(data.get('headcount', existing.headcount if existing else 1))
    break_minutes = int(data.get('break_minutes', existing.break_minutes if existing else 0))
    if headcount < 1 or headcount > 100 or break_minutes < 0:
        raise ValueError('Некорректные параметры смены')
    return starts_at, ends_at, headcount, break_minutes


@shifts_bp.get('')
@shifts_bp.get('/')
@jwt_required()
def list_shifts():
    user = get_current_user()
    date_from = parse_datetime(request.args.get('from'), 'from') or (utcnow() - timedelta(days=31))
    date_to = parse_datetime(request.args.get('to'), 'to') or (utcnow() + timedelta(days=62))
    assigned_ids = db.session.query(ShiftAssignment.shift_id).filter_by(
        user_id=user.id, status='confirmed')
    query = Shift.query.filter(Shift.status == 'published', Shift.ends_at >= date_from,
                               Shift.starts_at <= date_to)
    if request.args.get('open') in ('1', 'true'):
        shifts = [item for item in query.order_by(Shift.starts_at).all()
                  if can_access_store(user, item.store_id) and item.to_dict()['open_slots'] > 0]
    else:
        shifts = query.filter(Shift.id.in_(assigned_ids)).order_by(Shift.starts_at).all()
    return jsonify({'shifts': [item.to_dict() for item in shifts]})


@shifts_bp.get('/requests')
@jwt_required()
def my_requests():
    user = get_current_user()
    items = ShiftRequest.query.filter_by(requester_id=user.id).order_by(ShiftRequest.created_at.desc()).all()
    return jsonify({'requests': [item.to_dict() for item in items]})


@shifts_bp.post('/<int:shift_id>/requests')
@jwt_required()
def create_request(shift_id):
    user = get_current_user()
    shift = Shift.query.get_or_404(shift_id)
    if shift.status != 'published' or not can_access_store(user, shift.store_id):
        return jsonify({'error': 'Смена недоступна'}), 403
    data = request.get_json(silent=True) or {}
    request_type = data.get('request_type', 'open_shift')
    if request_type not in ('open_shift', 'swap', 'release'):
        return jsonify({'error': 'Некорректный тип запроса'}), 400
    own_assignment = ShiftAssignment.query.filter_by(shift_id=shift.id, user_id=user.id,
                                                      status='confirmed').first()
    if request_type in ('swap', 'release') and not own_assignment:
        return jsonify({'error': 'Пользователь не назначен на эту смену'}), 409
    if request_type == 'open_shift' and own_assignment:
        return jsonify({'error': 'Пользователь уже назначен на эту смену'}), 409
    pending = ShiftRequest.query.filter_by(requester_id=user.id, shift_id=shift.id,
                                           request_type=request_type, status='pending').first()
    if pending:
        return jsonify({'request': pending.to_dict(), 'duplicate': True}), 200
    item = ShiftRequest(request_type=request_type, requester_id=user.id, shift_id=shift.id,
                        target_shift_id=data.get('target_shift_id'), comment=data.get('comment'))
    db.session.add(item)
    db.session.flush()
    audit(user, 'shift_request.created', 'shift_request', item.id, shift.store_id,
          {'request_type': request_type, 'shift_id': shift.id})
    db.session.commit()
    return jsonify({'request': item.to_dict()}), 201


@shifts_bp.post('/manager')
@permission_required('shifts.manage')
@idempotent_mutation
def create_shift():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    try:
        store_id = int(data['store_id'])
        if not can_access_store(user, store_id, 'shifts.manage'):
            return jsonify({'error': 'Нет доступа к точке'}), 403
        starts_at, ends_at, headcount, break_minutes = _validate_shift(data)
    except (KeyError, TypeError, ValueError) as exc:
        return jsonify({'error': str(exc)}), 400
    item = Shift(store_id=store_id, title=str(data.get('title') or 'Рабочая смена').strip(),
                 role_name=data.get('role_name'), starts_at=starts_at, ends_at=ends_at,
                 headcount=headcount, break_minutes=break_minutes, notes=data.get('notes'),
                 created_by_id=user.id)
    db.session.add(item)
    db.session.flush()
    audit(user, 'shift.created', 'shift', item.id, item.store_id)
    return jsonify({'shift': item.to_dict()}), 201


@shifts_bp.patch('/manager/<int:shift_id>')
@permission_required('shifts.manage')
@idempotent_mutation
def update_shift(shift_id):
    user = get_current_user()
    item = Shift.query.get_or_404(shift_id)
    if not can_access_store(user, item.store_id, 'shifts.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    try:
        expected_version(data, item.version)
        starts_at, ends_at, headcount, break_minutes = _validate_shift(data, item)
    except (ValueError, RuntimeError) as exc:
        return jsonify({'error': str(exc)}), 409 if isinstance(exc, RuntimeError) else 400
    for assignment in item.assignments:
        if assignment.status == 'confirmed' and _overlap(assignment.user_id, starts_at, ends_at, item.id):
            return jsonify({'error': 'Изменение создаёт пересечение смен'}), 409
    if headcount < len([a for a in item.assignments if a.status == 'confirmed']):
        return jsonify({'error': 'Нельзя уменьшить число мест ниже количества назначений'}), 409
    item.starts_at, item.ends_at = starts_at, ends_at
    item.headcount, item.break_minutes = headcount, break_minutes
    for field in ('title', 'role_name', 'notes'):
        if field in data:
            setattr(item, field, data[field])
    item.version += 1
    audit(user, 'shift.updated', 'shift', item.id, item.store_id, {'version': item.version})
    return jsonify({'shift': item.to_dict()})


@shifts_bp.post('/manager/<int:shift_id>/assignments')
@permission_required('shifts.manage')
@idempotent_mutation
def assign_shift(shift_id):
    manager = get_current_user()
    shift = Shift.query.get_or_404(shift_id)
    if not can_access_store(manager, shift.store_id, 'shifts.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    employee = User.query.get(data.get('user_id'))
    if (not employee or not employee.is_active or employee.role not in (ROLE_SENDER, ROLE_MANAGER)
            or not can_access_store(employee, shift.store_id)):
        return jsonify({'error': 'Сотрудник недоступен для этой точки'}), 400
    if _overlap(employee.id, shift.starts_at, shift.ends_at, shift.id):
        return jsonify({'error': 'У сотрудника уже есть пересекающаяся смена'}), 409
    if len([a for a in shift.assignments if a.status == 'confirmed']) >= shift.headcount:
        return jsonify({'error': 'Все места смены уже заняты'}), 409
    assignment = ShiftAssignment.query.filter_by(shift_id=shift.id, user_id=employee.id).first()
    if assignment:
        assignment.status = 'confirmed'
    else:
        assignment = ShiftAssignment(shift_id=shift.id, user_id=employee.id,
                                     assigned_by_id=manager.id)
        db.session.add(assignment)
    db.session.flush()
    if shift.status == 'published':
        notify(employee.id, 'shift_assigned', 'Назначена смена', body=shift.title,
               entity_type='shift', entity_id=shift.id, action_url='/app/shifts', commit=False)
    audit(manager, 'shift.assigned', 'shift', shift.id, shift.store_id, {'user_id': employee.id})
    return jsonify({'assignment': assignment.to_dict()}), 201


@shifts_bp.delete('/manager/<int:shift_id>/assignments/<int:user_id>')
@permission_required('shifts.manage')
@idempotent_mutation
def remove_assignment(shift_id, user_id):
    manager = get_current_user()
    shift = Shift.query.get_or_404(shift_id)
    if not can_access_store(manager, shift.store_id, 'shifts.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    try:
        expected_version(data, shift.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    assignment = ShiftAssignment.query.filter_by(
        shift_id=shift.id, user_id=user_id, status='confirmed',
    ).first()
    if not assignment:
        return jsonify({'error': 'Активное назначение не найдено'}), 404
    assignment.status = 'released'
    shift.version += 1
    notify(user_id, 'shift_unassigned', 'Назначение на смену снято', body=shift.title,
           entity_type='shift', entity_id=shift.id, action_url='/app/shifts', commit=False)
    audit(manager, 'shift.unassigned', 'shift', shift.id, shift.store_id,
          {'user_id': user_id, 'reason': data.get('reason')})
    return jsonify({'assignment': assignment.to_dict(), 'shift': shift.to_dict()})


@shifts_bp.post('/manager/<int:shift_id>/cancel')
@permission_required('shifts.manage')
@idempotent_mutation
def cancel_shift(shift_id):
    manager = get_current_user()
    shift = Shift.query.get_or_404(shift_id)
    if not can_access_store(manager, shift.store_id, 'shifts.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    try:
        expected_version(data, shift.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    if shift.status == 'cancelled':
        return jsonify({'error': 'Смена уже отменена'}), 409
    reason = str(data.get('reason') or '').strip()
    if shift.status == 'published' and len(reason) < 3:
        return jsonify({'error': 'Укажите причину отмены опубликованной смены'}), 400
    shift.status = 'cancelled'
    shift.version += 1
    for assignment in shift.assignments:
        if assignment.status == 'confirmed':
            notify(assignment.user_id, 'shift_cancelled', 'Смена отменена',
                   body=reason or shift.title, entity_type='shift', entity_id=shift.id,
                   action_url='/app/shifts', commit=False)
    for item in ShiftRequest.query.filter_by(shift_id=shift.id, status='pending').all():
        item.status = 'rejected'
        item.decision_reason = reason or 'Смена отменена'
        item.decided_by_id = manager.id
        item.decided_at = utcnow()
        item.version += 1
    audit(manager, 'shift.cancelled', 'shift', shift.id, shift.store_id, {'reason': reason})
    return jsonify({'shift': shift.to_dict()})


@shifts_bp.post('/manager/<int:shift_id>/publish')
@permission_required('shifts.manage')
@idempotent_mutation
def publish_shift(shift_id):
    user = get_current_user()
    shift = Shift.query.get_or_404(shift_id)
    if not can_access_store(user, shift.store_id, 'shifts.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    if shift.status == 'cancelled':
        return jsonify({'error': 'Отменённую смену нельзя опубликовать'}), 409
    shift.status = 'published'
    shift.published_at = utcnow()
    shift.version += 1
    for assignment in shift.assignments:
        notify(assignment.user_id, 'shift_published', 'Смена опубликована',
               body=shift.title, entity_type='shift', entity_id=shift.id,
               action_url='/app/shifts', commit=False)
    audit(user, 'shift.published', 'shift', shift.id, shift.store_id)
    return jsonify({'shift': shift.to_dict()})


@shifts_bp.get('/manager/requests')
@permission_required('shift_requests.review')
def manager_requests():
    user = get_current_user()
    items = ShiftRequest.query.filter_by(status=request.args.get('status', 'pending')).order_by(
        ShiftRequest.created_at).all()
    items = [item for item in items
             if can_access_store(user, item.shift.store_id, 'shift_requests.review')]
    return jsonify({'requests': [item.to_dict() for item in items]})


@shifts_bp.post('/manager/requests/<int:request_id>/decision')
@permission_required('shift_requests.review')
@idempotent_mutation
def decide_request(request_id):
    manager = get_current_user()
    item = ShiftRequest.query.get_or_404(request_id)
    if not can_access_store(manager, item.shift.store_id, 'shift_requests.review'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    decision = data.get('decision')
    if decision not in ('approved', 'rejected'):
        return jsonify({'error': 'decision должен быть approved или rejected'}), 400
    try:
        expected_version(data, item.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    if item.status != 'pending':
        return jsonify({'error': 'Запрос уже обработан'}), 409
    if decision == 'approved':
        assignment = ShiftAssignment.query.filter_by(shift_id=item.shift_id,
                                                      user_id=item.requester_id).first()
        if item.request_type == 'open_shift':
            if item.shift.to_dict()['open_slots'] < 1 or _overlap(
                    item.requester_id, item.shift.starts_at, item.shift.ends_at, item.shift.id):
                return jsonify({'error': 'Смена уже занята или пересекается с другой'}), 409
            db.session.add(ShiftAssignment(shift_id=item.shift_id, user_id=item.requester_id,
                                           assigned_by_id=manager.id))
        elif item.request_type == 'release' and assignment:
            assignment.status = 'released'
        else:
            return jsonify({'error': 'Автоматическое одобрение этого обмена недоступно'}), 409
    item.status = decision
    item.decision_reason = data.get('reason')
    item.decided_by_id = manager.id
    item.decided_at = utcnow()
    item.version += 1
    notify(item.requester_id, 'shift_request_decided', 'Решение по запросу на смену',
           body='Одобрено' if decision == 'approved' else 'Отклонено',
           entity_type='shift_request', entity_id=item.id, action_url='/app/shifts', commit=False)
    audit(manager, f'shift_request.{decision}', 'shift_request', item.id,
          item.shift.store_id, {'reason': item.decision_reason})
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Запрос конфликтует с уже принятым решением'}), 409
    return jsonify({'request': item.to_dict()})
