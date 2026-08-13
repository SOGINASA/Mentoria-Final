"""Хелперы аутентификации/авторизации: получение текущего пользователя
и декоратор проверки роли."""

from functools import wraps

from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from models import User
from constants import ROLE_ADMIN


def get_current_user():
    """Вернуть объект User из JWT (или None)."""
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return None
    return User.query.get(user_id)


def role_required(*roles):
    """Декоратор: требует валидный JWT и одну из указанных ролей.
    Админ имеет доступ ко всему.

    Пример: @role_required('reviewer')  или  @role_required('sender', 'reviewer')
    """
    allowed = set(roles)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Flask-JWT-Extended intentionally exempts CORS preflight requests
            # from JWT verification. Do not attempt to read an identity after
            # that exemption: the browser must receive the automatic OPTIONS
            # response before it can send the authenticated request.
            if request.method == 'OPTIONS':
                return None
            verify_jwt_in_request()
            user = get_current_user()
            if not user or not user.is_active:
                return jsonify({'error': 'Пользователь не найден или деактивирован'}), 401
            if user.role != ROLE_ADMIN and user.role not in allowed:
                return jsonify({'error': 'Недостаточно прав для этого действия'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def permission_required(permission):
    """Require a staff-platform permission; administrators always pass."""
    from services.permissions import has_permission

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == 'OPTIONS':
                return None
            verify_jwt_in_request()
            user = get_current_user()
            if not user or not user.is_active:
                return jsonify({'error': 'Пользователь не найден или деактивирован'}), 401
            if not has_permission(user, permission):
                return jsonify({'error': 'Недостаточно прав', 'permission': permission}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def feature_required(feature):
    """Require an enabled staff-platform feature for the current user."""
    from services.feature_flags import feature_enabled_for_user

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == 'OPTIONS':
                return None
            verify_jwt_in_request()
            user = get_current_user()
            if not user or not user.is_active:
                return jsonify({'error': 'Пользователь не найден или деактивирован'}), 401
            if not feature_enabled_for_user(user, feature):
                return jsonify({
                    'error': 'Функция отключена администратором',
                    'feature': feature,
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
