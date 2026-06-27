"""Тесты аутентификации и ролей."""


def test_login_success(client, sender):
    resp = client.post('/api/auth/login', json={'identifier': 'sender1', 'password': 'secret123'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['access_token']
    assert data['user']['role'] == 'sender'


def test_login_wrong_password(client, sender):
    resp = client.post('/api/auth/login', json={'identifier': 'sender1', 'password': 'nope'})
    assert resp.status_code == 401


def test_me_requires_token(client):
    assert client.get('/api/auth/me').status_code == 401


def test_me_returns_user(client, sender, auth):
    resp = client.get('/api/auth/me', headers=auth(sender))
    assert resp.status_code == 200
    assert resp.get_json()['user']['username'] == 'sender1'


def test_sender_cannot_access_admin(client, sender, auth):
    resp = client.get('/api/admin/users', headers=auth(sender))
    assert resp.status_code == 403


def test_admin_can_list_users(client, admin, auth):
    resp = client.get('/api/admin/users', headers=auth(admin))
    assert resp.status_code == 200
    assert 'users' in resp.get_json()


def test_change_password(client, sender, auth):
    resp = client.post('/api/auth/change-password',
                       headers=auth(sender),
                       json={'current_password': 'secret123', 'new_password': 'newpass123'})
    assert resp.status_code == 200
    # старый пароль больше не работает
    assert client.post('/api/auth/login',
                       json={'identifier': 'sender1', 'password': 'secret123'}).status_code == 401
    assert client.post('/api/auth/login',
                       json={'identifier': 'sender1', 'password': 'newpass123'}).status_code == 200
