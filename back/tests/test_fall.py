"""Тесты авто-падений: создание черновика, подтверждение, уведомления, видимость."""

from io import BytesIO

# Минимальный валидный JPEG-заголовок (содержимое не важно — файл просто сохраняется)
FAKE_JPEG = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01' + b'\x00' * 32 + b'\xff\xd9'


def _fall_data(product='patty'):
    return {
        'product': product,
        'file': (BytesIO(FAKE_JPEG), 'fall.jpg'),
    }


def _post_fall(client, app, headers, tmp_path, **extra):
    app.config['UPLOAD_FOLDER'] = str(tmp_path)  # не засоряем static/uploads
    data = _fall_data()
    data.update(extra)
    return client.post('/api/write-offs/auto-fall', headers=headers,
                       data=data, content_type='multipart/form-data')


def test_auto_fall_creates_draft(client, app, sender, store, auth, tmp_path):
    resp = _post_fall(client, app, auth(sender), tmp_path)
    assert resp.status_code == 201, resp.get_json()
    wo = resp.get_json()['write_off']
    assert wo['status'] == 'draft'
    assert wo['source'] == 'auto_fall'
    assert len(wo['photos']) == 1
    # en->ru маппинг делает ML-сторона (product_ru); сюда передан только 'patty'
    assert wo['items'][0]['product_name'] == 'patty'


def test_auto_fall_requires_store(client, app, reviewer, auth, tmp_path):
    # отправитель без точки
    from models import db, User
    from constants import ROLE_SENDER
    u = User(username='cam_nostore', full_name='Cam', role=ROLE_SENDER, store_id=None)
    u.set_password('secret123')
    db.session.add(u)
    db.session.commit()
    resp = _post_fall(client, app, auth(u), tmp_path)
    assert resp.status_code == 400


def test_auto_fall_notifies_author(client, app, sender, store, auth, tmp_path):
    _post_fall(client, app, auth(sender), tmp_path)
    resp = client.get('/api/notifications', headers=auth(sender))
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['unread'] == 1
    assert body['notifications'][0]['kind'] == 'fall_draft'


def test_reviewer_does_not_see_draft(client, app, sender, reviewer, store, auth, tmp_path):
    _post_fall(client, app, auth(sender), tmp_path)
    resp = client.get('/api/write-offs', headers=auth(reviewer))
    assert resp.get_json()['pagination']['total'] == 0


def test_sender_sees_own_draft(client, app, sender, store, auth, tmp_path):
    _post_fall(client, app, auth(sender), tmp_path)
    resp = client.get('/api/write-offs', headers=auth(sender))
    assert resp.get_json()['pagination']['total'] == 1
    assert resp.get_json()['write_offs'][0]['status'] == 'draft'


def test_auto_fall_alerts_admin_and_reviewer(client, app, sender, reviewer, admin, store, auth, tmp_path):
    """Падение сразу уведомляет админа и проверяющего (надзор), не дожидаясь
    подтверждения сотрудником."""
    _post_fall(client, app, auth(sender), tmp_path)

    for user in (reviewer, admin):
        notes = client.get('/api/notifications?unread=1', headers=auth(user)).get_json()
        assert notes['unread'] == 1, user.username
        assert notes['notifications'][0]['kind'] == 'fall_alert'
        # уведомление ведёт прямо в карточку заявки
        assert notes['notifications'][0]['write_off_id'] is not None


def test_confirm_draft_goes_pending_and_notifies_reviewer(client, app, sender, reviewer, store, auth, tmp_path):
    wo_id = _post_fall(client, app, auth(sender), tmp_path).get_json()['write_off']['id']

    resp = client.post(f'/api/write-offs/{wo_id}/confirm', headers=auth(sender),
                       json={'comment': 'Котлета упала на пол, к продаже непригодна'})
    assert resp.status_code == 200
    assert resp.get_json()['write_off']['status'] == 'pending'

    # теперь проверяющий видит заявку и получил уведомление
    lst = client.get('/api/write-offs', headers=auth(reviewer))
    assert lst.get_json()['pagination']['total'] == 1

    # у проверяющего теперь два уведомления: алерт о падении + заявка на проверку,
    # самое свежее (review_pending) — сверху
    notes = client.get('/api/notifications?unread=1', headers=auth(reviewer)).get_json()
    assert notes['unread'] == 2
    assert notes['notifications'][0]['kind'] == 'review_pending'


def test_confirm_only_author(client, app, sender, store, auth, tmp_path):
    wo_id = _post_fall(client, app, auth(sender), tmp_path).get_json()['write_off']['id']
    from models import db, User
    from constants import ROLE_SENDER
    other = User(username='sender_other', full_name='Other', role=ROLE_SENDER, store_id=store.id)
    other.set_password('secret123')
    db.session.add(other)
    db.session.commit()
    resp = client.post(f'/api/write-offs/{wo_id}/confirm', headers=auth(other))
    assert resp.status_code == 403


def test_double_confirm_conflict(client, app, sender, store, auth, tmp_path):
    wo_id = _post_fall(client, app, auth(sender), tmp_path).get_json()['write_off']['id']
    client.post(f'/api/write-offs/{wo_id}/confirm', headers=auth(sender))
    resp = client.post(f'/api/write-offs/{wo_id}/confirm', headers=auth(sender))
    assert resp.status_code == 409


def test_mark_notification_read(client, app, sender, store, auth, tmp_path):
    _post_fall(client, app, auth(sender), tmp_path)
    notes = client.get('/api/notifications', headers=auth(sender)).get_json()
    nid = notes['notifications'][0]['id']
    client.post(f'/api/notifications/{nid}/read', headers=auth(sender))
    assert client.get('/api/notifications/unread-count', headers=auth(sender)).get_json()['unread'] == 0
