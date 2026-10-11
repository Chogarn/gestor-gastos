"""version de sesion

Añade a los usuarios un contador que va dentro de la cookie de sesión: cerrar sesión lo
incrementa e invalida todas las cookies emitidas antes. Las sesiones abiertas antes de
esta migración no llevan el contador, así que hay que volver a iniciar sesión una vez.

Revision ID: e3a1c5d7f902
Revises: d053a77ddfa7
Create Date: 2026-10-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e3a1c5d7f902'
down_revision = 'd053a77ddfa7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("session_version", sa.Integer(), nullable=False, server_default="0")
        )


def downgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("session_version")
