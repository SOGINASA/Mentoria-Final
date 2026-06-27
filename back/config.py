import os
from datetime import timedelta

# Пути проекта
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BACKEND_DIR, 'database')
UPLOAD_DIR = os.path.join(BACKEND_DIR, 'static', 'uploads')


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    # База данных — всегда предпочитаем DATABASE_URL из окружения.
    # В docker-compose задаётся: DATABASE_URL=sqlite:////app/database/database.db
    # Без него создаётся ЛОКАЛЬНЫЙ SQLite-файл (для разработки).
    _db_url_from_env = os.environ.get('DATABASE_URL')
    if not _db_url_from_env:
        import sys
        _local_path = os.path.join(DATABASE_DIR, 'database.db')
        print(
            f"[WARNING] DATABASE_URL не задан. Используется локальный файл: {_local_path}",
            file=sys.stderr,
        )
    SQLALCHEMY_DATABASE_URI = _db_url_from_env or f'sqlite:///{os.path.join(DATABASE_DIR, "database.db")}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # CORS — домены фронтенда (CRA dev = 3000, Vite = 5173)
    CORS_ORIGINS = [
        o.strip() for o in os.environ.get(
            'CORS_ORIGINS',
            'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173'
        ).split(',') if o.strip()
    ]

    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get('JWT_ACCESS_HOURS', '24')))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', '30')))

    # Загрузка фото
    UPLOAD_FOLDER = UPLOAD_DIR
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_UPLOAD_MB', '15')) * 1024 * 1024  # 15 МБ по умолчанию
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'}
    # Базовый публичный URL бэкенда (для формирования абсолютных ссылок на фото)
    API_BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:5252')

    # Iiko интеграция
    # IIKO_MODE: 'mock' (имитация) | 'real' (реальный API, нужны креды)
    IIKO_MODE = os.environ.get('IIKO_MODE', 'mock')
    IIKO_BASE_URL = os.environ.get('IIKO_BASE_URL', '')
    IIKO_API_LOGIN = os.environ.get('IIKO_API_LOGIN', '')
    IIKO_API_TOKEN = os.environ.get('IIKO_API_TOKEN', '')
    IIKO_DEFAULT_STORE_ID = os.environ.get('IIKO_DEFAULT_STORE_ID', '')

    # Первый администратор (создаётся сидером, если БД пустая)
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin12345')


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    IIKO_MODE = 'mock'


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,
}


def get_config():
    return config[os.environ.get('FLASK_ENV') or 'default']
