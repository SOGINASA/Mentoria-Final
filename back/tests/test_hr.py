from datetime import date

from constants import ROLE_HR, ROLE_SENDER
from models import Employee, Store, User, db
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
        linked_directory_employee = Employee(
            full_name='Employee1', position='Кассир', store_id=store.id,
        )
        directory_only_employee = Employee(
            full_name='Сотрудник без аккаунта', position='Повар', store_id=store.id,
        )
        db.session.add_all([linked_directory_employee, directory_only_employee])
        db.session.flush()
        employee.employee_id = linked_directory_employee.id
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
    assert payload['analytics']['active_employees'] == 2
    assert payload['analytics']['pending_documents'] == 1
    assert payload['analytics']['pending_leave'] == 1
    linked = next(item for item in payload['employees'] if item['user_id'] == employee.id)
    directory_only = next(item for item in payload['employees'] if item['user_id'] is None)
    assert linked['employee_id'] == linked_directory_employee.id
    assert linked['learning']['required_completed'] == 1
    assert directory_only['full_name'] == 'Сотрудник без аккаунта'
    assert directory_only['position'] == 'Повар'
    assert directory_only['has_account'] is False
    assert len(payload['employees']) == 2
    assert payload['requests']['documents'][0]['employee_name'] == 'Employee1'


def test_employee_cannot_open_hr_workspace(client, app, store, auth):
    with app.app_context():
        employee = _user('employee2', ROLE_SENDER, store)
        response = client.get('/api/hr/workspace', headers=auth(employee))
    assert response.status_code == 403


def test_hr_news_context_and_author_visibility(client, app, store, auth):
    with app.app_context():
        hr = _user('hr-news', ROLE_HR)
        other_store = Store(name='Точка №2', address='Адрес 2', iiko_store_id='IIKO-2')
        db.session.add(other_store)
        db.session.commit()
        expected_store_ids = {store.id, other_store.id}

        context = client.get('/api/news/manage-context', headers=auth(hr))
        created = client.post('/api/news/manager', headers=auth(hr), json={
            'title': 'Новость HR', 'body': 'Информация для сотрудников',
            'audience_role': ROLE_SENDER, 'store_id': store.id, 'status': 'published',
        })
        own_feed = client.get('/api/news', headers=auth(hr))

    assert context.status_code == 200
    assert {item['id'] for item in context.get_json()['stores']} == expected_store_ids
    assert created.status_code == 201
    assert [item['id'] for item in own_feed.get_json()['news']] == [created.get_json()['post']['id']]
