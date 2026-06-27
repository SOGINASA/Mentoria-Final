"""Общие фикстуры тестов."""

import os
import sys

import pytest

# backend в sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import TestingConfig
from app import create_app
from models import db as _db, User, Store, Employee
from constants import ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN


@pytest.fixture()
def app():
    app = create_app(TestingConfig)
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def store(app):
    s = Store(name='Точка №1', address='Адрес 1', iiko_store_id='IIKO-1')
    _db.session.add(s)
    _db.session.commit()
    return s


@pytest.fixture()
def employee(app, store):
    e = Employee(full_name='Иванов Иван', position='Повар', store_id=store.id)
    _db.session.add(e)
    _db.session.commit()
    return e


def _make_user(username, role, password='secret123', store=None):
    u = User(username=username, full_name=username.title(), role=role,
             store_id=store.id if store else None)
    u.set_password(password)
    _db.session.add(u)
    _db.session.commit()
    return u


@pytest.fixture()
def sender(app, store):
    return _make_user('sender1', ROLE_SENDER, store=store)


@pytest.fixture()
def reviewer(app):
    return _make_user('reviewer1', ROLE_REVIEWER)


@pytest.fixture()
def admin(app):
    return _make_user('admin1', ROLE_ADMIN)


def _login(client, username, password='secret123'):
    resp = client.post('/api/auth/login', json={'identifier': username, 'password': password})
    return resp.get_json()['access_token']


@pytest.fixture()
def auth(client):
    """Фабрика заголовков авторизации: auth(user) -> headers."""
    def _auth(user):
        token = _login(client, user.username)
        return {'Authorization': f'Bearer {token}'}
    return _auth
