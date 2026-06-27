"""Распознавание продукции на фото: тип (детектор) + испорченность (классификатор).

Двухступенчатый пайплайн на двух YOLOv8-моделях (логика из ml/inference_pipeline.py,
адаптированная под бэкенд: модели грузятся ОДИН раз и переиспользуются):
    1. Детектор  → bbox + класс продукта (patty / bun / tomato / potato ...)
    2. Классификатор каждого crop'а → состояние (good / defect / spoiled)
    3. Формирование подсказок по списанию (нужно ли списывать + причина)

Всё best-effort: если ultralytics/torch не установлены, веса не найдены или
инференс упал — функция возвращает None, и загрузка фото работает как раньше,
просто без подсказок ИИ.
"""

import logging
import threading

from flask import current_app

log = logging.getLogger(__name__)

# Причины списания — автоматически предлагаются на основе (продукт, состояние).
WRITEOFF_REASONS = {
    ("tomato", "spoiled"): "Помидор не соответствует стандартам (несвежий)",
    ("tomato", "defect"):  "Помидор повреждён (помятый/деформированный)",
    ("patty",  "defect"):  "Котлета не пригодна (упала/повреждена по санитарным нормам)",
    ("patty",  "spoiled"): "Котлета не пригодна к повторному использованию",
    ("bun",    "defect"):  "Булочка повреждена (помятая/деформированная)",
    ("bun",    "spoiled"): "Булочка не соответствует стандартам",
    ("potato", "spoiled"): "Картофель не соответствует стандартам качества",
    ("potato", "defect"):  "Картофель повреждён",
}

PRODUCT_NAMES_RU = {
    "patty":   "Котлета",
    "bun":     "Булочка",
    "tomato":  "Помидор",
    "onion":   "Лук",
    "cheese":  "Сыр",
    "lettuce": "Салат",
    "potato":  "Картофель",
}

BAD_STATES = ("defect", "spoiled")

# Кэш загруженных моделей. Грузим лениво и под локом — модели тяжёлые,
# параллельная загрузка двух одинаковых не нужна.
_detector = None
_classifier = None
_load_lock = threading.Lock()
# Один воркер gunicorn запускается с --threads 8; одну YOLO-модель нельзя гонять
# из нескольких потоков одновременно — сериализуем сам инференс этим локом.
_infer_lock = threading.Lock()
_load_failed = False  # один раз не смогли загрузить → больше не пытаемся


def is_enabled():
    return bool(current_app.config.get('RECOGNITION_ENABLED'))


def _load_models():
    """Лениво загружает обе модели. Возвращает (detector, classifier) или
    (None, None), если недоступно. Потокобезопасно."""
    global _detector, _classifier, _load_failed
    if _detector is not None and _classifier is not None:
        return _detector, _classifier
    if _load_failed:
        return None, None

    with _load_lock:
        if _detector is not None and _classifier is not None:
            return _detector, _classifier
        if _load_failed:
            return None, None

        det_path = current_app.config['DETECTOR_MODEL_PATH']
        cls_path = current_app.config['CLASSIFIER_MODEL_PATH']
        try:
            import os
            if not os.path.exists(det_path) or not os.path.exists(cls_path):
                log.warning('Распознавание выключено: веса не найдены (детектор=%s, классификатор=%s)',
                            det_path, cls_path)
                _load_failed = True
                return None, None
            from ultralytics import YOLO
            log.info('Загрузка моделей распознавания: %s, %s', det_path, cls_path)
            _detector = YOLO(det_path)
            _classifier = YOLO(cls_path)
            return _detector, _classifier
        except Exception as e:  # ultralytics/torch не установлены или битые веса
            log.warning('Не удалось загрузить модели распознавания: %s', e)
            _load_failed = True
            return None, None


def recognize(image_path):
    """Прогоняет фото через детектор + классификатор. Возвращает dict в формате
    ответа API (см. ниже) или None, если распознавание недоступно/упало.

    Формат:
        {
          "detected_items": [
            {product, state, requires_writeoff, suggested_reason, confidence}, ...
          ],
          "writeoff_required": bool,
          "total_detected": int,
          "total_for_writeoff": int,
          "suggested_reason": str | None   # причина для самого уверенного «плохого»
        }
    """
    if not is_enabled():
        return None

    detector, classifier = _load_models()
    if detector is None or classifier is None:
        return None

    try:
        from PIL import Image
        conf = current_app.config.get('RECOGNITION_CONF', 0.3)
        image = Image.open(image_path).convert('RGB')

        items = []
        with _infer_lock:  # сериализуем доступ к моделям внутри воркера
            det_results = detector(image_path, conf=conf, verbose=False)
            for result in det_results:
                names = result.names  # {idx: class_name}
                for box in result.boxes:
                    cls_idx = int(box.cls[0])
                    product = names[cls_idx]
                    conf_det = float(box.conf[0])
                    x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]

                    crop = image.crop((x1, y1, x2, y2))
                    state_res = classifier(crop, verbose=False)[0]
                    probs = state_res.probs
                    state = state_res.names[int(probs.top1)]
                    conf_state = float(probs.top1conf)

                    requires = state in BAD_STATES
                    reason = WRITEOFF_REASONS.get((product, state)) if requires else None
                    items.append({
                        'product': PRODUCT_NAMES_RU.get(product, product),
                        'product_key': product,
                        'state': state,
                        'requires_writeoff': requires,
                        'suggested_reason': reason,
                        'confidence': round((conf_det + conf_state) / 2, 3),
                    })

        # «Плохие» — вперёд, по убыванию уверенности.
        items.sort(key=lambda it: (it['requires_writeoff'], it['confidence']), reverse=True)

        bad = [it for it in items if it['requires_writeoff']]
        top_reason = next((it['suggested_reason'] for it in bad if it['suggested_reason']), None)

        return {
            'detected_items': items,
            'writeoff_required': bool(bad),
            'total_detected': len(items),
            'total_for_writeoff': len(bad),
            'suggested_reason': top_reason,
        }
    except Exception as e:
        log.warning('Ошибка распознавания фото %s: %s', image_path, e)
        return None
