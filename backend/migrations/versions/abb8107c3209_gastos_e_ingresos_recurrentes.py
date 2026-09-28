"""gastos e ingresos recurrentes

Crea `recurring_transactions` (plantillas de gasto/ingreso que se repiten todos los
meses) y añade `recurring_id` a gastos e ingresos: enlaza cada movimiento generado con
su plantilla, en NULL si se cargó a mano o si la plantilla se borró después (ON DELETE
SET NULL: el movimiento no se borra con la plantilla, solo se desengancha).

Revision ID: abb8107c3209
Revises: c936a900d2c9
Create Date: 2026-09-27 21:57:54.205352

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'abb8107c3209'
down_revision = 'c936a900d2c9'
branch_labels = None
depends_on = None

TRANSACTION_TABLES = ("expenses", "incomes")


def upgrade():
    op.create_table(
        "recurring_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False, server_default="expense"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("day_of_month", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_recurring_transactions_user_id"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], name="fk_recurring_transactions_category_id"
        ),
    )
    op.create_index(
        "ix_recurring_transactions_user_id", "recurring_transactions", ["user_id"]
    )
    op.create_index(
        "ix_recurring_transactions_category_id", "recurring_transactions", ["category_id"]
    )

    for table in TRANSACTION_TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("recurring_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                f"fk_{table}_recurring_id",
                "recurring_transactions",
                ["recurring_id"],
                ["id"],
                ondelete="SET NULL",
            )
            batch_op.create_index(f"ix_{table}_recurring_id", ["recurring_id"])
            batch_op.create_unique_constraint(
                f"uq_{table}_recurring_date", ["recurring_id", "date"]
            )


def downgrade():
    for table in reversed(TRANSACTION_TABLES):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(f"uq_{table}_recurring_date", type_="unique")
            batch_op.drop_index(f"ix_{table}_recurring_id")
            batch_op.drop_constraint(f"fk_{table}_recurring_id", type_="foreignkey")
            batch_op.drop_column("recurring_id")

    op.drop_index("ix_recurring_transactions_category_id", table_name="recurring_transactions")
    op.drop_index("ix_recurring_transactions_user_id", table_name="recurring_transactions")
    op.drop_table("recurring_transactions")
