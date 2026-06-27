# Front — структура (реализовано)

Стек: **Create React App** + **Tailwind CSS** + **Zustand** + **React Router**.
Подход: **mobile-first** (базовые стили — телефон, `md:`/`lg:` — десктоп).
Дизайн перенесён из макета **Bahandi** (`design/`), данные — с реального API (`back/`, без моков).

```
front/
├── .env                         # REACT_APP_API_URL (адрес бэкенда)
├── tailwind.config.js           # дизайн-токены: цвета → CSS-переменные, шрифты Oswald/Onest
├── src/
│   ├── index.css                # @tailwind + CSS-переменные светлой/тёмной темы (токены Bahandi)
│   ├── index.js                 # точка входа
│   ├── App.js                   # инициализация темы + сессии, BrowserRouter
│   │
│   ├── routes/
│   │   ├── AppRouter.jsx         # карта маршрутов
│   │   └── guards.jsx            # RequireAuth / RequireRole / GuestOnly
│   │
│   ├── pages/
│   │   ├── auth/LoginPage.jsx              # вход (реальный /auth/login + демо-кнопки)
│   │   ├── sender/SenderHomePage.jsx       # главная: счётчики + CTA + последние заявки
│   │   ├── sender/CreateWriteOffPage.jsx   # мастер: фото→точка→тип→[сотрудник]→комментарий+сводка
│   │   ├── sender/MyRequestsPage.jsx       # мои заявки (табы статусов)
│   │   ├── sender/RequestDetailPage.jsx    # деталь заявки + таймлайн
│   │   ├── reviewer/ReviewQueuePage.jsx    # очередь на проверку
│   │   ├── reviewer/ReviewDetailPage.jsx   # проверка: фото+данные, подтвердить/отклонить, статус iiko
│   │   ├── reviewer/ReviewHistoryPage.jsx  # история обработанных
│   │   └── common/{ProfilePage,NotFoundPage}.jsx
│   │
│   ├── components/
│   │   ├── layout/   AppShell · Header · Sidebar (десктоп) · BottomNav (мобайл) · navConfig
│   │   ├── ui/       Logo · Icon · Button · Spinner · Tabs · StatusBadge · TypeBadge ·
│   │   │             PhotoTile · RequestCard · EmptyState · Toast · BottomSheet
│   │   └── writeoff/ BigPhoto (зум) · InfoCard · Timeline
│   │
│   ├── store/        authStore · uiStore (тема/язык/тост) · writeOffStore   (Zustand)
│   ├── api/          client (JWT + авто-refresh) · auth · stores · writeOffs · uploads
│   ├── i18n/         translations (RU/KZ) · useI18n
│   ├── constants/    roles · statuses · writeOffTypes · iiko
│   └── utils/        format (даты, инициалы)
```

## Что реализовано из ТЗ (через реальный API)

- Вход по индивидуальному доступу — `POST /api/auth/login` (JWT, авто-refresh).
- Создание заявки: загрузка фото `POST /api/uploads/photo` → `POST /api/write-offs`
  (точка, тип, сотрудник при удержании, комментарий ≥10 символов).
- Списки и история — `GET /api/write-offs` с фильтрами по статусу.
- Проверка: `POST /api/write-offs/:id/approve` (создаёт акт в iiko) и `/reject`.
- Счётчики — `GET /api/write-offs/stats`. Справочники — `GET /api/stores`, сотрудники точки.

## Маршруты

| Путь | Страница | Роль |
|------|----------|------|
| `/login` | LoginPage | гость |
| `/` · `/create` · `/my-requests` · `/my-requests/:id` | экраны отправителя | sender |
| `/review` · `/review/history` · `/review/:id` | экраны проверяющего | reviewer / admin |
| `/profile` | ProfilePage | любой |
| `*` | NotFoundPage | — |

## Особенности дизайна

- Темы **светлая/тёмная** (`data-theme` на `<html>`), переключатель в профиле и на входе.
- Язык **RU/KZ** (i18n), переключается в профиле/на входе. Сохраняются в localStorage.
- Шрифты: **Oswald** (заголовки) + **Onest** (текст). Логотип BAHANDI.
- Цвета статусов едины: 🟡 на проверке · 🟢 подтверждена · 🔴 отклонена.

## Запуск

```bash
# 1) бэкенд (см. back/README.md): flask --app app init-db && python app.py  → :5252
# 2) фронт:
cd front && npm install && npm start                                        → :3000
```
