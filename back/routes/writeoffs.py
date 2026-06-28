"""Заявки на списание: создание (отправитель), просмотр, подтверждение/отклонение
(проверяющий), статистика, интеграция с Iiko при подтверждении."""

from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from models import db, WriteOff, WriteOffPhoto, WriteOffItem, Store, Employee
from utils.auth_helpers import get_current_user, role_required
from utils.validators import parse_date
from utils.request_helpers import get_pagination
from utils.uploads import save_image_file
from services import iiko_service
from services.notifications import notify, notify_reviewers, notify_admins
from constants import (
    ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN,
    STATUS_DRAFT, STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUSES,
    TYPE_NO_DEDUCTION, TYPE_WITH_DEDUCTION, WRITEOFF_TYPES,
    SOURCE_MANUAL, SOURCE_AUTO_FALL,
    NOTIFY_FALL_DRAFT, NOTIFY_FALL_ALERT, NOTIFY_REVIEW_PENDING,
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
            source=SOURCE_MANUAL,
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

        # Уведомления: проверяющим — новая заявка на проверку; админам — надзор.
        # (раньше ручное создание не уведомляло никого → пустая лента у проверяющих/админов)
        notify_body = f'{store.name}: {comment}'
        notify_reviewers(NOTIFY_REVIEW_PENDING, title='Новая заявка на списание',
                         body=notify_body, write_off_id=wo.id, commit=False)
        notify_admins(NOTIFY_REVIEW_PENDING, title='Новая заявка на списание',
                      body=notify_body, write_off_id=wo.id, commit=False)

        db.session.commit()
        return jsonify({'write_off': wo.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка создания заявки: {e}'}), 500


# --------------------------------------------------------------------------- #
# Авто-падение: камера/ML фиксирует падение продукта → черновик заявки
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/auto-fall', methods=['POST'])
@role_required(ROLE_SENDER)
def create_fall_draft():
    """Принимает событие падения от ML-пайплайна (камера логинится как
    отправитель точки). multipart-форма:
        file        — скриншот кадра в момент падения (обязательно)
        product     — класс детектора (patty/bun/...) (обязательно)
        product_ru  — отображаемое имя (опц., иначе = product)
        reason      — текст причины (опц., иначе авто-формулировка)
        track_id    — id трека ByteTrack (опц., для текста)
        confidence  — уверенность детекции (опц.)
        quantity, unit — позиция списания (опц.)
    Создаёт ЧЕРНОВИК (status=draft, source=auto_fall) и уведомляет автора —
    сотрудник подтверждает одним тапом (см. /<id>/confirm)."""
    user = get_current_user()

    if not user.store_id:
        return jsonify({'error': 'У аккаунта камеры не задана торговая точка'}), 400

    product = (request.form.get('product') or '').strip()
    if not product:
        return jsonify({'error': 'Не указан продукт (product)'}), 400
    product_ru = (request.form.get('product_ru') or product).strip()
    track_id = (request.form.get('track_id') or '').strip()

    reason = (request.form.get('reason') or '').strip()
    if not reason:
        suffix = f' (трек #{track_id})' if track_id else ''
        reason = (f'Падение продукта «{product_ru}» на пол — '
                  f'списание по санитарным нормам{suffix}')

    if 'file' not in request.files:
        return jsonify({'error': 'Не передан скриншот кадра (поле file)'}), 400
    try:
        photo_url, _ = save_image_file(request.files['file'])
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    try:
        wo = WriteOff(
            author_id=user.id,
            store_id=user.store_id,
            type=TYPE_NO_DEDUCTION,
            comment=reason,
            status=STATUS_DRAFT,
            source=SOURCE_AUTO_FALL,
        )
        db.session.add(wo)
        db.session.flush()

        db.session.add(WriteOffPhoto(write_off_id=wo.id, url=photo_url))
        db.session.add(WriteOffItem(
            write_off_id=wo.id,
            product_name=product_ru,
            quantity=float(request.form.get('quantity') or 1),
            unit=(request.form.get('unit') or 'шт').strip(),
        ))

        # Уведомление сотруднику: подтвердите черновик
        notify(
            user.id, NOTIFY_FALL_DRAFT,
            title='Зафиксировано падение продукта',
            body=f'{product_ru}: {reason}. Подтвердите черновик списания.',
            write_off_id=wo.id, commit=False,
        )

        # Надзорное уведомление: админ + проверяющий узнают о падении сразу,
        # не дожидаясь подтверждения сотрудником (контроль жалоб на поваров).
        store_name = user.store.name if user.store else 'Точка'
        alert_body = f'{store_name}: {product_ru} — {reason}'
        notify_admins(NOTIFY_FALL_ALERT, title='Зафиксировано падение продукта',
                      body=alert_body, write_off_id=wo.id, commit=False)
        notify_reviewers(NOTIFY_FALL_ALERT, title='Зафиксировано падение продукта',
                         body=alert_body, write_off_id=wo.id, commit=False)

        db.session.commit()
        return jsonify({'write_off': wo.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка создания черновика: {e}'}), 500


# --------------------------------------------------------------------------- #
# Подтверждение черновика (отправитель) → заявка уходит проверяющему
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/<int:wo_id>/confirm', methods=['POST'])
@role_required(ROLE_SENDER)
def confirm_draft(wo_id):
    """Сотрудник подтверждает авто-черновик одним тапом. Можно уточнить
    тип/комментарий/сотрудника для удержания. status: draft → pending,
    проверяющие получают уведомление."""
    user = get_current_user()
    wo = WriteOff.query.get(wo_id)
    if not wo:
        return jsonify({'error': 'Заявка не найдена'}), 404
    if wo.author_id != user.id:
        return jsonify({'error': 'Подтвердить черновик может только его автор'}), 403
    if wo.status != STATUS_DRAFT:
        return jsonify({'error': 'Заявка уже подтверждена или обработана'}), 409

    data = request.get_json(silent=True) or {}

    # Необязательные правки при подтверждении
    new_comment = (data.get('comment') or '').strip()
    if new_comment:
        if len(new_comment) < MIN_COMMENT_LENGTH:
            return jsonify({'error': f'Комментарий минимум {MIN_COMMENT_LENGTH} символов'}), 400
        wo.comment = new_comment

    new_type = data.get('type')
    if new_type is not None:
        if new_type not in WRITEOFF_TYPES:
            return jsonify({'error': 'Неверный тип списания'}), 400
        wo.type = new_type
        if new_type == TYPE_WITH_DEDUCTION:
            emp_id = data.get('deduction_employee_id')
            emp = Employee.query.filter_by(id=emp_id, is_active=True).first() if emp_id else None
            if not emp:
                return jsonify({'error': 'При удержании нужно выбрать сотрудника'}), 400
            if emp.store_id and emp.store_id != wo.store_id:
                return jsonify({'error': 'Сотрудник не относится к точке заявки'}), 400
            wo.deduction_employee_id = emp.id
        else:
            wo.deduction_employee_id = None

    wo.status = STATUS_PENDING
    db.session.flush()

    notify_reviewers(
        NOTIFY_REVIEW_PENDING,
        title='Новая заявка на списание (падение)',
        body=f'{wo.store.name if wo.store else "Точка"}: {wo.comment}',
        write_off_id=wo.id, commit=False,
    )
    db.session.commit()
    return jsonify({'write_off': wo.to_dict()})


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
    elif user.role in (ROLE_REVIEWER, ROLE_ADMIN):
        # Проверяющему/админу по умолчанию не показываем чужие черновики
        # (они приватны автору до подтверждения)
        query = query.filter(WriteOff.status != STATUS_DRAFT)

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
    draft = counts.get(STATUS_DRAFT, 0)
    pending = counts.get(STATUS_PENDING, 0)
    approved = counts.get(STATUS_APPROVED, 0)
    rejected = counts.get(STATUS_REJECTED, 0)
    return jsonify({
        'draft': draft,        # черновики (ожидают подтверждения сотрудником)
        'pending': pending,
        'approved': approved,
        'rejected': rejected,
        'total': draft + pending + approved + rejected,
    })


# --------------------------------------------------------------------------- #
# Аналитика (админ-дэшборд)
# --------------------------------------------------------------------------- #
@writeoffs_bp.route('/analytics', methods=['GET'])
@role_required(ROLE_REVIEWER, ROLE_ADMIN)
def analytics():
    """Сводная аналитика по списаниям для дэшборда.

    Считается на сервере по ВСЕМ заявкам (в отличие от списка, который
    ограничен пагинацией) — поэтому числа не «обрезаются». Черновики (draft)
    исключены: это ещё не подтверждённые авто-падения.

    Query:
        days     — окно тренда в днях (1..90, по умолчанию 7)
        store_id — ограничить аналитику одной точкой (опц.)

    Деньги — ОЦЕНКА: count × ANALYTICS_AVG_LOSS (реальной цены в данных нет).
    """
    days = request.args.get('days', default=7, type=int) or 7
    days = max(1, min(days, 90))
    store_id = request.args.get('store_id', type=int)
    avg_loss = int(current_app.config.get('ANALYTICS_AVG_LOSS', 1500))

    def scoped(query):
        """Общие фильтры аналитики: без черновиков + опц. по точке."""
        query = query.filter(WriteOff.status != STATUS_DRAFT)
        if store_id:
            query = query.filter(WriteOff.store_id == store_id)
        return query

    # --- Счётчики по статусам ---
    status_counts = dict(
        scoped(db.session.query(WriteOff.status, func.count(WriteOff.id)))
        .group_by(WriteOff.status).all()
    )
    pending = status_counts.get(STATUS_PENDING, 0)
    approved = status_counts.get(STATUS_APPROVED, 0)
    rejected = status_counts.get(STATUS_REJECTED, 0)
    total = pending + approved + rejected

    # --- По типу списания (с удержанием / без) ---
    type_counts = dict(
        scoped(db.session.query(WriteOff.type, func.count(WriteOff.id)))
        .group_by(WriteOff.type).all()
    )
    with_hold = type_counts.get(TYPE_WITH_DEDUCTION, 0)
    no_hold = type_counts.get(TYPE_NO_DEDUCTION, 0)

    # --- Топ точек по числу списаний ---
    store_rows = (
        scoped(db.session.query(Store.id, Store.name, func.count(WriteOff.id))
               .join(WriteOff, WriteOff.store_id == Store.id))
        .group_by(Store.id, Store.name)
        .order_by(func.count(WriteOff.id).desc())
        .limit(6).all()
    )
    by_store = [
        {'store_id': sid, 'name': name, 'count': cnt, 'loss': cnt * avg_loss}
        for sid, name, cnt in store_rows
    ]

    # --- Топ сотрудников по удержаниям ---
    emp_rows = (
        scoped(db.session.query(Employee.id, Employee.full_name, func.count(WriteOff.id))
               .join(WriteOff, WriteOff.deduction_employee_id == Employee.id)
               .filter(WriteOff.type == TYPE_WITH_DEDUCTION))
        .group_by(Employee.id, Employee.full_name)
        .order_by(func.count(WriteOff.id).desc())
        .limit(6).all()
    )
    by_employee = [
        {'employee_id': eid, 'name': name, 'count': cnt, 'loss': cnt * avg_loss}
        for eid, name, cnt in emp_rows
    ]

    # --- Динамика по дням (последние `days` суток, UTC) ---
    start = datetime.now(timezone.utc).date() - timedelta(days=days - 1)
    trend_rows = (
        scoped(db.session.query(func.date(WriteOff.created_at), func.count(WriteOff.id)))
        .filter(func.date(WriteOff.created_at) >= start.isoformat())
        .group_by(func.date(WriteOff.created_at)).all()
    )
    # func.date() в SQLite даёт строку, в Postgres — date; нормализуем ключ.
    by_date = {str(d): cnt for d, cnt in trend_rows}
    trend = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        trend.append({'date': d, 'count': by_date.get(d, 0)})

    return jsonify({
        'totals': {
            'total': total,
            'pending': pending,
            'approved': approved,
            'rejected': rejected,
        },
        'with_hold': with_hold,
        'no_hold': no_hold,
        'avg_loss': avg_loss,
        'loss_total': total * avg_loss,
        'by_store': by_store,
        'by_employee': by_employee,
        'trend': trend,
    })
