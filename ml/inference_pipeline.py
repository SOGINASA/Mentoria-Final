

from pathlib import Path
from dataclasses import dataclass


# Причины списания — автоматически предлагаются на основе детекции
WRITEOFF_REASONS = {
    ("tomato",  "spoiled"): "Помидор не соответствует стандартам (несвежий)",
    ("tomato",  "defect"):  "Помидор повреждён (помятый/деформированный)",
    ("patty",   "defect"):  "Котлета не пригодна (упала/повреждена по санитарным нормам)",
    ("patty",   "spoiled"): "Котлета не пригодна к повторному использованию",
    ("bun",     "defect"):  "Булочка повреждена (помятая/деформированная)",
    ("bun",     "spoiled"): "Булочка не соответствует стандартам",
    ("potato",  "spoiled"): "Картофель не соответствует стандартам качества",
    ("potato",  "defect"):  "Картофель повреждён",
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


@dataclass
class DetectionResult:
    product_class: str   # из Модели 1: patty / bun / tomato / potato / ...
    state: str           # из Модели 2: good / defect / spoiled
    confidence_det: float
    confidence_state: float
    bbox: tuple          # (x1, y1, x2, y2) в пикселях


@dataclass
class WriteoffSuggestion:
    product_ru: str
    state: str
    reason: str
    requires_writeoff: bool
    confidence: float


def run_inference(image_path: str, detector_model_path: str, classifier_model_path: str) -> list[WriteoffSuggestion]:
    """
    Полный пайплайн детекции:
      1. Загружаем изображение
      2. Модель 1 (YOLOv8 Detection) → список bbox с классами
      3. Для каждого bbox вырезаем crop
      4. Модель 2 (YOLOv8 Classification) → состояние каждого crop'а
      5. Формируем список предложений по списанию

    Требования:
      pip install ultralytics Pillow
    """
    try:
        from ultralytics import YOLO
        from PIL import Image
    except ImportError:
        raise ImportError("pip install ultralytics Pillow")

    image = Image.open(image_path).convert("RGB")

    # ── Шаг 1: Детекция объектов (Модель 1) ──────────────────────────────────
    detector = YOLO(detector_model_path)
    det_results = detector(image_path, conf=0.3)

    # ── Шаг 2: Классификация состояния (Модель 2) ────────────────────────────
    classifier = YOLO(classifier_model_path)

    detections: list[DetectionResult] = []

    for result in det_results:
        boxes  = result.boxes
        names  = result.names  # {idx: class_name}

        for box in boxes:
            cls_idx    = int(box.cls[0])
            cls_name   = names[cls_idx]
            conf_det   = float(box.conf[0])
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]

            # Вырезаем crop
            crop = image.crop((x1, y1, x2, y2))

            # Модель 2: классифицируем состояние crop'а
            state_results = classifier(crop)
            state_probs   = state_results[0].probs  # Classification probs
            state_idx     = int(state_probs.top1)
            state_name    = state_results[0].names[state_idx]
            conf_state    = float(state_probs.top1conf)

            detections.append(DetectionResult(
                product_class=cls_name,
                state=state_name,
                confidence_det=conf_det,
                confidence_state=conf_state,
                bbox=(x1, y1, x2, y2),
            ))

    # ── Шаг 3: Формируем предложения по списанию ─────────────────────────────
    suggestions: list[WriteoffSuggestion] = []

    for det in detections:
        needs_writeoff = det.state in ("defect", "spoiled")
        reason = WRITEOFF_REASONS.get(
            (det.product_class, det.state),
            f"{det.product_class} — {det.state}"  # fallback если пары нет в таблице
        )

        suggestions.append(WriteoffSuggestion(
            product_ru=PRODUCT_NAMES_RU.get(det.product_class, det.product_class),
            state=det.state,
            reason=reason,
            requires_writeoff=needs_writeoff,
            confidence=round((det.confidence_det + det.confidence_state) / 2, 3),
        ))

    # Сначала выводим те, которые требуют списания
    suggestions.sort(key=lambda s: s.requires_writeoff, reverse=True)
    return suggestions


def format_api_response(suggestions: list[WriteoffSuggestion]) -> dict:
    """
    Форматирует результат для возврата мобильному приложению (JSON).
    """
    items = []
    for s in suggestions:
        items.append({
            "product":          s.product_ru,
            "state":            s.state,
            "requires_writeoff": s.requires_writeoff,
            "suggested_reason": s.reason if s.requires_writeoff else None,
            "confidence":       s.confidence,
        })

    return {
        "detected_items":      items,
        "writeoff_required":   any(s.requires_writeoff for s in suggestions),
        "total_detected":      len(suggestions),
        "total_for_writeoff":  sum(1 for s in suggestions if s.requires_writeoff),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Пример использования
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json, sys

    if len(sys.argv) < 4:
        print("Использование: python inference_pipeline.py <image> <detector.pt> <classifier.pt>")
        print()
        print("Пример:")
        print("  python inference_pipeline.py photo.jpg runs/detect/weights/best.pt runs/classify/weights/best.pt")
        sys.exit(0)

    image_path     = sys.argv[1]
    detector_path  = sys.argv[2]
    classifier_path = sys.argv[3]

    print(f"Обрабатываем: {image_path}")
    results = run_inference(image_path, detector_path, classifier_path)
    response = format_api_response(results)

    print(json.dumps(response, ensure_ascii=False, indent=2))