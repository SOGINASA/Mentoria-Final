"""Хелперы аутентификации/авторизации: получение текущего пользователя
и декоратор проверки роли."""

from functools import wraps

from flask import jsonify
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
            verify_jwt_in_request()
            user = get_current_user()
            if not user or not user.is_active:
                return jsonify({'error': 'Пользователь не найден или деактивирован'}), 401
            if user.role != ROLE_ADMIN and user.role not in allowed:
                return jsonify({'error': 'Недостаточно прав для этого действия'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
