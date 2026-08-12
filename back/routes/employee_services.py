"""Server-backed learning, document and leave self-service workflows."""

from datetime import date

from flask import Blueprint, jsonify, request

from models import User, db
from platform_models import EmployeeDocumentRequest, LearningProgress, LeaveRequest
from services.audit import audit
from services.idempotency import idempotent_mutation
from services.employee_services import (
    DOCUMENT_CATALOG, LEARNING_CATALOG, LEAVE_TYPES,
    employee_services_payload, leave_balance, local_today,
)
from services.notifications import notify
from services.permissions import can_access_store, has_permission, scoped_store_ids
from utils.auth_helpers import get_current_user, permission_required
from utils.platform_helpers import expected_version, utcnow

employee_services_bp = Blueprint('employee_services', __name__)


def _parse_date(value, field):
    if not isinstance(value, str):
        raise ValueError(f'Поле {field} обязательно')
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f'Некорректное значение {field}') from exc


def _can_manage(manager, item):
    if not has_permission(manager, 'employee_services.manage'):
        return False
    if item.store_id is None:
        return scoped_store_ids(manager) is None
    return can_access_store(manager, item.store_id, 'employee_services.manage')


def _notify_managers(item, kind, title, body):
    owner_id = getattr(item, 'requester_id', None) or getattr(item, 'user_id', None)
    for candidate in User.query.filter_by(is_active=True).all():
        if candidate.id != owner_id and _can_manage(candidate, item):
            notify(candidate.id, kind, title, body=body,
                   entity_type=item.__tablename__, entity_id=item.id,
                   action_url='/app/services', commit=False)


@employee_services_bp.get('')
@employee_services_bp.get('/')
@permission_required('employee_services.use')
def get_employee_services():
    return jsonify(employee_services_payload(get_current_user()))


@employee_services_bp.post('/learning/<course_id>/modules/<module_id>/complete')
@permission_required('employee_services.use')
def complete_learning_module(course_id, module_id):
    user = get_current_user()
    course = LEARNING_CATALOG.get(course_id)
    if not course or module_id not in course['modules']:
        return jsonify({'error': 'Курс или урок не найден'}), 404
    item = LearningProgress.query.filter_by(user_id=user.id, course_id=course_id).first()
    if not item:
        item = LearningProgress(user_id=user.id, course_id=course_id,
                                completed_module_ids=[])
        db.session.add(item)
        db.session.flush()
    completed = list(item.completed_module_ids or [])
    duplicate = module_id in completed
    if not duplicate:
        completed.append(module_id)
        item.completed_module_ids = completed
        audit(user, 'learning.module_completed', 'learning_progress', item.id,
              user.store_id, {'course_id': course_id, 'module_id': module_id})
        db.session.commit()
    return jsonify({'progress': item.to_dict(), 'duplicate': duplicate}), 200 if duplicate else 201


@employee_services_bp.post('/learning/<course_id>/assessment')
@permission_required('employee_services.use')
def complete_learning_assessment(course_id):
    user = get_current_user()
    course = LEARNING_CATALOG.get(course_id)
    if not course:
        return jsonify({'error': 'Курс не найден'}), 404
    item = LearningProgress.query.filter_by(user_id=user.id, course_id=course_id).first()
    if not item or set(item.completed_module_ids or []) != set(course['modules']):
        return jsonify({'error': 'Сначала завершите все уроки курса'}), 409
    answer = str((request.get_json(silent=True) or {}).get('answer') or '').strip()
    if not answer:
        return jsonify({'error': 'Выберите вариант ответа'}), 400
    passed = answer == course['correct_option_id']
    item.assessment_score = 100 if passed else 0
    item.assessment_passed = passed
    item.completed_at = utcnow() if passed else None
    audit(user, 'learning.assessment_completed', 'learning_progress', item.id,
          user.store_id, {'course_id': course_id, 'passed': passed})
    db.session.commit()
    return jsonify({'progress': item.to_dict()})


@employee_services_bp.post('/documents/requests')
@permission_required('employee_services.use')
def create_document_request():
    user = get_current_user()
    document_id = str((request.get_json(silent=True) or {}).get('document_id') or '').strip()
    title = DOCUMENT_CATALOG.get(document_id)
    if not title:
        return jsonify({'error': 'Неизвестный тип документа'}), 400
    existing = EmployeeDocumentRequest.query.filter_by(
        user_id=user.id, document_id=document_id, status='processing',
    ).first()
    if existing:
        return jsonify({'request': existing.to_dict(), 'duplicate': True}), 200
    item = EmployeeDocumentRequest(reference='pending', user_id=user.id,
                                   store_id=user.store_id, document_id=document_id,
                                   title=title)
    db.session.add(item)
    db.session.flush()
    item.reference = f'BH-D-{item.id:06d}'
    _notify_managers(item, 'document_request_created', 'Запрос кадрового документа',
                     title)
    audit(user, 'document_request.created', 'employee_document_request', item.id,
          item.store_id, {'document_id': document_id})
    db.session.commit()
    return jsonify({'request': item.to_dict()}), 201


@employee_services_bp.post('/leave/requests')
@permission_required('employee_services.use')
def create_leave_request():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    leave_type = data.get('leave_type') or data.get('type')
    if leave_type not in LEAVE_TYPES:
        return jsonify({'error': 'Некорректный тип отсутствия'}), 400
    try:
        starts_on = _parse_date(data.get('starts_on') or data.get('start_date'), 'starts_on')
        ends_on = _parse_date(data.get('ends_on') or data.get('end_date'), 'ends_on')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    if ends_on < starts_on:
        return jsonify({'error': 'Дата окончания должна быть не раньше начала'}), 400
    if starts_on < local_today(user):
        return jsonify({'error': 'Дата начала не может быть в прошлом'}), 400
    days = (ends_on - starts_on).days + 1
    overlap = LeaveRequest.query.filter(
        LeaveRequest.requester_id == user.id,
        LeaveRequest.status.in_(('pending', 'approved')),
        LeaveRequest.starts_on <= ends_on,
        LeaveRequest.ends_on >= starts_on,
    ).first()
    if overlap:
        return jsonify({'error': 'На эти даты уже есть активная заявка'}), 409
    if leave_type == 'annual' and days > leave_balance(user, starts_on.year)['available_days']:
        return jsonify({'error': 'Недостаточно доступных дней отпуска'}), 409
    item = LeaveRequest(reference='pending', requester_id=user.id, store_id=user.store_id,
                        leave_type=leave_type, starts_on=starts_on, ends_on=ends_on,
                        days=days, comment=str(data.get('comment') or '').strip() or None)
    db.session.add(item)
    db.session.flush()
    item.reference = f'BH-L-{item.id:06d}'
    _notify_managers(item, 'leave_request_created', 'Новая заявка на отсутствие',
                     f'{starts_on.isoformat()} — {ends_on.isoformat()}')
    audit(user, 'leave_request.created', 'leave_request', item.id, item.store_id,
          {'leave_type': leave_type, 'days': days})
    db.session.commit()
    return jsonify({'request': item.to_dict(), 'leave_balance': leave_balance(user)}), 201


@employee_services_bp.post('/leave/requests/<int:request_id>/cancel')
@permission_required('employee_services.use')
def cancel_leave_request(request_id):
    user = get_current_user()
    item = LeaveRequest.query.get_or_404(request_id)
    if item.requester_id != user.id:
        return jsonify({'error': 'Заявка недоступна'}), 403
    data = request.get_json(silent=True) or {}
    try:
        expected_version(data, item.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    if item.status != 'pending':
        return jsonify({'error': 'Отменить можно только ожидающую заявку'}), 409
    item.status = 'cancelled'
    item.version += 1
    audit(user, 'leave_request.cancelled', 'leave_request', item.id, item.store_id)
    db.session.commit()
    return jsonify({'request': item.to_dict(), 'leave_balance': leave_balance(user)})


@employee_services_bp.get('/manager/documents/requests')
@permission_required('employee_services.manage')
def manager_document_requests():
    manager = get_current_user()
    status = request.args.get('status', 'processing')
    items = EmployeeDocumentRequest.query.filter_by(status=status).order_by(
        EmployeeDocumentRequest.created_at,
    ).all()
    return jsonify({'requests': [item.to_dict() for item in items if _can_manage(manager, item)]})


@employee_services_bp.post('/manager/documents/requests/<int:request_id>/decision')
@permission_required('employee_services.manage')
@idempotent_mutation
def decide_document_request(request_id):
    manager = get_current_user()
    item = EmployeeDocumentRequest.query.get_or_404(request_id)
    if not _can_manage(manager, item):
        return jsonify({'error': 'Нет доступа к заявке'}), 403
    data = request.get_json(silent=True) or {}
    decision = data.get('decision')
    if decision not in ('ready', 'rejected') or item.status != 'processing':
        return jsonify({'error': 'Недопустимое решение или состояние заявки'}), 409
    try:
        expected_version(data, item.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    file_url = str(data.get('file_url') or '').strip() or None
    if decision == 'ready' and not file_url:
        return jsonify({'error': 'Для готового документа требуется file_url'}), 400
    item.status = decision
    item.file_url = file_url
    item.decision_reason = str(data.get('reason') or '').strip() or None
    item.decided_by_id = manager.id
    item.decided_at = utcnow()
    item.version += 1
    notify(item.user_id, 'document_request_decided', 'Статус запроса документа',
           body='Документ готов' if decision == 'ready' else 'Запрос отклонён',
           entity_type='employee_document_request', entity_id=item.id,
           action_url='/app/documents', commit=False)
    audit(manager, f'document_request.{decision}', 'employee_document_request',
          item.id, item.store_id, {'reason': item.decision_reason})
    return jsonify({'request': item.to_dict()})


@employee_services_bp.get('/manager/leave/requests')
@permission_required('employee_services.manage')
def manager_leave_requests():
    manager = get_current_user()
    status = request.args.get('status', 'pending')
    items = LeaveRequest.query.filter_by(status=status).order_by(LeaveRequest.created_at).all()
    return jsonify({'requests': [item.to_dict() for item in items if _can_manage(manager, item)]})


@employee_services_bp.post('/manager/leave/requests/<int:request_id>/decision')
@permission_required('employee_services.manage')
@idempotent_mutation
def decide_leave_request(request_id):
    manager = get_current_user()
    item = LeaveRequest.query.get_or_404(request_id)
    if not _can_manage(manager, item):
        return jsonify({'error': 'Нет доступа к заявке'}), 403
    data = request.get_json(silent=True) or {}
    decision = data.get('decision')
    if decision not in ('approved', 'rejected') or item.status != 'pending':
        return jsonify({'error': 'Недопустимое решение или состояние заявки'}), 409
    try:
        expected_version(data, item.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    requester = (User.query.filter_by(id=item.requester_id)
                 .with_for_update().first())
    if not requester:
        return jsonify({'error': 'Сотрудник не найден'}), 409
    if decision == 'approved' and item.leave_type == 'annual':
        balance = leave_balance(requester, item.starts_on.year)
        if item.days > balance['available_days']:
            return jsonify({
                'error': 'Недостаточно доступных дней отпуска для согласования',
                'leave_balance': balance,
            }), 409
    item.status = decision
    item.decision_reason = str(data.get('reason') or '').strip() or None
    item.decided_by_id = manager.id
    item.decided_at = utcnow()
    item.version += 1
    notify(item.requester_id, 'leave_request_decided', 'Решение по отсутствию',
           body='Заявка согласована' if decision == 'approved' else 'Заявка отклонена',
           entity_type='leave_request', entity_id=item.id,
           action_url='/app/leave', commit=False)
    audit(manager, f'leave_request.{decision}', 'leave_request', item.id,
          item.store_id, {'reason': item.decision_reason})
    return jsonify({'request': item.to_dict(),
                    'leave_balance': leave_balance(requester)})
