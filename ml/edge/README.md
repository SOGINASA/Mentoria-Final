# Edge-детектор падений (на ларёк)

Запуск детекции падений **прямо в ларьке**, рядом с камерой. На бэкенд уходят
только события (скриншот + метаданные), видеопоток никуда не стримится.

```
Камера ларька ──► edge-бокс (этот агент) ──► POST /api/write-offs/auto-fall ──► бэкенд
                  YOLOv8 + ByteTrack + FallDetector                              │
                                                                                 ▼
                          • сотруднику: подтвердить черновик списания
                          • админу + проверяющему: алерт о падении (сразу, надзор)
```

Логика детекции — в [../fall_detection.py](../fall_detection.py). Здесь — только
обвязка для автозапуска одного экземпляра на точку.

---

## 0. Что нужно на ларёк

- Любой мини-ПК (Intel NUC, мини-ПК на N100, Raspberry Pi 5) или Jetson.
  CPU-инференса YOLOv8n хватает на несколько fps — для падений достаточно.
- Камера: USB (индекс `0`) или IP-камера по RTSP.
- Сеть до сервера бэкенда.

## 1. Подготовка на бэкенде (один раз на точку)

Аккаунт-камера — это обычный пользователь с ролью `sender`, привязанный к точке
(`store_id`). От его имени агент логинится и шлёт падения.

Через админ-UI: создать точку (Store), затем пользователя с ролью «Отправитель»
и выбранной точкой. Либо через API:

```bash
# 1) точка (если ещё нет)
curl -X POST http://SERVER:5252/api/admin/stores \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"name":"Ларёк №1","address":"ул. Пушкина 1","iiko_store_id":"IIKO-1"}'

# 2) аккаунт-камера этой точки (store_id из ответа выше)
curl -X POST http://SERVER:5252/api/admin/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"username":"cam_store1","password":"СИЛЬНЫЙ_ПАРОЛЬ","full_name":"Камера Ларёк №1","role":"sender","store_id":1}'
```

> Без `store_id` у аккаунта-камеры эндпоинт вернёт 400 («не задана торговая точка»).

## 2. Установка на edge-боксе

### Linux (рекомендуется)

```bash
# репозиторий (или только папку ml/)
sudo git clone <repo> /opt/mentoria
cd /opt/mentoria/ml

# venv + зависимости. torch ставим CPU-сборкой:
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt

# конфиг точки
cp edge/falldetect.env.example edge/falldetect.env
nano edge/falldetect.env      # BACKEND_URL, CAM_LOGIN, CAM_PASSWORD, SOURCE

# проверить вручную (Ctrl+C для остановки)
chmod +x edge/run_edge.sh
edge/run_edge.sh
```

Автозапуск через systemd:

```bash
sudo useradd -r -s /usr/sbin/nologin falldetect    # сервисный пользователь (опц.)
# поправьте пути/User в unit при необходимости:
sudo cp edge/falldetect.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now falldetect
journalctl -u falldetect -f     # логи: строки [FALL→backend] = отправленные падения
```

### Windows

```powershell
cd C:\mentoria\ml
python -m venv .venv
.\.venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\pip install -r requirements.txt

Copy-Item edge\falldetect.env.example edge\falldetect.env
notepad edge\falldetect.env     # заполнить

# проверка
powershell -ExecutionPolicy Bypass -File edge\run_edge.ps1
```

Автозапуск — Task Scheduler: задача «При запуске компьютера», действие
`powershell.exe -ExecutionPolicy Bypass -File C:\mentoria\ml\edge\run_edge.ps1`,
галочки «Выполнять вне зависимости от входа пользователя» и «Перезапускать при сбое».

## 3. Калибровка под камеру

Сначала визуально подберите пороги на записи с реальной камеры (без бэкенда):

```bash
python fall_detection.py --source video.mp4 \
  --model runs/detect/runs/writeoff_detector-3/weights/best.pt \
  --show --no-backend --snapshots ./out
```

- `FLOOR_RATIO` / `--floor-polygon` — где в кадре «пол». Для бокового ракурса
  лучше задать явный полигон зоны пола.
- `DROP_RATIO` — насколько резко объект должен «уехать» вниз. Меньше → чувствительнее
  (больше ложных), больше → строже.
- `WINDOW_SEC` — за какое время считается падение.

Подобранные значения перенесите в `edge/falldetect.env`.

## 4. Что увидят пользователи

При зафиксированном падении бэкенд:
1. создаёт **черновик списания** со скриншотом (status=`draft`, source=`auto_fall`);
2. шлёт сотруднику точки уведомление `fall_draft` — подтвердить одним тапом;
3. шлёт **админу и проверяющему** уведомление `fall_alert` сразу (надзор, не
   дожидаясь сотрудника). Уведомление ведёт прямо в карточку заявки.

После подтверждения сотрудником заявка уходит в очередь проверки (`review_pending`),
где проверяющий может оформить удержание с конкретного повара.
