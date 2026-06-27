"""Загрузка фото продукции. Файлы сохраняются в static/uploads,
наружу отдаётся публичный URL (см. отдачу в app.py).

При загрузке фото сразу прогоняется через модели распознавания (тип продукта +
испорченность) — результат возвращается в поле recognition, чтобы фронт мог
показать подсказку и автозаполнить причину списания."""

import os

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

from utils.uploads import save_image_file
from services import recognition

uploads_bp = Blueprint('uploads', __name__)


@uploads_bp.route('/photo', methods=['POST'])
@jwt_required()
def upload_photo():
    """Принимает multipart-форму с полем 'file'.
    Возвращает {url, filename, recognition}. recognition = None, если
    распознавание выключено/недоступно (загрузка при этом не ломается)."""
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не передан (ожидается поле file)'}), 400

    try:
        url, filename = save_image_file(request.files['file'])
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    # Распознавание (best-effort: ошибки не должны рушить загрузку).
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    result = recognition.recognize(file_path)

    return jsonify({'url': url, 'filename': filename, 'recognition': result}), 201
