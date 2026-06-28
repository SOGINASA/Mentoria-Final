"""Тесты API входа по биометрии (WebAuthn).

Полный криптографический раунд-трип требует виртуального аутентификатора, поэтому
здесь проверяется контракт API: авторизация, генерация опций, хранение challenge,
управление ключами. Сами verify_* из библиотеки webauthn покрыты её тестами."""

import json

from models import db, WebAuthnCredential, WebAuthnChallenge


def _seed_credential(user, credential_id=b'cred-123', device_name='iPhone'):
    """Создать ключ напрямую в БД (имитация уже зарегистрированного устройства)."""
    cred = WebAuthnCredential(
        user_id=user.id,
        credential_id=credential_id,
        public_key=b'pubkey',
        sign_count=0,
        device_name=device_name,
    )
    db.session.add(cred)
    db.session.commit()
    return cred


# ──── Регистрация ключа ────

def test_register_options_requires_auth(client):
    assert client.post('/api/auth/webauthn/register-options').status_code == 401


def test_register_options_returns_options_and_stores_challenge(client, sender, auth):
    resp = client.post('/api/auth/webauthn/register-options', headers=auth(sender))
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['challenge']                       # есть challenge для клиента
    assert data['rp']['id'] == 'localhost'         # RP из конфига
    assert data['user']['name']                    # имя пользователя проброшено
    # challenge сохранён в БД под тип 'registration'
    assert WebAuthnChallenge.query.filter_by(
        user_id=sender.id, challenge_type='registration'
    ).count() == 1


def test_register_rejects_without_challenge(client, sender, auth):
    # Вызов /register без предварительного /register-options → challenge не найден
    resp = client.post('/api/auth/webauthn/register', headers=auth(sender),
                       json={'id': 'x', 'rawId': 'x', 'response': {}, 'type': 'public-key'})
    assert resp.status_code == 400
    assert 'Challenge' in resp.get_json()['error']


# ──── Вход по ключу ────

def test_authenticate_options_unknown_user(client):
    resp = client.post('/api/auth/webauthn/authenticate-options',
                       json={'identifier': 'ghost'})
    assert resp.status_code == 404


def test_authenticate_options_no_credentials(client, sender):
    resp = client.post('/api/auth/webauthn/authenticate-options',
                       json={'identifier': 'sender1'})
    assert resp.status_code == 404
    assert 'ключ' in resp.get_json()['error'].lower()


def test_authenticate_options_returns_allow_credentials(client, sender):
    _seed_credential(sender)
    resp = client.post('/api/auth/webauthn/authenticate-options',
                       json={'identifier': 'sender1'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['challenge']
    assert len(data['allowCredentials']) == 1
    # challenge сохранён под тип 'authentication'
    assert WebAuthnChallenge.query.filter_by(
        user_id=sender.id, challenge_type='authentication'
    ).count() == 1


def test_authenticate_rejects_without_challenge(client, sender):
    _seed_credential(sender)
    resp = client.post('/api/auth/webauthn/authenticate', json={
        'identifier': 'sender1',
        'credential': {'rawId': 'Y3JlZC0xMjM'},  # base64url от 'cred-123'
    })
    assert resp.status_code == 400
    assert 'Challenge' in resp.get_json()['error']


# ──── Управление ключами ────

def test_list_credentials_requires_auth(client):
    assert client.get('/api/auth/webauthn/credentials').status_code == 401


def test_list_and_delete_credentials(client, sender, auth):
    cred = _seed_credential(sender)

    resp = client.get('/api/auth/webauthn/credentials', headers=auth(sender))
    assert resp.status_code == 200
    items = resp.get_json()
    assert len(items) == 1
    assert items[0]['device_name'] == 'iPhone'

    # удаление
    resp = client.delete(f'/api/auth/webauthn/credentials/{cred.id}', headers=auth(sender))
    assert resp.status_code == 200
    assert WebAuthnCredential.query.count() == 0


def test_delete_missing_credential(client, sender, auth):
    resp = client.delete('/api/auth/webauthn/credentials/999', headers=auth(sender))
    assert resp.status_code == 404
