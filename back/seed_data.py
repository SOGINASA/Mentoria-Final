"""Заполнение БД демо-данными: торговые точки, сотрудники, демо-пользователи.
Идемпотентно — повторный запуск не создаёт дубликатов.

Запуск:  flask seed   (или  flask init-db  для create_all + seed)
"""

import os

from models import db, User, Store, Employee
from constants import ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN


def _get_or_create_store(name, address, iiko_store_id):
    store = Store.query.filter_by(name=name).first()
    if store:
        return store
    store = Store(name=name, address=address, iiko_store_id=iiko_store_id)
    db.session.add(store)
    db.session.flush()
    return store


def _get_or_create_employee(full_name, position, store):
    emp = Employee.query.filter_by(full_name=full_name, store_id=store.id).first()
    if emp:
        return emp
    emp = Employee(full_name=full_name, position=position, store_id=store.id)
    db.session.add(emp)
    return emp


def _get_or_create_user(username, password, full_name, role, store=None, email=None):
    user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
    if user:
        return user
    user = User(
        username=username,
        email=email,
        full_name=full_name,
        role=role,
        store_id=store.id if store else None,
    )
    user.set_password(password)
    db.session.add(user)
    return user


def seed_stores_and_employees():
    """Демо-точки и сотрудники на них."""
    stores_data = [
        ('Точка №1 — Абая', 'г. Алматы, пр. Абая, 10', 'IIKO-STORE-001'),
        ('Точка №2 — Достык', 'г. Алматы, пр. Достык, 50', 'IIKO-STORE-002'),
        ('Точка №3 — Сатпаева', 'г. Алматы, ул. Сатпаева, 22', 'IIKO-STORE-003'),
    ]
    employees_by_store = {
        'Точка №1 — Абая': [
            ('Иванов Иван', 'Повар'),
            ('Петрова Анна', 'Кассир'),
            ('Сидоров Олег', 'Сотрудник зала'),
        ],
        'Точка №2 — Достык': [
            ('Ким Сергей', 'Повар'),
            ('Ахметова Дана', 'Кассир'),
        ],
        'Точка №3 — Сатпаева': [
            ('Нурланов Арман', 'Повар'),
            ('Ли Виктория', 'Бариста'),
        ],
    }

    stores = {}
    for name, address, iiko_id in stores_data:
        store = _get_or_create_store(name, address, iiko_id)
        stores[name] = store

    for store_name, employees in employees_by_store.items():
        store = stores[store_name]
        for full_name, position in employees:
            _get_or_create_employee(full_name, position, store)

    db.session.commit()
    return stores


def seed_users(stores):
    """Демо-пользователи: админ, проверяющий и отправители."""
    admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin12345')

    _get_or_create_user(admin_username, admin_password, 'Администратор', ROLE_ADMIN)
    _get_or_create_user('reviewer', 'reviewer123', 'Проверяющий Главный', ROLE_REVIEWER)

    store1 = stores.get('Точка №1 — Абая')
    store2 = stores.get('Точка №2 — Достык')
    _get_or_create_user('sender1', 'sender123', 'Отправитель Первый', ROLE_SENDER, store=store1)
    _get_or_create_user('sender2', 'sender123', 'Отправитель Второй', ROLE_SENDER, store=store2)

    db.session.commit()


def seed_all():
    stores = seed_stores_and_employees()
    seed_users(stores)
    print('[seed] Точки, сотрудники и демо-пользователи готовы.')
    print('[seed] Логины: admin/admin12345, reviewer/reviewer123, sender1/sender123, sender2/sender123')


if __name__ == '__main__':
    from app import create_app
    app = create_app()
    with app.app_context():
        db.create_all()
        seed_all()
