"""Тесты аутентификации и ролей."""

from constants import ROLE_MANAGER


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


def test_manager_account_requires_credentials_and_store(client, admin, store, auth):
    missing_password = client.post('/api/admin/users', headers=auth(admin), json={
        'username': 'manager.new', 'full_name': 'Новый менеджер',
        'role': ROLE_MANAGER, 'store_id': store.id,
    })
    assert missing_password.status_code == 400

    missing_store = client.post('/api/admin/users', headers=auth(admin), json={
        'username': 'manager.new', 'password': 'secret123',
        'full_name': 'Новый менеджер', 'role': ROLE_MANAGER,
    })
    assert missing_store.status_code == 400

    created = client.post('/api/admin/users', headers=auth(admin), json={
        'username': 'manager.new', 'password': 'secret123',
        'full_name': 'Новый менеджер', 'role': ROLE_MANAGER, 'store_id': store.id,
    })
    assert created.status_code == 201
    assert created.get_json()['user']['role'] == ROLE_MANAGER

    # Сквозной контракт: созданные администратором данные сразу подходят для
    # входа, а выданный токен открывает scoped-кабинет менеджера.
    login = client.post('/api/auth/login', json={
        'identifier': 'manager.new', 'password': 'secret123',
    })
    assert login.status_code == 200
    login_data = login.get_json()
    assert login_data['user']['role'] == ROLE_MANAGER
    manager_headers = {'Authorization': f"Bearer {login_data['access_token']}"}

    me = client.get('/api/auth/me', headers=manager_headers)
    assert me.status_code == 200
    assert 'manager.queue' in me.get_json()['permissions']
    assert me.get_json()['scopes']['store_ids'] == [store.id]

    workspace = client.get('/api/manager/workspace', headers=manager_headers)
    assert workspace.status_code == 200
    assert [item['id'] for item in workspace.get_json()['stores']] == [store.id]


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
