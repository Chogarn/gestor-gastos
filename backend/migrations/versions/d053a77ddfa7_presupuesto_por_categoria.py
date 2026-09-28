"""presupuesto por categoria

Añade un presupuesto mensual opcional a las categorías (solo tiene sentido para las de
gasto; se aplica igual todos los meses, no hay uno distinto por mes).

Revision ID: d053a77ddfa7
Revises: abb8107c3209
Create Date: 2026-09-27 23:00:06.675676

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd053a77ddfa7'
down_revision = 'abb8107c3209'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("categories") as batch_op:
        batch_op.add_column(sa.Column("budget", sa.Numeric(12, 2), nullable=True))


def downgrade():
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_column("budget")
