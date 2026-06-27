#!/bin/sh
set -e

echo "[entrypoint] Инициализация БД и демо-данных..."
flask init-db || echo "[entrypoint] init-db пропущен (возможно, данные уже есть)"

echo "[entrypoint] Запуск gunicorn..."
exec gunicorn --preload -w 4 --threads 8 -b 0.0.0.0:5252 --timeout 120 app:app
