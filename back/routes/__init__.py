from routes.auth import auth_bp
from routes.stores import stores_bp
from routes.writeoffs import writeoffs_bp
from routes.uploads import uploads_bp
from routes.admin import admin_bp
from routes.notifications import notifications_bp

__all__ = ['auth_bp', 'stores_bp', 'writeoffs_bp', 'uploads_bp', 'admin_bp', 'notifications_bp']
