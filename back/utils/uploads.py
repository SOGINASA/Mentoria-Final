"""Сохранение загружаемых изображений в static/uploads.
Общий код для роута загрузки (routes/uploads.py) и авто-падений
(routes/writeoffs.py: создание черновика со скриншотом кадра)."""

import os
import uuid

from flask import current_app
from werkzeug.utils import secure_filename


def allowed_file(filename):
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in current_app.config['ALLOWED_IMAGE_EXTENSIONS']


def public_url(filename):
    """Абсолютный URL для отдачи фото (см. serve_upload в app.py)."""
    base = current_app.config['API_BASE_URL'].rstrip('/')
    return f"{base}/uploads/{filename}"


def save_image_file(file):
    """Сохраняет werkzeug FileStorage в папку загрузок.
    Возвращает (url, filename). Бросает ValueError при пустом/недопустимом файле."""
    if not file or file.filename == '':
        raise ValueError('Пустое имя файла')
    if not allowed_file(file.filename):
        allowed = ', '.join(sorted(current_app.config['ALLOWED_IMAGE_EXTENSIONS']))
        raise ValueError(f'Недопустимый формат. Разрешены: {allowed}')

    ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"

    upload_dir = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)
    file.save(os.path.join(upload_dir, filename))
    return public_url(filename), filename
