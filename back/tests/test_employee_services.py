"""API coverage for the server-backed employee service workflows."""

from datetime import date, timedelta

import pytest

from constants import ROLE_MANAGER, ROLE_SENDER
from models import Notification, User, db
from platform_models import AuditEvent, EmployeeDocumentRequest, LeaveRequest


@pytest.fixture()
def manager(app, store):
    user = User(username='service-manager', full_name='Менеджер сервисов',
                role=ROLE_MANAGER, store_id=store.id)
    user.set_password('secret123')
    db.session.add(user)
    db.session.commit()
    return user


def future_range(offset=30, days=3):
    starts_on = date.today() + timedelta(days=offset)
    ends_on = starts_on + timedelta(days=days - 1)
    return starts_on.isoformat(), ends_on.isoformat()


def test_bootstrap_exposes_empty_server_owned_employee_services(client, sender, auth):
    response = client.get('/api/platform/bootstrap', headers=auth(sender))

    assert response.status_code == 200
    services = response.get_json()['employee_services']
    assert services['learning_progress'] == []
    assert services['document_requests'] == []
    assert services['leave_requests'] == []
    assert services['leave_balance'] == {
        'year': date.today().year,
        'annual_allowance_days': 24,
        'external_used_days': 0,
        'approved_days': 0,
        'available_days': 24,
        'preliminary': True,
        'source': 'configured_allowance_and_platform_requests',
    }


def test_learning_progress_is_validated_idempotent_and_isolated(client, sender, store, auth):
    blocked = client.post(
        '/api/employee-services/learning/service-standards/assessment',
        headers=auth(sender), json={'answer': 'a'},
    )
    assert blocked.status_code == 409

    for module_id in ('welcome', 'order', 'handoff', 'feedback'):
        response = client.post(
            f'/api/employee-services/learning/service-standards/modules/{module_id}/complete',
            headers=auth(sender),
        )
        assert response.status_code == 201

    duplicate = client.post(
        '/api/employee-services/learning/service-standards/modules/welcome/complete',
        headers=auth(sender),
    )
    assert duplicate.status_code == 200
    assert duplicate.get_json()['duplicate'] is True
    assert len(duplicate.get_json()['progress']['completed_module_ids']) == 4

    failed = client.post(
        '/api/employee-services/learning/service-standards/assessment',
        headers=auth(sender), json={'answer': 'b'},
    )
    assert failed.status_code == 200
    assert failed.get_json()['progress']['assessment_passed'] is False

    passed = client.post(
        '/api/employee-services/learning/service-standards/assessment',
        headers=auth(sender), json={'answer': 'a'},
    )
    assert passed.status_code == 200
    assert passed.get_json()['progress']['assessment_score'] == 100

    other = User(username='other-sender', full_name='Другой сотрудник',
                 role=ROLE_SENDER, store_id=store.id)
    other.set_password('secret123')
    db.session.add(other)
    db.session.commit()
    other_services = client.get('/api/employee-services', headers=auth(other)).get_json()
    assert other_services['learning_progress'] == []


def test_document_request_deduplicates_and_requires_manager_decision(client, sender, manager, auth):
    created = client.post('/api/employee-services/documents/requests',
                          headers=auth(sender), json={'document_id': 'employment'})
    assert created.status_code == 201
    item = created.get_json()['request']
    assert item['reference'].startswith('BH-D-')
    assert item['status'] == 'processing'

    duplicate = client.post('/api/employee-services/documents/requests',
                            headers=auth(sender), json={'document_id': 'employment'})
    assert duplicate.status_code == 200
    assert duplicate.get_json()['duplicate'] is True
    assert EmployeeDocumentRequest.query.count() == 1

    forbidden = client.get('/api/employee-services/manager/documents/requests',
                           headers=auth(sender))
    assert forbidden.status_code == 403
    missing_file = client.post(
        f"/api/employee-services/manager/documents/requests/{item['request_id']}/decision",
        headers=auth(manager), json={'decision': 'ready', 'version': item['version']},
    )
    assert missing_file.status_code == 400
    decided = client.post(
        f"/api/employee-services/manager/documents/requests/{item['request_id']}/decision",
        headers=auth(manager), json={
            'decision': 'ready', 'version': item['version'],
            'file_url': 'https://documents.example/BH-D-000001',
        },
    )
    assert decided.status_code == 200
    assert decided.get_json()['request']['status'] == 'ready'
    assert Notification.query.filter_by(user_id=sender.id,
                                        kind='document_request_decided').count() == 1


def test_leave_request_state_machine_balance_and_audit(client, sender, manager, auth):
    starts_on, ends_on = future_range()
    created = client.post('/api/employee-services/leave/requests', headers=auth(sender), json={
        'leave_type': 'annual', 'starts_on': starts_on, 'ends_on': ends_on,
        'comment': 'Семейная поездка',
    })
    assert created.status_code == 201, created.get_json()
    item = created.get_json()['request']
    assert item['days'] == 3
    assert created.get_json()['leave_balance']['preliminary'] is True

    overlap = client.post('/api/employee-services/leave/requests', headers=auth(sender), json={
        'leave_type': 'annual', 'starts_on': starts_on, 'ends_on': ends_on,
    })
    assert overlap.status_code == 409

    approved = client.post(
        f"/api/employee-services/manager/leave/requests/{item['request_id']}/decision",
        headers=auth(manager), json={'decision': 'approved', 'version': item['version']},
    )
    assert approved.status_code == 200, approved.get_json()
    assert approved.get_json()['request']['status'] == 'approved'
    assert approved.get_json()['leave_balance']['available_days'] == 21
    assert AuditEvent.query.filter_by(action='leave_request.approved').count() == 1

    cannot_cancel = client.post(
        f"/api/employee-services/leave/requests/{item['request_id']}/cancel",
        headers=auth(sender), json={'version': approved.get_json()['request']['version']},
    )
    assert cannot_cancel.status_code == 409

    second_start, second_end = future_range(offset=60, days=2)
    second = client.post('/api/employee-services/leave/requests', headers=auth(sender), json={
        'leave_type': 'unpaid', 'starts_on': second_start, 'ends_on': second_end,
    }).get_json()['request']
    cancelled = client.post(
        f"/api/employee-services/leave/requests/{second['request_id']}/cancel",
        headers=auth(sender), json={'version': second['version']},
    )
    assert cancelled.status_code == 200
    assert cancelled.get_json()['request']['status'] == 'cancelled'
    assert LeaveRequest.query.filter_by(status='cancelled').count() == 1
