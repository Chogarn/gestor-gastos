"""moneda de usuario

Añade la moneda elegida (código ISO 4217, 3 letras) a los usuarios; USD por defecto.
Solo cambia cómo se muestran los montos, no los convierte.

Revision ID: c936a900d2c9
Revises: 7bd9f3352cf7
Create Date: 2026-09-27 21:31:23.472605

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c936a900d2c9'
down_revision = '7bd9f3352cf7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD")
        )


def downgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("currency")
