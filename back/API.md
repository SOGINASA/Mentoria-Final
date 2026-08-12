# WriteOff API

Базовый префикс: `/api`. Авторизация — JWT в заголовке `Authorization: Bearer <access_token>`.

Роли: `sender`, `manager`, `reviewer`, `hr`, `finance`, `operations`, `admin`.
Администратор имеет доступ ко всему; остальные права и точки возвращаются как
`permissions` и `scopes`.

---

## Auth — `/api/auth`

### POST `/login`
Вход по `username` **или** `email`.
```json
// Запрос
{ "identifier": "sender1", "password": "sender123" }
// Ответ 200
{ "user": { "id": 3, "username": "sender1", "role": "sender", "store_id": 1, ... },
  "access_token": "...", "refresh_token": "..." }
```
Ошибки: `400` нет полей, `401` неверные данные, `403` деактивирован.

### POST `/refresh` — `Bearer <refresh_token>`
`{ "access_token": "..." }`

### GET `/me`
`{ "user": { ... }, "permissions": [...], "scopes": {...}, "feature_flags": {...} }`

### POST `/change-password`
`{ "current_password": "...", "new_password": "..." }`

---

## Справочники — `/api/stores`

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/stores` | активные торговые точки |
| GET | `/api/stores/:id` | одна точка |
| GET | `/api/stores/:id/employees` | сотрудники точки (для удержания) |
| GET | `/api/stores/employees?store_id=` | все сотрудники (опц. фильтр) |

```json
// GET /api/stores
{ "stores": [ { "id": 1, "name": "Точка №1 — Абая", "address": "...", "iiko_store_id": "IIKO-STORE-001", "is_active": true } ] }
```

---

## Заявки на списание — `/api/write-offs`

### POST `/api/write-offs`  (роль: sender)
```json
// Запрос
{
  "store_id": 1,
  "type": "with_deduction",            // или "no_deduction"
  "deduction_employee_id": 2,          // обязателен только при with_deduction
  "comment": "Упавшая котлета, санитарные требования",  // мин. 10 символов
  "photo_urls": ["http://localhost:5252/uploads/ab12.jpg"],  // мин. 1
  "items": [ { "product_name": "Котлета", "quantity": 2, "unit": "шт" } ]  // опционально
}
// Ответ 201
{ "write_off": { "id": 5, "status": "pending", ... } }
```
Валидация: точка существует; тип валиден; при удержании выбран сотрудник; комментарий ≥10; ≥1 фото.

### GET `/api/write-offs`
Список с фильтрами. Sender видит только свои; reviewer/admin — все.

Query: `status` (pending|approved|rejected), `store_id`, `date_from`, `date_to` (ГГГГ-ММ-ДД), `scope=mine`, `page`, `per_page`.
```json
{ "write_offs": [ { ... } ],
  "pagination": { "page": 1, "per_page": 20, "total": 42, "pages": 3 } }
```

### GET `/api/write-offs/:id`
Деталь. Sender — только своя заявка.

### POST `/api/write-offs/:id/approve`  (роль: reviewer)
Подтверждает заявку и создаёт акт в Iiko. `409` если уже обработана.
```json
{ "write_off": { "status": "approved", "iiko_act_id": "MOCK-ACT-...", "iiko_sync_status": "synced", ... } }
```

### POST `/api/write-offs/:id/reject`  (роль: reviewer)
```json
{ "rejection_reason": "Фото не подтверждает списание" }  // мин. 5 символов
```

### POST `/api/write-offs/:id/retry-iiko`  (роль: reviewer)
Повторная синхронизация с Iiko для подтверждённой заявки (если `iiko_sync_status=failed`).

### GET `/api/write-offs/stats`
Счётчики для главной/очереди. Sender — по своим; reviewer/admin — по всем (или `?scope=mine`).
```json
{ "pending": 3, "approved": 10, "rejected": 2, "total": 15 }
```

### GET `/api/write-offs/analytics`  (роль: reviewer/admin)
Сводная аналитика для дэшборда. Считается на сервере по **всем** заявкам (не ограничена пагинацией списка). Черновики (`draft`) исключены. Query: `days` (окно тренда, 1..90, по умолч. 7), `store_id` (опц. фильтр по точке).
Деньги — **оценка**: `count × ANALYTICS_AVG_LOSS` (реальной цены в данных нет; `ANALYTICS_AVG_LOSS` задаётся через env, по умолч. 1500 ₸).
```json
{
  "totals": { "total": 15, "pending": 3, "approved": 10, "rejected": 2 },
  "with_hold": 4,
  "no_hold": 11,
  "avg_loss": 1500,
  "loss_total": 22500,
  "by_store": [ { "store_id": 1, "name": "Точка №1", "count": 9, "loss": 13500 } ],
  "by_employee": [ { "employee_id": 2, "name": "Иванов Иван", "count": 3, "loss": 4500 } ],
  "trend": [ { "date": "2026-06-22", "count": 1 }, { "date": "2026-06-28", "count": 4 } ]
}
```

---

## Загрузка фото — `/api/uploads`

### POST `/api/uploads/photo`  (multipart, поле `file`)
```json
{ "url": "http://localhost:5252/uploads/ab12cd34.jpg", "filename": "ab12cd34.jpg" }
```
Разрешены: png, jpg, jpeg, webp, heic, heif. Лимит — `MAX_UPLOAD_MB` (15 МБ).

Отдача файла: `GET /uploads/<filename>`.

---

## Администрирование — `/api/admin`  (роль: admin)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/users?role=` | список пользователей |
| POST | `/api/admin/users` | создать пользователя |
| PUT | `/api/admin/users/:id` | изменить (роль, точка, пароль, is_active) |
| DELETE | `/api/admin/users/:id` | деактивировать |
| POST | `/api/admin/stores` | создать точку |
| PUT/DELETE | `/api/admin/stores/:id` | изменить/деактивировать |
| POST | `/api/admin/employees` | создать сотрудника |
| PUT/DELETE | `/api/admin/employees/:id` | изменить/деактивировать |

```json
// POST /api/admin/users
{ "username": "sender3", "password": "secret123", "full_name": "Имя Фамилия",
  "role": "sender", "store_id": 1, "email": "u@example.com" }
```

---

## Демо-логины (после `flask db upgrade` и `flask seed`)

| Логин | Пароль | Роль |
|-------|--------|------|
| admin | admin12345 | admin |
| reviewer | reviewer123 | reviewer |
| sender1 | sender123 | sender (Точка №1) |
| sender2 | sender123 | sender (Точка №2) |
# Staff Platform API (Workday MVP)

Все маршруты ниже используют JWT access token. Время передаётся в ISO 8601 и
возвращается в UTC с суффиксом `Z`.

## Bootstrap и профиль

- `GET /api/platform/bootstrap` — пользователь, permissions, store scopes,
  feature flags, ближайшие смены, активные задачи, текущее состояние отметок и
  server-backed snapshot сервисов сотрудника.
- `PATCH /api/platform/profile` — изменение только `full_name`, `email`, `phone`.
- `GET /api/auth/me` — пользователь вместе с permissions/scopes/feature flags.

## Смены

- `GET /api/shifts?from=&to=` — назначенные опубликованные смены.
- `GET /api/shifts?open=1` — доступные открытые смены.
- `GET /api/shifts/requests`, `POST /api/shifts/{id}/requests` — запросы
  сотрудника (`open_shift`, `release`, `swap`).
- `POST /api/shifts/manager`, `PATCH /api/shifts/manager/{id}` — создание и
  изменение смены менеджером.
- `POST /api/shifts/manager/{id}/assignments`,
  `POST /api/shifts/manager/{id}/publish` — назначение и публикация.
- `GET /api/shifts/manager/requests`,
  `POST /api/shifts/manager/requests/{id}/decision` — очередь решений.

## Учёт времени

- `GET /api/time/current` — состояние и допустимые следующие действия.
- `POST /api/time/events` — `clock_in`, `break_start`, `break_end`, `clock_out`.
  Заголовок `Idempotency-Key` обязателен.
- `GET /api/time/events`, `GET /api/time/timecards` — собственная история.
- `POST /api/time/timecards/{id}/corrections` — запрос корректировки.
- `GET /api/time/manager/timecards`,
  `POST /api/time/manager/timecards/{id}/decision` — подтверждение табеля.
- `GET /api/time/manager/corrections`,
  `POST /api/time/manager/corrections/{id}/decision` — решения по корректировкам.

## Задачи, обращения, новости

- `GET /api/tasks`, `PATCH /api/tasks/{id}/steps/{step_id}`,
  `POST /api/tasks/{id}/complete|reopen` — задачи сотрудника.
- `/api/tasks/manager...` — шаблоны, назначение и проверка менеджером.
- `GET|POST /api/cases`, `POST /api/cases/{id}/messages` — обращения.
- `GET /api/news`, `POST /api/news/{id}/read` — новости и отметка прочтения.
- `GET /api/manager/today` — единая очередь смен, табелей, корректировок, задач,
  запросов документов и заявок на отсутствие. Все элементы фильтруются по
  store scopes менеджера; новые типы добавлены в ответ отдельными массивами и
  счётчиками `document_requests`/`leave_requests`.

### Повтор manager-операций

Все изменяющие manager endpoints принимают заголовок `Idempotency-Key` длиной
8–120 символов. Успешный ответ и доменное изменение фиксируются одной
транзакцией. Повтор с тем же пользователем, методом и URL возвращает исходный
ответ с `Idempotency-Replayed: true`; использование ключа для другого endpoint
возвращает `409`.

## Сервисы сотрудника

- `GET /api/employee-services` — прогресс обучения, запросы документов, заявки
  на отсутствие и предварительный баланс отпуска. Тот же snapshot вложен в
  `employee_services` ответа `/api/platform/bootstrap`.
- `POST /api/employee-services/learning/{course_id}/modules/{module_id}/complete`
  — идемпотентная отметка урока.
- `POST /api/employee-services/learning/{course_id}/assessment` с
  `{ "answer": "a" }` — серверная проверка ответа после всех уроков.
- `POST /api/employee-services/documents/requests` с `document_id` — запрос
  кадрового документа; повторный активный запрос возвращается с
  `duplicate=true`.
- `POST /api/employee-services/leave/requests` — заявка с `leave_type`,
  `starts_on`, `ends_on`, `comment`; пересечения и доступный баланс проверяются
  на сервере.
- `POST /api/employee-services/leave/requests/{id}/cancel` — отмена собственной
  заявки только в состоянии `pending`.
- `/api/employee-services/manager/documents/requests...` и
  `/api/employee-services/manager/leave/requests...` — scoped-очереди и решения
  менеджера/HR с optimistic `version`, audit и уведомлением сотрудника.

При согласовании ежегодного отпуска backend повторно проверяет актуальный
предварительный баланс. Если ранее была одобрена другая заявка и лимита уже не
хватает, решение отклоняется с `409 Conflict` и текущим `leave_balance`.

`leave_balance.preliminary=true` обязателен до подключения официальной
HR-системы. `ANNUAL_LEAVE_ALLOWANCE_DAYS` и `ANNUAL_LEAVE_USED_DAYS` — временные
конфигурационные значения; API не выдаёт их за официальный кадровый расчёт.

## Администрирование платформы

- `PUT /api/admin/platform/users/{id}/scopes` — store scopes.
- `GET|PUT /api/admin/platform/feature-flags[/<key>]` — feature flags и targets.
- `GET /api/admin/platform/audit` — append-only audit feed.

Изменяющие state machine endpoints принимают поле `version`; при устаревшей
версии возвращается `409 Conflict`.
