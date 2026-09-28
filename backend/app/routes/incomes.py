from flask import Blueprint, jsonify, request

from .. import db
from ..auth import current_user_id, get_owned_or_404, require_login
from ..models import INCOME, Category, Income
from ..schemas import ValidationError, parse_limit, parse_month, validate_transaction

bp = Blueprint("incomes", __name__)
bp.before_request(require_login)


@bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify(errors=err.errors), 400


def _check_category(category_id):
    category = db.session.get(Category, category_id)
    if category is None or category.user_id != current_user_id() or category.kind != INCOME:
        raise ValidationError({"category_id": "La categoría de ingreso no existe"})


@bp.get("/incomes")
def list_incomes():
    query = Income.query.filter_by(user_id=current_user_id())

    month = request.args.get("month")
    if month:
        start, end = parse_month(month)
        query = query.filter(Income.date >= start, Income.date < end)

    category_id = request.args.get("category_id", type=int)
    if category_id:
        query = query.filter(Income.category_id == category_id)

    query = query.order_by(Income.date.desc(), Income.id.desc())
    if limit := parse_limit(request.args.get("limit")):
        query = query.limit(limit)
    return jsonify([i.to_dict() for i in query.all()])


@bp.post("/incomes")
def create_income():
    fields = validate_transaction(request.get_json(silent=True))
    _check_category(fields["category_id"])
    income = Income(user_id=current_user_id(), **fields)
    db.session.add(income)
    db.session.commit()
    return jsonify(income.to_dict()), 201


@bp.put("/incomes/<int:income_id>")
def update_income(income_id):
    income = get_owned_or_404(Income, income_id)
    fields = validate_transaction(request.get_json(silent=True))
    _check_category(fields["category_id"])
    for key, value in fields.items():
        setattr(income, key, value)
    db.session.commit()
    return jsonify(income.to_dict())


@bp.delete("/incomes/<int:income_id>")
def delete_income(income_id):
    income = get_owned_or_404(Income, income_id)
    db.session.delete(income)
    db.session.commit()
    return "", 204
