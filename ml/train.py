

import torch
from ultralytics import YOLO


def pick_device():
    """Выбирает устройство обучения: GPU (0), если CUDA доступна, иначе CPU.

    ВНИМАНИЕ: GPU задействуется только при CUDA-сборке PyTorch. Если установлена
    CPU-версия (torch ...+cpu), здесь всегда будет CPU. Поставить CUDA-сборку:
        pip install --index-url https://download.pytorch.org/whl/cu126 \
            torch==2.12.1+cu126 torchvision==0.27.1+cu126
    """
    if torch.cuda.is_available():
        print(f"[GPU] Обучение на: {torch.cuda.get_device_name(0)}")
        return 0
    print(f"[CPU] CUDA недоступна (torch {torch.__version__}) — обучение на CPU, медленно.")
    return "cpu"


# ─────────────────────────────────────────────────────────────────────────────
# МОДЕЛЬ 1: Детектор продуктов (YOLOv8 Detection)
# Датасет: unified_writeoff_dataset/  (собран dataset_merge.py)
# Задача:  найти bbox + назвать класс (patty / bun / tomato / potato ...)
# ─────────────────────────────────────────────────────────────────────────────

def train_detector():
    model = YOLO("yolov8n.pt")   # nano — быстро, для хакатона достаточно
                                  # yolov8s.pt / yolov8m.pt — точнее, медленнее
    model.train(
        data    = "unified_writeoff_dataset/data.yaml",
        epochs  = 50,
        imgsz   = 640,
        batch   = 16,            # RTX 4050 6 ГБ: если CUDA OOM — снизь до 8
        device  = pick_device(), # GPU (0) или CPU
        workers = 2,             # Windows/15 ГБ RAM: меньше воркеров → меньше
                                 # коммита памяти. При WinError 1455 (paging file
                                 # too small) ставь 0.
        name    = "writeoff_detector",
        project = "runs",
        patience= 10,            # early stopping
        augment = True,
        degrees = 15,            # небольшой поворот для устойчивости к углу съёмки
        flipud  = 0.1,
        fliplr  = 0.5,
    )
    print("✅ Детектор обучен → runs/writeoff_detector/weights/best.pt")


# ─────────────────────────────────────────────────────────────────────────────
# МОДЕЛЬ 2: Классификатор состояния (YOLOv8 Classification)
# Датасет: state_classifier_dataset/  (собран state_classifier_dataset.py)
# Задача:  оценить crop объекта → good / defect / spoiled
# ─────────────────────────────────────────────────────────────────────────────

def train_classifier():
    model = YOLO("yolov8n-cls.pt")   # Classification вариант модели
    model.train(
        data    = "state_classifier_dataset",
        epochs  = 30,
        imgsz   = 224,     # crop'ы небольшие, 224 достаточно
        batch   = 32,
        device  = pick_device(),   # GPU (0) или CPU
        workers = 2,               # см. примечание в train_detector (WinError 1455)
        name    = "writeoff_classifier",
        project = "runs",
        patience= 7,
    )
    print("✅ Классификатор обучен → runs/writeoff_classifier/weights/best.pt")


if __name__ == "__main__":
    import sys
    if "--detector" in sys.argv:
        train_detector()
    elif "--classifier" in sys.argv:
        train_classifier()
    else:
        print("Использование:")
        print("  python train.py --detector     # Модель 1")
        print("  python train.py --classifier   # Модель 2")
        print()
        print("Порядок запуска:")
        print("  1. python dataset_merge.py YOUR_KEY")
        print("  2. python state_classifier_dataset.py YOUR_KEY")
        print("  3. python train.py --detector")
        print("  4. python train.py --classifier")
        print("  5. python inference_pipeline.py photo.jpg detector.pt classifier.pt")