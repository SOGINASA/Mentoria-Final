FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# ultralytics/matplotlib пишут свои настройки/кэш — направляем в /tmp (на запись)
ENV YOLO_CONFIG_DIR=/tmp/Ultralytics
ENV MPLCONFIGDIR=/tmp/mpl

WORKDIR /app

# Системные библиотеки для OpenCV (его как зависимость тянет ultralytics).
# Без них cv2 не импортируется → распознавание молча отключается.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# torch/torchvision — ТОЛЬКО CPU-сборка (без CUDA): образ меньше на ~2 ГБ.
# Ставим до requirements, чтобы ultralytics подхватил уже готовый torch.
# Не нужен ИИ? Выставь RECOGNITION_ENABLED=0, эту строку и ultralytics можно убрать.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision \
    && pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

# Папки для БД и загрузок с правами на запись
RUN mkdir -p /app/database /app/static/uploads && chmod -R 777 /app/database /app/static/uploads

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5252

CMD ["/entrypoint.sh"]
