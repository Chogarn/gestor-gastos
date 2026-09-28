from . import db

EXPENSE = "expense"
INCOME = "income"
KINDS = (EXPENSE, INCOME)

DEFAULT_CURRENCY = "USD"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(254), nullable=False, unique=True)
    name = db.Column(db.String(80))  # nombre para mostrar, opcional
    # Código ISO 4217 (3 letras): solo cambia cómo se muestran los montos, no los convierte.
    currency = db.Column(
        db.String(3), nullable=False, default=DEFAULT_CURRENCY, server_default=DEFAULT_CURRENCY
    )
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=db.func.now()
    )

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "currency": self.currency,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# `user_id` es nullable en la base de datos solo por los datos anteriores a las
# cuentas de usuario: la primera persona que se registra los reclama. Todas las
# consultas filtran por usuario, así que los huérfanos no los ve nadie más.
class Category(db.Model):
    __tablename__ = "categories"
    __table_args__ = (
        db.UniqueConstraint("user_id", "name", "kind", name="uq_categories_user_name_kind"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    name = db.Column(db.String(50), nullable=False)
    # Las categorías de gastos y de ingresos son listas independientes
    kind = db.Column(db.String(10), nullable=False, default=EXPENSE, server_default=EXPENSE)
    # Tope mensual, solo para categorías de gasto; NULL = sin presupuesto puesto.
    budget = db.Column(db.Numeric(12, 2))

    expenses = db.relationship("Expense", back_populates="category")
    incomes = db.relationship("Income", back_populates="category")
    recurring_transactions = db.relationship("RecurringTransaction", back_populates="category")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "budget": str(self.budget) if self.budget is not None else None,
        }


class Income(db.Model):
    __tablename__ = "incomes"
    __table_args__ = (
        db.UniqueConstraint("recurring_id", "date", name="uq_incomes_recurring_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True
    )
    # Movimiento generado por una plantilla recurrente (ver RecurringTransaction); NULL si se
    # cargó a mano. Al borrar la plantilla (routes/recurring.py) este campo se pone en NULL
    # a propósito: el movimiento no se borra, solo se desengancha. `ondelete="SET NULL"` es
    # además una red de seguridad a nivel de Postgres (SQLite no lo aplica salvo que se pida
    # por conexión, así que no hay que depender solo de esto).
    recurring_id = db.Column(
        db.Integer, db.ForeignKey("recurring_transactions.id", ondelete="SET NULL"), index=True
    )

    category = db.relationship("Category", back_populates="incomes")

    def to_dict(self):
        return {
            "id": self.id,
            "amount": str(self.amount),
            "description": self.description,
            "date": self.date.isoformat(),
            "category_id": self.category_id,
            "category": self.category.name,
            "recurring_id": self.recurring_id,
        }


class Expense(db.Model):
    __tablename__ = "expenses"
    __table_args__ = (
        db.UniqueConstraint("recurring_id", "date", name="uq_expenses_recurring_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True
    )
    recurring_id = db.Column(
        db.Integer, db.ForeignKey("recurring_transactions.id", ondelete="SET NULL"), index=True
    )

    category = db.relationship("Category", back_populates="expenses")

    def to_dict(self):
        return {
            "id": self.id,
            "amount": str(self.amount),
            "description": self.description,
            "date": self.date.isoformat(),
            "category_id": self.category_id,
            "category": self.category.name,
            "recurring_id": self.recurring_id,
        }


# Plantilla de gasto o ingreso que se repite todos los meses. `_generate_for_template`
# (backend/app/recurring.py) la usa para crear los movimientos reales (Expense/Income).
class RecurringTransaction(db.Model):
    __tablename__ = "recurring_transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    kind = db.Column(db.String(10), nullable=False, default=EXPENSE, server_default=EXPENSE)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True
    )
    # 1-31: si el mes no tiene ese día, se genera en el último día del mes.
    day_of_month = db.Column(db.Integer, nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=True, server_default="true")
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=db.func.now()
    )

    category = db.relationship("Category", back_populates="recurring_transactions")

    def to_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "amount": str(self.amount),
            "description": self.description,
            "category_id": self.category_id,
            "category": self.category.name,
            "day_of_month": self.day_of_month,
            "active": self.active,
        }
