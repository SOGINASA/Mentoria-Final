"""Add atomic idempotency receipts for offline mutation retries.

Revision ID: 20260812_03
Revises: 20260812_02
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa

revision = '20260812_03'
down_revision = '20260812_02'
branch_labels = None
depends_on = None


def upgrade():
    from models import db
    import platform_models  # noqa: F401

    db.metadata.tables['mutation_receipts'].create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    bind = op.get_bind()
    if 'mutation_receipts' in sa.inspect(bind).get_table_names():
        op.drop_table('mutation_receipts')
