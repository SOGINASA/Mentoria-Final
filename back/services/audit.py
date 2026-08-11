"""Append-only audit recording helpers."""

from flask import has_request_context, request

from models import db
from platform_models import AuditEvent


def audit(actor, action, entity_type, entity_id=None, store_id=None, payload=None):
    event = AuditEvent(
        actor_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        store_id=store_id,
        payload=payload or {},
        ip_address=request.remote_addr if has_request_context() else None,
        user_agent=(request.user_agent.string[:255] if has_request_context() else None),
    )
    db.session.add(event)
    return event
