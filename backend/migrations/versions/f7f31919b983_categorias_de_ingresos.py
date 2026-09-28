"""categorias de ingresos

Añade `kind` a las categorías (gasto/ingreso) y `category_id` a los ingresos.
Los ingresos que ya existieran se asignan a la categoría de ingreso "Otros".

Revision ID: f7f31919b983
Revises: 99a7c286c165
Create Date: 2026-09-26 19:45:37.667341

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f7f31919b983'
down_revision = '99a7c286c165'
branch_labels = None
depends_on = None

# Para poder borrar la restricción única sin nombre que crea SQLite
NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


def _name_unique_constraint_name():
    """Nombre de la restricción UNIQUE(name) de categories (varía según el motor)."""
    inspector = sa.inspect(op.get_bind())
    for uc in inspector.get_unique_constraints("categories"):
        if uc["column_names"] == ["name"]:
            return uc["name"] or NAMING["uq"] % {"table_name": "categories", "column_0_name": "name"}
    return None


def upgrade():
    old_unique = _name_unique_constraint_name()

    with op.batch_alter_table("categories", naming_convention=NAMING) as batch_op:
        batch_op.add_column(
            sa.Column("kind", sa.String(length=10), server_default="expense", nullable=False)
        )
        if old_unique:
            batch_op.drop_constraint(old_unique, type_="unique")
        batch_op.create_unique_constraint("uq_categories_name_kind", ["name", "kind"])

    # Categoría de respaldo para los ingresos ya existentes
    op.execute("INSERT INTO categories (name, kind) VALUES ('Otros', 'income')")

    with op.batch_alter_table("incomes") as batch_op:
        batch_op.add_column(sa.Column("category_id", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE incomes SET category_id = "
        "(SELECT id FROM categories WHERE name = 'Otros' AND kind = 'income')"
    )
    with op.batch_alter_table("incomes") as batch_op:
        batch_op.alter_column("category_id", existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key("fk_incomes_category_id", "categories", ["category_id"], ["id"])
        batch_op.create_index("ix_incomes_category_id", ["category_id"], unique=False)


def downgrade():
    with op.batch_alter_table("incomes") as batch_op:
        batch_op.drop_index("ix_incomes_category_id")
        batch_op.drop_constraint("fk_incomes_category_id", type_="foreignkey")
        batch_op.drop_column("category_id")

    op.execute("DELETE FROM categories WHERE kind = 'income'")
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_categories_name_kind", type_="unique")
        batch_op.drop_column("kind")
        batch_op.create_unique_constraint("uq_categories_name", ["name"])
