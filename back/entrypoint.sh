#!/bin/sh
set -e

echo "[entrypoint] Применение миграций БД..."
flask db upgrade

echo "[entrypoint] Инициализация демо-данных..."
flask seed || echo "[entrypoint] seed пропущен (возможно, данные уже есть)"

echo "[entrypoint] Запуск gunicorn (воркеров: ${GUNICORN_WORKERS:-2})..."
# Each worker lazily loads its own recognition model. Keep the process count
# conservative and use threads for request concurrency.
exec gunicorn --preload -w "${GUNICORN_WORKERS:-2}" --threads 8 \
    -b 0.0.0.0:5252 --timeout 180 app:app
