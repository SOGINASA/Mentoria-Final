#!/bin/sh
set -e

echo "[entrypoint] Инициализация БД и демо-данных..."
flask init-db || echo "[entrypoint] init-db пропущен (возможно, данные уже есть)"

echo "[entrypoint] Запуск gunicorn (воркеров: ${GUNICORN_WORKERS:-2})..."
# Каждый воркер грузит свою копию YOLO-моделей при первом запросе — поэтому
# воркеров держим немного (GUNICORN_WORKERS), а конкурентность даём потоками.
# timeout 180: первый запрос с инференсом на CPU прогревает torch дольше.
exec gunicorn --preload -w "${GUNICORN_WORKERS:-2}" --threads 8 \
    -b 0.0.0.0:5252 --timeout 180 app:app
