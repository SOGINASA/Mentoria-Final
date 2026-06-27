"""Загрузка фото продукции. Файлы сохраняются в static/uploads,
наружу отдаётся публичный URL (см. отдачу в app.py)."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from utils.uploads import save_image_file

uploads_bp = Blueprint('uploads', __name__)


@uploads_bp.route('/photo', methods=['POST'])
@jwt_required()
def upload_photo():
    """Принимает multipart-форму с полем 'file'. Возвращает {url, filename}."""
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не передан (ожидается поле file)'}), 400

    try:
        url, filename = save_image_file(request.files['file'])
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({'url': url, 'filename': filename}), 201
