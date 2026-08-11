"""Add the Bahandi staff-platform foundation and Workday MVP entities.

Revision ID: 20260812_01
Revises: None
Create Date: 2026-08-12

This first repository migration is deliberately adoption-safe: on a fresh
database it creates the full current metadata; on an existing legacy database
it creates missing tables and adds only the new columns.  Existing write-off
data is never rewritten.
"""

from alembic import op
import sqlalchemy as sa

revision = '20260812_01'
down_revision = None
branch_labels = None
depends_on = None

PLATFORM_TABLES = [
    'news_reads', 'case_messages', 'task_step_results', 'time_correction_requests',
    'timecards', 'time_events', 'shift_requests', 'shift_assignments',
    'platform_tasks', 'task_template_steps', 'news_posts', 'support_cases',
    'task_templates', 'shifts', 'audit_events', 'feature_flag_targets',
    'feature_flags', 'user_store_scopes',
]

LEGACY_COLUMNS = {
    'stores': [
        sa.Column('timezone', sa.String(length=64), nullable=False,
                  server_default='Asia/Almaty'),
    ],
    'notifications': [
        sa.Column('entity_type', sa.String(length=40), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('action_url', sa.String(length=500), nullable=True),
        sa.Column('priority', sa.String(length=20), nullable=False, server_default='normal'),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
    ],
}


def upgrade():
    from models import db
    import platform_models  # noqa: F401

    bind = op.get_bind()
    # checkfirst makes this safe for both empty databases and installations
    # created before migrations were introduced.
    db.metadata.create_all(bind=bind, checkfirst=True)
    inspector = sa.inspect(bind)
    for table_name, columns in LEGACY_COLUMNS.items():
        if table_name not in inspector.get_table_names():
            continue
        existing = {column['name'] for column in inspector.get_columns(table_name)}
        for column in columns:
            if column.name not in existing:
                op.add_column(table_name, column)
    indexes = {index['name'] for index in sa.inspect(bind).get_indexes('notifications')}
    for name, columns in (
        ('ix_notifications_entity_type', ['entity_type']),
        ('ix_notifications_entity_id', ['entity_id']),
    ):
        if name not in indexes:
            op.create_index(name, 'notifications', columns)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'notifications' in inspector.get_table_names():
        indexes = {index['name'] for index in inspector.get_indexes('notifications')}
        for name in ('ix_notifications_entity_type', 'ix_notifications_entity_id'):
            if name in indexes:
                op.drop_index(name, table_name='notifications')
    existing_tables = set(inspector.get_table_names())
    for table_name in PLATFORM_TABLES:
        if table_name in existing_tables:
            op.drop_table(table_name)
    inspector = sa.inspect(bind)
    for table_name, columns in LEGACY_COLUMNS.items():
        if table_name not in inspector.get_table_names():
            continue
        existing = {column['name'] for column in inspector.get_columns(table_name)}
        with op.batch_alter_table(table_name) as batch:
            for column in reversed(columns):
                if column.name in existing:
                    batch.drop_column(column.name)
