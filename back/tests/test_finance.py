from datetime import datetime

from constants import ROLE_FINANCE, ROLE_HR, ROLE_SENDER
from models import User, db
from platform_models import CaseMessage, SupportCase, Timecard


def _user(username, role, store=None):
    item = User(username=username, full_name=username.title(), role=role,
                store_id=store.id if store else None)
    item.set_password('secret123')
    db.session.add(item)
    db.session.commit()
    return item


def test_finance_workspace_and_csv_use_only_confirmed_hours(client, app, store, auth):
    with app.app_context():
        finance = _user('finance1', ROLE_FINANCE)
        employee = _user('cashier1', ROLE_SENDER, store)
        db.session.add_all([
            Timecard(user_id=employee.id, store_id=store.id,
                     clock_in_at=datetime(2026, 8, 3, 9), clock_out_at=datetime(2026, 8, 3, 17),
                     worked_minutes=450, break_minutes=30, status='approved'),
            Timecard(user_id=employee.id, store_id=store.id,
                     clock_in_at=datetime(2026, 8, 4, 9), clock_out_at=datetime(2026, 8, 4, 17),
                     worked_minutes=450, break_minutes=30, status='submitted'),
        ])
        db.session.commit()
        headers = auth(finance)
        response = client.get('/api/finance/workspace?month=2026-08', headers=headers)
        exported = client.get('/api/finance/export?month=2026-08', headers=headers)

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['analytics']['approved_minutes'] == 450
    assert payload['analytics']['pending_minutes'] == 450
    assert payload['employees'][0]['readiness'] == 'attention'
    assert exported.status_code == 200
    assert 'Cashier1'.encode() in exported.data
    assert b'450' in exported.data


def test_hr_and_finance_see_only_their_case_categories(client, app, store, auth):
    with app.app_context():
        employee = _user('worker1', ROLE_SENDER, store)
        hr = _user('hr2', ROLE_HR)
        finance = _user('finance2', ROLE_FINANCE)
        for index, category in enumerate(('hr', 'payroll', 'tech'), start=1):
            case = SupportCase(reference=f'BH-S-{index:06d}', author_id=employee.id,
                               store_id=store.id, category=category, subject=category)
            db.session.add(case)
            db.session.flush()
            db.session.add(CaseMessage(case_id=case.id, author_id=employee.id, body='Вопрос'))
        db.session.commit()
        hr_response = client.get('/api/cases', headers=auth(hr)).get_json()['cases']
        finance_response = client.get('/api/cases', headers=auth(finance)).get_json()['cases']

    assert [item['category'] for item in hr_response] == ['hr']
    assert [item['category'] for item in finance_response] == ['payroll']
