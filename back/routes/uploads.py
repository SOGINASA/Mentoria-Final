"""Загрузка фото продукции. Файлы сохраняются в static/uploads,
наружу отдаётся публичный URL (см. отдачу в app.py).

Распознавание (тип продукта + испорченность) — отдельный шаг. По умолчанию
загрузка НЕ ждёт инференс модели (это медленно): клиент отправляет recognize=0,
получает url мгновенно и запрашивает вердикт ИИ фоново через /uploads/recognize.
Без recognize=0 распознавание идёт синхронно (обратная совместимость)."""

import os

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

from utils.uploads import save_image_file
from services import recognition

uploads_bp = Blueprint('uploads', __name__)


def _truthy(v, default=False):
    if v is None:
        return default
    return str(v).strip().lower() not in ('0', 'false', 'no', '')


@uploads_bp.route('/photo', methods=['POST'])
@jwt_required()
def upload_photo():
    """Принимает multipart-форму с полем 'file'.
    Поле 'recognize' (опц.): '0' → пропустить инференс (быстро), вердикт ИИ
    запрашивается отдельно через /uploads/recognize.
    Возвращает {url, filename, recognition}. recognition = None, если
    распознавание отложено/выключено/недоступно (загрузка при этом не ломается)."""
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не передан (ожидается поле file)'}), 400

    try:
        url, filename = save_image_file(request.files['file'])
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    result = None
    # Быстрая загрузка — режим по умолчанию. Инференс запускается только по
    # явному recognize=1; отсутствие/потеря multipart-поля больше не способно
    # подвесить upload на десятки секунд.
    if _truthy(request.form.get('recognize'), default=False):
        # Синхронный режим (best-effort: ошибки не должны рушить загрузку).
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        result = recognition.recognize(file_path)

    return jsonify({'url': url, 'filename': filename, 'recognition': result}), 201


@uploads_bp.route('/recognize', methods=['POST'])
@jwt_required()
def recognize_photo():
    """Прогоняет уже загруженный файл через модели распознавания.
    Тело (JSON): {filename}. Возвращает {recognition} (или null, если ИИ
    недоступен/файла нет). Вызывается фоново после быстрой загрузки."""
    data = request.get_json(silent=True) or {}
    filename = os.path.basename((data.get('filename') or '').strip())
    if not filename:
        return jsonify({'error': 'Не указан filename'}), 400

    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    if not os.path.isfile(file_path):
        return jsonify({'error': 'Файл не найден'}), 404

    result = recognition.recognize(file_path)
    return jsonify({'recognition': result})
