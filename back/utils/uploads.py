"""Сохранение загружаемых изображений в static/uploads.
Общий код для роута загрузки (routes/uploads.py) и авто-падений
(routes/writeoffs.py: создание черновика со скриншотом кадра)."""

import os
import uuid

from flask import current_app


def allowed_file(filename):
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in current_app.config['ALLOWED_IMAGE_EXTENSIONS']


def public_url(filename):
    """Абсолютный URL для отдачи фото (см. serve_upload в app.py)."""
    base = current_app.config['API_BASE_URL'].rstrip('/')
    return f"{base}/uploads/{filename}"


def normalize_photo_url(url):
    """Пересобирает ссылку на НАШЕ фото от текущего API_BASE_URL.

    В БД лежит абсолютный URL, собранный из API_BASE_URL на момент загрузки.
    Если адрес бэка поменялся (домен, порт, префикс за nginx) — все старые
    строки начинают указывать «в никуда», и фото перестают открываться.
    Причём молча: за фронтовым nginx с SPA-фолбэком такой запрос вернёт 200 и
    index.html, браузер покажет битую картинку и НИЧЕГО не напишет в консоль.
    Поэтому на выдаче берём из ссылки только имя файла и клеим актуальную базу.

    Чужие ссылки (демо-заглушки placehold.co и т.п.) не трогаем — у них нет
    сегмента /uploads/.
    """
    if not url:
        return url
    marker = '/uploads/'
    idx = url.rfind(marker)
    if idx == -1:
        return url
    filename = url[idx + len(marker):].split('?', 1)[0].split('#', 1)[0]
    if not filename or '/' in filename:
        return url
    return public_url(filename)


def save_image_file(file):
    """Сохраняет werkzeug FileStorage в папку загрузок.
    Возвращает (url, filename). Бросает ValueError при пустом/недопустимом файле."""
    if not file or file.filename == '':
        raise ValueError('Пустое имя файла')
    if not allowed_file(file.filename):
        allowed = ', '.join(sorted(current_app.config['ALLOWED_IMAGE_EXTENSIONS']))
        raise ValueError(f'Недопустимый формат. Разрешены: {allowed}')

    # Расширение берём из ИСХОДНОГО имени: оно уже прошло allowed_file() и входит
    # в белый список (значит безопасно). secure_filename здесь применять нельзя —
    # для имён на кириллице он вырезает все не-ASCII символы и вместе с ними может
    # убить расширение ('фото.jpg' -> 'jpg'), из-за чего rsplit('.')[1] падал.
    # Итоговое имя всё равно генерим как UUID, исходное имя не сохраняем.
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"

    upload_dir = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)
    file.save(os.path.join(upload_dir, filename))
    return public_url(filename), filename
