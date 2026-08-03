"""Регрессии быстрой загрузки фото."""

import io


def test_photo_upload_does_not_wait_for_recognition_by_default(
    client, sender, auth, monkeypatch,
):
    """Отсутствие recognize не должно запускать тяжёлый YOLO-инференс."""
    called = False

    monkeypatch.setattr(
        'routes.uploads.save_image_file',
        lambda _file: ('http://localhost:5252/uploads/test.jpg', 'test.jpg'),
    )

    def recognize(_path):
        nonlocal called
        called = True
        return {'detected_items': []}

    monkeypatch.setattr('routes.uploads.recognition.recognize', recognize)
    response = client.post(
        '/api/uploads/photo',
        headers=auth(sender),
        data={'file': (io.BytesIO(b'jpeg'), 'photo.jpg')},
        content_type='multipart/form-data',
    )

    assert response.status_code == 201
    assert response.get_json()['recognition'] is None
    assert called is False


def test_photo_upload_can_explicitly_request_recognition(
    client, sender, auth, monkeypatch, tmp_path, app,
):
    monkeypatch.setattr(
        'routes.uploads.save_image_file',
        lambda _file: ('http://localhost:5252/uploads/test.jpg', 'test.jpg'),
    )
    app.config['UPLOAD_FOLDER'] = str(tmp_path)
    (tmp_path / 'test.jpg').write_bytes(b'jpeg')
    monkeypatch.setattr(
        'routes.uploads.recognition.recognize',
        lambda _path: {'detected_items': []},
    )

    response = client.post(
        '/api/uploads/photo',
        headers=auth(sender),
        data={'file': (io.BytesIO(b'jpeg'), 'photo.jpg'), 'recognize': '1'},
        content_type='multipart/form-data',
    )

    assert response.status_code == 201
    assert response.get_json()['recognition'] == {'detected_items': []}
