# Mentoria Hackathon — Система автоматизации списаний на торговых точках

Веб-приложение (mobile-first + desktop) для цифровизации процесса списания продукции
на торговых точках с проверкой ответственным сотрудником и интеграцией с iiko.

## Структура репозитория

```
.
├── front/   — веб-клиент (Create React App + Tailwind CSS + Zustand)
├── ios/     — нативное iOS-приложение (SwiftUI, XcodeGen)
├── android/ — Android-обёртка (WebView вокруг веб-клиента, Kotlin)
└── back/    — сервер (API, интеграция с iiko)
```

## Роли

- **Отправитель** (сотрудник торговой точки) — создаёт заявки на списание.
- **Проверяющий** — подтверждает / отклоняет заявки, инициирует акт списания в iiko.

## Запуск фронта

```bash
cd front
npm install
npm start
```

Открывается на http://localhost:3000

## Документация

- [`front/STRUCTURE.md`](front/STRUCTURE.md) — файловая структура клиента.
- [`front/DESIGN-SPEC.md`](front/DESIGN-SPEC.md) — постраничное описание для дизайна (Claude Design).
