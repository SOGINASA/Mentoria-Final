"""Product recognition using the single YOLO detector in ``ml/best.pt``."""

import logging
import os
import threading

import yaml
from flask import current_app

log = logging.getLogger(__name__)

PRODUCT_NAMES_RU = {
    "lettuce": "Салат",
    "onion": "Лук",
    "pickle": "Маринованный огурец",
    "tomato": "Помидор",
}

_model = None
_load_lock = threading.Lock()
_infer_lock = threading.Lock()
_load_failed = False


def is_enabled():
    return bool(current_app.config.get("RECOGNITION_ENABLED"))


def _classes_from_yaml(path):
    """Read the canonical class list from data.yaml."""
    with open(path, "r", encoding="utf-8") as stream:
        data = yaml.safe_load(stream) or {}
    names = data.get("names")
    if isinstance(names, dict):
        names = [names[key] for key in sorted(names, key=lambda value: int(value))]
    if not isinstance(names, list) or not names:
        raise ValueError("data.yaml must contain a non-empty 'names' list")
    if data.get("nc") is not None and int(data["nc"]) != len(names):
        raise ValueError("data.yaml 'nc' does not match the number of names")
    return [str(name) for name in names]


def _load_model():
    """Load and cache only the new detector, validating its classes against data.yaml."""
    global _model, _load_failed
    if _model is not None:
        return _model
    if _load_failed:
        return None

    with _load_lock:
        if _model is not None:
            return _model
        if _load_failed:
            return None

        model_path = current_app.config["RECOGNITION_MODEL_PATH"]
        data_path = current_app.config["RECOGNITION_DATA_PATH"]
        try:
            if not os.path.isfile(model_path) or not os.path.isfile(data_path):
                raise FileNotFoundError(f"model={model_path}, data={data_path}")

            from ultralytics import YOLO

            model = YOLO(model_path)
            yaml_names = _classes_from_yaml(data_path)
            model_names = [str(model.names[index]) for index in sorted(model.names)]
            if model_names != yaml_names:
                raise ValueError(
                    f"model classes {model_names!r} do not match data.yaml {yaml_names!r}"
                )
            _model = model
            log.info("Loaded recognition model %s with classes %s", model_path, yaml_names)
            return _model
        except Exception as exc:
            log.warning("Product recognition is unavailable: %s", exc)
            _load_failed = True
            return None


def recognize(image_path):
    """Detect products and return the existing upload API response shape.

    The new model detects ingredient classes only; it does not classify freshness.
    Consequently ``state`` is ``detected`` and no write-off decision is fabricated.
    """
    if not is_enabled():
        return None

    model = _load_model()
    if model is None:
        return None

    try:
        confidence = current_app.config.get("RECOGNITION_CONF", 0.3)
        items = []
        with _infer_lock:
            results = model(image_path, conf=confidence, verbose=False)
            for result in results:
                for box in result.boxes:
                    class_index = int(box.cls[0])
                    class_name = str(result.names[class_index])
                    class_key = class_name.casefold()
                    items.append({
                        "product": PRODUCT_NAMES_RU.get(class_key, class_name),
                        "product_key": class_key,
                        "state": "detected",
                        "requires_writeoff": False,
                        "suggested_reason": None,
                        "confidence": round(float(box.conf[0]), 3),
                    })

        items.sort(key=lambda item: item["confidence"], reverse=True)
        return {
            "detected_items": items,
            "writeoff_required": False,
            "total_detected": len(items),
            "total_for_writeoff": 0,
            "suggested_reason": None,
        }
    except Exception as exc:
        log.warning("Recognition failed for %s: %s", image_path, exc)
        return None
