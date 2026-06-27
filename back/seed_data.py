"""Заполнение БД демо-данными: торговые точки (из CSV), сотрудники, демо-пользователи.
Идемпотентно — повторный запуск не создаёт дубликатов.

Точки берутся из stores_rows.csv (реальный список точек Bahandi).

Запуск:  flask seed   (или  flask init-db  для create_all + seed)
"""

import csv
import os

from models import db, User, Store, Employee
from constants import ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN

# CSV с точками лежит рядом с этим файлом
STORES_CSV = os.path.join(os.path.dirname(__file__), 'stores_rows.csv')


def _get_or_create_store(name, address, iiko_store_id=None):
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


def seed_stores_from_csv():
    """Торговые точки из stores_rows.csv. Город склеивается с адресом
    (в модели Store отдельной колонки city нет — схему не трогаем)."""
    stores = []
    if not os.path.exists(STORES_CSV):
        print(f'[seed] CSV не найден: {STORES_CSV} — точки не загружены')
        return stores

    with open(STORES_CSV, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            name = (row.get('name') or '').strip()
            if not name:
                continue
            address = (row.get('address') or '').strip()
            city = (row.get('city') or '').strip()
            full_address = ', '.join(p for p in (address, city) if p)
            stores.append(_get_or_create_store(name, full_address))

    db.session.commit()
    print(f'[seed] Загружено точек из CSV: {len(stores)}')
    return stores


# Сотрудники добавляются на первые несколько точек — чтобы работал
# сценарий списания «с удержанием» (выбор сотрудника).
DEMO_EMPLOYEES = [
    ('Иванов Иван', 'Повар'),
    ('Петрова Анна', 'Кассир'),
    ('Сидоров Олег', 'Сотрудник зала'),
    ('Ким Сергей', 'Повар'),
    ('Ахметова Дана', 'Бариста'),
]


def seed_employees(stores):
    for store in stores[:3]:
        for full_name, position in DEMO_EMPLOYEES:
            _get_or_create_employee(full_name, position, store)
    db.session.commit()


def seed_users(stores):
    """Демо-пользователи: админ, проверяющий и отправители.
    Отправители привязываются к первым точкам из CSV."""
    admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin12345')

    _get_or_create_user(admin_username, admin_password, 'Администратор', ROLE_ADMIN)
    _get_or_create_user('reviewer', 'reviewer123', 'Проверяющий Главный', ROLE_REVIEWER)

    store1 = stores[0] if len(stores) > 0 else None
    store2 = stores[1] if len(stores) > 1 else None
    _get_or_create_user('sender1', 'sender123', 'Отправитель Первый', ROLE_SENDER, store=store1)
    _get_or_create_user('sender2', 'sender123', 'Отправитель Второй', ROLE_SENDER, store=store2)

    db.session.commit()


def seed_all():
    stores = seed_stores_from_csv()
    seed_employees(stores)
    seed_users(stores)
    print('[seed] Точки, сотрудники и демо-пользователи готовы.')
    print('[seed] Логины: admin/admin12345, reviewer/reviewer123, sender1/sender123, sender2/sender123')


if __name__ == '__main__':
    from app import create_app
    app = create_app()
    with app.app_context():
        db.create_all()
        seed_all()
