"""System administration endpoints for scopes, feature flags and audit."""

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func

from constants import ROLE_ADMIN, ROLES, STORE_SCOPES
from models import Employee, Store, User, db
from platform_models import AuditEvent, FeatureFlag, FeatureFlagTarget, UserStoreScope
from services.audit import audit
from services.feature_flags import DEFAULT_FLAGS
from services.iiko_service import REAL_INTEGRATION_AVAILABLE
from utils.auth_helpers import get_current_user, role_required

admin_platform_bp = Blueprint('admin_platform', __name__)

FLAG_DESCRIPTIONS = {
    'staff_platform': 'Новая платформа сотрудника',
    'shifts': 'Смены и расписание',
    'time_tracking': 'Учёт рабочего времени',
    'tasks': 'Задачи сотрудников',
    'support_cases': 'Обращения и поддержка',
    'news': 'Новости компании',
    'income': 'Расчёт и просмотр дохода',
    'hr_services': 'Кадровые сервисы',
}


def _flag_dict(flag, key, default=False):
    return {
        'key': key,
        'description': (flag.description if flag else None) or FLAG_DESCRIPTIONS.get(key, ''),
        'enabled_by_default': flag.enabled_by_default if flag else bool(default),
        'targets': [{
            'target_type': target.target_type,
            'target_value': target.target_value,
            'enabled': target.enabled,
        } for target in (flag.targets if flag else [])],
    }


@admin_platform_bp.get('/overview')
@role_required(ROLE_ADMIN)
def overview():
    """Return operational facts needed by the administrator dashboard."""
    role_counts = {role: 0 for role in ROLES}
    role_counts.update(dict(db.session.query(User.role, func.count(User.id)).group_by(User.role).all()))
    total_users = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()
    total_stores = Store.query.count()
    active_stores = Store.query.filter_by(is_active=True).count()
    unlinked_accounts = User.query.filter(
        User.is_active.is_(True), User.role == 'sender', User.employee_id.is_(None)
    ).count()
    missing_iiko = Store.query.filter(
        Store.is_active.is_(True), db.or_(Store.iiko_store_id.is_(None), Store.iiko_store_id == '')
    ).count()

    recent = AuditEvent.query.order_by(AuditEvent.created_at.desc()).limit(6).all()
    actor_ids = {item.actor_id for item in recent if item.actor_id}
    actors = ({u.id: u.full_name for u in User.query.filter(User.id.in_(actor_ids)).all()}
              if actor_ids else {})
    issues = []
    if unlinked_accounts:
        issues.append({'key': 'unlinked_accounts', 'count': unlinked_accounts,
                       'title': 'Аккаунты не связаны со справочником iiko', 'target': 'users'})
    if missing_iiko:
        issues.append({'key': 'missing_iiko', 'count': missing_iiko,
                       'title': 'У активных точек не указан ID iiko', 'target': 'stores'})

    iiko_real_mode = current_app.config.get('IIKO_MODE') == 'real'
    iiko_configured = iiko_real_mode and bool(current_app.config.get('IIKO_BASE_URL'))
    iiko_connected = iiko_configured and REAL_INTEGRATION_AVAILABLE
    if iiko_connected:
        iiko_status = 'connected'
        iiko_detail = 'Реальная интеграция настроена'
    elif iiko_real_mode:
        iiko_status = 'unavailable'
        iiko_detail = ('Реальный режим настроен, но отправка актов в iiko '
                       'ещё не реализована')
    else:
        iiko_status = 'mock'
        iiko_detail = 'Тестовый режим — данные не отправляются в iiko'
    return jsonify({
        'users': {'total': total_users, 'active': active_users,
                  'inactive': total_users - active_users, 'by_role': role_counts},
        'stores': {'total': total_stores, 'active': active_stores,
                   'inactive': total_stores - active_stores},
        'employees': {'active': Employee.query.filter_by(is_active=True).count()},
        'features': {'available': len(DEFAULT_FLAGS), 'configured': FeatureFlag.query.count()},
        'audit': {'total': AuditEvent.query.count(), 'recent': [
            dict(item.to_dict(), actor_name=actors.get(item.actor_id)) for item in recent
        ]},
        'integrations': [{
            'key': 'iiko', 'name': 'iiko',
            'status': iiko_status,
            'detail': iiko_detail,
        }],
        'issues': issues,
    })


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
    stored = {flag.key: flag for flag in FeatureFlag.query.order_by(FeatureFlag.key).all()}
    keys = list(DEFAULT_FLAGS) + sorted(set(stored) - set(DEFAULT_FLAGS))
    return jsonify({'feature_flags': [
        _flag_dict(stored.get(key), key, DEFAULT_FLAGS.get(key, False)) for key in keys
    ]})


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
        seen_targets = set()
        for target in data.get('targets') or []:
            if target.get('target_type') not in ('user', 'role', 'store'):
                return jsonify({'error': 'target_type должен быть user, role или store'}), 400
            value = str(target.get('target_value') or '').strip()
            if not value:
                return jsonify({'error': 'Укажите значение правила доступа'}), 400
            identity = (target['target_type'], value)
            if identity in seen_targets:
                return jsonify({'error': 'Правило для этой цели уже существует'}), 400
            seen_targets.add(identity)
            db.session.add(FeatureFlagTarget(
                flag_id=flag.id, target_type=target['target_type'], target_value=value,
                enabled=bool(target.get('enabled', True)),
            ))
    audit(actor, 'feature_flag.updated', 'feature_flag', flag.id, payload={'key': key})
    db.session.commit()
    return jsonify({'feature_flag': _flag_dict(flag, flag.key)})


@admin_platform_bp.get('/audit')
@role_required(ROLE_ADMIN)
def list_audit():
    page = max(1, request.args.get('page', 1, type=int))
    per_page = min(100, max(1, request.args.get('per_page', 50, type=int)))
    query = AuditEvent.query
    action = (request.args.get('action') or '').strip()
    entity_type = (request.args.get('entity_type') or '').strip()
    actor_id = request.args.get('actor_id', type=int)
    if action:
        query = query.filter(AuditEvent.action.ilike(f'%{action}%'))
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    if actor_id:
        query = query.filter_by(actor_id=actor_id)
    pagination = query.order_by(AuditEvent.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    actor_ids = {item.actor_id for item in pagination.items if item.actor_id}
    store_ids = {item.store_id for item in pagination.items if item.store_id}
    actors = ({u.id: u.full_name for u in User.query.filter(User.id.in_(actor_ids)).all()}
              if actor_ids else {})
    stores = ({s.id: s.name for s in Store.query.filter(Store.id.in_(store_ids)).all()}
              if store_ids else {})
    events = [dict(item.to_dict(), actor_name=actors.get(item.actor_id),
                   store_name=stores.get(item.store_id)) for item in pagination.items]
    return jsonify({'events': events, 'pagination': {
        'page': page, 'per_page': per_page, 'total': pagination.total, 'pages': pagination.pages,
    }})
