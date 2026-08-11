"""Append-only time events, timecards and correction approval flow."""

from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import IntegrityError

from models import User, db
from platform_models import (
    Shift, ShiftAssignment, TimeCorrectionRequest, TimeEvent, Timecard,
)
from services.audit import audit
from services.notifications import notify
from services.permissions import can_access_store
from utils.auth_helpers import get_current_user, permission_required
from utils.platform_helpers import expected_version, parse_datetime, utcnow

time_tracking_bp = Blueprint('time_tracking', __name__)

TRANSITIONS = {
    'idle': {'clock_in'},
    'clock_in': {'break_start', 'clock_out'},
    'break_end': {'break_start', 'clock_out'},
    'break_start': {'break_end'},
}


def _last_event(user_id):
    return TimeEvent.query.filter_by(user_id=user_id).order_by(
        TimeEvent.occurred_at.desc(), TimeEvent.id.desc()).first()


def _state(user_id):
    last = _last_event(user_id)
    return ('idle' if not last or last.event_type == 'clock_out' else last.event_type), last


def _calculate_timecard(card):
    events = (TimeEvent.query.filter(TimeEvent.user_id == card.user_id,
                                     TimeEvent.occurred_at >= card.clock_in_at)
              .order_by(TimeEvent.occurred_at, TimeEvent.id).all())
    work_start = None
    break_start = None
    worked = 0
    breaks = 0
    for event in events:
        if event.event_type == 'clock_in':
            work_start = event.occurred_at
            break_start = None
        elif event.event_type == 'break_start' and work_start:
            worked += max(0, int((event.occurred_at - work_start).total_seconds() // 60))
            break_start = event.occurred_at
            work_start = None
        elif event.event_type == 'break_end' and break_start:
            breaks += max(0, int((event.occurred_at - break_start).total_seconds() // 60))
            work_start = event.occurred_at
            break_start = None
        elif event.event_type == 'clock_out':
            if work_start:
                worked += max(0, int((event.occurred_at - work_start).total_seconds() // 60))
            elif break_start:
                breaks += max(0, int((event.occurred_at - break_start).total_seconds() // 60))
            card.clock_out_at = event.occurred_at
            break
    card.break_minutes = breaks
    card.worked_minutes = worked
    return card


@time_tracking_bp.get('/current')
@jwt_required()
def current_state():
    user = get_current_user()
    state, last = _state(user.id)
    card = Timecard.query.filter_by(user_id=user.id, status='open').order_by(Timecard.id.desc()).first()
    return jsonify({'state': state, 'last_event': last.to_dict() if last else None,
                    'timecard': card.to_dict() if card else None,
                    'allowed_actions': sorted(TRANSITIONS.get(state, {'clock_in'}))})


@time_tracking_bp.post('/events')
@jwt_required()
def create_event():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    event_type = data.get('event_type')
    key = request.headers.get('Idempotency-Key') or data.get('idempotency_key')
    if not key or len(key) > 120:
        return jsonify({'error': 'Требуется Idempotency-Key длиной до 120 символов'}), 400
    existing = TimeEvent.query.filter_by(user_id=user.id, idempotency_key=key).first()
    if existing:
        return jsonify({'event': existing.to_dict(), 'duplicate': True}), 200
    state, last = _state(user.id)
    if event_type not in TRANSITIONS.get(state, {'clock_in'}):
        return jsonify({'error': 'Недопустимый переход состояния', 'state': state,
                        'allowed_actions': sorted(TRANSITIONS.get(state, {'clock_in'}))}), 409
    try:
        occurred_at = parse_datetime(data.get('occurred_at'), 'occurred_at') or utcnow()
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    if occurred_at > utcnow() + timedelta(minutes=5):
        return jsonify({'error': 'Время события не может быть в будущем'}), 400
    if last and occurred_at < last.occurred_at:
        return jsonify({'error': 'Событие старше предыдущей отметки'}), 409

    shift = None
    store_id = data.get('store_id') or (last.store_id if last and state != 'idle' else user.store_id)
    if data.get('shift_id'):
        shift = Shift.query.get(data['shift_id'])
        if not shift or shift.status != 'published':
            return jsonify({'error': 'Смена не найдена или не опубликована'}), 404
        assignment = ShiftAssignment.query.filter_by(shift_id=shift.id, user_id=user.id,
                                                      status='confirmed').first()
        if not assignment:
            return jsonify({'error': 'Пользователь не назначен на смену'}), 403
        store_id = shift.store_id
    elif last and state != 'idle':
        shift = Shift.query.get(last.shift_id) if last.shift_id else None
    if not store_id or not can_access_store(user, int(store_id)):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    if state != 'idle' and last and (shift.id if shift else None) != last.shift_id:
        return jsonify({'error': 'Нельзя переключить смену до отметки выхода'}), 409

    event = TimeEvent(user_id=user.id, store_id=int(store_id), shift_id=shift.id if shift else None,
                      event_type=event_type, occurred_at=occurred_at,
                      method=data.get('method', 'device'), idempotency_key=key,
                      metadata_json=data.get('metadata') or {}, created_by_id=user.id)
    db.session.add(event)
    if event_type == 'clock_in':
        card = Timecard(user_id=user.id, store_id=int(store_id), shift_id=shift.id if shift else None,
                        clock_in_at=occurred_at)
        db.session.add(card)
    else:
        card = Timecard.query.filter_by(user_id=user.id, status='open').order_by(Timecard.id.desc()).first()
        if not card:
            return jsonify({'error': 'Открытый табель не найден'}), 409
    db.session.flush()
    if event_type == 'clock_out':
        _calculate_timecard(card)
        card.status = 'submitted'
        card.version += 1
    audit(user, f'time.{event_type}', 'time_event', event.id, int(store_id),
          {'shift_id': event.shift_id, 'method': event.method})
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        existing = TimeEvent.query.filter_by(user_id=user.id, idempotency_key=key).first()
        if existing:
            return jsonify({'event': existing.to_dict(), 'duplicate': True}), 200
        return jsonify({'error': 'Конфликт при сохранении отметки'}), 409
    return jsonify({'event': event.to_dict(), 'timecard': card.to_dict()}), 201


@time_tracking_bp.get('/events')
@jwt_required()
def list_events():
    user = get_current_user()
    items = TimeEvent.query.filter_by(user_id=user.id).order_by(TimeEvent.occurred_at.desc()).limit(200).all()
    return jsonify({'events': [item.to_dict() for item in items]})


@time_tracking_bp.get('/timecards')
@jwt_required()
def list_timecards():
    user = get_current_user()
    items = Timecard.query.filter_by(user_id=user.id).order_by(Timecard.clock_in_at.desc()).limit(100).all()
    return jsonify({'timecards': [item.to_dict() for item in items]})


@time_tracking_bp.post('/timecards/<int:card_id>/corrections')
@permission_required('time.request_correction')
def request_correction(card_id):
    user = get_current_user()
    card = Timecard.query.get_or_404(card_id)
    if card.user_id != user.id or card.status == 'open':
        return jsonify({'error': 'Табель недоступен для корректировки'}), 403
    data = request.get_json(silent=True) or {}
    reason = str(data.get('reason') or '').strip()
    if len(reason) < 5:
        return jsonify({'error': 'Укажите причину корректировки (минимум 5 символов)'}), 400
    if TimeCorrectionRequest.query.filter_by(timecard_id=card.id, status='pending').first():
        return jsonify({'error': 'Корректировка уже ожидает решения'}), 409
    try:
        item = TimeCorrectionRequest(
            timecard_id=card.id, requester_id=user.id,
            proposed_clock_in_at=parse_datetime(data.get('clock_in_at'), 'clock_in_at'),
            proposed_clock_out_at=parse_datetime(data.get('clock_out_at'), 'clock_out_at'),
            proposed_break_minutes=data.get('break_minutes'), reason=reason,
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    if (item.proposed_clock_in_at is None and item.proposed_clock_out_at is None
            and item.proposed_break_minutes is None):
        return jsonify({'error': 'Укажите хотя бы одно исправляемое значение'}), 400
    db.session.add(item)
    db.session.flush()
    audit(user, 'time_correction.created', 'time_correction', item.id, card.store_id)
    db.session.commit()
    return jsonify({'correction': item.to_dict()}), 201


@time_tracking_bp.get('/manager/timecards')
@permission_required('time.manage')
def manager_timecards():
    user = get_current_user()
    status = request.args.get('status')
    query = Timecard.query
    if status:
        query = query.filter_by(status=status)
    items = [card for card in query.order_by(Timecard.clock_in_at.desc()).limit(250).all()
             if can_access_store(user, card.store_id, 'time.manage')]
    return jsonify({'timecards': [item.to_dict() for item in items]})


@time_tracking_bp.post('/manager/timecards/<int:card_id>/decision')
@permission_required('time.manage')
def decide_timecard(card_id):
    manager = get_current_user()
    card = Timecard.query.get_or_404(card_id)
    if not can_access_store(manager, card.store_id, 'time.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    if data.get('decision') not in ('approved', 'rejected') or card.status != 'submitted':
        return jsonify({'error': 'Недопустимое решение или состояние табеля'}), 409
    try:
        expected_version(data, card.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    card.status = data['decision']
    card.approved_by_id = manager.id
    card.approved_at = utcnow()
    card.version += 1
    notify(card.user_id, 'timecard_decided', 'Табель обработан',
           body='Подтверждён' if card.status == 'approved' else 'Отклонён',
           entity_type='timecard', entity_id=card.id, action_url='/app/income', commit=False)
    audit(manager, f'timecard.{card.status}', 'timecard', card.id, card.store_id,
          {'reason': data.get('reason')})
    db.session.commit()
    return jsonify({'timecard': card.to_dict()})


@time_tracking_bp.get('/manager/corrections')
@permission_required('time.manage')
def manager_corrections():
    user = get_current_user()
    items = TimeCorrectionRequest.query.filter_by(status=request.args.get('status', 'pending')).all()
    items = [item for item in items if can_access_store(user, item.timecard.store_id, 'time.manage')]
    return jsonify({'corrections': [item.to_dict() for item in items]})


@time_tracking_bp.post('/manager/corrections/<int:correction_id>/decision')
@permission_required('time.manage')
def decide_correction(correction_id):
    manager = get_current_user()
    item = TimeCorrectionRequest.query.get_or_404(correction_id)
    card = item.timecard
    if not can_access_store(manager, card.store_id, 'time.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    decision = data.get('decision')
    if decision not in ('approved', 'rejected') or item.status != 'pending':
        return jsonify({'error': 'Недопустимое решение или запрос уже обработан'}), 409
    try:
        expected_version(data, item.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    before = card.to_dict()
    if decision == 'approved':
        card.clock_in_at = item.proposed_clock_in_at or card.clock_in_at
        card.clock_out_at = item.proposed_clock_out_at or card.clock_out_at
        card.break_minutes = (item.proposed_break_minutes if item.proposed_break_minutes is not None
                              else card.break_minutes)
        if card.clock_out_at <= card.clock_in_at or card.break_minutes < 0:
            return jsonify({'error': 'Предложенные значения некорректны'}), 400
        elapsed = int((card.clock_out_at - card.clock_in_at).total_seconds() // 60)
        card.worked_minutes = max(0, elapsed - card.break_minutes)
        card.status = 'corrected'
        card.version += 1
    item.status = decision
    item.decision_reason = data.get('reason')
    item.decided_by_id = manager.id
    item.decided_at = utcnow()
    item.version += 1
    notify(item.requester_id, 'time_correction_decided', 'Решение по корректировке',
           body='Одобрено' if decision == 'approved' else 'Отклонено',
           entity_type='time_correction', entity_id=item.id, action_url='/app/income', commit=False)
    audit(manager, f'time_correction.{decision}', 'time_correction', item.id, card.store_id,
          {'before': before, 'after': card.to_dict(), 'reason': item.decision_reason})
    db.session.commit()
    return jsonify({'correction': item.to_dict(), 'timecard': card.to_dict()})
