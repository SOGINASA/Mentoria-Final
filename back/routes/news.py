"""Audience-aware staff news with read receipts."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from models import db
from platform_models import NewsPost, NewsRead
from services.audit import audit
from services.permissions import has_permission
from utils.auth_helpers import get_current_user
from utils.platform_helpers import parse_datetime, utcnow

news_bp = Blueprint('news', __name__)


@news_bp.get('')
@news_bp.get('/')
@jwt_required()
def list_news():
    user = get_current_user()
    query = NewsPost.query.filter_by(status='published').filter(
        db.or_(NewsPost.audience_role.is_(None), NewsPost.audience_role == user.role),
        db.or_(NewsPost.store_id.is_(None), NewsPost.store_id == user.store_id),
    ).order_by(NewsPost.published_at.desc())
    reads = {row.post_id for row in NewsRead.query.filter_by(user_id=user.id).all()}
    return jsonify({'news': [post.to_dict(post.id in reads) for post in query.all()]})


@news_bp.post('/<int:post_id>/read')
@jwt_required()
def mark_news_read(post_id):
    user = get_current_user()
    post = NewsPost.query.get_or_404(post_id)
    row = NewsRead.query.filter_by(post_id=post.id, user_id=user.id).first()
    if not row:
        row = NewsRead(post_id=post.id, user_id=user.id)
        db.session.add(row)
        db.session.commit()
    return jsonify({'read_at': row.read_at.isoformat() + ('Z' if not row.read_at.tzinfo else '')})


@news_bp.post('/manager')
@jwt_required()
def create_news():
    user = get_current_user()
    if not has_permission(user, 'news.manage'):
        return jsonify({'error': 'Недостаточно прав'}), 403
    data = request.get_json(silent=True) or {}
    title, body = str(data.get('title') or '').strip(), str(data.get('body') or '').strip()
    if not title or not body:
        return jsonify({'error': 'Заголовок и текст обязательны'}), 400
    status = data.get('status', 'draft')
    if status not in ('draft', 'published'):
        return jsonify({'error': 'Некорректный статус'}), 400
    item = NewsPost(title=title, excerpt=data.get('excerpt'), body=body,
                    category=data.get('category'), audience_role=data.get('audience_role'),
                    store_id=data.get('store_id'), status=status,
                    published_at=(parse_datetime(data.get('published_at'), 'published_at') or utcnow())
                    if status == 'published' else None, created_by_id=user.id)
    db.session.add(item)
    db.session.flush()
    audit(user, 'news.created', 'news_post', item.id, item.store_id, {'status': status})
    db.session.commit()
    return jsonify({'post': item.to_dict()}), 201
