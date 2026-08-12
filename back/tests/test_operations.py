from datetime import timedelta

from constants import ROLE_OPERATIONS, ROLE_SENDER
from models import User, db
from platform_models import PlatformTask, Shift, SupportCase, Timecard
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
