from . import db
from .models import EXPENSE, INCOME, Category

DEFAULT_CATEGORIES = {
    EXPENSE: ["Comida", "Transporte", "Hogar", "Ocio", "Otros"],
    INCOME: ["Salario", "Freelance", "Inversiones", "Otros"],
}


def seed_categories(user_id):
    """Crea las categorías por defecto del usuario que aún no tenga (no hace commit)."""
    existing = {
        (c.name, c.kind) for c in Category.query.filter_by(user_id=user_id).all()
    }
    for kind, names in DEFAULT_CATEGORIES.items():
        for name in names:
            if (name, kind) not in existing:
                db.session.add(Category(user_id=user_id, name=name, kind=kind))
