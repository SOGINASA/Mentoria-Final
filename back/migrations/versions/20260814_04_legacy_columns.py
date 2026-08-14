"""Ensure columns introduced before Alembic exist on legacy installations.

Revision ID: 20260814_04
Revises: 20260812_03
Create Date: 2026-08-14

Older production releases added these columns at application startup.  The
migration is intentionally idempotent so both already-patched and untouched
legacy databases can safely adopt the Alembic migration chain.
"""

from alembic import op
import sqlalchemy as sa


revision = '20260814_04'
down_revision = '20260812_03'
branch_labels = None
depends_on = None


LEGACY_COLUMNS = {
    'users': (
        sa.Column('employee_id', sa.Integer(), nullable=True),
    ),
    'write_offs': (
        sa.Column(
            'source', sa.String(length=20), nullable=False,
            server_default='manual',
        ),
        sa.Column(
            'deduct_all', sa.Boolean(), nullable=False,
            server_default=sa.false(),
        ),
    ),
}

INDEXES = (
    ('ix_users_employee_id', 'users', ('employee_id',)),
    ('ix_write_offs_source', 'write_offs', ('source',)),
)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    for table_name, columns in LEGACY_COLUMNS.items():
        if table_name not in tables:
            continue
        existing_columns = {
            column['name'] for column in inspector.get_columns(table_name)
        }
        for column in columns:
            if column.name not in existing_columns:
                op.add_column(table_name, column)
                existing_columns.add(column.name)

    inspector = sa.inspect(bind)
    for index_name, table_name, columns in INDEXES:
        if table_name not in tables:
            continue
        existing_indexes = {
            index['name'] for index in inspector.get_indexes(table_name)
        }
        if index_name not in existing_indexes:
            op.create_index(index_name, table_name, list(columns))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    for index_name, table_name, _columns in reversed(INDEXES):
        if table_name not in tables:
            continue
        existing_indexes = {
            index['name'] for index in inspector.get_indexes(table_name)
        }
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name=table_name)

    for table_name, columns in reversed(tuple(LEGACY_COLUMNS.items())):
        if table_name not in tables:
            continue
        existing_columns = {
            column['name'] for column in sa.inspect(bind).get_columns(table_name)
        }
        with op.batch_alter_table(table_name) as batch:
            for column in reversed(columns):
                if column.name in existing_columns:
                    batch.drop_column(column.name)
