"""Создание уведомлений (лента, опрашивается фронтом через polling).
Сейчас используется сценарием авто-падений: сотруднику — подтвердить
черновик, проверяющим — новая заявка ожидает проверки."""

from models import db, User, Notification
from constants import ROLE_REVIEWER, ROLE_ADMIN


def notify(user_id, kind, title, body=None, write_off_id=None, commit=True):
    """Создать одно уведомление для пользователя."""
    n = Notification(
        user_id=user_id, kind=kind, title=title, body=body, write_off_id=write_off_id,
    )
    db.session.add(n)
    if commit:
        db.session.commit()
    return n


def notify_reviewers(kind, title, body=None, write_off_id=None, commit=True):
    """Создать уведомление для всех активных проверяющих."""
    return _notify_role(ROLE_REVIEWER, kind, title, body, write_off_id, commit)


def notify_admins(kind, title, body=None, write_off_id=None, commit=True):
    """Создать уведомление для всех активных администраторов."""
    return _notify_role(ROLE_ADMIN, kind, title, body, write_off_id, commit)


def _notify_role(role, kind, title, body, write_off_id, commit):
    """Уведомить всех активных пользователей указанной роли."""
    recipients = User.query.filter_by(role=role, is_active=True).all()
    created = [
        notify(u.id, kind, title, body=body, write_off_id=write_off_id, commit=False)
        for u in recipients
    ]
    if commit:
        db.session.commit()
    return created
