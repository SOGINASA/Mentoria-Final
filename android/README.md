# Bahandi — Android (WebView)

Нативная Android-обёртка над веб-приложением Bahandi (`../front`). Весь UI — это тот же
React-сайт, упакованный внутрь APK и загружаемый из `file://`. Подключён к тому же
общему бэкенду, что веб и iOS.

## Как это работает
- Веб собирается с относительными путями + **HashRouter** (`REACT_APP_HASH_ROUTER=1`) и
  кладётся в `app/src/main/assets/www`.
- `MainActivity` грузит `file:///android_asset/www/index.html` в `WebView`.
- CORS обходится через `allowUniversalAccessFromFileURLs(true)` (страница из `file://`
  ходит в `https`-API напрямую) — правок бэкенда не требуется.
- **Фото:** реализован `WebChromeClient.onShowFileChooser` — камера (через `FileProvider`)
  + галерея с **множественным выбором**. Разрешение `CAMERA` запрашивается в рантайме.

## Сборка
```bash
# 1) собрать веб-бандл в assets (нужно при каждом изменении фронта)
./build-web.sh

# 2) собрать APK
ANDROID_HOME=$HOME/Library/Android/sdk \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
gradle assembleDebug            # или ./gradlew, если сгенерён wrapper

# APK: app/build/outputs/apk/debug/app-debug.apk
```
Либо просто открыть папку `android/` в **Android Studio** и нажать Run ▶.

## Установка на устройство/эмулятор
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Конфигурация
- Адрес бэкенда берётся из веб-сборки (`front/.env` → `REACT_APP_API_URL`),
  сейчас — `https://foodtrack.beast-inside.kz/mentoria`.
- `applicationId` / namespace: `kz.itshechka.bahandi`.
- `minSdk 24`, `compileSdk/targetSdk 36`, Kotlin, без лишних зависимостей
  (только `androidx.core` ради `FileProvider`).

## Структура
```
android/
├── build-web.sh                 # сборка веб-бандла → assets
├── settings.gradle.kts · build.gradle.kts · gradle.properties
└── app/
    ├── build.gradle.kts
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/kz/itshechka/bahandi/MainActivity.kt   # WebView + выбор фото
        ├── res/ (icon, strings, file_paths)
        └── assets/www/          # сюда кладётся собранный фронт (gitignore)
```
