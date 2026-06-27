"""Заполнение БД демо-данными: торговые точки (из CSV), сотрудники, демо-пользователи.
Идемпотентно — повторный запуск не создаёт дубликатов.

Точки берутся из stores_rows.csv (реальный список точек Bahandi).

Запуск:  flask seed   (или  flask init-db  для create_all + seed)
"""

import csv
import os
import random
from datetime import datetime, timezone, timedelta

from models import db, User, Store, Employee, WriteOff, WriteOffPhoto
from constants import (
    ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN,
    STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED,
    TYPE_NO_DEDUCTION, TYPE_WITH_DEDUCTION, SOURCE_MANUAL,
    IIKO_SYNCED,
)

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


# Демо-заявки для наполнения дэшборда аналитики.
DEMO_REASONS = [
    'Товар испорчен, истёк срок годности',
    'Повреждённая упаковка при приёмке',
    'Продукт уронили на пол — санитарные нормы',
    'Брак партии, нетоварный вид',
    'Подтаявшее мороженое, продать нельзя',
    'Помятые булочки, витринный вид потерян',
    'Разбитая бутылка при выкладке',
    'Просрочка молочной продукции',
]
DEMO_PHOTO_URL = 'https://placehold.co/600x400?text=Demo+write-off'

# Сколько заявок сгенерировать и за сколько прошедших дней их «размазать».
DEMO_WRITEOFFS_COUNT = 60
DEMO_WRITEOFFS_DAYS = 14


def seed_write_offs(stores):
    """Демо-заявки на списание для аналитики: разные статусы/типы/точки/даты.

    Идемпотентно: если в БД уже есть заявки — пропускаем (не плодим дубли и
    не трогаем реальные данные). Заявки концентрируются на первых точках, где
    есть сотрудники, чтобы работала аналитика «удержания по сотрудникам».
    """
    if WriteOff.query.count() > 0:
        print('[seed] Заявки уже есть — генерацию демо-аналитики пропускаем.')
        return

    senders = User.query.filter_by(role=ROLE_SENDER).all()
    reviewer = User.query.filter_by(role=ROLE_REVIEWER).first()
    if not senders:
        print('[seed] Нет отправителей — демо-заявки не создаём.')
        return

    # Точки с сотрудниками (для списаний «с удержанием»). Падаем назад на все.
    candidate_stores = [s for s in stores[:6] if s] or Store.query.limit(6).all()
    if not candidate_stores:
        print('[seed] Нет точек — демо-заявки не создаём.')
        return

    rnd = random.Random(42)  # детерминированно — повторяемый демо-набор
    # Статусы с весами: больше подтверждённых, часть на проверке/отклонена.
    status_pool = (
        [STATUS_APPROVED] * 6 + [STATUS_PENDING] * 3 + [STATUS_REJECTED] * 2
    )
    # Первые точки весомее — объём концентрируется там, где есть сотрудники,
    # чтобы аналитика «по точкам» и «удержания по сотрудникам» была наглядной.
    store_weights = [len(candidate_stores) - idx for idx in range(len(candidate_stores))]
    # Свежие дни весомее — чтобы 7-дневный тренд был наполнен.
    day_weights = [DEMO_WRITEOFFS_DAYS - d for d in range(DEMO_WRITEOFFS_DAYS)]
    now = datetime.now(timezone.utc)

    created = 0
    for i in range(DEMO_WRITEOFFS_COUNT):
        store = rnd.choices(candidate_stores, weights=store_weights)[0]
        author = rnd.choice(senders)
        status = rnd.choice(status_pool)

        # Тип: ~40% с удержанием, если на точке есть сотрудники.
        store_emps = Employee.query.filter_by(store_id=store.id, is_active=True).all()
        if store_emps and rnd.random() < 0.4:
            wo_type = TYPE_WITH_DEDUCTION
            employee = rnd.choice(store_emps)
        else:
            wo_type = TYPE_NO_DEDUCTION
            employee = None

        day_offset = rnd.choices(range(DEMO_WRITEOFFS_DAYS), weights=day_weights)[0]
        created_at = now - timedelta(
            days=day_offset, hours=rnd.randint(0, 23), minutes=rnd.randint(0, 59)
        )

        wo = WriteOff(
            author_id=author.id,
            store_id=store.id,
            type=wo_type,
            deduction_employee_id=employee.id if employee else None,
            comment=rnd.choice(DEMO_REASONS),
            status=status,
            source=SOURCE_MANUAL,
            created_at=created_at,
            updated_at=created_at,
        )

        if status in (STATUS_APPROVED, STATUS_REJECTED):
            wo.reviewer_id = reviewer.id if reviewer else None
            wo.reviewed_at = created_at + timedelta(hours=rnd.randint(1, 12))
            if status == STATUS_REJECTED:
                wo.rejection_reason = 'Фото не подтверждает порчу товара'
            else:
                wo.iiko_sync_status = IIKO_SYNCED
                wo.iiko_act_id = f'MOCK-ACT-SEED-{i + 1}'
                wo.iiko_synced_at = wo.reviewed_at

        db.session.add(wo)
        db.session.flush()
        db.session.add(WriteOffPhoto(write_off_id=wo.id, url=DEMO_PHOTO_URL))
        created += 1

    db.session.commit()
    print(f'[seed] Создано демо-заявок для аналитики: {created}')


def seed_all():
    stores = seed_stores_from_csv()
    seed_employees(stores)
    seed_users(stores)
    seed_write_offs(stores)
    print('[seed] Точки, сотрудники и демо-пользователи готовы.')
    print('[seed] Логины: admin/admin12345, reviewer/reviewer123, sender1/sender123, sender2/sender123')


if __name__ == '__main__':
    from app import create_app
    app = create_app()
    with app.app_context():
        db.create_all()
        seed_all()
