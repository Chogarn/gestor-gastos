"""nombre de usuario

Añade el nombre para mostrar (opcional) a los usuarios.

Revision ID: 7bd9f3352cf7
Revises: 69951bd07b50
Create Date: 2026-09-27 10:14:37.208514

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7bd9f3352cf7'
down_revision = '69951bd07b50'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("name", sa.String(length=80), nullable=True))


def downgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("name")
