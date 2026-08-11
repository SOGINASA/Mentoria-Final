"""End-to-end API tests for the staff-platform MVP."""

from datetime import datetime, timedelta, timezone

import pytest

from constants import ROLE_MANAGER
from models import User, db
from platform_models import AuditEvent, TimeEvent


@pytest.fixture()
def manager(app, store):
    user = User(username='manager1', full_name='Менеджер', role=ROLE_MANAGER, store_id=store.id)
    user.set_password('secret123')
    db.session.add(user)
    db.session.commit()
    return user


def iso(hours):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def create_published_shift(client, auth, manager, store, sender=None, start=1, end=9, headcount=1):
    response = client.post('/api/shifts/manager', headers=auth(manager), json={
        'store_id': store.id, 'title': 'Утренняя смена',
        'starts_at': iso(start), 'ends_at': iso(end), 'headcount': headcount,
    })
    assert response.status_code == 201, response.get_json()
    shift = response.get_json()['shift']
    if sender:
        response = client.post(f"/api/shifts/manager/{shift['id']}/assignments",
                               headers=auth(manager), json={'user_id': sender.id})
        assert response.status_code == 201, response.get_json()
    response = client.post(f"/api/shifts/manager/{shift['id']}/publish", headers=auth(manager))
    assert response.status_code == 200, response.get_json()
    return response.get_json()['shift']


def test_me_and_bootstrap_expose_platform_context(client, sender, auth):
    me = client.get('/api/auth/me', headers=auth(sender))
    assert me.status_code == 200
    assert 'platform.use' in me.get_json()['permissions']
    assert me.get_json()['feature_flags']['shifts'] is True
    assert me.get_json()['scopes']['store_ids'] == [sender.store_id]

    bootstrap = client.get('/api/platform/bootstrap', headers=auth(sender))
    assert bootstrap.status_code == 200
    assert bootstrap.get_json()['time_tracking']['state'] == 'idle'


def test_shift_publish_assignment_and_employee_list(client, store, sender, manager, auth):
    shift = create_published_shift(client, auth, manager, store, sender)
    response = client.get('/api/shifts', headers=auth(sender))
    assert response.status_code == 200
    assert [item['id'] for item in response.get_json()['shifts']] == [shift['id']]


def test_shift_assignment_rejects_overlap(client, store, sender, manager, auth):
    create_published_shift(client, auth, manager, store, sender, start=1, end=9)
    response = client.post('/api/shifts/manager', headers=auth(manager), json={
        'store_id': store.id, 'starts_at': iso(8), 'ends_at': iso(12),
    })
    shift_id = response.get_json()['shift']['id']
    response = client.post(f'/api/shifts/manager/{shift_id}/assignments',
                           headers=auth(manager), json={'user_id': sender.id})
    assert response.status_code == 409


def test_open_shift_request_and_manager_decision(client, store, sender, manager, auth):
    shift = create_published_shift(client, auth, manager, store, headcount=2)
    response = client.post(f"/api/shifts/{shift['id']}/requests", headers=auth(sender),
                           json={'request_type': 'open_shift'})
    assert response.status_code == 201
    item = response.get_json()['request']
    duplicate = client.post(f"/api/shifts/{shift['id']}/requests", headers=auth(sender),
                            json={'request_type': 'open_shift'})
    assert duplicate.get_json()['duplicate'] is True
    response = client.post(f"/api/shifts/manager/requests/{item['id']}/decision",
                           headers=auth(manager), json={'decision': 'approved', 'version': 1})
    assert response.status_code == 200
    assert response.get_json()['request']['status'] == 'approved'


def test_time_state_machine_idempotency_and_approval(client, store, sender, manager, auth):
    shift = create_published_shift(client, auth, manager, store, sender, start=-1, end=8)
    base = datetime.now(timezone.utc) - timedelta(minutes=30)

    def event(kind, minutes, key):
        return client.post('/api/time/events', headers={**auth(sender), 'Idempotency-Key': key}, json={
            'event_type': kind, 'shift_id': shift['id'],
            'occurred_at': (base + timedelta(minutes=minutes)).isoformat(),
        })

    clock_in = event('clock_in', 0, 'clock-1')
    assert clock_in.status_code == 201, clock_in.get_json()
    duplicate = event('clock_in', 0, 'clock-1')
    assert duplicate.status_code == 200 and duplicate.get_json()['duplicate'] is True
    assert TimeEvent.query.count() == 1
    assert event('break_start', 10, 'clock-2').status_code == 201
    assert event('break_end', 15, 'clock-3').status_code == 201
    out = event('clock_out', 30, 'clock-4')
    assert out.status_code == 201, out.get_json()
    card = out.get_json()['timecard']
    assert card['worked_minutes'] == 25
    assert card['break_minutes'] == 5
    assert card['status'] == 'submitted'

    approved = client.post(f"/api/time/manager/timecards/{card['id']}/decision",
                           headers=auth(manager), json={'decision': 'approved', 'version': card['version']})
    assert approved.status_code == 200
    assert approved.get_json()['timecard']['status'] == 'approved'
    assert AuditEvent.query.filter_by(action='timecard.approved').count() == 1

    correction = client.post(f"/api/time/timecards/{card['id']}/corrections",
                             headers=auth(sender), json={
        'reason': 'Забыл вовремя отметить выход',
        'clock_out_at': (base + timedelta(minutes=40)).isoformat(),
    })
    assert correction.status_code == 201, correction.get_json()
    correction_data = correction.get_json()['correction']
    decided = client.post(
        f"/api/time/manager/corrections/{correction_data['id']}/decision",
        headers=auth(manager),
        json={'decision': 'approved', 'version': correction_data['version']},
    )
    assert decided.status_code == 200, decided.get_json()
    assert decided.get_json()['timecard']['worked_minutes'] == 35
    assert decided.get_json()['timecard']['status'] == 'corrected'


def test_time_invalid_transition_is_rejected(client, sender, auth):
    response = client.post('/api/time/events', headers={**auth(sender), 'Idempotency-Key': 'bad-1'},
                           json={'event_type': 'break_start'})
    assert response.status_code == 409
    assert response.get_json()['state'] == 'idle'


def test_task_checklist_completion_and_manager_review(client, store, sender, manager, auth):
    response = client.post('/api/tasks/manager', headers=auth(manager), json={
        'store_id': store.id, 'assignee_id': sender.id, 'title': 'Открыть точку',
        'steps': ['Включить свет', 'Проверить кухню'],
    })
    assert response.status_code == 201, response.get_json()
    task = response.get_json()['task']
    blocked = client.post(f"/api/tasks/{task['id']}/complete", headers=auth(sender))
    assert blocked.status_code == 409
    for step in task['steps']:
        response = client.patch(f"/api/tasks/{task['id']}/steps/{step['id']}",
                                headers=auth(sender), json={'done': True})
        assert response.status_code == 200
    completed = client.post(f"/api/tasks/{task['id']}/complete", headers=auth(sender))
    assert completed.status_code == 200
    completed_task = completed.get_json()['task']
    reviewed = client.post(f"/api/tasks/manager/{task['id']}/review", headers=auth(manager),
                           json={'decision': 'approved', 'version': completed_task['version']})
    assert reviewed.status_code == 200
    assert reviewed.get_json()['task']['status'] == 'approved'


def test_support_case_persists_messages(client, sender, auth):
    response = client.post('/api/cases', headers=auth(sender), json={
        'category': 'schedule', 'subject': 'Ошибка в графике',
        'message': 'Не отображается смена',
    })
    assert response.status_code == 201
    item = response.get_json()['case']
    assert item['reference'].startswith('BH-S-')
    response = client.post(f"/api/cases/{item['id']}/messages", headers=auth(sender),
                           json={'body': 'Дополнительная информация'})
    assert response.status_code == 201
    assert len(response.get_json()['case']['messages']) == 2


def test_admin_can_manage_scopes_and_targeted_feature_flags(
        client, store, sender, manager, admin, auth):
    response = client.put(f'/api/admin/platform/users/{manager.id}/scopes',
                          headers=auth(admin), json={
        'scopes': [{'store_id': store.id, 'scope': 'manager'}],
    })
    assert response.status_code == 200
    assert response.get_json()['scopes'][0]['store_id'] == store.id

    response = client.put('/api/admin/platform/feature-flags/tasks', headers=auth(admin), json={
        'enabled_by_default': True,
        'targets': [{'target_type': 'user', 'target_value': sender.id, 'enabled': False}],
    })
    assert response.status_code == 200, response.get_json()
    me = client.get('/api/auth/me', headers=auth(sender))
    assert me.get_json()['feature_flags']['tasks'] is False
