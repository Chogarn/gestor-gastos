from flask import Blueprint, jsonify, request

from .. import db
from ..auth import current_user_id, get_owned_or_404, require_login
from ..models import EXPENSE, KINDS, Category
from ..schemas import ValidationError, validate_budget, validate_category

bp = Blueprint("categories", __name__)
bp.before_request(require_login)


@bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify(errors=err.errors), 400


@bp.get("/categories")
def list_categories():
    query = Category.query.filter_by(user_id=current_user_id())
    kind = request.args.get("kind")
    if kind:
        if kind not in KINDS:
            raise ValidationError({"kind": "Debe ser 'expense' o 'income'"})
        query = query.filter_by(kind=kind)
    return jsonify([c.to_dict() for c in query.order_by(Category.kind, Category.name)])


@bp.post("/categories")
def create_category():
    fields = validate_category(request.get_json(silent=True))
    user_id = current_user_id()
    if Category.query.filter_by(user_id=user_id, **fields).first():
        return jsonify(errors={"name": "Ya existe esa categoría"}), 409
    category = Category(user_id=user_id, **fields)
    db.session.add(category)
    db.session.commit()
    return jsonify(category.to_dict()), 201


@bp.put("/categories/<int:category_id>")
def update_category_budget(category_id):
    """Único campo editable de una categoría por ahora: su presupuesto mensual."""
    category = get_owned_or_404(Category, category_id)
    if category.kind != EXPENSE:
        raise ValidationError({"budget": "Solo las categorías de gasto tienen presupuesto"})
    category.budget = validate_budget(request.get_json(silent=True))
    db.session.commit()
    return jsonify(category.to_dict())


@bp.delete("/categories/<int:category_id>")
def delete_category(category_id):
    category = get_owned_or_404(Category, category_id)
    if category.expenses or category.incomes or category.recurring_transactions:
        return (
            jsonify(errors={"category": "Tiene movimientos asociados, no se puede borrar"}),
            409,
        )
    db.session.delete(category)
    db.session.commit()
    return "", 204
