#!/usr/bin/env bash
# Запуск edge-детектора падений для одного ларька (Linux).
# Читает конфиг из falldetect.env рядом с собой, активирует venv и запускает
# ml/fall_detection.py. Используется systemd-юнитом falldetect.service, но
# годится и для ручного запуска: ./run_edge.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"

ENV_FILE="${FALLDETECT_ENV:-$HERE/falldetect.env}"
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
else
    echo "Нет конфига $ENV_FILE — скопируйте falldetect.env.example в falldetect.env" >&2
    exit 1
fi

# venv: по умолчанию ml/.venv (создаётся при установке, см. README)
VENV="${FALLDETECT_VENV:-$REPO_ROOT/ml/.venv}"
PYTHON="$VENV/bin/python"
[[ -x "$PYTHON" ]] || PYTHON="$(command -v python3)"

cd "$REPO_ROOT/ml"

exec "$PYTHON" fall_detection.py \
    --source "${SOURCE:-0}" \
    --model "${MODEL_PATH:-runs/detect/runs/writeoff_detector-3/weights/best.pt}" \
    --backend "$BACKEND_URL" \
    --login "$CAM_LOGIN" \
    --password "$CAM_PASSWORD" \
    --device "${DEVICE:-cpu}" \
    --conf "${CONF:-0.3}" \
    --drop-ratio "${DROP_RATIO:-0.22}" \
    --floor-ratio "${FLOOR_RATIO:-0.2}" \
    --window-sec "${WINDOW_SEC:-0.5}" \
    ${EXTRA_ARGS:-}
