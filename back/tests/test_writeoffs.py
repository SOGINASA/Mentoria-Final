"""Тесты заявок на списание: создание, валидация, approve/reject, Iiko, доступ."""


def _create_payload(store, employee=None, wo_type='no_deduction'):
    payload = {
        'store_id': store.id,
        'type': wo_type,
        'comment': 'Помятые булочки, продать нельзя',
        'photo_urls': ['http://localhost:5252/uploads/test.jpg'],
    }
    if wo_type == 'with_deduction' and employee:
        payload['deduction_employee_id'] = employee.id
    return payload


def test_create_write_off(client, sender, store, auth):
    resp = client.post('/api/write-offs', headers=auth(sender), json=_create_payload(store))
    assert resp.status_code == 201
    wo = resp.get_json()['write_off']
    assert wo['status'] == 'pending'
    assert wo['type'] == 'no_deduction'
    assert len(wo['photos']) == 1


def test_create_requires_min_comment(client, sender, store, auth):
    payload = _create_payload(store)
    payload['comment'] = 'кратко'  # < 10 символов
    resp = client.post('/api/write-offs', headers=auth(sender), json=payload)
    assert resp.status_code == 400


def test_create_requires_photo(client, sender, store, auth):
    payload = _create_payload(store)
    payload['photo_urls'] = []
    resp = client.post('/api/write-offs', headers=auth(sender), json=payload)
    assert resp.status_code == 400


def test_with_deduction_requires_employee(client, sender, store, auth):
    payload = _create_payload(store, wo_type='with_deduction')  # без employee
    resp = client.post('/api/write-offs', headers=auth(sender), json=payload)
    assert resp.status_code == 400


def test_with_deduction_ok(client, sender, store, employee, auth):
    payload = _create_payload(store, employee=employee, wo_type='with_deduction')
    resp = client.post('/api/write-offs', headers=auth(sender), json=payload)
    assert resp.status_code == 201
    assert resp.get_json()['write_off']['deduction_employee_id'] == employee.id


def test_reviewer_cannot_create(client, reviewer, store, auth):
    resp = client.post('/api/write-offs', headers=auth(reviewer), json=_create_payload(store))
    assert resp.status_code == 403


def test_approve_creates_iiko_act(client, sender, reviewer, store, auth):
    created = client.post('/api/write-offs', headers=auth(sender), json=_create_payload(store))
    wo_id = created.get_json()['write_off']['id']

    resp = client.post(f'/api/write-offs/{wo_id}/approve', headers=auth(reviewer))
    assert resp.status_code == 200
    wo = resp.get_json()['write_off']
    assert wo['status'] == 'approved'
    assert wo['iiko_sync_status'] == 'synced'
    assert wo['iiko_act_id'].startswith('MOCK-ACT-')


def test_double_approve_conflict(client, sender, reviewer, store, auth):
    wo_id = client.post('/api/write-offs', headers=auth(sender),
                        json=_create_payload(store)).get_json()['write_off']['id']
    client.post(f'/api/write-offs/{wo_id}/approve', headers=auth(reviewer))
    resp = client.post(f'/api/write-offs/{wo_id}/approve', headers=auth(reviewer))
    assert resp.status_code == 409


def test_reject_requires_reason(client, sender, reviewer, store, auth):
    wo_id = client.post('/api/write-offs', headers=auth(sender),
                        json=_create_payload(store)).get_json()['write_off']['id']
    resp = client.post(f'/api/write-offs/{wo_id}/reject', headers=auth(reviewer),
                       json={'rejection_reason': 'нет'})
    assert resp.status_code == 400


def test_reject_ok(client, sender, reviewer, store, auth):
    wo_id = client.post('/api/write-offs', headers=auth(sender),
                        json=_create_payload(store)).get_json()['write_off']['id']
    resp = client.post(f'/api/write-offs/{wo_id}/reject', headers=auth(reviewer),
                       json={'rejection_reason': 'Фото не подтверждает списание'})
    assert resp.status_code == 200
    assert resp.get_json()['write_off']['status'] == 'rejected'


def test_sender_sees_only_own(client, sender, reviewer, store, auth):
    # sender создаёт заявку
    client.post('/api/write-offs', headers=auth(sender), json=_create_payload(store))
    # второй отправитель
    from models import db, User
    from constants import ROLE_SENDER
    other = User(username='sender2', full_name='S2', role=ROLE_SENDER, store_id=store.id)
    other.set_password('secret123')
    db.session.add(other)
    db.session.commit()

    resp = client.get('/api/write-offs', headers=auth(other))
    assert resp.status_code == 200
    assert resp.get_json()['pagination']['total'] == 0


def test_reviewer_sees_all(client, sender, reviewer, store, auth):
    client.post('/api/write-offs', headers=auth(sender), json=_create_payload(store))
    resp = client.get('/api/write-offs', headers=auth(reviewer))
    assert resp.get_json()['pagination']['total'] == 1


def test_stats(client, sender, reviewer, store, auth):
    client.post('/api/write-offs', headers=auth(sender), json=_create_payload(store))
    resp = client.get('/api/write-offs/stats', headers=auth(sender))
    data = resp.get_json()
    assert data['pending'] == 1
    assert data['total'] == 1


def test_analytics_aggregates(client, sender, reviewer, store, employee, auth):
    # две заявки: одна с удержанием, одну подтверждаем
    client.post('/api/write-offs', headers=auth(sender), json=_create_payload(store))
    wo2 = client.post('/api/write-offs', headers=auth(sender),
                      json=_create_payload(store, employee=employee, wo_type='with_deduction'))
    client.post(f"/api/write-offs/{wo2.get_json()['write_off']['id']}/approve", headers=auth(reviewer))

    resp = client.get('/api/write-offs/analytics', headers=auth(reviewer))
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['totals']['total'] == 2
    assert data['totals']['approved'] == 1
    assert data['with_hold'] == 1
    assert data['no_hold'] == 1
    assert data['loss_total'] == 2 * data['avg_loss']
    # топ точек и сотрудников
    assert data['by_store'][0]['name'] == store.name
    assert data['by_store'][0]['count'] == 2
    assert data['by_employee'][0]['name'] == employee.full_name
    assert data['by_employee'][0]['count'] == 1
    # тренд по умолчанию — 7 дней, сегодня есть списания
    assert len(data['trend']) == 7
    assert data['trend'][-1]['count'] == 2


def test_analytics_days_param(client, sender, store, reviewer, auth):
    resp = client.get('/api/write-offs/analytics?days=30', headers=auth(reviewer))
    assert resp.status_code == 200
    assert len(resp.get_json()['trend']) == 30


def test_analytics_forbidden_for_sender(client, sender, auth):
    resp = client.get('/api/write-offs/analytics', headers=auth(sender))
    assert resp.status_code == 403


def test_sender_cannot_view_others_detail(client, sender, store, auth):
    wo_id = client.post('/api/write-offs', headers=auth(sender),
                        json=_create_payload(store)).get_json()['write_off']['id']
    from models import db, User
    from constants import ROLE_SENDER
    other = User(username='sender3', full_name='S3', role=ROLE_SENDER, store_id=store.id)
    other.set_password('secret123')
    db.session.add(other)
    db.session.commit()

    resp = client.get(f'/api/write-offs/{wo_id}', headers=auth(other))
    assert resp.status_code == 403
