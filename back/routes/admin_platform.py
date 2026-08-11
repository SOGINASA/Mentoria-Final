"""Administration endpoints for platform scopes, flags and audit."""

from flask import Blueprint, jsonify, request

from constants import ROLE_ADMIN, STORE_SCOPES
from models import Store, User, db
from platform_models import AuditEvent, FeatureFlag, FeatureFlagTarget, UserStoreScope
from services.audit import audit
from utils.auth_helpers import get_current_user, role_required

admin_platform_bp = Blueprint('admin_platform', __name__)


@admin_platform_bp.put('/users/<int:user_id>/scopes')
@role_required(ROLE_ADMIN)
def replace_scopes(user_id):
    actor = get_current_user()
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}
    values = data.get('scopes') or []
    normalized = []
    for value in values:
        try:
            store_id = int(value['store_id'])
            scope = value['scope']
        except (KeyError, TypeError, ValueError):
            return jsonify({'error': 'Каждый scope должен содержать store_id и scope'}), 400
        if scope not in STORE_SCOPES or not Store.query.get(store_id):
            return jsonify({'error': 'Некорректная точка или scope'}), 400
        normalized.append((store_id, scope))
    UserStoreScope.query.filter_by(user_id=user.id).delete()
    for store_id, scope in set(normalized):
        db.session.add(UserStoreScope(user_id=user.id, store_id=store_id, scope=scope))
    audit(actor, 'user.scopes_replaced', 'user', user.id, payload={'scopes': values})
    db.session.commit()
    return jsonify({'scopes': [item.to_dict() for item in UserStoreScope.query.filter_by(user_id=user.id).all()]})


@admin_platform_bp.get('/feature-flags')
@role_required(ROLE_ADMIN)
def list_flags():
    return jsonify({'feature_flags': [{
        'key': flag.key, 'description': flag.description,
        'enabled_by_default': flag.enabled_by_default,
        'targets': [{'target_type': target.target_type, 'target_value': target.target_value,
                     'enabled': target.enabled} for target in flag.targets],
    } for flag in FeatureFlag.query.order_by(FeatureFlag.key).all()]})


@admin_platform_bp.put('/feature-flags/<string:key>')
@role_required(ROLE_ADMIN)
def upsert_flag(key):
    actor = get_current_user()
    data = request.get_json(silent=True) or {}
    flag = FeatureFlag.query.filter_by(key=key).first()
    if not flag:
        flag = FeatureFlag(key=key)
        db.session.add(flag)
    if 'enabled_by_default' in data:
        flag.enabled_by_default = bool(data['enabled_by_default'])
    if 'description' in data:
        flag.description = str(data['description'])[:255]
    db.session.flush()
    if 'targets' in data:
        FeatureFlagTarget.query.filter_by(flag_id=flag.id).delete()
        for target in data.get('targets') or []:
            if target.get('target_type') not in ('user', 'role', 'store'):
                return jsonify({'error': 'target_type должен быть user, role или store'}), 400
            db.session.add(FeatureFlagTarget(flag_id=flag.id,
                                             target_type=target['target_type'],
                                             target_value=str(target.get('target_value')),
                                             enabled=bool(target.get('enabled', True))))
    audit(actor, 'feature_flag.updated', 'feature_flag', flag.id,
          payload={'key': key})
    db.session.commit()
    return jsonify({'feature_flag': {'key': flag.key,
                                     'enabled_by_default': flag.enabled_by_default}})


@admin_platform_bp.get('/audit')
@role_required(ROLE_ADMIN)
def list_audit():
    page = max(1, request.args.get('page', 1, type=int))
    per_page = min(100, max(1, request.args.get('per_page', 50, type=int)))
    query = AuditEvent.query.order_by(AuditEvent.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({'events': [item.to_dict() for item in pagination.items],
                    'pagination': {'page': page, 'per_page': per_page,
                                   'total': pagination.total, 'pages': pagination.pages}})
