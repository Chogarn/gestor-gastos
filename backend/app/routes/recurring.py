from flask import Blueprint, jsonify, request

from .. import db
from ..auth import current_user_id, get_owned_or_404, require_login
from ..models import EXPENSE, KINDS, Category, Expense, Income, RecurringTransaction
from ..recurring import generate_for_template
from ..schemas import ValidationError, validate_recurring

bp = Blueprint("recurring", __name__)
bp.before_request(require_login)


@bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify(errors=err.errors), 400


def _check_category(category_id, kind):
    category = db.session.get(Category, category_id)
    if category is None or category.user_id != current_user_id() or category.kind != kind:
        raise ValidationError({"category_id": "La categoría no existe"})


@bp.get("/recurring")
def list_recurring():
    query = RecurringTransaction.query.filter_by(user_id=current_user_id())
    kind = request.args.get("kind")
    if kind:
        if kind not in KINDS:
            raise ValidationError({"kind": "Debe ser 'expense' o 'income'"})
        query = query.filter_by(kind=kind)
    query = query.order_by(RecurringTransaction.day_of_month, RecurringTransaction.description)
    return jsonify([r.to_dict() for r in query.all()])


@bp.post("/recurring")
def create_recurring():
    fields = validate_recurring(request.get_json(silent=True))
    _check_category(fields["category_id"], fields["kind"])
    template = RecurringTransaction(user_id=current_user_id(), **fields)
    db.session.add(template)
    db.session.flush()  # necesita el id antes de generar sus movimientos
    generate_for_template(template)
    db.session.commit()
    return jsonify(template.to_dict()), 201


@bp.put("/recurring/<int:recurring_id>")
def update_recurring(recurring_id):
    template = get_owned_or_404(RecurringTransaction, recurring_id)
    fields = validate_recurring(request.get_json(silent=True))
    _check_category(fields["category_id"], fields["kind"])
    for key, value in fields.items():
        setattr(template, key, value)
    generate_for_template(template)
    db.session.commit()
    return jsonify(template.to_dict())


@bp.delete("/recurring/<int:recurring_id>")
def delete_recurring(recurring_id):
    template = get_owned_or_404(RecurringTransaction, recurring_id)
    # Los movimientos ya generados no se borran, solo se desenganchan (quedan como
    # movimientos normales). Se hace acá, en vez de confiar en el ondelete=SET NULL de la
    # base de datos, porque SQLite (a diferencia de Postgres) no lo aplica salvo que se
    # pida por conexión.
    model = Expense if template.kind == EXPENSE else Income
    model.query.filter_by(recurring_id=template.id).update({"recurring_id": None})
    db.session.delete(template)
    db.session.commit()
    return "", 204
