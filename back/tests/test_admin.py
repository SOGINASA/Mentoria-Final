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
