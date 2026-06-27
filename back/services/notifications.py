"""Создание уведомлений (лента, опрашивается фронтом через polling).
Сейчас используется сценарием авто-падений: сотруднику — подтвердить
черновик, проверяющим — новая заявка ожидает проверки."""

from models import db, User, Notification
from constants import ROLE_REVIEWER


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
    reviewers = User.query.filter_by(role=ROLE_REVIEWER, is_active=True).all()
    created = [
        notify(r.id, kind, title, body=body, write_off_id=write_off_id, commit=False)
        for r in reviewers
    ]
    if commit:
        db.session.commit()
    return created
