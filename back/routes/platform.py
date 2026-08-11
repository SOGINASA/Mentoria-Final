"""Staff-platform bootstrap and self-service profile endpoints."""

from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from models import db, Notification
from platform_models import PlatformTask, Shift, ShiftAssignment, TimeEvent
from services.audit import audit
from services.feature_flags import flags_for_user
from services.employee_services import employee_services_payload
from services.permissions import permissions_for_user, scope_payload
from utils.auth_helpers import get_current_user
from utils.platform_helpers import utcnow

platform_bp = Blueprint('platform', __name__)


def user_context(user):
    return {
        'user': user.to_dict(),
        'permissions': permissions_for_user(user),
        'scopes': scope_payload(user),
        'feature_flags': flags_for_user(user),
    }


@platform_bp.get('/bootstrap')
@jwt_required()
def bootstrap():
    user = get_current_user()
    now = utcnow()
    assignments = (ShiftAssignment.query.join(Shift)
                   .filter(ShiftAssignment.user_id == user.id,
                           ShiftAssignment.status == 'confirmed',
                           Shift.status == 'published',
                           Shift.ends_at >= now - timedelta(hours=12),
                           Shift.starts_at <= now + timedelta(days=14))
                   .order_by(Shift.starts_at).all())
    tasks = (PlatformTask.query.filter(
        PlatformTask.status.in_(('active', 'in_progress')),
        db.or_(PlatformTask.assignee_id == user.id,
               db.and_(PlatformTask.assignee_id.is_(None), PlatformTask.store_id == user.store_id)),
    ).order_by(PlatformTask.due_at.asc()).limit(20).all())
    last_event = TimeEvent.query.filter_by(user_id=user.id).order_by(TimeEvent.occurred_at.desc()).first()
    payload = user_context(user)
    payload.update({
        'server_time': now.isoformat().replace('+00:00', 'Z'),
        'shifts': [assignment.shift.to_dict() for assignment in assignments],
        'tasks': [task.to_dict() for task in tasks],
        'time_tracking': {
            'state': last_event.event_type if last_event and last_event.event_type != 'clock_out' else 'idle',
            'last_event': last_event.to_dict() if last_event else None,
        },
        'unread_notifications': Notification.query.filter_by(user_id=user.id, is_read=False).count(),
        'employee_services': employee_services_payload(user),
    })
    return jsonify(payload)


@platform_bp.patch('/profile')
@jwt_required()
def update_profile():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    allowed = {'full_name', 'email', 'phone'}
    unknown = set(data) - allowed
    if unknown:
        return jsonify({'error': 'Эти поля нельзя изменить', 'fields': sorted(unknown)}), 400
    if 'full_name' in data:
        value = str(data['full_name']).strip()
        if len(value) < 2:
            return jsonify({'error': 'Имя слишком короткое'}), 400
        user.full_name = value
    if 'email' in data:
        value = str(data['email']).strip() or None
        if value and '@' not in value:
            return jsonify({'error': 'Некорректный email'}), 400
        user.email = value
    if 'phone' in data:
        user.phone = str(data['phone']).strip() or None
    audit(user, 'profile.updated', 'user', user.id, user.store_id,
          {'fields': sorted(data.keys())})
    db.session.commit()
    return jsonify({'user': user.to_dict()})
