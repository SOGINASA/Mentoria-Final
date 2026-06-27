"""Модели БД системы автоматизации списаний на торговых точках."""

from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

from constants import (
    ROLE_SENDER, STATUS_PENDING, TYPE_NO_DEDUCTION, IIKO_NONE, SOURCE_MANUAL,
)

db = SQLAlchemy()


def _utc_iso(dt):
    """datetime -> ISO-строка с суффиксом Z для UTC."""
    if dt is None:
        return None
    s = dt.isoformat()
    if not s.endswith('Z') and '+' not in s:
        s += 'Z'
    return s


def _now():
    return datetime.now(timezone.utc)


class User(db.Model):
    """Пользователь системы. Логинится по username или email.
    Аккаунты заводит администратор (публичной регистрации нет)."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=True, index=True)
    phone = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)

    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default=ROLE_SENDER, index=True)  # sender|reviewer|admin

    # Закреплённая за отправителем точка (предзаполняется в форме создания)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True, index=True)

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=_now)
    last_login = db.Column(db.DateTime)

    store = db.relationship('Store', foreign_keys=[store_id])
    write_offs = db.relationship(
        'WriteOff', backref='author', lazy='dynamic',
        foreign_keys='WriteOff.author_id', cascade='all, delete-orphan'
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'phone': self.phone,
            'full_name': self.full_name,
            'role': self.role,
            'store_id': self.store_id,
            'store': self.store.to_dict() if self.store else None,
            'is_active': self.is_active,
            'created_at': _utc_iso(self.created_at),
            'last_login': _utc_iso(self.last_login),
        }


class Store(db.Model):
    """Торговая точка."""
    __tablename__ = 'stores'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.String(255))
    # Идентификатор склада/точки в Iiko (нужен для создания акта списания)
    iiko_store_id = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=_now)

    employees = db.relationship(
        'Employee', backref='store', lazy='dynamic', cascade='all, delete-orphan'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'iiko_store_id': self.iiko_store_id,
            'is_active': self.is_active,
        }


class Employee(db.Model):
    """Сотрудник торговой точки — кандидат на удержание.
    Это справочник, не обязательно совпадает с пользователями приложения."""
    __tablename__ = 'employees'

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    position = db.Column(db.String(80))
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True, index=True)
    # Идентификатор сотрудника в Iiko (для привязки удержания)
    iiko_employee_id = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=_now)

    def to_dict(self):
        return {
            'id': self.id,
            'full_name': self.full_name,
            'position': self.position,
            'store_id': self.store_id,
            'is_active': self.is_active,
        }


class WriteOff(db.Model):
    """Заявка на списание продукции."""
    __tablename__ = 'write_offs'

    id = db.Column(db.Integer, primary_key=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)

    type = db.Column(db.String(20), nullable=False, default=TYPE_NO_DEDUCTION)  # no_deduction|with_deduction
    # Сотрудник, с которого удержание (только при type=with_deduction)
    deduction_employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)

    comment = db.Column(db.Text, nullable=False)  # обязательный, мин. 10 символов (валидация в роуте)
    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING, index=True)
    # Источник: manual (создал сотрудник) | auto_fall (камера+ML по падению)
    source = db.Column(db.String(20), nullable=False, default=SOURCE_MANUAL, index=True)

    # Проверка
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    # Интеграция с Iiko
    iiko_act_id = db.Column(db.String(100), nullable=True)
    iiko_sync_status = db.Column(db.String(20), default=IIKO_NONE, nullable=False)  # none|pending|synced|failed
    iiko_synced_at = db.Column(db.DateTime, nullable=True)
    iiko_error = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=_now, index=True)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    store = db.relationship('Store', foreign_keys=[store_id])
    reviewer = db.relationship('User', foreign_keys=[reviewer_id])
    deduction_employee = db.relationship('Employee', foreign_keys=[deduction_employee_id])
    photos = db.relationship(
        'WriteOffPhoto', backref='write_off', lazy='joined', cascade='all, delete-orphan'
    )
    items = db.relationship(
        'WriteOffItem', backref='write_off', lazy='joined', cascade='all, delete-orphan'
    )

    def to_dict(self, include_author=True):
        data = {
            'id': self.id,
            'author_id': self.author_id,
            'store_id': self.store_id,
            'store': self.store.to_dict() if self.store else None,
            'type': self.type,
            'source': self.source,
            'deduction_employee_id': self.deduction_employee_id,
            'deduction_employee': self.deduction_employee.to_dict() if self.deduction_employee else None,
            'comment': self.comment,
            'status': self.status,
            'reviewer_id': self.reviewer_id,
            'reviewer': {
                'id': self.reviewer.id,
                'full_name': self.reviewer.full_name,
            } if self.reviewer else None,
            'rejection_reason': self.rejection_reason,
            'reviewed_at': _utc_iso(self.reviewed_at),
            'iiko_act_id': self.iiko_act_id,
            'iiko_sync_status': self.iiko_sync_status,
            'iiko_synced_at': _utc_iso(self.iiko_synced_at),
            'iiko_error': self.iiko_error,
            'photos': [p.to_dict() for p in self.photos],
            'items': [i.to_dict() for i in self.items],
            'created_at': _utc_iso(self.created_at),
            'updated_at': _utc_iso(self.updated_at),
        }
        if include_author:
            data['author'] = {
                'id': self.author.id,
                'full_name': self.author.full_name,
                'username': self.author.username,
            } if self.author else None
        return data


class WriteOffPhoto(db.Model):
    """Фото продукции, прикреплённое к заявке (подтверждение состояния)."""
    __tablename__ = 'write_off_photos'

    id = db.Column(db.Integer, primary_key=True)
    write_off_id = db.Column(db.Integer, db.ForeignKey('write_offs.id'), nullable=False, index=True)
    url = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=_now)

    def to_dict(self):
        return {'id': self.id, 'url': self.url}


class WriteOffItem(db.Model):
    """Позиция списания (продукт + количество). Опционально — нужно
    для формирования детального акта в Iiko."""
    __tablename__ = 'write_off_items'

    id = db.Column(db.Integer, primary_key=True)
    write_off_id = db.Column(db.Integer, db.ForeignKey('write_offs.id'), nullable=False, index=True)
    product_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Float, default=1)
    unit = db.Column(db.String(20), default='шт')
    # Идентификатор номенклатуры в Iiko (если известен)
    iiko_product_id = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'product_name': self.product_name,
            'quantity': self.quantity,
            'unit': self.unit,
            'iiko_product_id': self.iiko_product_id,
        }


class Notification(db.Model):
    """Уведомление пользователю (лента, опрашивается фронтом).
    Используется для авто-падений: сотруднику — подтвердить черновик,
    проверяющему — новая заявка ожидает проверки."""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)  # получатель
    kind = db.Column(db.String(30), nullable=False)  # fall_draft | review_pending
    title = db.Column(db.String(160), nullable=False)
    body = db.Column(db.Text, nullable=True)
    write_off_id = db.Column(db.Integer, db.ForeignKey('write_offs.id'), nullable=True, index=True)
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=_now, index=True)

    write_off = db.relationship('WriteOff', foreign_keys=[write_off_id])

    def to_dict(self):
        wo = self.write_off
        return {
            'id': self.id,
            'kind': self.kind,
            'title': self.title,
            'body': self.body,
            'write_off_id': self.write_off_id,
            'is_read': self.is_read,
            'created_at': _utc_iso(self.created_at),
            # Короткая сводка по заявке для карточки уведомления
            'write_off': {
                'id': wo.id,
                'status': wo.status,
                'source': wo.source,
                'photo_url': wo.photos[0].url if wo.photos else None,
            } if wo else None,
        }
