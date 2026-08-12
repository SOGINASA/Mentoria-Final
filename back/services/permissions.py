"""Central role and store-scope authorization for the staff platform."""

from constants import (
    ROLE_ADMIN, ROLE_FINANCE, ROLE_HR, ROLE_MANAGER, ROLE_OPERATIONS,
    ROLE_REVIEWER, ROLE_SENDER,
)
from models import Store
from platform_models import UserStoreScope


ROLE_PERMISSIONS = {
    ROLE_SENDER: {'platform.use', 'shifts.read_own', 'time.track_own', 'time.read_own',
                  'time.request_correction', 'tasks.read_own', 'tasks.complete_own',
                  'cases.create', 'cases.read_own', 'news.read',
                  'employee_services.use'},
    ROLE_MANAGER: {'platform.use', 'shifts.read_own', 'shifts.manage', 'time.track_own',
                   'time.read_own', 'time.manage', 'time.request_correction',
                   'tasks.read_own', 'tasks.complete_own', 'tasks.manage',
                   'cases.create', 'cases.read_own', 'cases.manage',
                   'news.read', 'news.manage', 'manager.queue',
                   'employee_services.use', 'employee_services.manage'},
    ROLE_REVIEWER: {'platform.use', 'shifts.read_own', 'time.track_own', 'time.read_own',
                    'time.manage', 'tasks.read_own', 'tasks.complete_own',
                    'tasks.manage', 'cases.create', 'cases.read_own', 'news.read',
                    'manager.queue', 'reviewer.control', 'employee_services.use'},
    ROLE_HR: {'platform.use', 'hr.workspace', 'cases.manage', 'news.read', 'news.manage', 'time.read_all',
              'employee_services.use', 'employee_services.manage'},
    ROLE_FINANCE: {'platform.use', 'time.read_all', 'income.read', 'news.read',
                   'employee_services.use'},
    ROLE_OPERATIONS: {'platform.use', 'shifts.manage', 'time.manage', 'tasks.manage',
                      'cases.manage', 'news.read', 'news.manage', 'manager.queue',
                      'employee_services.use', 'employee_services.manage'},
    ROLE_ADMIN: {'*'},
}


def permissions_for_user(user):
    return sorted(ROLE_PERMISSIONS.get(user.role, set()))


def has_permission(user, permission):
    permissions = ROLE_PERMISSIONS.get(user.role, set())
    return '*' in permissions or permission in permissions


def scoped_store_ids(user, scope=None):
    """Return explicit store IDs, with backward-compatible role fallbacks.

    ``None`` means unrestricted access; an empty set means no store access.
    """
    if user.role in (ROLE_ADMIN, ROLE_OPERATIONS, ROLE_HR, ROLE_FINANCE):
        return None

    query = UserStoreScope.query.filter_by(user_id=user.id)
    if scope:
        query = query.filter_by(scope=scope)
    explicit = {item.store_id for item in query.all()}
    if explicit:
        return explicit

    if user.role == ROLE_REVIEWER:
        supervised = {store.id for store in user.supervised_stores}
        return supervised or None
    if user.store_id:
        return {user.store_id}
    return set()


def can_access_store(user, store_id, permission=None):
    if permission and not has_permission(user, permission):
        return False
    allowed = scoped_store_ids(user)
    return allowed is None or store_id in allowed


def scope_payload(user):
    allowed = scoped_store_ids(user)
    ids = [store.id for store in Store.query.order_by(Store.id).all()] if allowed is None else sorted(allowed)
    explicit = UserStoreScope.query.filter_by(user_id=user.id).all()
    return {
        'unrestricted': allowed is None,
        'store_ids': ids,
        'assignments': [item.to_dict() for item in explicit],
    }
