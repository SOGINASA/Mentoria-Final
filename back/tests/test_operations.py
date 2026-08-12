from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from constants import ROLE_OPERATIONS, ROLE_SENDER
from models import Employee, Store, User, db
from platform_models import PlatformTask, Shift, ShiftAssignment, SupportCase, Timecard
from utils.platform_helpers import utcnow


def _user(username, role, store=None):
    item = User(username=username, full_name=username.title(), role=role,
                store_id=store.id if store else None)
    item.set_password('secret123')
    db.session.add(item)
    db.session.commit()
    return item


def test_operations_workspace_collects_store_exceptions(client, app, store, auth):
    with app.app_context():
        operations = _user('operations1', ROLE_OPERATIONS)
        employee = _user('worker1', ROLE_SENDER, store)
        now = utcnow()
        db.session.add(Shift(
            store_id=store.id, title='Дневная смена', starts_at=now,
            ends_at=now + timedelta(hours=8), headcount=2, status='published',
            created_by_id=operations.id,
        ))
        db.session.add(PlatformTask(
            title='Просроченная задача', store_id=store.id, assignee_id=employee.id,
            due_at=now - timedelta(hours=1), status='active', created_by_id=operations.id,
        ))
        db.session.add(Timecard(
            user_id=employee.id, store_id=store.id, clock_in_at=now - timedelta(hours=8),
            clock_out_at=now, worked_minutes=450, status='submitted',
        ))
        db.session.add(SupportCase(
            reference='BH-S-000001', author_id=employee.id, store_id=store.id,
            category='tech', subject='Не работает терминал',
        ))
        db.session.commit()
        response = client.get('/api/operations/workspace?days=14', headers=auth(operations))

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['analytics']['uncovered_slots'] == 2
    assert payload['analytics']['overdue_tasks'] == 1
    assert payload['analytics']['submitted_timecards'] == 1
    assert payload['analytics']['open_cases'] == 1
    assert payload['store_summaries'][0]['attention_count'] == 5
    assert {item['kind'] for item in payload['alerts']} == {'coverage', 'tasks', 'timecards', 'cases'}


def test_employee_cannot_open_operations_workspace(client, app, store, auth):
    with app.app_context():
        employee = _user('worker2', ROLE_SENDER, store)
        response = client.get('/api/operations/workspace', headers=auth(employee))
    assert response.status_code == 403


def test_operations_uses_local_day_workforce_and_completion_period(client, app, store, auth):
    with app.app_context():
        operations = _user('operations-local', ROLE_OPERATIONS)
        home_store = Store(name='Домашняя точка', address='Адрес 2', timezone='Asia/Almaty')
        db.session.add(home_store)
        db.session.flush()
        employee = _user('night-worker', ROLE_SENDER, home_store)
        linked_employee = Employee(
            full_name='Ночной сотрудник', position='Кассир', store_id=home_store.id,
        )
        directory_only = Employee(
            full_name='Сотрудник без аккаунта', position='Повар', store_id=store.id,
        )
        db.session.add_all([linked_employee, directory_only])
        db.session.flush()
        employee.employee_id = linked_employee.id

        now = utcnow()
        store_timezone = ZoneInfo(store.timezone)
        local_today = now.replace(tzinfo=timezone.utc).astimezone(store_timezone).date()
        local_start = datetime.combine(local_today, time.min, tzinfo=store_timezone)
        today_start = local_start.astimezone(timezone.utc).replace(tzinfo=None)
        night_shift = Shift(
            store_id=store.id, title='Ночная смена',
            starts_at=today_start - timedelta(hours=1),
            ends_at=today_start + timedelta(hours=2), headcount=2,
            status='published', created_by_id=operations.id,
        )
        db.session.add(night_shift)
        db.session.flush()
        db.session.add(ShiftAssignment(
            shift_id=night_shift.id, user_id=employee.id, assigned_by_id=operations.id,
        ))
        db.session.add_all([
            PlatformTask(
                title='Старая завершённая задача', store_id=store.id,
                status='approved', created_by_id=operations.id,
                created_at=now - timedelta(days=20), completed_at=now - timedelta(hours=1),
            ),
            PlatformTask(
                title='Новая задача', store_id=store.id, status='active',
                created_by_id=operations.id, created_at=now - timedelta(hours=2),
            ),
        ])
        db.session.commit()

        response = client.get(
            f'/api/operations/workspace?days=7&store_id={store.id}',
            headers=auth(operations),
        )

    assert response.status_code == 200
    payload = response.get_json()
    summary = payload['store_summaries'][0]
    assert summary['today_shifts'] == 1
    assert summary['uncovered_slots'] == 1
    assert summary['team'] == 2
    assert payload['analytics']['active_employees'] == 2
    assert payload['analytics']['tasks_created'] == 1
    assert payload['analytics']['tasks_completed'] == 1
    assert payload['analytics']['tasks_in_period'] == 2
    assert payload['analytics']['task_completion_percent'] == 50
    assert sum(item['completed_tasks'] for item in payload['trend']) == 1
