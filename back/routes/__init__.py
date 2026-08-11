from routes.auth import auth_bp
from routes.stores import stores_bp
from routes.writeoffs import writeoffs_bp
from routes.uploads import uploads_bp
from routes.admin import admin_bp
from routes.notifications import notifications_bp
from routes.webauthn import webauthn_bp
from routes.platform import platform_bp
from routes.shifts import shifts_bp
from routes.time_tracking import time_tracking_bp
from routes.tasks import tasks_bp
from routes.cases import cases_bp
from routes.news import news_bp
from routes.manager import manager_bp
from routes.admin_platform import admin_platform_bp
from routes.employee_services import employee_services_bp

__all__ = [
    'auth_bp', 'stores_bp', 'writeoffs_bp', 'uploads_bp', 'admin_bp',
    'notifications_bp', 'webauthn_bp', 'platform_bp', 'shifts_bp',
    'time_tracking_bp', 'tasks_bp', 'cases_bp', 'news_bp', 'manager_bp',
    'admin_platform_bp', 'employee_services_bp',
]
