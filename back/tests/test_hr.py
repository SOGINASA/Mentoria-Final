from datetime import date

from constants import ROLE_HR, ROLE_SENDER
from models import User, db
from platform_models import EmployeeDocumentRequest, LearningProgress, LeaveRequest


def _user(username, role, store=None):
    item = User(username=username, full_name=username.title(), role=role,
                store_id=store.id if store else None)
    item.set_password('secret123')
    db.session.add(item)
    db.session.commit()
    return item


def test_hr_workspace_returns_people_requests_and_learning(client, app, store, auth):
    with app.app_context():
        hr = _user('hr1', ROLE_HR)
        employee = _user('employee1', ROLE_SENDER, store)
        db.session.add(LearningProgress(
            user_id=employee.id, course_id='service-standards',
            completed_module_ids=['welcome', 'order', 'handoff', 'feedback'],
            assessment_passed=True, assessment_score=100,
        ))
        db.session.add(EmployeeDocumentRequest(
            reference='BH-D-000001', user_id=employee.id, store_id=store.id,
            document_id='employment', title='Справка с места работы',
        ))
        db.session.add(LeaveRequest(
            reference='BH-L-000001', requester_id=employee.id, store_id=store.id,
            leave_type='annual', starts_on=date(2027, 1, 10), ends_on=date(2027, 1, 12), days=3,
        ))
        db.session.commit()

        response = client.get('/api/hr/workspace', headers=auth(hr))

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['analytics']['active_employees'] == 1
    assert payload['analytics']['pending_documents'] == 1
    assert payload['analytics']['pending_leave'] == 1
    assert payload['employees'][0]['learning']['required_completed'] == 1
    assert payload['requests']['documents'][0]['employee_name'] == 'Employee1'


def test_employee_cannot_open_hr_workspace(client, app, store, auth):
    with app.app_context():
        employee = _user('employee2', ROLE_SENDER, store)
        response = client.get('/api/hr/workspace', headers=auth(employee))
    assert response.status_code == 403
