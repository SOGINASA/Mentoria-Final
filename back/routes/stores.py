"""Справочники: торговые точки и сотрудники (для формы создания заявки)."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from models import Store, Employee

stores_bp = Blueprint('stores', __name__)


@stores_bp.route('', methods=['GET'])
@stores_bp.route('/', methods=['GET'])
@jwt_required()
def list_stores():
    """Список активных торговых точек (для выбора в форме)."""
    stores = Store.query.filter_by(is_active=True).order_by(Store.name).all()
    return jsonify({'stores': [s.to_dict() for s in stores]})


@stores_bp.route('/<int:store_id>', methods=['GET'])
@jwt_required()
def get_store(store_id):
    store = Store.query.get(store_id)
    if not store:
        return jsonify({'error': 'Точка не найдена'}), 404
    return jsonify({'store': store.to_dict()})


@stores_bp.route('/<int:store_id>/employees', methods=['GET'])
@jwt_required()
def store_employees(store_id):
    """Сотрудники точки — кандидаты на удержание (шаг 4 формы)."""
    store = Store.query.get(store_id)
    if not store:
        return jsonify({'error': 'Точка не найдена'}), 404
    employees = (
        Employee.query
        .filter_by(store_id=store_id, is_active=True)
        .order_by(Employee.full_name)
        .all()
    )
    return jsonify({'employees': [e.to_dict() for e in employees]})


@stores_bp.route('/employees', methods=['GET'])
@jwt_required()
def list_employees():
    """Все активные сотрудники; опционально ?store_id=."""
    query = Employee.query.filter_by(is_active=True)
    store_id = request.args.get('store_id', type=int)
    if store_id:
        query = query.filter_by(store_id=store_id)
    employees = query.order_by(Employee.full_name).all()
    return jsonify({'employees': [e.to_dict() for e in employees]})
