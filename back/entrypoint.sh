#!/bin/sh
set -e

DATABASE_FILE_PATH="${SQLITE_DATABASE_FILE:-/app/database/database.db}"
if [ -f "$DATABASE_FILE_PATH" ]; then
    BACKUP_FILE_PATH="${DATABASE_FILE_PATH}.pre-migration-$(date -u +%Y%m%dT%H%M%SZ).bak"
    echo "[entrypoint] Резервная копия SQLite: $BACKUP_FILE_PATH"
    cp -p "$DATABASE_FILE_PATH" "$BACKUP_FILE_PATH"
fi

echo "[entrypoint] Применение миграций БД..."
flask db upgrade

echo "[entrypoint] Инициализация демо-данных..."
flask seed || echo "[entrypoint] seed пропущен (возможно, данные уже есть)"

echo "[entrypoint] Запуск gunicorn (воркеров: ${GUNICORN_WORKERS:-2})..."
# Each worker lazily loads its own recognition model. Keep the process count
# conservative and use threads for request concurrency.
exec gunicorn --preload -w "${GUNICORN_WORKERS:-2}" --threads 8 \
    -b 0.0.0.0:5252 --timeout 180 app:app
