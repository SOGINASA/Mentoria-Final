"""Тесты админ-эндпоинтов: видимость деактивированных точек/сотрудников."""


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
