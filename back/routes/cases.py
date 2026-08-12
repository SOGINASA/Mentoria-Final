"""Employee support cases and conversation history."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from constants import ROLE_FINANCE, ROLE_HR
from models import db
from platform_models import CaseMessage, SupportCase
from services.audit import audit
from services.idempotency import idempotent_mutation
from services.notifications import notify
from services.permissions import can_access_store, has_permission
from utils.auth_helpers import feature_required, get_current_user
from utils.platform_helpers import utcnow

cases_bp = Blueprint('cases', __name__)


@cases_bp.before_request
@feature_required('support_cases')
def require_support_cases_feature():
    pass


def _can_manage(user, case):
    if not has_permission(user, 'cases.manage') or not can_access_store(user, case.store_id):
        return False
    if user.role == ROLE_HR:
        return case.category == 'hr'
    if user.role == ROLE_FINANCE:
        return case.category == 'payroll'
    return True


def _can_view(user, case):
    return case.author_id == user.id or _can_manage(user, case)


@cases_bp.get('')
@cases_bp.get('/')
@jwt_required()
def list_cases():
    user = get_current_user()
    query = SupportCase.query
    if not has_permission(user, 'cases.manage'):
        query = query.filter_by(author_id=user.id)
    items = [item for item in query.order_by(SupportCase.updated_at.desc()).all()
             if _can_view(user, item)]
    return jsonify({'cases': [item.to_dict() for item in items]})


@cases_bp.post('')
@cases_bp.post('/')
@jwt_required()
def create_case():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    subject = str(data.get('subject') or '').strip()
    body = str(data.get('message') or '').strip()
    if not subject or len(body) < 3:
        return jsonify({'error': 'Укажите тему и сообщение'}), 400
    item = SupportCase(reference='pending', author_id=user.id, store_id=user.store_id,
                       category=data.get('category', 'other'), subject=subject,
                       priority=data.get('priority', 'normal'))
    db.session.add(item)
    db.session.flush()
    item.reference = f'BH-S-{item.id:06d}'
    db.session.add(CaseMessage(case_id=item.id, author_id=user.id, body=body))
    audit(user, 'case.created', 'support_case', item.id, item.store_id)
    db.session.commit()
    return jsonify({'case': item.to_dict()}), 201


@cases_bp.post('/<int:case_id>/messages')
@jwt_required()
@idempotent_mutation
def add_message(case_id):
    user = get_current_user()
    item = SupportCase.query.get_or_404(case_id)
    if not _can_view(user, item):
        return jsonify({'error': 'Обращение недоступно'}), 403
    body = str((request.get_json(silent=True) or {}).get('body') or '').strip()
    if not body:
        return jsonify({'error': 'Сообщение не может быть пустым'}), 400
    message = CaseMessage(case_id=item.id, author_id=user.id, body=body)
    item.updated_at = utcnow()
    item.messages.append(message)
    if user.id != item.author_id:
        notify(item.author_id, 'case_message', 'Ответ по обращению', body=item.subject,
               entity_type='support_case', entity_id=item.id,
               action_url='/app/support', commit=False)
    audit(user, 'case.message_added', 'support_case', item.id, item.store_id)
    db.session.flush()
    return jsonify({'case': item.to_dict()}), 201


@cases_bp.patch('/<int:case_id>')
@jwt_required()
@idempotent_mutation
def update_case(case_id):
    user = get_current_user()
    item = SupportCase.query.get_or_404(case_id)
    if not _can_manage(user, item):
        return jsonify({'error': 'Недостаточно прав'}), 403
    data = request.get_json(silent=True) or {}
    if data.get('status') not in ('open', 'in_progress', 'resolved', 'closed'):
        return jsonify({'error': 'Некорректный статус'}), 400
    item.status = data['status']
    item.assigned_to_id = data.get('assigned_to_id', item.assigned_to_id)
    item.updated_at = utcnow()
    audit(user, 'case.updated', 'support_case', item.id, item.store_id,
          {'status': item.status})
    return jsonify({'case': item.to_dict()})
