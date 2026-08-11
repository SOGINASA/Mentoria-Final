"""Add server-backed employee service workflow tables.

Revision ID: 20260812_02
Revises: 20260812_01
Create Date: 2026-08-12

The migration is additive: legacy write-offs and Workday MVP tables are not
altered or rewritten.
"""

from alembic import op
import sqlalchemy as sa

revision = '20260812_02'
down_revision = '20260812_01'
branch_labels = None
depends_on = None

TABLES = (
    'learning_progress',
    'employee_document_requests',
    'leave_requests',
)


def upgrade():
    from models import db
    import platform_models  # noqa: F401

    bind = op.get_bind()
    for table_name in TABLES:
        db.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade():
    bind = op.get_bind()
    for table_name in reversed(TABLES):
        if table_name in sa.inspect(bind).get_table_names():
            op.drop_table(table_name)
