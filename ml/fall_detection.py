"""Детекция падения продуктов: YOLOv8 (детектор Блока 1) + ByteTrack + зона пола.

Схема:
    Камера/телефон сотрудника
        ↓
    [YOLOv8 Detection] — детектор продуктов (patty / bun / tomato / potato ...)
        ↓
    [ByteTrack] — присваивает track_id каждому объекту (supervision)
        ↓
    [FallDetector] — анализирует траекторию по track_id:
        если объект быстро опустился (dy > порог) и оказался в зоне пола → "DROPPED"
        ↓
    on_fall(event) → POST /api/write-offs/auto-fall →
        бэкенд создаёт ЧЕРНОВИК списания (продукт + причина + скриншот) →
        сотрудник подтверждает одним тапом → заявка уходит проверяющему.

Запуск:
    # только просмотр/отладка, без бэкенда:
    python ml/fall_detection.py --source video.mp4 --model runs/.../best.pt --show --no-backend

    # с отправкой черновиков на бэкенд (камера = отправитель точки):
    python ml/fall_detection.py --source 0 --model runs/.../best.pt \
        --backend http://localhost:5252 --login sender1 --password sender123 --show

Зависимости: см. ml/requirements.txt (ultralytics, supervision, opencv-python).
"""

import argparse
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

try:
    from inference_pipeline import PRODUCT_NAMES_RU
except ImportError:  # запуск из другого каталога
    PRODUCT_NAMES_RU = {
        "patty": "Котлета", "bun": "Булочка", "tomato": "Помидор",
        "onion": "Лук", "cheese": "Сыр", "lettuce": "Салат", "potato": "Картофель",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Событие падения
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class FallEvent:
    track_id: int
    product: str            # класс детектора (en): patty / bun / ...
    product_ru: str         # отображаемое имя
    confidence: float
    frame_index: int
    image_bgr: np.ndarray = field(repr=False)  # скриншот кадра (для заявки)


# ─────────────────────────────────────────────────────────────────────────────
# Анализ траектории по track_id
# ─────────────────────────────────────────────────────────────────────────────
class FallDetector:
    """Хранит историю нижней грани bbox по каждому track_id и фиксирует
    падение: объект быстро опустился на >= drop_ratio высоты кадра за окно
    window кадров И его «ноги» (bottom-center) оказались в зоне пола."""

    def __init__(self, window=12, drop_ratio=0.22):
        self.window = window
        self.drop_ratio = drop_ratio
        self._bottom = defaultdict(lambda: deque(maxlen=window + 1))  # track_id -> deque(bottom_y)
        self._last_seen = {}      # track_id -> frame_index
        self.fired = set()        # track_id, по которым уже создан черновик

    def update(self, detections, in_floor, frame_index, frame_h):
        """Возвращает список track_id, по которым ТОЛЬКО ЧТО зафиксировано падение."""
        falls = []
        tracker_ids = detections.tracker_id
        if tracker_ids is None:
            return falls

        for i in range(len(detections)):
            tid = int(tracker_ids[i])
            if tid < 0:
                continue
            x1, y1, x2, y2 = detections.xyxy[i]
            bottom_y = float(y2)

            hist = self._bottom[tid]
            hist.append(bottom_y)
            self._last_seen[tid] = frame_index

            if tid in self.fired:
                continue
            # нужно накопить полное окно и быть сейчас в зоне пола
            if len(hist) <= self.window or not bool(in_floor[i]):
                continue

            descent = bottom_y - hist[0]  # насколько опустился за окно (вниз = +)
            if descent >= self.drop_ratio * frame_h:
                self.fired.add(tid)
                falls.append(tid)

        self._prune(frame_index)
        return falls

    def _prune(self, frame_index):
        """Удаляем историю давно пропавших треков (экономия памяти)."""
        ttl = self.window * 4
        stale = [t for t, seen in self._last_seen.items() if frame_index - seen > ttl]
        for t in stale:
            self._bottom.pop(t, None)
            self._last_seen.pop(t, None)


# ─────────────────────────────────────────────────────────────────────────────
# Зона пола
# ─────────────────────────────────────────────────────────────────────────────
def build_floor_polygon(frame_w, frame_h, floor_ratio=0.2, polygon=None):
    """Полигон зоны пола. По умолчанию — нижние floor_ratio кадра (прямоугольник).
    polygon — явный список точек [[x,y], ...] (приоритетнее floor_ratio)."""
    if polygon:
        return np.array(polygon, dtype=int)
    y0 = int(frame_h * (1 - floor_ratio))
    return np.array([[0, y0], [frame_w, y0], [frame_w, frame_h], [0, frame_h]], dtype=int)


# ─────────────────────────────────────────────────────────────────────────────
# Репортеры события падения
# ─────────────────────────────────────────────────────────────────────────────
def _encode_jpeg(image_bgr):
    ok, buf = cv2.imencode('.jpg', image_bgr)
    if not ok:
        raise RuntimeError('Не удалось закодировать кадр в JPEG')
    return buf.tobytes()


class PrintReporter:
    """Печатает событие и (опц.) сохраняет скриншот на диск. Без бэкенда."""

    def __init__(self, save_dir=None):
        self.save_dir = save_dir
        if save_dir:
            import os
            os.makedirs(save_dir, exist_ok=True)

    def __call__(self, ev: FallEvent):
        msg = f"[FALL] track #{ev.track_id} {ev.product_ru} ({ev.product}) conf={ev.confidence:.2f} frame={ev.frame_index}"
        if self.save_dir:
            import os
            path = os.path.join(self.save_dir, f"fall_{ev.frame_index:06d}_track{ev.track_id}.jpg")
            cv2.imwrite(path, ev.image_bgr)
            msg += f" -> {path}"
        print(msg)


class BackendFallReporter:
    """Отправляет падение на бэкенд (создаётся черновик заявки)."""

    def __init__(self, base_url, login, password):
        from backend_client import WriteoffBackendClient
        self.client = WriteoffBackendClient(base_url, login, password)

    def __call__(self, ev: FallEvent):
        try:
            jpeg = _encode_jpeg(ev.image_bgr)
            r = self.client.post_fall(
                jpeg, product=ev.product, product_ru=ev.product_ru,
                track_id=ev.track_id, confidence=ev.confidence,
            )
            if r.status_code == 201:
                wo = r.json().get('write_off', {})
                print(f"[FALL→backend] черновик #{wo.get('id')} создан "
                      f"({ev.product_ru}, track #{ev.track_id})")
            else:
                print(f"[FALL→backend] ошибка {r.status_code}: {r.text[:200]}")
        except Exception as e:  # сеть не должна ронять видеоцикл
            print(f"[FALL→backend] исключение: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Основной пайплайн
# ─────────────────────────────────────────────────────────────────────────────
def run(source, model_path, on_fall, conf=0.3, floor_ratio=0.2, floor_polygon=None,
        drop_ratio=0.22, window_sec=0.5, device=None, show=False, save_path=None):
    """Прогоняет видео/камеру через детектор + ByteTrack + FallDetector.
    on_fall(FallEvent) вызывается при каждом новом падении."""
    cap = cv2.VideoCapture(int(source) if str(source).isdigit() else source)
    if not cap.isOpened():
        raise RuntimeError(f"Не удалось открыть источник видео: {source}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    if not fps or fps != fps or fps <= 1:  # 0 / NaN / мусор
        fps = 24.0
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError("Источник видео пуст")
    frame_h, frame_w = frame.shape[:2]

    polygon = build_floor_polygon(frame_w, frame_h, floor_ratio, floor_polygon)
    zone = sv.PolygonZone(polygon=polygon, triggering_anchors=(sv.Position.BOTTOM_CENTER,))

    model = YOLO(model_path)
    tracker = sv.ByteTrack(frame_rate=int(round(fps)))
    fall_detector = FallDetector(window=max(3, int(round(fps * window_sec))), drop_ratio=drop_ratio)

    box_annotator = sv.BoxAnnotator(thickness=2)
    label_annotator = sv.LabelAnnotator(text_scale=0.5, text_thickness=1)
    zone_annotator = sv.PolygonZoneAnnotator(zone=zone, color=sv.Color.RED, thickness=2)

    writer = None
    if save_path:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(save_path, fourcc, fps, (frame_w, frame_h))

    recent_falls = {}  # track_id -> frame_index (для надписи DROPPED N кадров)
    frame_index = 0
    predict_kwargs = {'conf': conf, 'verbose': False}
    if device is not None:
        predict_kwargs['device'] = device

    try:
        while ok:
            result = model(frame, **predict_kwargs)[0]
            detections = sv.Detections.from_ultralytics(result)
            detections = tracker.update_with_detections(detections)

            in_floor = zone.trigger(detections) if len(detections) else np.array([], dtype=bool)
            class_names = detections.data.get('class_name', np.array([''] * len(detections)))

            falls = fall_detector.update(detections, in_floor, frame_index, frame_h)
            for tid in falls:
                idx = _index_of_track(detections, tid)
                if idx is None:
                    continue
                product = str(class_names[idx]) if len(class_names) else 'object'
                product_ru = PRODUCT_NAMES_RU.get(product, product)
                conf_val = float(detections.confidence[idx]) if detections.confidence is not None else 0.0
                snapshot = _snapshot(frame, detections.xyxy[idx], product_ru)
                on_fall(FallEvent(tid, product, product_ru, conf_val, frame_index, snapshot))
                recent_falls[tid] = frame_index

            # ── визуализация ──
            annotated = frame.copy()
            annotated = zone_annotator.annotate(scene=annotated)
            if len(detections):
                labels = _build_labels(detections, class_names, in_floor, fall_detector.fired)
                annotated = box_annotator.annotate(scene=annotated, detections=detections)
                annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
            _draw_dropped_banner(annotated, recent_falls, frame_index, fps)

            if writer:
                writer.write(annotated)
            if show:
                cv2.imshow('fall-detection', annotated)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

            frame_index += 1
            ok, frame = cap.read()
    finally:
        cap.release()
        if writer:
            writer.release()
        if show:
            cv2.destroyAllWindows()

    return frame_index


# ── вспомогательные функции визуализации ──
def _index_of_track(detections, tid):
    if detections.tracker_id is None:
        return None
    for i in range(len(detections)):
        if int(detections.tracker_id[i]) == tid:
            return i
    return None


def _build_labels(detections, class_names, in_floor, fired):
    labels = []
    for i in range(len(detections)):
        tid = int(detections.tracker_id[i]) if detections.tracker_id is not None else -1
        name = str(class_names[i]) if len(class_names) else 'obj'
        conf = float(detections.confidence[i]) if detections.confidence is not None else 0.0
        if tid in fired:
            tag = ' DROPPED'
        elif len(in_floor) and bool(in_floor[i]):
            tag = ' floor'
        else:
            tag = ''
        labels.append(f"#{tid} {name} {conf:.2f}{tag}")
    return labels


def _snapshot(frame, xyxy, product_ru):
    """Кадр-скриншот падения: выделяем упавший объект красным."""
    img = frame.copy()
    x1, y1, x2, y2 = [int(v) for v in xyxy]
    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 3)
    cv2.putText(img, f"DROPPED: {product_ru}", (x1, max(20, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    return img


def _draw_dropped_banner(scene, recent_falls, frame_index, fps):
    """Показывает баннер DROPPED ~1.5 сек после события."""
    hold = int(fps * 1.5)
    active = [t for t, f in recent_falls.items() if frame_index - f <= hold]
    if active:
        cv2.putText(scene, f"DROPPED x{len(active)}", (12, 36),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
def _parse_args():
    p = argparse.ArgumentParser(description="Детекция падения продуктов (YOLOv8 + ByteTrack)")
    p.add_argument('--source', required=True, help="видеофайл или индекс камеры (0)")
    p.add_argument('--model', required=True, help="путь к детектору best.pt (Блок 1)")
    p.add_argument('--conf', type=float, default=0.3, help="порог уверенности детектора")
    p.add_argument('--floor-ratio', type=float, default=0.2,
                   help="доля высоты кадра снизу как зона пола (если не задан --floor-polygon)")
    p.add_argument('--floor-polygon', default=None,
                   help="явный полигон зоны пола, JSON: '[[x,y],...]'")
    p.add_argument('--drop-ratio', type=float, default=0.22,
                   help="мин. падение нижней грани (доля высоты кадра за окно) для срабатывания")
    p.add_argument('--window-sec', type=float, default=0.5, help="окно анализа траектории, сек")
    p.add_argument('--device', default=None, help="устройство YOLO (0=GPU, cpu). По умолчанию авто")
    p.add_argument('--show', action='store_true', help="показывать окно с разметкой")
    p.add_argument('--save', default=None, help="сохранить размеченное видео в файл .mp4")
    # бэкенд
    p.add_argument('--backend', default='http://localhost:5252', help="базовый URL бэкенда")
    p.add_argument('--login', default='sender1', help="логин отправителя (аккаунт камеры точки)")
    p.add_argument('--password', default='sender123', help="пароль отправителя")
    p.add_argument('--no-backend', action='store_true',
                   help="не отправлять на бэкенд (только печать/сохранение скриншотов)")
    p.add_argument('--snapshots', default=None, help="папка для сохранения скриншотов падений")
    return p.parse_args()


def main():
    import json
    args = _parse_args()

    floor_polygon = json.loads(args.floor_polygon) if args.floor_polygon else None

    if args.no_backend:
        on_fall = PrintReporter(save_dir=args.snapshots)
    else:
        on_fall = BackendFallReporter(args.backend, args.login, args.password)
        print(f"[init] падения уходят на {args.backend} как «{args.login}»")

    t0 = time.time()
    frames = run(
        source=args.source, model_path=args.model, on_fall=on_fall,
        conf=args.conf, floor_ratio=args.floor_ratio, floor_polygon=floor_polygon,
        drop_ratio=args.drop_ratio, window_sec=args.window_sec, device=args.device,
        show=args.show, save_path=args.save,
    )
    dt = time.time() - t0
    print(f"[done] обработано {frames} кадров за {dt:.1f}с "
          f"({frames / dt:.1f} fps)" if dt else f"[done] {frames} кадров")


if __name__ == '__main__':
    main()
