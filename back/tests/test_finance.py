from datetime import datetime

from constants import ROLE_FINANCE, ROLE_HR, ROLE_REVIEWER, ROLE_SENDER
from models import Employee, Store, User, db
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


def test_finance_uses_timecard_store_local_month_and_full_directory(client, app, store, auth):
    with app.app_context():
        finance = _user('finance-local', ROLE_FINANCE)
        work_store = Store(
            name='Ночная точка', address='Адрес 2', timezone='Asia/Almaty',
            iiko_store_id='IIKO-NIGHT',
        )
        db.session.add(work_store)
        db.session.flush()
        cashier = _user('cashier-home', ROLE_SENDER, store)
        linked_employee = Employee(
            full_name='Кассир на подмене', position='Кассир', store_id=work_store.id,
        )
        directory_only = Employee(
            full_name='Сотрудник без аккаунта', position='Повар', store_id=work_store.id,
        )
        historical_user = _user('former-reviewer', ROLE_REVIEWER, store)
        historical_user.is_active = False
        db.session.add_all([linked_employee, directory_only])
        db.session.flush()
        cashier.employee_id = linked_employee.id
        db.session.add_all([
            # 1 августа 01:00 по времени точки — должен войти в август.
            Timecard(user_id=cashier.id, store_id=work_store.id,
                     clock_in_at=datetime(2026, 7, 31, 20), worked_minutes=60,
                     status='approved'),
            # 1 сентября 01:00 по времени точки — уже не август.
            Timecard(user_id=cashier.id, store_id=work_store.id,
                     clock_in_at=datetime(2026, 8, 31, 20), worked_minutes=999,
                     status='approved'),
            # Исторический табель неактивного аккаунта другой роли не теряется.
            Timecard(user_id=historical_user.id, store_id=work_store.id,
                     clock_in_at=datetime(2026, 8, 15, 8), worked_minutes=120,
                     status='corrected'),
        ])
        db.session.commit()
        cashier_id = cashier.id
        historical_user_id = historical_user.id
        linked_employee_id = linked_employee.id
        work_store_id = work_store.id

        headers = auth(finance)
        response = client.get(
            f'/api/finance/workspace?month=2026-08&store_id={work_store_id}',
            headers=headers,
        )
        exported = client.get(
            f'/api/finance/export?month=2026-08&store_id={work_store_id}',
            headers=headers,
        )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['analytics']['approved_minutes'] == 180
    assert payload['analytics']['no_data_employees'] == 1
    assert payload['analytics']['stores'][0]['approved_minutes'] == 180
    assert len(payload['employees']) == 3
    linked = next(item for item in payload['employees'] if item['user_id'] == cashier_id)
    no_account = next(item for item in payload['employees'] if item['user_id'] is None)
    historical = next(item for item in payload['employees'] if item['user_id'] == historical_user_id)
    assert linked['employee_id'] == linked_employee_id
    assert linked['store_id'] == work_store_id
    assert linked['approved_minutes'] == 60
    assert no_account['has_account'] is False
    assert no_account['readiness'] == 'no_data'
    assert historical['approved_minutes'] == 120
    assert exported.status_code == 200
    exported_text = exported.data.decode('utf-8-sig')
    assert 'Ночная точка' in exported_text
    assert '999' not in exported_text
