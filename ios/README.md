# Bahandi — iOS (SwiftUI)

Нативное iOS-приложение системы списаний. Тот же дизайн Bahandi, адаптированный под iOS
(TabView, SF Symbols, нативная навигация, тёмная/светлая тема, RU/KZ), подключён к тому же
бэкенду Flask, что и веб (`back/`), без моков.

## Стек
- **SwiftUI**, iOS 17+
- **URLSession + async/await** (JWT с авто-refresh), `Codable`-модели
- **XcodeGen** — проект генерируется из `project.yml`
- Архитектура: `ObservableObject`-сторы (Auth, WriteOff, AppSettings)

## Открыть / запустить
```bash
cd ios
xcodegen generate          # создаёт Bahandi.xcodeproj из project.yml
open Bahandi.xcodeproj      # открыть в Xcode → Run (⌘R)
```
Или из CLI:
```bash
xcodebuild -project Bahandi.xcodeproj -scheme Bahandi \
  -sdk iphonesimulator -destination 'name=iPhone 16 Pro' build
```

> Перед запуском подними бэкенд: `cd ../back && source .venv/bin/activate && python app.py` (`:5252`).
> На симуляторе `localhost` указывает на Mac-хост, поэтому всё работает из коробки
> (для http в dev включён `NSAllowsLocalNetworking`).
> Демо-вход — кнопки «Отправитель / Проверяющий / Администратор» на экране входа.

## Структура
```
Bahandi/
├── App/                 BahandiApp (точка входа), RootView (навигация по ролям)
├── DesignSystem/        Theme (токены/цвета), Components, Formatting
├── Localization/        Strings (RU/KZ)
├── Models/              Codable-модели (User, Store, Employee, WriteOff…)
├── Networking/          APIClient (JWT+refresh, multipart upload), Endpoints
├── Stores/              AppSettings, AuthStore, WriteOffStore
└── Features/
    ├── Auth/            LoginView
    ├── Sender/          Home, CreateWriteOff (мастер + камера/галерея), MyRequests, Detail
    ├── Reviewer/        ReviewQueue, ReviewDetail (approve/reject), History
    ├── Admin/           AdminView + AdminForm (пользователи/точки/сотрудники)
    └── Common/          RequestRow, ChipBar, Detail-компоненты, Profile
```

## Конфигурация и подвязка к общему бэкенду

Бэкенд и БД — **общие** для веб- и iOS-приложений (тот же Flask `back/`). Адрес API
вынесен в **одно место** — [`Networking/AppConfig.swift`](Bahandi/Networking/AppConfig.swift).
Когда бэкенд задеплоят на хост — менять нужно одну строку.

**Окружения (переключатель `AppConfig.environment`):**
| Значение | Когда использовать | Адрес |
|----------|--------------------|-------|
| `.localSimulator` | разработка в симуляторе | `http://localhost:5252` (= Mac-хост) |
| `.localLAN` | реальный iPhone в одной Wi-Fi с Mac | `lanBaseURL` (IP Mac: `ipconfig getifaddr en0`) |
| `.production` | задеплоенный общий бэкенд | `productionBaseURL` |

**Чтобы подвязать боевой хост (быстро):**
1. В `AppConfig.swift` укажи `productionBaseURL = "https://<твой-хост>"`.
2. Переключи `environment = .production`. Готово.

> Альтернатива без правок кода: задать build-setting / Info.plist ключ `API_BASE_URL`
> (он имеет приоритет над `AppConfig`). Удобно для разных схем (Debug/Release) и CI.

**Параллель с вебом:** там адрес задаётся одной строкой в `front/.env`
(`REACT_APP_API_URL`). То есть для переезда на хост: 1 строка в `front/.env` + 1 строка в
`AppConfig.swift` — оба клиента смотрят на один бэкенд и одну БД.

**Сеть (ATS):** в dev включены `NSAllowsArbitraryLoads` + `NSAllowsLocalNetworking`,
поэтому http к `localhost`, LAN-IP и временному хосту работает без настройки.
Для App Store ограничить до нужного домена с https.

- Токены пока в `UserDefaults` (для прода вынести в Keychain).
