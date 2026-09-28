from flask import Blueprint, jsonify, request

from .. import db
from ..auth import current_user_id, get_owned_or_404, require_login
from ..models import EXPENSE, Category, Expense
from ..schemas import ValidationError, parse_limit, parse_month, validate_transaction

bp = Blueprint("expenses", __name__)
bp.before_request(require_login)


@bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify(errors=err.errors), 400


def _check_category(category_id):
    category = db.session.get(Category, category_id)
    if category is None or category.user_id != current_user_id() or category.kind != EXPENSE:
        raise ValidationError({"category_id": "La categoría de gasto no existe"})


@bp.get("/expenses")
def list_expenses():
    query = Expense.query.filter_by(user_id=current_user_id())

    month = request.args.get("month")
    if month:
        start, end = parse_month(month)
        query = query.filter(Expense.date >= start, Expense.date < end)

    category_id = request.args.get("category_id", type=int)
    if category_id:
        query = query.filter(Expense.category_id == category_id)

    query = query.order_by(Expense.date.desc(), Expense.id.desc())
    if limit := parse_limit(request.args.get("limit")):
        query = query.limit(limit)
    return jsonify([e.to_dict() for e in query.all()])


@bp.post("/expenses")
def create_expense():
    fields = validate_transaction(request.get_json(silent=True))
    _check_category(fields["category_id"])
    expense = Expense(user_id=current_user_id(), **fields)
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201


@bp.put("/expenses/<int:expense_id>")
def update_expense(expense_id):
    expense = get_owned_or_404(Expense, expense_id)
    fields = validate_transaction(request.get_json(silent=True))
    _check_category(fields["category_id"])
    for key, value in fields.items():
        setattr(expense, key, value)
    db.session.commit()
    return jsonify(expense.to_dict())


@bp.delete("/expenses/<int:expense_id>")
def delete_expense(expense_id):
    expense = get_owned_or_404(Expense, expense_id)
    db.session.delete(expense)
    db.session.commit()
    return "", 204
