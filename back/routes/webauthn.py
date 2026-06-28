"""Вход по биометрии через WebAuthn (Face ID, Touch ID, отпечаток, passkey).

Поток:
  1. Регистрация ключа (нужен JWT — пользователь уже залогинен паролем):
     POST /register-options → клиент вызывает navigator.credentials.create()
     POST /register         → сохраняем публичный ключ.
  2. Вход по ключу (без пароля):
     POST /authenticate-options → клиент вызывает navigator.credentials.get()
     POST /authenticate         → проверяем подпись, выдаём JWT.

Интерфейса нет — только API (фронт подключим позже)."""

import base64

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier

from models import db, User, WebAuthnCredential, WebAuthnChallenge
from utils.validators import is_email
from routes.auth import _make_tokens

webauthn_bp = Blueprint('webauthn', __name__)


# ──── Challenge store (БД, одноразовый, TTL 5 минут) ────

def _store_challenge(user_id, challenge, challenge_type):
    """Сохранить challenge, затерев предыдущий того же типа для пользователя."""
    WebAuthnChallenge.query.filter_by(
        user_id=user_id, challenge_type=challenge_type
    ).delete()
    record = WebAuthnChallenge(
        user_id=user_id, challenge=challenge, challenge_type=challenge_type
    )
    db.session.add(record)
    db.session.commit()
    return record


def _get_challenge(user_id, challenge_type):
    """Получить и сразу удалить challenge (одноразовый). None, если нет/истёк."""
    record = WebAuthnChallenge.query.filter_by(
        user_id=user_id, challenge_type=challenge_type
    ).first()
    if record is None:
        return None
    if record.is_expired():
        db.session.delete(record)
        db.session.commit()
        return None
    challenge = record.challenge
    db.session.delete(record)
    db.session.commit()
    return challenge


def _find_user_by_identifier(identifier):
    """Найти пользователя по email или username (как в обычном логине)."""
    identifier = (identifier or '').strip()
    if not identifier:
        return None
    if is_email(identifier):
        return User.query.filter(db.func.lower(User.email) == identifier.lower()).first()
    return User.query.filter(db.func.lower(User.username) == identifier.lower()).first()


# ──── Регистрация ключа (требует JWT) ────

@webauthn_bp.route('/register-options', methods=['POST'])
@jwt_required()
def register_options():
    """Сгенерировать опции для navigator.credentials.create()."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    # Уже зарегистрированные ключи исключаем (нельзя регистрировать дважды)
    existing = WebAuthnCredential.query.filter_by(user_id=user_id).all()
    exclude_credentials = [
        PublicKeyCredentialDescriptor(id=cred.credential_id) for cred in existing
    ]

    options = generate_registration_options(
        rp_id=current_app.config['WEBAUTHN_RP_ID'],
        rp_name=current_app.config['WEBAUTHN_RP_NAME'],
        user_id=str(user_id).encode(),
        user_name=user.email or user.username or f'user_{user_id}',
        user_display_name=user.full_name or user.username or '',
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
    )

    _store_challenge(user_id, options.challenge, 'registration')
    # options_to_json уже возвращает готовую JSON-строку — отдаём как есть,
    # без повторной сериализации через jsonify (иначе клиент получит строку).
    return current_app.response_class(options_to_json(options), mimetype='application/json'), 200


@webauthn_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    """Проверить ответ аутентификатора и сохранить публичный ключ."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Нет данных'}), 400

    challenge = _get_challenge(user_id, 'registration')
    if challenge is None:
        return jsonify({'error': 'Challenge истёк или не найден'}), 400

    try:
        verification = verify_registration_response(
            credential=data,
            expected_challenge=challenge,
            expected_rp_id=current_app.config['WEBAUTHN_RP_ID'],
            expected_origin=current_app.config['WEBAUTHN_ORIGIN'],
        )
    except Exception as e:
        return jsonify({'error': f'Проверка не пройдена: {str(e)}'}), 400

    if WebAuthnCredential.query.filter_by(credential_id=verification.credential_id).first():
        return jsonify({'error': 'Этот ключ уже зарегистрирован'}), 409

    credential = WebAuthnCredential(
        user_id=user_id,
        credential_id=verification.credential_id,
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        device_name=data.get('device_name') or data.get('deviceName') or 'Неизвестное устройство',
    )
    db.session.add(credential)
    db.session.commit()

    return jsonify({
        'message': 'Ключ зарегистрирован',
        'credential': credential.to_dict(),
    }), 201


# ──── Вход по ключу (без пароля) ────

@webauthn_bp.route('/authenticate-options', methods=['POST'])
def authenticate_options():
    """Сгенерировать опции для navigator.credentials.get() по email/username."""
    data = request.get_json(silent=True) or {}
    user = _find_user_by_identifier(
        data.get('identifier') or data.get('username') or data.get('email')
    )
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    credentials = WebAuthnCredential.query.filter_by(user_id=user.id).all()
    if not credentials:
        return jsonify({'error': 'Нет зарегистрированных биометрических ключей'}), 404

    options = generate_authentication_options(
        rp_id=current_app.config['WEBAUTHN_RP_ID'],
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=cred.credential_id) for cred in credentials
        ],
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    _store_challenge(user.id, options.challenge, 'authentication')
    # options_to_json уже возвращает готовую JSON-строку — отдаём как есть,
    # без повторной сериализации через jsonify (иначе клиент получит строку).
    return current_app.response_class(options_to_json(options), mimetype='application/json'), 200


@webauthn_bp.route('/authenticate', methods=['POST'])
def authenticate():
    """Проверить подпись аутентификатора и выдать JWT (access + refresh)."""
    data = request.get_json(silent=True) or {}
    user = _find_user_by_identifier(
        data.get('identifier') or data.get('username') or data.get('email')
    )
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    if not user.is_active:
        return jsonify({'error': 'Аккаунт деактивирован'}), 403

    challenge = _get_challenge(user.id, 'authentication')
    if challenge is None:
        return jsonify({'error': 'Challenge истёк или не найден'}), 400

    credential_data = data.get('credential')
    if not credential_data:
        return jsonify({'error': 'Нет данных ключа'}), 400

    # rawId приходит в base64url без паддинга — дополняем перед декодом
    raw_id = base64.urlsafe_b64decode(credential_data['rawId'] + '==')
    stored = WebAuthnCredential.query.filter_by(
        credential_id=raw_id, user_id=user.id
    ).first()
    if not stored:
        return jsonify({'error': 'Ключ не найден'}), 404

    try:
        verification = verify_authentication_response(
            credential=credential_data,
            expected_challenge=challenge,
            expected_rp_id=current_app.config['WEBAUTHN_RP_ID'],
            expected_origin=current_app.config['WEBAUTHN_ORIGIN'],
            credential_public_key=stored.public_key,
            credential_current_sign_count=stored.sign_count,
        )
    except Exception as e:
        return jsonify({'error': f'Аутентификация не пройдена: {str(e)}'}), 400

    # Обновляем счётчик подписей (защита от клонирования) и время входа
    stored.sign_count = verification.new_sign_count
    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    access, refresh = _make_tokens(user)
    return jsonify({
        'user': user.to_dict(),
        'access_token': access,
        'refresh_token': refresh,
    }), 200


# ──── Управление ключами (требует JWT) ────

@webauthn_bp.route('/credentials', methods=['GET'])
@jwt_required()
def list_credentials():
    """Список биометрических ключей текущего пользователя."""
    user_id = int(get_jwt_identity())
    credentials = WebAuthnCredential.query.filter_by(user_id=user_id).all()
    return jsonify([c.to_dict() for c in credentials]), 200


@webauthn_bp.route('/credentials/<int:credential_id>', methods=['DELETE'])
@jwt_required()
def delete_credential(credential_id):
    """Удалить биометрический ключ (отвязать устройство)."""
    user_id = int(get_jwt_identity())
    credential = WebAuthnCredential.query.filter_by(
        id=credential_id, user_id=user_id
    ).first()
    if not credential:
        return jsonify({'error': 'Ключ не найден'}), 404

    db.session.delete(credential)
    db.session.commit()
    return jsonify({'message': 'Ключ удалён'}), 200
