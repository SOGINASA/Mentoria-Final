"""Atomic idempotency receipts for retryable platform mutations."""

from functools import wraps

from flask import jsonify, make_response, request
from sqlalchemy.exc import IntegrityError

from models import db
from platform_models import MutationReceipt
from utils.auth_helpers import get_current_user


def _replayed(receipt):
    response = jsonify(receipt.response_json)
    response.status_code = receipt.status_code
    response.headers['Idempotency-Replayed'] = 'true'
    return response


def idempotent_mutation(fn):
    """Commit a successful mutation and its response as one transaction.

    The header is optional for backwards compatibility. Retry-capable clients
    send ``Idempotency-Key`` and receive the first response on every replay.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        key = (request.headers.get('Idempotency-Key') or '').strip()
        if key and (len(key) < 8 or len(key) > 120):
            return jsonify({'error': 'Idempotency-Key должен содержать от 8 до 120 символов'}), 400

        if key:
            existing = MutationReceipt.query.filter_by(
                user_id=user.id, idempotency_key=key,
            ).first()
            if existing:
                if existing.method != request.method or existing.path != request.path:
                    return jsonify({'error': 'Idempotency-Key уже использован для другого действия'}), 409
                return _replayed(existing)

        try:
            response = make_response(fn(*args, **kwargs))
            if response.status_code >= 400:
                db.session.rollback()
                return response

            if key:
                payload = response.get_json(silent=True)
                db.session.add(MutationReceipt(
                    user_id=user.id,
                    idempotency_key=key,
                    method=request.method,
                    path=request.path,
                    status_code=response.status_code,
                    response_json=payload if payload is not None else {},
                ))
            db.session.commit()
            return response
        except IntegrityError:
            db.session.rollback()
            if key:
                existing = MutationReceipt.query.filter_by(
                    user_id=user.id, idempotency_key=key,
                ).first()
                if existing and existing.method == request.method and existing.path == request.path:
                    return _replayed(existing)
            raise
        except Exception:
            db.session.rollback()
            raise

    return wrapper
