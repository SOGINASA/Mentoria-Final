"""Уведомления текущего пользователя (лента, polling).
Используется сценарием авто-падений: сотруднику — подтвердить черновик,
проверяющим — новая заявка на проверку."""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from models import db, Notification
from utils.auth_helpers import get_current_user
from utils.request_helpers import get_pagination

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('', methods=['GET'])
@notifications_bp.route('/', methods=['GET'])
@jwt_required()
def list_notifications():
    """Лента уведомлений пользователя. Query: unread=1 (только непрочитанные),
    page, per_page. Непрочитанные и более новые — выше."""
    user = get_current_user()
    query = Notification.query.filter(Notification.user_id == user.id)

    if request.args.get('unread') in ('1', 'true', 'yes'):
        query = query.filter(Notification.is_read.is_(False))

    query = query.order_by(Notification.is_read.asc(), Notification.created_at.desc())

    page, per_page = get_pagination(request)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'notifications': [n.to_dict() for n in pagination.items],
        'unread': Notification.query.filter_by(user_id=user.id, is_read=False).count(),
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages,
        },
    })


@notifications_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_count():
    """Счётчик непрочитанных (для бейджа-колокольчика)."""
    user = get_current_user()
    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify({'unread': count})


@notifications_bp.route('/<int:notif_id>/read', methods=['POST'])
@jwt_required()
def mark_read(notif_id):
    """Отметить одно уведомление прочитанным (только своё)."""
    user = get_current_user()
    n = Notification.query.get(notif_id)
    if not n or n.user_id != user.id:
        return jsonify({'error': 'Уведомление не найдено'}), 404
    n.is_read = True
    db.session.commit()
    return jsonify({'notification': n.to_dict()})


@notifications_bp.route('/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    """Отметить все уведомления пользователя прочитанными."""
    user = get_current_user()
    updated = Notification.query.filter_by(user_id=user.id, is_read=False).update(
        {Notification.is_read: True}, synchronize_session=False
    )
    db.session.commit()
    return jsonify({'updated': updated})
