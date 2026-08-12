"""Тесты административных эндпоинтов и системных настроек."""

from constants import ROLE_SENDER
from models import User, db
from platform_models import AuditEvent


def test_admin_stores_include_inactive(client, admin, store, auth):
    h = auth(admin)
    # деактивируем точку
    assert client.delete(f'/api/admin/stores/{store.id}', headers=h).status_code == 200

    # публичный список (для формы создания) — деактивированной точки нет
    public = client.get('/api/stores', headers=h).get_json()['stores']
    assert all(s['id'] != store.id for s in public)

    # админский список — точка присутствует и помечена неактивной
    admin_list = client.get('/api/admin/stores', headers=h).get_json()['stores']
    found = [s for s in admin_list if s['id'] == store.id]
    assert found and found[0]['is_active'] is False


def test_admin_can_reactivate_store(client, admin, store, auth):
    h = auth(admin)
    client.delete(f'/api/admin/stores/{store.id}', headers=h)
    resp = client.put(f'/api/admin/stores/{store.id}', headers=h, json={'is_active': True})
    assert resp.status_code == 200
    assert resp.get_json()['store']['is_active'] is True


def test_admin_employees_include_inactive(client, admin, employee, auth):
    h = auth(admin)
    client.delete(f'/api/admin/employees/{employee.id}', headers=h)

    public = client.get('/api/stores/employees', headers=h).get_json()['employees']
    assert all(e['id'] != employee.id for e in public)

    admin_list = client.get('/api/admin/employees', headers=h).get_json()['employees']
    found = [e for e in admin_list if e['id'] == employee.id]
    assert found and found[0]['is_active'] is False


def test_admin_list_requires_admin_role(client, reviewer, auth):
    # проверяющий не имеет доступа к админским спискам
    assert client.get('/api/admin/stores', headers=auth(reviewer)).status_code == 403
    assert client.get('/api/admin/employees', headers=auth(reviewer)).status_code == 403


def test_admin_platform_overview_returns_system_facts(client, admin, sender, store, auth):
    response = client.get('/api/admin/platform/overview', headers=auth(admin))
    assert response.status_code == 200
    data = response.get_json()
    assert data['users']['total'] >= 2
    assert data['users']['by_role']['admin'] >= 1
    assert data['stores']['total'] >= 1
    assert data['features']['available'] >= 8
    assert data['integrations'][0]['key'] == 'iiko'
    assert isinstance(data['issues'], list)


def test_admin_feature_flags_include_defaults_without_database_rows(client, admin, auth):
    response = client.get('/api/admin/platform/feature-flags', headers=auth(admin))
    assert response.status_code == 200
    flags = {item['key']: item for item in response.get_json()['feature_flags']}
    assert flags['staff_platform']['enabled_by_default'] is True
    assert flags['income']['enabled_by_default'] is False
    assert flags['income']['description']


def test_admin_audit_supports_filters_and_enriched_actor(client, admin, auth):
    client.put('/api/admin/platform/feature-flags/tasks', headers=auth(admin), json={
        'enabled_by_default': False,
    })
    response = client.get('/api/admin/platform/audit?action=feature_flag', headers=auth(admin))
    assert response.status_code == 200
    data = response.get_json()
    assert data['pagination']['total'] == 1
    assert data['events'][0]['actor_name'] == admin.full_name
    assert data['events'][0]['action'] == 'feature_flag.updated'


def test_admin_can_update_clear_and_validate_user_email(client, admin, sender, auth):
    headers = auth(admin)

    updated = client.put(f'/api/admin/users/{sender.id}', headers=headers, json={
        'email': 'New.Address@Bahandi.KZ',
    })
    assert updated.status_code == 200
    assert updated.get_json()['user']['email'] == 'new.address@bahandi.kz'

    duplicate = User(username='other-sender', full_name='Другой сотрудник',
                     role=ROLE_SENDER, store_id=sender.store_id,
                     email='occupied@bahandi.kz')
    duplicate.set_password('secret123')
    db.session.add(duplicate)
    db.session.commit()
    response = client.put(f'/api/admin/users/{sender.id}', headers=headers,
                          json={'email': 'occupied@bahandi.kz'})
    assert response.status_code == 400

    cleared = client.put(f'/api/admin/users/{sender.id}', headers=headers, json={'email': ''})
    assert cleared.status_code == 200
    assert cleared.get_json()['user']['email'] is None


def test_admin_cannot_deactivate_or_demote_own_account(client, admin, auth):
    headers = auth(admin)
    assert client.delete(f'/api/admin/users/{admin.id}', headers=headers).status_code == 400
    response = client.put(f'/api/admin/users/{admin.id}', headers=headers, json={
        'role': ROLE_SENDER, 'store_id': 1,
    })
    assert response.status_code == 400
    db.session.refresh(admin)
    assert admin.is_active is True
    assert admin.role == 'admin'


def test_admin_crud_is_recorded_in_audit_log(client, admin, auth):
    response = client.post('/api/admin/stores', headers=auth(admin), json={
        'name': 'Новая точка',
    })
    assert response.status_code == 201
    store_id = response.get_json()['store']['id']
    event = AuditEvent.query.filter_by(action='admin.store_created', entity_id=store_id).one()
    assert event.actor_id == admin.id
    assert event.store_id == store_id


def test_disabled_feature_blocks_its_backend(client, admin, sender, auth):
    response = client.put('/api/admin/platform/feature-flags/tasks', headers=auth(admin), json={
        'enabled_by_default': False,
    })
    assert response.status_code == 200
    blocked = client.get('/api/tasks', headers=auth(sender))
    assert blocked.status_code == 403
    assert blocked.get_json()['feature'] == 'tasks'


def test_overview_does_not_claim_unimplemented_iiko_is_connected(
        app, client, admin, auth):
    app.config.update(IIKO_MODE='real', IIKO_BASE_URL='https://iiko.example.test')
    response = client.get('/api/admin/platform/overview', headers=auth(admin))
    integration = response.get_json()['integrations'][0]
    assert integration['status'] == 'unavailable'
    assert 'не реализована' in integration['detail']
