"""Заявки на списание: создание (отправитель), просмотр, подтверждение/отклонение
(проверяющий), статистика, интеграция с Iiko при подтверждении."""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from models import db, WriteOff, WriteOffPhoto, WriteOffItem, Store, Employee
from utils.auth_helpers import get_current_user, role_required
from utils.validators import parse_date
from utils.request_helpers import get_pagination
from services import iiko_service
from constants import (
    ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN,
    STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUSES,
    TYPE_NO_DEDUCTION, TYPE_WITH_DEDUCTION, WRITEOFF_TYPES,
    IIKO_PENDING, IIKO_SYNCED, IIKO_FAILED, MIN_COMMENT_LENGTH,
)

writeoffs_bp = Blueprint('writeoffs', __name__)


def _can_view(user, wo):
    """Отправитель видит только свои заявки; проверяющий/админ — любые."""
    if user.role in (ROLE_REVIEWER, ROLE_ADMIN):
        return True
    return wo.author_id == user.id


# --------------------------------------------------------------------------- #
# Создание (отправитель)
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('', methods=['POST'])
@writeoffs_bp.route('/', methods=['POST'])
@role_required(ROLE_SENDER)
def create_write_off():
    """Создать заявку. Тело (JSON):
        store_id, type, deduction_employee_id?, comment, photo_urls[], items?[]
    """
    user = get_current_user()
    data = request.get_json(silent=True) or {}

    # --- store ---
    store_id = data.get('store_id')
    store = Store.query.filter_by(id=store_id, is_active=True).first() if store_id else None
    if not store:
        return jsonify({'error': 'Выберите существующую торговую точку'}), 400

    # --- type ---
    wo_type = data.get('type')
    if wo_type not in WRITEOFF_TYPES:
        return jsonify({'error': 'Неверный тип списания'}), 400

    # --- сотрудник для удержания (условно) ---
    deduction_employee_id = None
    if wo_type == TYPE_WITH_DEDUCTION:
        deduction_employee_id = data.get('deduction_employee_id')
        emp = Employee.query.filter_by(id=deduction_employee_id, is_active=True).first() if deduction_employee_id else None
        if not emp:
            return jsonify({'error': 'При удержании нужно выбрать сотрудника'}), 400
        if emp.store_id and emp.store_id != store.id:
            return jsonify({'error': 'Сотрудник не относится к выбранной точке'}), 400

    # --- комментарий (обязательный, мин. 10 символов) ---
    comment = (data.get('comment') or '').strip()
    if len(comment) < MIN_COMMENT_LENGTH:
        return jsonify({'error': f'Комментарий обязателен, минимум {MIN_COMMENT_LENGTH} символов'}), 400

    # --- фото (минимум одно) ---
    photo_urls = data.get('photo_urls') or []
    if not isinstance(photo_urls, list) or len([u for u in photo_urls if u]) == 0:
        return jsonify({'error': 'Прикрепите минимум одно фото'}), 400

    try:
        wo = WriteOff(
            author_id=user.id,
            store_id=store.id,
            type=wo_type,
            deduction_employee_id=deduction_employee_id,
            comment=comment,
            status=STATUS_PENDING,
        )
        db.session.add(wo)
        db.session.flush()

        for url in photo_urls:
            if url:
                db.session.add(WriteOffPhoto(write_off_id=wo.id, url=url))

        # Позиции списания — опционально
        for item in (data.get('items') or []):
            name = (item.get('product_name') or '').strip()
            if not name:
                continue
            db.session.add(WriteOffItem(
                write_off_id=wo.id,
                product_name=name,
                quantity=float(item.get('quantity') or 1),
                unit=(item.get('unit') or 'шт').strip(),
                iiko_product_id=item.get('iiko_product_id'),
            ))

        db.session.commit()
        return jsonify({'write_off': wo.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка создания заявки: {e}'}), 500


# --------------------------------------------------------------------------- #
# Список
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('', methods=['GET'])
@writeoffs_bp.route('/', methods=['GET'])
@jwt_required()
def list_write_offs():
    """Список заявок с фильтрами.
    Query: status, store_id, date_from, date_to, scope (mine|all), page, per_page.
    Отправитель всегда видит только свои; проверяющий/админ — все (или ?scope=mine)."""
    user = get_current_user()
    query = WriteOff.query

    # Видимость по роли
    if user.role == ROLE_SENDER or request.args.get('scope') == 'mine':
        query = query.filter(WriteOff.author_id == user.id)

    # Фильтр по статусу
    status = request.args.get('status')
    if status:
        if status not in STATUSES:
            return jsonify({'error': 'Неверный статус'}), 400
        query = query.filter(WriteOff.status == status)

    # Фильтр по точке
    store_id = request.args.get('store_id', type=int)
    if store_id:
        query = query.filter(WriteOff.store_id == store_id)

    # Фильтр по дате создания
    date_from, err = parse_date(request.args.get('date_from'))
    if err:
        return jsonify({'error': f'date_from: {err}'}), 400
    date_to, err = parse_date(request.args.get('date_to'))
    if err:
        return jsonify({'error': f'date_to: {err}'}), 400
    if date_from:
        query = query.filter(func.date(WriteOff.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(WriteOff.created_at) <= date_to)

    query = query.order_by(WriteOff.created_at.desc())

    page, per_page = get_pagination(request)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'write_offs': [wo.to_dict() for wo in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages,
        },
    })


# --------------------------------------------------------------------------- #
# Деталь
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/<int:wo_id>', methods=['GET'])
@jwt_required()
def get_write_off(wo_id):
    user = get_current_user()
    wo = WriteOff.query.get(wo_id)
    if not wo:
        return jsonify({'error': 'Заявка не найдена'}), 404
    if not _can_view(user, wo):
        return jsonify({'error': 'Нет доступа к этой заявке'}), 403
    return jsonify({'write_off': wo.to_dict()})


# --------------------------------------------------------------------------- #
# Подтверждение (проверяющий) -> Iiko
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/<int:wo_id>/approve', methods=['POST'])
@role_required(ROLE_REVIEWER)
def approve_write_off(wo_id):
    user = get_current_user()
    wo = WriteOff.query.get(wo_id)
    if not wo:
        return jsonify({'error': 'Заявка не найдена'}), 404
    if wo.status != STATUS_PENDING:
        return jsonify({'error': 'Заявка уже обработана'}), 409

    wo.status = STATUS_APPROVED
    wo.reviewer_id = user.id
    wo.reviewed_at = datetime.now(timezone.utc)
    wo.rejection_reason = None
    wo.iiko_sync_status = IIKO_PENDING
    db.session.commit()

    # Создание акта в Iiko (mock/real в зависимости от конфигурации)
    result = iiko_service.create_writeoff_act(wo)
    if result.success:
        wo.iiko_act_id = result.act_id
        wo.iiko_sync_status = IIKO_SYNCED
        wo.iiko_synced_at = datetime.now(timezone.utc)
        wo.iiko_error = None
    else:
        wo.iiko_sync_status = IIKO_FAILED
        wo.iiko_error = result.error
    db.session.commit()

    return jsonify({'write_off': wo.to_dict()})


# --------------------------------------------------------------------------- #
# Отклонение (проверяющий)
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/<int:wo_id>/reject', methods=['POST'])
@role_required(ROLE_REVIEWER)
def reject_write_off(wo_id):
    user = get_current_user()
    wo = WriteOff.query.get(wo_id)
    if not wo:
        return jsonify({'error': 'Заявка не найдена'}), 404
    if wo.status != STATUS_PENDING:
        return jsonify({'error': 'Заявка уже обработана'}), 409

    data = request.get_json(silent=True) or {}
    reason = (data.get('rejection_reason') or data.get('reason') or '').strip()
    if len(reason) < 5:
        return jsonify({'error': 'Укажите причину отклонения (минимум 5 символов)'}), 400

    wo.status = STATUS_REJECTED
    wo.reviewer_id = user.id
    wo.reviewed_at = datetime.now(timezone.utc)
    wo.rejection_reason = reason
    db.session.commit()

    return jsonify({'write_off': wo.to_dict()})


# --------------------------------------------------------------------------- #
# Повторная синхронизация с Iiko (если упало при подтверждении)
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/<int:wo_id>/retry-iiko', methods=['POST'])
@role_required(ROLE_REVIEWER)
def retry_iiko(wo_id):
    wo = WriteOff.query.get(wo_id)
    if not wo:
        return jsonify({'error': 'Заявка не найдена'}), 404
    if wo.status != STATUS_APPROVED:
        return jsonify({'error': 'Синхронизация возможна только для подтверждённых заявок'}), 409

    wo.iiko_sync_status = IIKO_PENDING
    db.session.commit()

    result = iiko_service.create_writeoff_act(wo)
    if result.success:
        wo.iiko_act_id = result.act_id
        wo.iiko_sync_status = IIKO_SYNCED
        wo.iiko_synced_at = datetime.now(timezone.utc)
        wo.iiko_error = None
    else:
        wo.iiko_sync_status = IIKO_FAILED
        wo.iiko_error = result.error
    db.session.commit()

    return jsonify({'write_off': wo.to_dict()})


# --------------------------------------------------------------------------- #
# Статистика (счётчики для главной/очереди)
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/stats', methods=['GET'])
@jwt_required()
def stats():
    """Счётчики заявок по статусам.
    Отправитель -> по своим; проверяющий/админ -> по всем (или ?scope=mine)."""
    user = get_current_user()
    query = db.session.query(WriteOff.status, func.count(WriteOff.id))

    if user.role == ROLE_SENDER or request.args.get('scope') == 'mine':
        query = query.filter(WriteOff.author_id == user.id)

    counts = dict(query.group_by(WriteOff.status).all())
    pending = counts.get(STATUS_PENDING, 0)
    approved = counts.get(STATUS_APPROVED, 0)
    rejected = counts.get(STATUS_REJECTED, 0)
    return jsonify({
        'pending': pending,
        'approved': approved,
        'rejected': rejected,
        'total': pending + approved + rejected,
    })
