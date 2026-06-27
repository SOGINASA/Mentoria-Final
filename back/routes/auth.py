"""Аутентификация: вход, обновление токена, текущий пользователь, смена пароля.
Публичной регистрации нет — аккаунты заводит администратор (см. routes/admin.py)."""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, get_jwt_identity,
)

from models import db, User
from utils.validators import is_email
from utils.auth_helpers import get_current_user

auth_bp = Blueprint('auth', __name__)


def _make_tokens(user):
    claims = {'role': user.role, 'full_name': user.full_name, 'username': user.username}
    access = create_access_token(identity=str(user.id), additional_claims=claims)
    refresh = create_refresh_token(identity=str(user.id))
    return access, refresh


@auth_bp.route('/login', methods=['POST'])
def login():
    """Вход по username или email + пароль."""
    data = request.get_json(silent=True) or {}
    identifier = (data.get('identifier') or data.get('username') or data.get('email') or '').strip()
    password = data.get('password') or ''

    if not identifier or not password:
        return jsonify({'error': 'Укажите логин и пароль'}), 400

    if is_email(identifier):
        user = User.query.filter(db.func.lower(User.email) == identifier.lower()).first()
    else:
        user = User.query.filter(db.func.lower(User.username) == identifier.lower()).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    if not user.is_active:
        return jsonify({'error': 'Аккаунт деактивирован'}), 403

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    access, refresh = _make_tokens(user)
    return jsonify({
        'user': user.to_dict(),
        'access_token': access,
        'refresh_token': refresh,
    })


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Обновить access-токен по refresh-токену."""
    user = User.query.get(int(get_jwt_identity()))
    if not user or not user.is_active:
        return jsonify({'error': 'Пользователь не найден'}), 404
    access, _ = _make_tokens(user)
    return jsonify({'access_token': access})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """Данные текущего пользователя."""
    user = get_current_user()
    if not user or not user.is_active:
        return jsonify({'error': 'Пользователь не найден'}), 404
    return jsonify({'user': user.to_dict()})


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Смена собственного пароля."""
    user = get_current_user()
    if not user or not user.is_active:
        return jsonify({'error': 'Пользователь не найден'}), 404

    data = request.get_json(silent=True) or {}
    current = data.get('current_password') or ''
    new = data.get('new_password') or ''

    if not user.check_password(current):
        return jsonify({'error': 'Неверный текущий пароль'}), 400
    if len(new) < 6:
        return jsonify({'error': 'Новый пароль должен содержать минимум 6 символов'}), 400

    user.set_password(new)
    db.session.commit()
    return jsonify({'message': 'Пароль изменён'})
