# Front — файловая структура

Стек: **Create React App** + **Tailwind CSS** + **Zustand** + **React Router**.
Подход: **mobile-first** (базовые стили — под телефон, `md:`/`lg:` — расширение под десктоп).

```
front/
├── public/
│   └── index.html
├── src/
│   ├── index.js                 # точка входа, маунт <App/>
│   ├── index.css                # подключение Tailwind (@tailwind base/components/utilities)
│   ├── App.js                   # корневой компонент: провайдеры + роутер
│   │
│   ├── routes/                  # маршрутизация
│   │   ├── AppRouter.jsx        # карта всех маршрутов
│   │   └── ProtectedRoute.jsx   # доступ по роли (отправитель / проверяющий)
│   │
│   ├── pages/                   # экраны (по ролям)
│   │   ├── auth/
│   │   │   └── LoginPage.jsx            # вход (индивидуальный доступ)
│   │   ├── sender/                      # роль «Отправитель»
│   │   │   ├── SenderHomePage.jsx       # главная отправителя
│   │   │   ├── CreateWriteOffPage.jsx   # форма создания заявки (мастер по шагам)
│   │   │   ├── MyRequestsPage.jsx       # мои заявки / история
│   │   │   └── RequestDetailPage.jsx    # детально по своей заявке (статус)
│   │   ├── reviewer/                     # роль «Проверяющий»
│   │   │   ├── ReviewQueuePage.jsx      # очередь заявок на проверку
│   │   │   ├── ReviewDetailPage.jsx     # проверка заявки: фото + инфо + решение
│   │   │   └── ReviewHistoryPage.jsx    # история обработанных заявок
│   │   └── common/
│   │       ├── ProfilePage.jsx          # профиль / выход
│   │       └── NotFoundPage.jsx         # 404
│   │
│   ├── components/
│   │   ├── layout/              # каркас интерфейса
│   │   │   ├── AppShell.jsx     # обёртка: контент + навигация (адаптив)
│   │   │   ├── Header.jsx       # верхняя панель (заголовок, профиль)
│   │   │   ├── BottomNav.jsx    # нижняя навигация (мобайл, основной способ навигации)
│   │   │   └── Sidebar.jsx      # боковое меню (десктоп)
│   │   └── ui/                  # переиспользуемые элементы
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Textarea.jsx     # комментарий (со счётчиком символов)
│   │       ├── Select.jsx       # выбор точки / сотрудника
│   │       ├── PhotoUpload.jsx  # съёмка/загрузка фото + превью
│   │       ├── Modal.jsx        # подтверждения (одобрить/отклонить)
│   │       ├── StatusBadge.jsx  # статус заявки (на проверке/одобрена/отклонена)
│   │       ├── Card.jsx         # карточка заявки в списке
│   │       ├── Spinner.jsx
│   │       └── EmptyState.jsx   # пустые списки
│   │
│   ├── store/                   # Zustand-стораджи
│   │   ├── authStore.js         # пользователь, роль, токен, login/logout
│   │   ├── writeOffStore.js     # заявки: создание, список, фильтры, действия
│   │   └── uiStore.js           # модалки, тосты, состояние навигации
│   │
│   ├── api/                     # слой данных (общение с back)
│   │   ├── client.js            # базовый HTTP-клиент
│   │   ├── auth.api.js
│   │   ├── writeOffs.api.js
│   │   └── stores.api.js        # точки и сотрудники
│   │
│   ├── constants/
│   │   ├── roles.js             # SENDER / REVIEWER
│   │   ├── statuses.js          # PENDING / APPROVED / REJECTED
│   │   └── writeOffTypes.js     # без удержания / с удержанием
│   │
│   ├── hooks/                   # кастомные хуки
│   ├── utils/                   # форматтеры, валидация (мин. 10 символов и т.п.)
│   └── assets/                  # иконки, картинки
├── tailwind.config.js          # дизайн-токены (заполняется на этапе дизайна)
├── postcss.config.js
├── DESIGN-SPEC.md              # постраничное описание для дизайна
└── STRUCTURE.md                # этот файл
```

## Принципы

- **Mobile-first.** Верстаем сначала под телефон, через `md:` / `lg:` адаптируем под десктоп.
  Навигация: на мобиле — нижний таб-бар (`BottomNav`), на десктопе — боковое меню (`Sidebar`).
- **Разделение по ролям.** `pages/sender` и `pages/reviewer` строго разделены, доступ — через
  `ProtectedRoute` по роли из `authStore`.
- **Состояние — в Zustand.** UI-компоненты «тупые», логика и данные — в стораджах.
- **`api/` изолирует back.** Компоненты не знают про эндпоинты; всё через слой `api`.

## Маршруты (карта)

| Путь                     | Страница             | Роль         |
|--------------------------|----------------------|--------------|
| `/login`                 | LoginPage            | гость        |
| `/`                      | SenderHomePage       | отправитель  |
| `/create`                | CreateWriteOffPage   | отправитель  |
| `/my-requests`           | MyRequestsPage       | отправитель  |
| `/my-requests/:id`       | RequestDetailPage    | отправитель  |
| `/review`                | ReviewQueuePage      | проверяющий  |
| `/review/:id`            | ReviewDetailPage     | проверяющий  |
| `/review/history`        | ReviewHistoryPage    | проверяющий  |
| `/profile`               | ProfilePage          | любой        |
| `*`                      | NotFoundPage         | любой        |
