import os
import shutil
import yaml
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# 1. ЕДИНАЯ СХЕМА КЛАССОВ (target)
# ─────────────────────────────────────────────────────────────────────────────

# Финальные классы, которые будет знать Модель 1
UNIFIED_CLASSES = [
    "patty",    # котлета — говяжья, куриная, любая
    "bun",      # булочка — верх, низ, целая
    "tomato",   # помидор
    "onion",    # лук
    "cheese",   # сыр
    "lettuce",  # салат / листья
    "potato",   # картофель / картофель фри
]

# ─────────────────────────────────────────────────────────────────────────────
# 2. ТАБЛИЦА РЕМАППИНГА
#    ключ   = оригинальное имя класса в исходном датасете (lowercase)
#    значение = имя класса в UNIFIED_CLASSES
#    None   = пропустить этот класс (не нужен для кейса списания)
# ─────────────────────────────────────────────────────────────────────────────

REMAP: dict[str, str | None] = {
    # ── SmartOrder: Burger Ingredients ─────────────────────────────────────
    "patty":            "patty",
    "beef_patty":       "patty",
    "chicken_patty":    "patty",
    "bun":              "bun",
    "bun_top":          "bun",
    "bun_bottom":       "bun",
    "tomato":           "tomato",
    "onion":            "onion",
    "cheese":           "cheese",
    "lettuce":          "lettuce",
    "salad":            "lettuce",

    # ── Kartik Shekhar: hamburger ───────────────────────────────────────────
    "burger":           None,       # целый бургер — не нужен, нас интересуют компоненты
    "wrap":             None,       # обёртка — не входит в список списания
    "bread":            "bun",

    # ── Orlovskyi: burger-detection ────────────────────────────────────────
    "burger-patty":     "patty",
    "hotdog":           None,       # хот-дог — отдельный продукт, пропускаем
    "hotdog cooked":    None,
    "bbq":              None,
    "red_bottom":       "bun",
    "red_side":         "bun",
    "red_top":          "bun",

    # ── FOOD-INGREDIENTS 120 классов (только нужные) ───────────────────────
    "potato":           "potato",
    "french fries":     "potato",
    "fries":            "potato",
    "beef":             "patty",    # сырая говядина → тот же класс что и котлета
    "chicken":          "patty",    # куриное мясо
    "sausage":          None,       # сосиска — отдельный продукт
    "bread_roll":       "bun",
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. КОНФИГУРАЦИЯ ДАТАСЕТОВ
#    Заполни api_key и раскомментируй download-блок после установки roboflow
# ─────────────────────────────────────────────────────────────────────────────

DATASETS_CONFIG = [
    {
        "name": "smartorder_burger_ingredients",
        "workspace": "smartorder",
        "project": "burger-ingredients",
        "version": 1,
        # Классы в этом датасете и их индексы будут прочитаны из data.yaml автоматически
    },
    {
        "name": "hamburger_kartik",
        "workspace": "kartik-shekhar-oz2qb",
        "project": "hamburger-tfjak",
        "version": 1,
    },
    {
        "name": "burger_detection_orlovskyi",
        "workspace": "artem-orlovskyi",
        "project": "burger-detection",
        "version": 1,
    },
    {
        "name": "food_ingredients_120",
        "workspace": "food-recipe-ingredient-images-0gnku",
        "project": "food-ingredients-dataset",
        "version": 1,
    },
]

OUTPUT_DIR = Path("unified_writeoff_dataset")
RAW_DIR    = Path("raw_datasets")

# ─────────────────────────────────────────────────────────────────────────────
# 4. СКАЧИВАНИЕ ДАТАСЕТОВ (требует pip install roboflow + API ключ)
# ─────────────────────────────────────────────────────────────────────────────

def download_datasets(api_key: str):
    """
    Скачивает все датасеты из Roboflow в папку raw_datasets/.
    Формат: YOLOv8 (папки images/ и labels/ с .txt аннотациями).
    """
    try:
        from roboflow import Roboflow
    except ImportError:
        raise ImportError("Установи roboflow: pip install roboflow")

    rf = Roboflow(api_key=api_key)
    RAW_DIR.mkdir(exist_ok=True)

    for cfg in DATASETS_CONFIG:
        dest = RAW_DIR / cfg["name"]
        if dest.exists():
            print(f"[SKIP] {cfg['name']} уже скачан")
            continue

        print(f"[DOWNLOAD] {cfg['name']} ...")
        project = rf.workspace(cfg["workspace"]).project(cfg["project"])
        dataset = project.version(cfg["version"])
        dataset.download("yolov8", location=str(dest))
        print(f"[OK] {cfg['name']} → {dest}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. ЧТЕНИЕ КЛАССОВ ИЗ data.yaml ИСХОДНОГО ДАТАСЕТА
# ─────────────────────────────────────────────────────────────────────────────

def read_source_classes(dataset_dir: Path) -> dict[int, str]:
    """
    Возвращает {индекс: имя_класса} из data.yaml датасета.
    Имена приводятся к нижнему регистру и без пробелов по краям.
    """
    yaml_path = dataset_dir / "data.yaml"
    if not yaml_path.exists():
        raise FileNotFoundError(f"data.yaml не найден в {dataset_dir}")

    with open(yaml_path) as f:
        data = yaml.safe_load(f)

    names = data.get("names", [])
    # names может быть списком или словарём {int: str}
    if isinstance(names, list):
        return {i: name.strip().lower() for i, name in enumerate(names)}
    elif isinstance(names, dict):
        return {int(k): v.strip().lower() for k, v in names.items()}
    else:
        raise ValueError(f"Неизвестный формат names в {yaml_path}: {type(names)}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. РЕМАППИНГ ОДНОГО LABEL-ФАЙЛА
# ─────────────────────────────────────────────────────────────────────────────

def remap_label_file(
    src_path: Path,
    dst_path: Path,
    source_classes: dict[int, str],   # {old_idx: old_name}
    unified_class_idx: dict[str, int], # {unified_name: new_idx}
) -> int:
    """
    Читает YOLO .txt файл аннотаций, ремаппит индексы классов,
    пишет результат в dst_path.
    Возвращает количество записанных строк (0 = файл пуст после фильтрации).
    """
    lines_out = []

    with open(src_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            parts = line.split()
            old_idx = int(parts[0])
            coords  = parts[1:]          # cx cy w h (нормализованные)

            old_name = source_classes.get(old_idx)
            if old_name is None:
                continue                  # индекс не найден в yaml — пропускаем

            # Смотрим в таблицу ремаппинга
            unified_name = REMAP.get(old_name)
            if unified_name is None:
                continue                  # класс не нужен для кейса — пропускаем

            new_idx = unified_class_idx[unified_name]
            lines_out.append(f"{new_idx} {' '.join(coords)}")

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    with open(dst_path, "w") as f:
        f.write("\n".join(lines_out) + ("\n" if lines_out else ""))

    return len(lines_out)

# ─────────────────────────────────────────────────────────────────────────────
# 7. КОПИРОВАНИЕ ИЗОБРАЖЕНИЙ
# ─────────────────────────────────────────────────────────────────────────────

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def copy_images(src_dir: Path, dst_dir: Path, prefix: str) -> list[str]:
    """
    Копирует изображения из src_dir в dst_dir, добавляя prefix к имени файла.
    Возвращает список новых имён файлов.
    """
    dst_dir.mkdir(parents=True, exist_ok=True)
    copied = []
    for img_path in src_dir.iterdir():
        if img_path.suffix.lower() not in IMAGE_EXTS:
            continue
        new_name = f"{prefix}_{img_path.name}"
        shutil.copy2(img_path, dst_dir / new_name)
        copied.append(new_name)
    return copied

# ─────────────────────────────────────────────────────────────────────────────
# 8. ОСНОВНАЯ ФУНКЦИЯ МЁРЖА
# ─────────────────────────────────────────────────────────────────────────────

def merge_datasets():
    """
    Объединяет все датасеты из raw_datasets/ в unified_writeoff_dataset/.

    Структура результата:
        unified_writeoff_dataset/
        ├── data.yaml
        ├── train/
        │   ├── images/
        │   └── labels/
        ├── valid/
        │   ├── images/
        │   └── labels/
        └── test/          (если есть в исходниках)
            ├── images/
            └── labels/
    """
    # Индекс unified классов: {name: idx}
    unified_idx = {name: i for i, name in enumerate(UNIFIED_CLASSES)}

    # Счётчики для статистики
    stats = {cls: {"train": 0, "valid": 0, "test": 0} for cls in UNIFIED_CLASSES}
    skipped_classes: dict[str, int] = {}   # классы, которые отфильтровали

    OUTPUT_DIR.mkdir(exist_ok=True)
    for split in ("train", "valid", "test"):
        (OUTPUT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

    for cfg in DATASETS_CONFIG:
        dataset_dir = RAW_DIR / cfg["name"]
        if not dataset_dir.exists():
            print(f"[WARN] Датасет не найден: {dataset_dir} — пропускаем")
            continue

        print(f"\n── Обрабатываем: {cfg['name']} ──")

        try:
            source_classes = read_source_classes(dataset_dir)
        except FileNotFoundError as e:
            print(f"  [WARN] {e}")
            continue

        print(f"  Классы в исходнике: {list(source_classes.values())}")

        # Покажем, что ремаппится, что пропускается
        for idx, name in source_classes.items():
            target = REMAP.get(name, "❓ НЕТ В ТАБЛИЦЕ")
            mark = "→ " + target if target else "✗ пропускаем"
            print(f"    [{idx}] {name}  {mark}")

        prefix = cfg["name"][:20]   # короткий префикс для имён файлов

        for split in ("train", "valid", "test"):
            img_src = dataset_dir / split / "images"
            lbl_src = dataset_dir / split / "labels"

            if not img_src.exists():
                continue

            # Копируем изображения
            copied_imgs = copy_images(
                img_src,
                OUTPUT_DIR / split / "images",
                prefix=f"{prefix}_{split}"
            )

            # Ремаппим аннотации
            processed = 0
            for img_name in copied_imgs:
                stem    = Path(img_name).stem.replace(f"{prefix}_{split}_", "")
                lbl_src_file = lbl_src / (stem + ".txt")
                lbl_dst_file = OUTPUT_DIR / split / "labels" / (Path(img_name).stem + ".txt")

                if not lbl_src_file.exists():
                    # Изображение без аннотаций — создаём пустой файл
                    lbl_dst_file.touch()
                    continue

                count = remap_label_file(
                    lbl_src_file,
                    lbl_dst_file,
                    source_classes,
                    unified_idx,
                )
                if count > 0:
                    processed += 1

            print(f"  [{split}] изображений: {len(copied_imgs)}, с аннотациями после ремаппинга: {processed}")

    # ─────────────────────────────────────────────────────────────────────────
    # 9. ГЕНЕРАЦИЯ data.yaml
    # ─────────────────────────────────────────────────────────────────────────

    data_yaml = {
        "path": str(OUTPUT_DIR.resolve()),
        "train": "train/images",
        "val":   "valid/images",
        "test":  "test/images",
        "nc":    len(UNIFIED_CLASSES),
        "names": UNIFIED_CLASSES,

        # Метаданные для понимания откуда датасет
        "description": (
            "Unified writeoff detection dataset. "
            "Merged from SmartOrder Burger Ingredients, Hamburger (Kartik Shekhar), "
            "Burger Detection (Orlovskyi), Food Ingredients 120. "
            "Classes remapped to unified schema."
        ),
        "source_datasets": [cfg["name"] for cfg in DATASETS_CONFIG],
    }

    yaml_out = OUTPUT_DIR / "data.yaml"
    with open(yaml_out, "w", encoding="utf-8") as f:
        yaml.dump(data_yaml, f, allow_unicode=True, sort_keys=False)

    print(f"\n✅ Мёрж завершён → {OUTPUT_DIR}")
    print(f"   Классы ({len(UNIFIED_CLASSES)}): {UNIFIED_CLASSES}")
    print(f"   data.yaml: {yaml_out}")

# ─────────────────────────────────────────────────────────────────────────────
# 10. ПРОВЕРКА ДАТАСЕТА ПОСЛЕ МЁРЖА
# ─────────────────────────────────────────────────────────────────────────────

def verify_dataset():
    """
    Печатает статистику по объединённому датасету:
    сколько объектов каждого класса в каждом split'е.
    """
    print("\n── Верификация объединённого датасета ──")

    unified_idx = {name: i for i, name in enumerate(UNIFIED_CLASSES)}
    inv_idx     = {i: name for name, i in unified_idx.items()}

    for split in ("train", "valid", "test"):
        lbl_dir = OUTPUT_DIR / split / "labels"
        if not lbl_dir.exists():
            continue

        counts = {name: 0 for name in UNIFIED_CLASSES}
        total_files = 0

        for lbl_file in lbl_dir.glob("*.txt"):
            total_files += 1
            with open(lbl_file) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    idx = int(line.split()[0])
                    name = inv_idx.get(idx, f"unknown_{idx}")
                    if name in counts:
                        counts[name] += 1

        print(f"\n  [{split}] файлов аннотаций: {total_files}")
        for cls, cnt in sorted(counts.items(), key=lambda x: -x[1]):
            bar = "█" * min(cnt // 50, 40)
            print(f"    {cls:<12} {cnt:>6}  {bar}")

# ─────────────────────────────────────────────────────────────────────────────
# 11. ТОЧКА ВХОДА
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    print("=" * 60)
    print("  Dataset Merge Tool — Writeoff Detection System")
    print("=" * 60)

    # Режим 1: скачать + смёржить
    # Передай API ключ Roboflow как аргумент: python dataset_merge.py YOUR_KEY
    if len(sys.argv) == 2 and sys.argv[1] not in ("--merge-only", "--verify"):
        api_key = sys.argv[1]
        print(f"\n[1/3] Скачивание датасетов (API key: {api_key[:6]}...)")
        download_datasets(api_key)
        print("\n[2/3] Объединение и ремаппинг...")
        merge_datasets()
        print("\n[3/3] Проверка результата...")
        verify_dataset()

    # Режим 2: только мёрж (датасеты уже скачаны вручную в raw_datasets/)
    elif "--merge-only" in sys.argv:
        print("\n[1/2] Объединение и ремаппинг...")
        merge_datasets()
        print("\n[2/2] Проверка результата...")
        verify_dataset()

    # Режим 3: только проверка уже готового датасета
    elif "--verify" in sys.argv:
        verify_dataset()

    else:
        print("\nИспользование:")
        print("  python dataset_merge.py YOUR_ROBOFLOW_KEY    # скачать + смёржить")
        print("  python dataset_merge.py --merge-only         # только мёрж (датасеты уже есть)")
        print("  python dataset_merge.py --verify             # проверить готовый датасет")
        print()
        print("Unified classes:", UNIFIED_CLASSES)
        print()
        print("Ожидаемая структура raw_datasets/:")
        for cfg in DATASETS_CONFIG:
            print(f"  raw_datasets/{cfg['name']}/")
            print(f"    ├── data.yaml")
            print(f"    ├── train/images/  train/labels/")
            print(f"    └── valid/images/  valid/labels/")