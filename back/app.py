import os

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_jwt_extended.exceptions import JWTExtendedException
from werkzeug.exceptions import HTTPException

from config import get_config, DATABASE_DIR, UPLOAD_DIR
from models import db

migrate = Migrate()
jwt = JWTManager()


def create_app(config_object=None):
    app = Flask(__name__)
    app.config.from_object(config_object or get_config())

    CORS(app, supports_credentials=True, origins=app.config['CORS_ORIGINS'])

    # Папки для БД и загрузок
    os.makedirs(DATABASE_DIR, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    with app.app_context():
        db.create_all()

    # Blueprints
    from routes import auth_bp, stores_bp, writeoffs_bp, uploads_bp, admin_bp, notifications_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(stores_bp, url_prefix='/api/stores')
    app.register_blueprint(writeoffs_bp, url_prefix='/api/write-offs')
    app.register_blueprint(uploads_bp, url_prefix='/api/uploads')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')

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

    # Отдача загруженных фото
    @app.route('/uploads/<path:filename>')
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
