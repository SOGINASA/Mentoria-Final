FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

# Папки для БД и загрузок с правами на запись
RUN mkdir -p /app/database /app/static/uploads && chmod -R 777 /app/database /app/static/uploads

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5252

CMD ["/entrypoint.sh"]
