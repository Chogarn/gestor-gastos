"""usuarios y datos por usuario

Crea la tabla de usuarios y añade `user_id` a categorías, gastos e ingresos.
`user_id` queda nullable: los datos existentes no tienen dueño hasta que la
primera persona se registre y los reclame (ver app/routes/auth.py).

Revision ID: 69951bd07b50
Revises: f7f31919b983
Create Date: 2026-09-26 21:02:11.412305

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '69951bd07b50'
down_revision = 'f7f31919b983'
branch_labels = None
depends_on = None

OWNED_TABLES = ("categories", "expenses", "incomes")


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    for table in OWNED_TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(f"fk_{table}_user_id", "users", ["user_id"], ["id"])
            batch_op.create_index(f"ix_{table}_user_id", ["user_id"], unique=False)

    # El nombre de una categoría deja de ser único por tipo para pasar a serlo por usuario
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_categories_name_kind", type_="unique")
        batch_op.create_unique_constraint("uq_categories_user_name_kind", ["user_id", "name", "kind"])


def downgrade():
    # Ojo: si dos usuarios tienen una categoría con el mismo nombre y tipo, no se puede
    # volver a la restricción única global y este paso fallará.
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_categories_user_name_kind", type_="unique")
        batch_op.create_unique_constraint("uq_categories_name_kind", ["name", "kind"])

    for table in reversed(OWNED_TABLES):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_index(f"ix_{table}_user_id")
            batch_op.drop_constraint(f"fk_{table}_user_id", type_="foreignkey")
            batch_op.drop_column("user_id")

    op.drop_table("users")
