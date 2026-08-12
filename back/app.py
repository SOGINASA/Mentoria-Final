import os

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_jwt_extended.exceptions import JWTExtendedException
from werkzeug.exceptions import HTTPException
from sqlalchemy import inspect as sa_inspect, text

from config import get_config, DATABASE_DIR, UPLOAD_DIR
from models import db
# Register the staff-platform tables in the shared SQLAlchemy metadata before
# create_all/migrations run.  The import is intentionally side-effect only.
import platform_models  # noqa: F401, E402

migrate = Migrate()
jwt = JWTManager()


# Колонки, добавленные в модели уже ПОСЛЕ первых деплоев. db.create_all() не
# доливает их в существующую таблицу (создаёт только отсутствующие таблицы), а
# Flask-Migrate-миграций в проекте нет. Поэтому досоздаём недостающие колонки
# идемпотентно на старте — иначе INSERT с новым полем падает с
# OperationalError: table ... has no column named ...
# Формат: (таблица, колонка, DDL-тип с DEFAULT для бэкфилла существующих строк).
_SCHEMA_PATCHES = [
    ('write_offs', 'source', "VARCHAR(20) NOT NULL DEFAULT 'manual'"),
    ('write_offs', 'deduct_all', "BOOLEAN NOT NULL DEFAULT 0"),
    ('users', 'employee_id', "INTEGER"),
    ('stores', 'timezone', "VARCHAR(64) NOT NULL DEFAULT 'Asia/Almaty'"),
    ('notifications', 'entity_type', "VARCHAR(40)"),
    ('notifications', 'entity_id', "INTEGER"),
    ('notifications', 'action_url', "VARCHAR(500)"),
    ('notifications', 'priority', "VARCHAR(20) NOT NULL DEFAULT 'normal'"),
    ('notifications', 'read_at', "DATETIME"),
    ('notifications', 'expires_at', "DATETIME"),
]


def _ensure_schema():
    """Идемпотентно добавляет недостающие колонки в уже созданные таблицы."""
    inspector = sa_inspect(db.engine)
    tables = set(inspector.get_table_names())
    for table, column, ddl in _SCHEMA_PATCHES:
        if table not in tables:
            continue  # таблицы ещё нет — create_all() создаст её сразу с колонкой
        if column in {c['name'] for c in inspector.get_columns(table)}:
            continue  # колонка уже есть — ничего не делаем
        db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))
        db.session.commit()
        print(f'[schema] добавлена недостающая колонка {table}.{column}')


def _ensure_sender_employee_links():
    """Связывает старые аккаунты отправителей с карточкой сотрудника.

    Раньше такой связи в схеме не было. Для существующих аккаунтов сначала
    ищем сотрудника точки по ФИО, а если его нет — создаём карточку с тем же
    именем. Благодаря этому «Списать с меня» работает сразу после обновления.
    """
    from constants import ROLE_SENDER
    from models import User, Employee

    changed = False
    users = User.query.filter_by(role=ROLE_SENDER, is_active=True).all()
    for user in users:
        if user.employee_id or not user.store_id:
            continue
        employee = Employee.query.filter(
            Employee.store_id == user.store_id,
            db.func.lower(Employee.full_name) == user.full_name.strip().lower(),
        ).first()
        if not employee:
            employee = Employee(
                full_name=user.full_name.strip(), position='Отправитель',
                store_id=user.store_id, is_active=True,
            )
            db.session.add(employee)
            db.session.flush()
        user.employee_id = employee.id
        changed = True
    if changed:
        db.session.commit()


def create_app(config_object=None):
    app = Flask(__name__)
    app.config.from_object(config_object or get_config())

    CORS(app, supports_credentials=True, origins=app.config['CORS_ORIGINS'])

    # Печатаем адрес, из которого собираются ссылки на фото: если он не совпадает
    # с публичным адресом API (включая префикс за nginx, напр. https://host/bahandi),
    # картинки в интерфейсе будут битыми — причём молча, без ошибок в консоли
    # браузера (фронтовый nginx вернёт на такой путь 200 и index.html).
    print(f"[config] API_BASE_URL={app.config['API_BASE_URL']} (база для ссылок на фото)")

    # Папки для БД и загрузок
    os.makedirs(DATABASE_DIR, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    with app.app_context():
        # Tests own an isolated in-memory schema.  Runtime databases are
        # upgraded by Alembic in entrypoint.sh; importing the app must not
        # mutate production schema implicitly.
        if app.config.get('TESTING'):
            db.create_all()
            _ensure_schema()
            _ensure_sender_employee_links()

    # Blueprints
    from routes import (
        auth_bp, stores_bp, writeoffs_bp, uploads_bp, admin_bp,
        notifications_bp, webauthn_bp,
        platform_bp, shifts_bp, time_tracking_bp, tasks_bp, cases_bp, news_bp,
        manager_bp, admin_platform_bp,
        employee_services_bp, hr_bp, finance_bp, operations_bp,
    )
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(stores_bp, url_prefix='/api/stores')
    app.register_blueprint(writeoffs_bp, url_prefix='/api/write-offs')
    app.register_blueprint(uploads_bp, url_prefix='/api/uploads')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    app.register_blueprint(webauthn_bp, url_prefix='/api/auth/webauthn')
    app.register_blueprint(platform_bp, url_prefix='/api/platform')
    app.register_blueprint(shifts_bp, url_prefix='/api/shifts')
    app.register_blueprint(time_tracking_bp, url_prefix='/api/time')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(cases_bp, url_prefix='/api/cases')
    app.register_blueprint(news_bp, url_prefix='/api/news')
    app.register_blueprint(manager_bp, url_prefix='/api/manager')
    app.register_blueprint(admin_platform_bp, url_prefix='/api/admin/platform')
    app.register_blueprint(employee_services_bp, url_prefix='/api/employee-services')
    app.register_blueprint(hr_bp, url_prefix='/api/hr')
    app.register_blueprint(finance_bp, url_prefix='/api/finance')
    app.register_blueprint(operations_bp, url_prefix='/api/operations')

    _register_misc_routes(app)
    _register_error_handlers(app)
    _register_cli(app)

    return app


def _register_misc_routes(app):
    @app.route('/api')
    def api_info():
        return jsonify({
            'message': 'WriteOff API is alive',
            'version': '1.0.0',
            'description': 'Система автоматизации списаний на торговых точках',
            'endpoints': {
                'auth': '/api/auth — вход, refresh, профиль',
                'webauthn': '/api/auth/webauthn — вход по биометрии (Face ID/Touch ID/passkey)',
                'stores': '/api/stores — точки и их сотрудники',
                'write_offs': '/api/write-offs — заявки на списание',
                'uploads': '/api/uploads/photo — загрузка фото',
                'admin': '/api/admin — управление пользователями/точками/сотрудниками',
                'notifications': '/api/notifications — лента уведомлений (падения/проверка)',
            },
        })

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok'})

    # Отдача загруженных фото.
    # Путей несколько намеренно: ссылка на фото собирается из API_BASE_URL, а его
    # на разных стендах задают то как адрес хоста (…/bahandi), то как адрес API
    # (…/bahandi/api). Во втором случае ссылка получается вида /api/uploads/<файл>,
    # и без этого роута фото просто не открывались.
    # У алиаса конвертер без слэшей (<filename>, а не <path:filename>), чтобы он
    # не перехватывал уже существующий /api/uploads/files/<файл>.
    @app.route('/uploads/<path:filename>')
    @app.route('/api/uploads/<filename>')
    @app.route('/api/uploads/files/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


def _register_error_handlers(app):
    @app.errorhandler(JWTExtendedException)
    def handle_jwt_error(e):
        return jsonify({'error': 'Ошибка авторизации', 'message': str(e)}), 401

    @app.errorhandler(HTTPException)
    def handle_http_exception(e):
        return jsonify({'error': e.name, 'message': e.description}), e.code

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify({'error': 'Токен истёк'}), 401

    @jwt.invalid_token_loader
    def invalid_token(error):
        return jsonify({'error': 'Недействительный токен'}), 401

    @jwt.unauthorized_loader
    def missing_token(error):
        return jsonify({'error': 'Требуется авторизация'}), 401


def _register_cli(app):
    @app.cli.command('init-db')
    def init_db():
        """Создать таблицы и заполнить демо-данными."""
        from seed_data import seed_all
        db.create_all()
        seed_all()
        print('База данных инициализирована.')

    @app.cli.command('seed')
    def seed():
        """Заполнить демо-данными (точки, сотрудники, демо-пользователи)."""
        from seed_data import seed_all
        seed_all()
        print('Демо-данные загружены.')


app = create_app()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5252)
