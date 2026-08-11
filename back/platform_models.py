"""Data model for the Bahandi staff platform.

The legacy write-off domain remains in ``models.py``.  Keeping the staff
platform in a separate module makes its boundaries explicit while still using
the same SQLAlchemy metadata and transaction boundary.
"""

from models import db, _now, _utc_iso


class UserStoreScope(db.Model):
    __tablename__ = 'user_store_scopes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False, index=True)
    scope = db.Column(db.String(24), nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    store = db.relationship('Store')
    __table_args__ = (db.UniqueConstraint('user_id', 'store_id', 'scope', name='uq_user_store_scope'),)

    def to_dict(self):
        return {'id': self.id, 'store_id': self.store_id, 'scope': self.scope,
                'store': self.store.to_dict() if self.store else None}


class FeatureFlag(db.Model):
    __tablename__ = 'feature_flags'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(80), unique=True, nullable=False, index=True)
    description = db.Column(db.String(255))
    enabled_by_default = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now, nullable=False)


class FeatureFlagTarget(db.Model):
    __tablename__ = 'feature_flag_targets'

    id = db.Column(db.Integer, primary_key=True)
    flag_id = db.Column(db.Integer, db.ForeignKey('feature_flags.id', ondelete='CASCADE'), nullable=False, index=True)
    target_type = db.Column(db.String(20), nullable=False)  # user|role|store
    target_value = db.Column(db.String(80), nullable=False)
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    flag = db.relationship('FeatureFlag', backref=db.backref('targets', cascade='all, delete-orphan'))
    __table_args__ = (db.UniqueConstraint('flag_id', 'target_type', 'target_value', name='uq_flag_target'),)


class AuditEvent(db.Model):
    __tablename__ = 'audit_events'

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    entity_type = db.Column(db.String(40), nullable=False, index=True)
    entity_id = db.Column(db.Integer, nullable=True, index=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True, index=True)
    payload = db.Column(db.JSON, nullable=False, default=dict)
    ip_address = db.Column(db.String(64))
    user_agent = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=_now, nullable=False, index=True)

    def to_dict(self):
        return {'id': self.id, 'actor_id': self.actor_id, 'action': self.action,
                'entity_type': self.entity_type, 'entity_id': self.entity_id,
                'store_id': self.store_id, 'payload': self.payload or {},
                'created_at': _utc_iso(self.created_at)}


class Shift(db.Model):
    __tablename__ = 'shifts'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False, default='Рабочая смена')
    role_name = db.Column(db.String(80))
    starts_at = db.Column(db.DateTime, nullable=False, index=True)
    ends_at = db.Column(db.DateTime, nullable=False, index=True)
    break_minutes = db.Column(db.Integer, nullable=False, default=0)
    headcount = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(20), nullable=False, default='draft', index=True)
    notes = db.Column(db.Text)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    published_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now, nullable=False)

    store = db.relationship('Store')
    assignments = db.relationship('ShiftAssignment', backref='shift', cascade='all, delete-orphan', lazy='selectin')

    def to_dict(self, include_assignments=True):
        data = {
            'id': self.id, 'store_id': self.store_id,
            'store': self.store.to_dict() if self.store else None,
            'title': self.title, 'role_name': self.role_name,
            'starts_at': _utc_iso(self.starts_at), 'ends_at': _utc_iso(self.ends_at),
            'break_minutes': self.break_minutes, 'headcount': self.headcount,
            'status': self.status, 'notes': self.notes, 'version': self.version,
            'open_slots': max(0, self.headcount - len([a for a in self.assignments if a.status == 'confirmed'])),
            'published_at': _utc_iso(self.published_at), 'created_at': _utc_iso(self.created_at),
        }
        if include_assignments:
            data['assignments'] = [a.to_dict() for a in self.assignments]
        return data


class ShiftAssignment(db.Model):
    __tablename__ = 'shift_assignments'

    id = db.Column(db.Integer, primary_key=True)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default='confirmed')
    assigned_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    user = db.relationship('User', foreign_keys=[user_id])
    __table_args__ = (db.UniqueConstraint('shift_id', 'user_id', name='uq_shift_assignment'),)

    def to_dict(self):
        return {'id': self.id, 'shift_id': self.shift_id, 'user_id': self.user_id,
                'status': self.status, 'user': {'id': self.user.id, 'full_name': self.user.full_name}
                if self.user else None, 'created_at': _utc_iso(self.created_at)}


class ShiftRequest(db.Model):
    __tablename__ = 'shift_requests'

    id = db.Column(db.Integer, primary_key=True)
    request_type = db.Column(db.String(24), nullable=False)  # open_shift|swap|release
    requester_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=False, index=True)
    target_shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=True)
    comment = db.Column(db.Text)
    status = db.Column(db.String(20), nullable=False, default='pending', index=True)
    decision_reason = db.Column(db.Text)
    decided_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    decided_at = db.Column(db.DateTime)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    shift = db.relationship('Shift', foreign_keys=[shift_id])
    target_shift = db.relationship('Shift', foreign_keys=[target_shift_id])

    def to_dict(self):
        return {'id': self.id, 'request_type': self.request_type, 'requester_id': self.requester_id,
                'shift_id': self.shift_id, 'target_shift_id': self.target_shift_id,
                'comment': self.comment, 'status': self.status, 'decision_reason': self.decision_reason,
                'decided_by_id': self.decided_by_id, 'decided_at': _utc_iso(self.decided_at),
                'version': self.version, 'created_at': _utc_iso(self.created_at)}


class TimeEvent(db.Model):
    __tablename__ = 'time_events'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=True, index=True)
    event_type = db.Column(db.String(24), nullable=False, index=True)
    occurred_at = db.Column(db.DateTime, nullable=False, default=_now, index=True)
    method = db.Column(db.String(20), nullable=False, default='device')
    idempotency_key = db.Column(db.String(120), nullable=False)
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    __table_args__ = (db.UniqueConstraint('user_id', 'idempotency_key', name='uq_time_event_idempotency'),)

    def to_dict(self):
        return {'id': self.id, 'user_id': self.user_id, 'store_id': self.store_id,
                'shift_id': self.shift_id, 'event_type': self.event_type,
                'occurred_at': _utc_iso(self.occurred_at), 'method': self.method,
                'idempotency_key': self.idempotency_key, 'metadata': self.metadata_json or {},
                'created_at': _utc_iso(self.created_at)}


class Timecard(db.Model):
    __tablename__ = 'timecards'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=True, index=True)
    clock_in_at = db.Column(db.DateTime, nullable=False)
    clock_out_at = db.Column(db.DateTime)
    break_minutes = db.Column(db.Integer, nullable=False, default=0)
    worked_minutes = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default='open', index=True)
    version = db.Column(db.Integer, nullable=False, default=1)
    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now, nullable=False)

    __table_args__ = (db.UniqueConstraint('user_id', 'shift_id', name='uq_user_shift_timecard'),)

    def to_dict(self):
        return {'id': self.id, 'user_id': self.user_id, 'store_id': self.store_id,
                'shift_id': self.shift_id, 'clock_in_at': _utc_iso(self.clock_in_at),
                'clock_out_at': _utc_iso(self.clock_out_at), 'break_minutes': self.break_minutes,
                'worked_minutes': self.worked_minutes, 'status': self.status,
                'version': self.version, 'approved_by_id': self.approved_by_id,
                'approved_at': _utc_iso(self.approved_at), 'created_at': _utc_iso(self.created_at)}


class TimeCorrectionRequest(db.Model):
    __tablename__ = 'time_correction_requests'

    id = db.Column(db.Integer, primary_key=True)
    timecard_id = db.Column(db.Integer, db.ForeignKey('timecards.id'), nullable=False, index=True)
    requester_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    proposed_clock_in_at = db.Column(db.DateTime)
    proposed_clock_out_at = db.Column(db.DateTime)
    proposed_break_minutes = db.Column(db.Integer)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending', index=True)
    decision_reason = db.Column(db.Text)
    decided_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    decided_at = db.Column(db.DateTime)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    timecard = db.relationship('Timecard')

    def to_dict(self):
        return {'id': self.id, 'timecard_id': self.timecard_id,
                'requester_id': self.requester_id,
                'proposed_clock_in_at': _utc_iso(self.proposed_clock_in_at),
                'proposed_clock_out_at': _utc_iso(self.proposed_clock_out_at),
                'proposed_break_minutes': self.proposed_break_minutes,
                'reason': self.reason, 'status': self.status,
                'decision_reason': self.decision_reason, 'decided_by_id': self.decided_by_id,
                'decided_at': _utc_iso(self.decided_at), 'version': self.version,
                'created_at': _utc_iso(self.created_at)}


class TaskTemplate(db.Model):
    __tablename__ = 'task_templates'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    task_type = db.Column(db.String(24), nullable=False, default='operation')
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True, index=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    steps = db.relationship('TaskTemplateStep', backref='template', cascade='all, delete-orphan',
                            lazy='selectin', order_by='TaskTemplateStep.position')


class TaskTemplateStep(db.Model):
    __tablename__ = 'task_template_steps'

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('task_templates.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    evidence_required = db.Column(db.Boolean, nullable=False, default=False)


class PlatformTask(db.Model):
    __tablename__ = 'platform_tasks'

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('task_templates.id'), nullable=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    task_type = db.Column(db.String(24), nullable=False, default='operation')
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    assignee_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=True, index=True)
    due_at = db.Column(db.DateTime, nullable=True, index=True)
    status = db.Column(db.String(24), nullable=False, default='active', index=True)
    completed_at = db.Column(db.DateTime)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    step_results = db.relationship('TaskStepResult', backref='task', cascade='all, delete-orphan',
                                   lazy='selectin', order_by='TaskStepResult.position')

    def to_dict(self):
        completed = len([s for s in self.step_results if s.is_done])
        total = len(self.step_results)
        return {'id': self.id, 'template_id': self.template_id, 'title': self.title,
                'description': self.description, 'task_type': self.task_type,
                'store_id': self.store_id, 'assignee_id': self.assignee_id,
                'shift_id': self.shift_id, 'due_at': _utc_iso(self.due_at),
                'status': self.status, 'done': self.status in ('completed', 'approved'),
                'completed_at': _utc_iso(self.completed_at), 'reviewed_by_id': self.reviewed_by_id,
                'reviewed_at': _utc_iso(self.reviewed_at), 'version': self.version,
                'progress': round(completed * 100 / total) if total else None,
                'steps': [s.to_dict() for s in self.step_results],
                'created_at': _utc_iso(self.created_at)}


class TaskStepResult(db.Model):
    __tablename__ = 'task_step_results'

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('platform_tasks.id', ondelete='CASCADE'), nullable=False)
    template_step_id = db.Column(db.Integer, db.ForeignKey('task_template_steps.id'), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    is_done = db.Column(db.Boolean, nullable=False, default=False)
    comment = db.Column(db.Text)
    evidence_url = db.Column(db.String(500))
    completed_at = db.Column(db.DateTime)

    def to_dict(self):
        return {'id': self.id, 'title': self.title, 'position': self.position,
                'done': self.is_done, 'comment': self.comment,
                'evidence_url': self.evidence_url, 'completed_at': _utc_iso(self.completed_at)}


class SupportCase(db.Model):
    __tablename__ = 'support_cases'

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(32), unique=True, nullable=False, index=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True, index=True)
    category = db.Column(db.String(30), nullable=False)
    subject = db.Column(db.String(160), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='open', index=True)
    priority = db.Column(db.String(20), nullable=False, default='normal')
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now, nullable=False)

    messages = db.relationship('CaseMessage', backref='case', cascade='all, delete-orphan',
                               lazy='selectin', order_by='CaseMessage.created_at')

    def to_dict(self):
        return {'id': self.id, 'reference': self.reference, 'author_id': self.author_id,
                'store_id': self.store_id, 'category': self.category, 'subject': self.subject,
                'status': self.status, 'priority': self.priority, 'assigned_to_id': self.assigned_to_id,
                'messages': [m.to_dict() for m in self.messages],
                'created_at': _utc_iso(self.created_at), 'updated_at': _utc_iso(self.updated_at)}


class CaseMessage(db.Model):
    __tablename__ = 'case_messages'

    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('support_cases.id', ondelete='CASCADE'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    def to_dict(self):
        return {'id': self.id, 'author_id': self.author_id, 'body': self.body,
                'created_at': _utc_iso(self.created_at)}


class NewsPost(db.Model):
    __tablename__ = 'news_posts'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    excerpt = db.Column(db.String(500))
    body = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(40))
    audience_role = db.Column(db.String(24), nullable=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True, index=True)
    status = db.Column(db.String(20), nullable=False, default='draft')
    published_at = db.Column(db.DateTime, nullable=True, index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    def to_dict(self, is_read=False):
        return {'id': self.id, 'title': self.title, 'excerpt': self.excerpt, 'body': self.body,
                'category': self.category, 'audience_role': self.audience_role,
                'store_id': self.store_id, 'status': self.status,
                'published_at': _utc_iso(self.published_at), 'is_read': is_read,
                'created_at': _utc_iso(self.created_at)}


class NewsRead(db.Model):
    __tablename__ = 'news_reads'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('news_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    read_at = db.Column(db.DateTime, default=_now, nullable=False)

    __table_args__ = (db.UniqueConstraint('post_id', 'user_id', name='uq_news_read'),)
