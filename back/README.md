# Back — система автоматизации списаний

Бэкенд для веб-приложения списаний на торговых точках (кейс Mentoria Hackathon).
Сотрудник точки оформляет заявку на списание с фото → проверяющий подтверждает/отклоняет →
при подтверждении создаётся акт списания в **Iiko**.

Стек: **Flask** + **SQLAlchemy** + **Flask-JWT-Extended** + **Flask-Migrate** (структура взята
из проекта FoodTrack и очищена под этот кейс).

## Структура

```
back/
├── app.py                 # app-factory, регистрация blueprints, отдача фото, CLI
├── config.py              # конфигурация по переменным окружения
├── constants.py           # роли, статусы, типы списания (совпадают с фронтом)
├── models.py              # User, Store, Employee, WriteOff(+Photo/Item), WebAuthnCredential/Challenge
├── seed_data.py           # демо-точки, сотрудники, пользователи
├── routes/
│   ├── auth.py            # вход, refresh, /me, смена пароля
│   ├── webauthn.py        # вход по биометрии (Face ID/Touch ID/passkey)
│   ├── stores.py          # точки и их сотрудники
│   ├── writeoffs.py       # создание/просмотр/approve/reject/stats + Iiko
│   ├── uploads.py         # загрузка фото
│   └── admin.py           # CRUD пользователей/точек/сотрудников
├── services/
│   └── iiko_service.py    # создание акта в Iiko (mock | real)
├── utils/                 # auth_helpers (role_required), validators, request_helpers
├── tests/                 # pytest (conftest + auth + writeoffs)
├── static/uploads/        # загруженные фото
├── Dockerfile / docker-compose.yml / entrypoint.sh
├── requirements.txt
└── API.md                 # описание всех эндпоинтов
```

## Быстрый старт (локально)

```bash
cd back
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # при необходимости поправить

# создать таблицы + демо-данные
flask --app app init-db

# запустить
python app.py                 # http://localhost:5252
```

Проверка: `GET http://localhost:5252/api` → информация об API.

## Демо-логины

| Логин | Пароль | Роль |
|-------|--------|------|
| admin | admin12345 | admin |
| reviewer | reviewer123 | reviewer |
| sender1 | sender123 | sender (Точка №1) |
| sender2 | sender123 | sender (Точка №2) |

## Запуск через Docker

```bash
cd back
docker compose up --build
```
БД (SQLite) и загруженные фото монтируются в `./database` и `./static/uploads`.

## Тесты

```bash
pytest
```

## Iiko

По умолчанию `IIKO_MODE=mock` — создание акта имитируется (генерируется фиктивный `iiko_act_id`).
Для реальной интеграции: задать `IIKO_MODE=real` и креды (`IIKO_BASE_URL`, `IIKO_API_LOGIN`,
`IIKO_API_TOKEN`) в `.env`, затем реализовать `_create_act_real()` в
[services/iiko_service.py](services/iiko_service.py) (там подробные TODO).

## Биометрия (WebAuthn / passkey)

Вход по Face ID / Touch ID / отпечатку / passkey без пароля. Реализован **только API**
(`routes/webauthn.py`, префикс `/api/auth/webauthn`), интерфейс подключим позже.
Пакет: `webauthn>=2.7.0`. Challenge'ы одноразовые, хранятся в БД с TTL 5 минут
(таблица `webauthn_challenges`), ключи — в `webauthn_credentials`.

Поток:

1. **Регистрация ключа** (пользователь уже залогинен паролем, нужен JWT):
   - `POST /register-options` → опции для `navigator.credentials.create()`;
   - `POST /register` → сохраняем публичный ключ (тело — ответ аутентификатора + опц. `device_name`).
2. **Вход по ключу** (без пароля):
   - `POST /authenticate-options` `{ "identifier": "email|username" }` → опции для `navigator.credentials.get()`;
   - `POST /authenticate` `{ "identifier", "credential" }` → проверка подписи, выдаёт `access_token` + `refresh_token` (как обычный логин).
3. **Управление ключами** (нужен JWT): `GET /credentials`, `DELETE /credentials/<id>`.

Переменные окружения (для прода обязательно задать под свой домен):

| Env | По умолчанию | Назначение |
|-----|--------------|-----------|
| `WEBAUTHN_RP_ID` | `localhost` | Домен сайта без схемы/порта |
| `WEBAUTHN_RP_NAME` | `WriteOff` | Имя сервиса в системном диалоге |
| `WEBAUTHN_ORIGIN` | `http://localhost:3000` | Полный origin фронта (схема+домен+порт) |

> WebAuthn работает только по HTTPS (или `localhost`). На проде `WEBAUTHN_ORIGIN` должен
> точно совпадать с адресом, откуда браузер вызывает API.

## Подключение фронта

- Все эндпоинты под `/api/...`, CORS открыт для `localhost:3000` и `5173` (меняется через `CORS_ORIGINS`).
- Константы ролей/статусов/типов в `constants.py` совпадают с `front/src/constants/`.
- Полное описание запросов/ответов — в [API.md](API.md).
