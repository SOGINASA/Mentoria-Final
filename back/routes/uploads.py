"""Загрузка фото продукции. Файлы сохраняются в static/uploads,
наружу отдаётся публичный URL (см. отдачу в app.py)."""

import os
import uuid

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

uploads_bp = Blueprint('uploads', __name__)


def _allowed(filename):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in current_app.config['ALLOWED_IMAGE_EXTENSIONS']


def _public_url(filename):
    base = current_app.config['API_BASE_URL'].rstrip('/')
    return f"{base}/uploads/{filename}"


@uploads_bp.route('/photo', methods=['POST'])
@jwt_required()
def upload_photo():
    """Принимает multipart-форму с полем 'file'. Возвращает {url, filename}."""
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не передан (ожидается поле file)'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'Пустое имя файла'}), 400

    if not _allowed(file.filename):
        allowed = ', '.join(sorted(current_app.config['ALLOWED_IMAGE_EXTENSIONS']))
        return jsonify({'error': f'Недопустимый формат. Разрешены: {allowed}'}), 400

    ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"

    upload_dir = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)
    file.save(os.path.join(upload_dir, filename))

    return jsonify({'url': _public_url(filename), 'filename': filename}), 201
