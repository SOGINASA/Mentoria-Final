"""Администрирование: CRUD пользователей, точек и сотрудников.
Все эндпоинты доступны только роли admin."""

from flask import Blueprint, request, jsonify

from models import db, User, Store, Employee
from utils.auth_helpers import role_required
from utils.validators import validate_username, validate_email
from constants import ROLE_ADMIN, ROLES

admin_bp = Blueprint('admin', __name__)


# ============================ ПОЛЬЗОВАТЕЛИ ================================= #
@admin_bp.route('/users', methods=['GET'])
@role_required(ROLE_ADMIN)
def list_users():
    role = request.args.get('role')
    query = User.query
    if role:
        query = query.filter_by(role=role)
    users = query.order_by(User.created_at.desc()).all()
    return jsonify({'users': [u.to_dict() for u in users]})


@admin_bp.route('/users', methods=['POST'])
@role_required(ROLE_ADMIN)
def create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    full_name = (data.get('full_name') or '').strip()
    role = data.get('role')
    email = (data.get('email') or '').strip().lower() or None

    if not validate_username(username):
        return jsonify({'error': 'Username: 3-30 символов (буквы, цифры, . _ -)'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Пароль минимум 6 символов'}), 400
    if not full_name:
        return jsonify({'error': 'Укажите ФИО'}), 400
    if role not in ROLES:
        return jsonify({'error': f'Роль должна быть одной из: {", ".join(sorted(ROLES))}'}), 400
    if email and not validate_email(email):
        return jsonify({'error': 'Неверный формат email'}), 400

    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({'error': 'Username уже занят'}), 400
    if email and User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({'error': 'Email уже используется'}), 400

    store_id = data.get('store_id')
    if store_id and not Store.query.get(store_id):
        return jsonify({'error': 'Точка не найдена'}), 400

    user = User(
        username=username,
        email=email,
        phone=(data.get('phone') or '').strip() or None,
        full_name=full_name,
        role=role,
        store_id=store_id,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'user': user.to_dict()}), 201


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@role_required(ROLE_ADMIN)
def update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    data = request.get_json(silent=True) or {}

    if 'full_name' in data and data['full_name']:
        user.full_name = data['full_name'].strip()
    if 'role' in data:
        if data['role'] not in ROLES:
            return jsonify({'error': 'Неверная роль'}), 400
        user.role = data['role']
    if 'phone' in data:
        user.phone = (data['phone'] or '').strip() or None
    if 'store_id' in data:
        if data['store_id'] and not Store.query.get(data['store_id']):
            return jsonify({'error': 'Точка не найдена'}), 400
        user.store_id = data['store_id']
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])
    if data.get('password'):
        if len(data['password']) < 6:
            return jsonify({'error': 'Пароль минимум 6 символов'}), 400
        user.set_password(data['password'])

    db.session.commit()
    return jsonify({'user': user.to_dict()})


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@role_required(ROLE_ADMIN)
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    # Мягкое удаление — деактивация (чтобы не терять историю заявок)
    user.is_active = False
    db.session.commit()
    return jsonify({'message': 'Пользователь деактивирован'})


# ============================ ТОЧКИ ======================================= #
@admin_bp.route('/stores', methods=['POST'])
@role_required(ROLE_ADMIN)
def create_store():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Укажите название точки'}), 400
    store = Store(
        name=name,
        address=(data.get('address') or '').strip() or None,
        iiko_store_id=(data.get('iiko_store_id') or '').strip() or None,
    )
    db.session.add(store)
    db.session.commit()
    return jsonify({'store': store.to_dict()}), 201


@admin_bp.route('/stores/<int:store_id>', methods=['PUT'])
@role_required(ROLE_ADMIN)
def update_store(store_id):
    store = Store.query.get(store_id)
    if not store:
        return jsonify({'error': 'Точка не найдена'}), 404
    data = request.get_json(silent=True) or {}
    if 'name' in data and data['name']:
        store.name = data['name'].strip()
    if 'address' in data:
        store.address = (data['address'] or '').strip() or None
    if 'iiko_store_id' in data:
        store.iiko_store_id = (data['iiko_store_id'] or '').strip() or None
    if 'is_active' in data:
        store.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify({'store': store.to_dict()})


@admin_bp.route('/stores/<int:store_id>', methods=['DELETE'])
@role_required(ROLE_ADMIN)
def delete_store(store_id):
    store = Store.query.get(store_id)
    if not store:
        return jsonify({'error': 'Точка не найдена'}), 404
    store.is_active = False
    db.session.commit()
    return jsonify({'message': 'Точка деактивирована'})


# ============================ СОТРУДНИКИ ================================== #
@admin_bp.route('/employees', methods=['POST'])
@role_required(ROLE_ADMIN)
def create_employee():
    data = request.get_json(silent=True) or {}
    full_name = (data.get('full_name') or '').strip()
    if not full_name:
        return jsonify({'error': 'Укажите ФИО сотрудника'}), 400
    store_id = data.get('store_id')
    if store_id and not Store.query.get(store_id):
        return jsonify({'error': 'Точка не найдена'}), 400
    employee = Employee(
        full_name=full_name,
        position=(data.get('position') or '').strip() or None,
        store_id=store_id,
        iiko_employee_id=(data.get('iiko_employee_id') or '').strip() or None,
    )
    db.session.add(employee)
    db.session.commit()
    return jsonify({'employee': employee.to_dict()}), 201


@admin_bp.route('/employees/<int:employee_id>', methods=['PUT'])
@role_required(ROLE_ADMIN)
def update_employee(employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Сотрудник не найден'}), 404
    data = request.get_json(silent=True) or {}
    if 'full_name' in data and data['full_name']:
        employee.full_name = data['full_name'].strip()
    if 'position' in data:
        employee.position = (data['position'] or '').strip() or None
    if 'store_id' in data:
        if data['store_id'] and not Store.query.get(data['store_id']):
            return jsonify({'error': 'Точка не найдена'}), 400
        employee.store_id = data['store_id']
    if 'iiko_employee_id' in data:
        employee.iiko_employee_id = (data['iiko_employee_id'] or '').strip() or None
    if 'is_active' in data:
        employee.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify({'employee': employee.to_dict()})


@admin_bp.route('/employees/<int:employee_id>', methods=['DELETE'])
@role_required(ROLE_ADMIN)
def delete_employee(employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({'error': 'Сотрудник не найден'}), 404
    employee.is_active = False
    db.session.commit()
    return jsonify({'message': 'Сотрудник деактивирован'})
