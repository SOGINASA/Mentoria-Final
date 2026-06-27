
import yaml
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# 1. КОНФИГУРАЦИЯ
# ─────────────────────────────────────────────────────────────────────────────

# Три класса состояния — единые для всех типов продуктов
STATE_CLASSES = ["good", "defect", "spoiled"]

# Откуда брать данные для классификатора состояния.
#
# "rules" — упорядоченный список (подстрока в имени COCO-категории → класс
# состояния). Для каждой категории берётся ПЕРВОЕ совпадение, поэтому "spoiled"
# идёт раньше "fresh". Подстрока ловит все варианты ("fresh apple",
# "freshbittergourd", "spoiled banana" и т.д.) без перечисления каждого продукта.
STATE_DATASETS_CONFIG = [
    {
        "name": "food_spoilage_status",
        "workspace": "project-rspra",
        "project": "food-spoilage-status",
        "version": 1,
        "rules": [
            ("spoiled", "spoiled"),
            ("rotten",  "spoiled"),
            ("bad",     "spoiled"),
            ("fresh",   "good"),
            ("ripe",    "good"),
            ("good",    "good"),
        ],
    },
    {
        "name": "fruit_spoilage",
        "workspace": "fruit-spoilage-detection",
        "project": "a-b",
        "version": 2,
        "rules": [
            ("spoiled", "spoiled"),
            ("rotten",  "spoiled"),
            ("fresh",   "good"),
        ],
    },
    # food_waste_detection исключён намеренно: его категории — это пищевые
    # отходы/объедки (bone, apple-core, shrimp-shell, rice...), а не состояние
    # продукта. Семантически не ложится в good/defect/spoiled.
]

RAW_STATE_DIR  = Path("raw_state_datasets")
STATE_OUT_DIR  = Path("state_classifier_dataset")

# ─────────────────────────────────────────────────────────────────────────────
# 2. СКАЧИВАНИЕ ДАТАСЕТОВ ДЛЯ КЛАССИФИКАТОРА
# ─────────────────────────────────────────────────────────────────────────────

def download_state_datasets(api_key: str):
    try:
        from roboflow import Roboflow
    except ImportError:
        raise ImportError("pip install roboflow")

    rf = Roboflow(api_key=api_key)
    RAW_STATE_DIR.mkdir(exist_ok=True)

    for cfg in STATE_DATASETS_CONFIG:
        dest = RAW_STATE_DIR / cfg["name"]
        if dest.exists():
            print(f"[SKIP] {cfg['name']} уже скачан")
            continue
        print(f"[DOWNLOAD] {cfg['name']} ...")
        project = rf.workspace(cfg["workspace"]).project(cfg["project"])
        dataset = project.version(cfg["version"])
        # COCO формат: bbox-аннотации для нарезки кропов под классификатор.
        # "folder" недоступен — исходные проекты detection/instance-segmentation.
        dataset.download("coco", location=str(dest))
        print(f"[OK] → {dest}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. СБОРКА ДАТАСЕТА КЛАССИФИКАЦИИ
#
# Исходники — detection / instance-segmentation проекты, скачанные в COCO.
# Структура COCO от Roboflow:
#   dataset/
#     train/
#       _annotations.coco.json   ← images + annotations(bbox) + categories
#       img1.jpg
#     valid/
#       _annotations.coco.json
#       ...
#
# Для классификатора состояния нам нужны КРОПЫ объектов, поэтому по каждой
# bbox-аннотации вырезаем фрагмент изображения и раскладываем в папки
# good / defect / spoiled согласно "rules" (имя категории → класс состояния).
# ─────────────────────────────────────────────────────────────────────────────

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

# Сплиты Roboflow: внутренний валидационный называется "valid".
SPLITS = ("train", "valid")

def _load_coco(split_dir: Path):
    """Загружает COCO-аннотации сплита. Возвращает dict либо None, если файла нет."""
    import json
    ann_path = split_dir / "_annotations.coco.json"
    if not ann_path.exists():
        return None
    with open(ann_path, "r", encoding="utf-8") as f:
        return json.load(f)

def _match_state(cat_name: str, rules):
    """Имя COCO-категории → класс состояния по первому совпадению подстроки."""
    for keyword, state in rules:
        if keyword in cat_name:
            return state
    return None

def build_state_dataset():
    """
    Собирает датасет для YOLOv8 Classification, нарезая кропы по bbox из
    нескольких COCO-источников. Итоговая структура (folder format):

        state_classifier_dataset/
        ├── train/
        │   ├── good/
        │   ├── defect/
        │   └── spoiled/
        └── valid/
            ├── good/
            ├── defect/
            └── spoiled/
    """
    try:
        from PIL import Image
    except ImportError:
        raise ImportError("pip install Pillow — нужен для нарезки кропов")

    # Создаём папки
    for split in SPLITS:
        for state in STATE_CLASSES:
            (STATE_OUT_DIR / split / state).mkdir(parents=True, exist_ok=True)

    total = {s: {st: 0 for st in STATE_CLASSES} for s in SPLITS}

    for cfg in STATE_DATASETS_CONFIG:
        dataset_dir = RAW_STATE_DIR / cfg["name"]
        if not dataset_dir.exists():
            print(f"[WARN] {dataset_dir} не найден — пропускаем")
            continue

        print(f"\n── {cfg['name']} ──")
        rules = cfg["rules"]
        prefix = cfg["name"][:15]
        skipped = set()  # категории без соответствия ни одному правилу

        for split in SPLITS:
            split_dir = dataset_dir / split
            coco = _load_coco(split_dir)
            if coco is None:
                continue

            cat_name = {c["id"]: c["name"].lower().strip()
                        for c in coco.get("categories", [])}
            img_file = {im["id"]: im["file_name"]
                        for im in coco.get("images", [])}

            # Группируем аннотации по изображению, чтобы открыть каждый файл один раз
            anns_by_img = {}
            for ann in coco.get("annotations", []):
                anns_by_img.setdefault(ann["image_id"], []).append(ann)

            for img_id, anns in anns_by_img.items():
                fname = img_file.get(img_id)
                if not fname:
                    continue
                img_path = split_dir / fname
                if not img_path.exists():
                    continue

                image = None  # ленивая загрузка — только если есть валидный кроп
                for idx, ann in enumerate(anns):
                    src_class = cat_name.get(ann["category_id"], "")
                    target_state = _match_state(src_class, rules)
                    if target_state is None:
                        if src_class:
                            skipped.add(src_class)
                        continue

                    x, y, w, h = ann["bbox"]
                    if w < 2 or h < 2:
                        continue

                    if image is None:
                        image = Image.open(img_path).convert("RGB")

                    left   = max(0, int(x))
                    top    = max(0, int(y))
                    right  = min(image.width,  int(x + w))
                    bottom = min(image.height, int(y + h))
                    if right - left < 2 or bottom - top < 2:
                        continue

                    crop = image.crop((left, top, right, bottom))
                    safe_class = src_class.replace(" ", "-")
                    out_name = f"{prefix}_{safe_class}_{img_id}_{idx}.jpg"
                    crop.save(STATE_OUT_DIR / split / target_state / out_name)
                    total[split][target_state] += 1

        if skipped:
            print(f"  [SKIP classes] {sorted(skipped)} — нет совпадений по правилам")

    # Статистика
    print("\n── Статистика state_classifier_dataset ──")
    for split in ("train", "valid"):
        print(f"\n  [{split}]")
        for state, cnt in total[split].items():
            bar = "█" * min(cnt // 10, 50)
            print(f"    {state:<10} {cnt:>5}  {bar}")

    # data.yaml для YOLOv8 Classification
    yaml_out = {
        "path": str(STATE_OUT_DIR.resolve()),
        "train": "train",
        "val":   "valid",
        "nc":    len(STATE_CLASSES),
        "names": STATE_CLASSES,
        "description": (
            "State classifier dataset for writeoff system. "
            "Classes: good (пригоден), defect (физический дефект), spoiled (испорченный). "
            "Used as Model 2 after Model 1 (detector) crops the bounding box."
        ),
    }
    with open(STATE_OUT_DIR / "data.yaml", "w", encoding="utf-8") as f:
        yaml.dump(yaml_out, f, allow_unicode=True, sort_keys=False)

    print(f"\n✅ state_classifier_dataset готов → {STATE_OUT_DIR}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. ГЕНЕРАЦИЯ СИНТЕТИЧЕСКИХ ПРИМЕРОВ ДЛЯ КЛАССА "defect"
#
# В реальных датасетах мало примеров именно физического дефекта
# (помятая булочка, упавшая котлета). Этот блок помогает добрать данные
# через аугментацию — имитируем "упавший" продукт поворотом + размытием.
# ─────────────────────────────────────────────────────────────────────────────

def augment_defect_class(good_dir: Path, output_defect_dir: Path, n_samples: int = 200):
    """
    Простая аугментация: берёт изображения из good/,
    применяет случайный поворот + размытие → сохраняет в defect/.

    Логика: упавший или деформированный продукт визуально похож на
    хороший, но в нестандартной ориентации и возможно нерезкий.

    Для более качественного датасета — вручную сфотографируй
    реальные бракованные продукты и добавь в defect/.
    """
    try:
        from PIL import Image, ImageFilter
        import random
    except ImportError:
        print("[WARN] pip install Pillow — пропускаем аугментацию")
        return

    output_defect_dir.mkdir(parents=True, exist_ok=True)
    good_images = [p for p in good_dir.glob("*") if p.suffix.lower() in IMAGE_EXTS]

    if not good_images:
        print(f"[WARN] Нет изображений в {good_dir}")
        return

    print(f"\nГенерация {n_samples} синтетических defect-примеров из {len(good_images)} good-изображений...")

    for i in range(n_samples):
        src = random.choice(good_images)
        img = Image.open(src)

        # Случайный поворот (имитация упавшего продукта)
        angle = random.choice([45, 90, 135, 180, 225, 270])
        img = img.rotate(angle, expand=True)

        # Случайное размытие (имитация нечёткости или грязи)
        if random.random() > 0.5:
            img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 2.0)))

        out_name = f"synthetic_defect_{i:04d}{src.suffix}"
        img.save(output_defect_dir / out_name)

    print(f"✅ Сохранено {n_samples} синтетических примеров → {output_defect_dir}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. ТОЧКА ВХОДА
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    print("=" * 60)
    print("  State Classifier Dataset Tool — Writeoff Detection System")
    print("=" * 60)
    print()
    print("Эта модель обучается ОТДЕЛЬНО от детектора (Блок 1).")
    print("Она принимает CROP объекта и классифицирует его состояние.")
    print(f"Классы состояния: {STATE_CLASSES}")
    print()

    if len(sys.argv) == 2 and sys.argv[1] not in ("--build-only", "--augment"):
        api_key = sys.argv[1]
        print("[1/3] Скачивание датасетов состояния...")
        download_state_datasets(api_key)
        print("\n[2/3] Сборка датасета классификатора...")
        build_state_dataset()
        print("\n[3/3] Аугментация класса defect...")
        augment_defect_class(
            good_dir=STATE_OUT_DIR / "train" / "good",
            output_defect_dir=STATE_OUT_DIR / "train" / "defect",
            n_samples=200
        )

    elif "--build-only" in sys.argv:
        build_state_dataset()

    elif "--augment" in sys.argv:
        augment_defect_class(
            good_dir=STATE_OUT_DIR / "train" / "good",
            output_defect_dir=STATE_OUT_DIR / "train" / "defect",
        )

    else:
        print("Использование:")
        print("  python state_classifier_dataset.py YOUR_KEY   # скачать + собрать")
        print("  python state_classifier_dataset.py --build-only")
        print("  python state_classifier_dataset.py --augment")