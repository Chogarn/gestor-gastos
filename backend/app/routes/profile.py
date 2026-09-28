from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from .. import db, limiter
from ..auth import current_user_id, require_login, start_session
from ..models import Category, Expense, Income
from ..schemas import ValidationError, password_error, validate_profile

bp = Blueprint("profile", __name__)
bp.before_request(require_login)


@bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify(errors=err.errors), 400


def _profile():
    user_id = current_user_id()
    return {
        **g.user.to_dict(),
        "stats": {
            "expenses": Expense.query.filter_by(user_id=user_id).count(),
            "incomes": Income.query.filter_by(user_id=user_id).count(),
            "categories": Category.query.filter_by(user_id=user_id).count(),
        },
    }


@bp.get("/profile")
def get_profile():
    return jsonify(_profile())


@bp.patch("/profile")
def update_profile():
    updates = validate_profile(request.get_json(silent=True))
    g.user.name = updates["name"]
    if "currency" in updates:
        g.user.currency = updates["currency"]
    db.session.commit()
    return jsonify(_profile())


@bp.put("/profile/password")
@limiter.limit("10 per minute", key_func=lambda: f"perfil:{current_user_id()}")
def change_password():
    data = request.get_json(silent=True) or {}
    current, new = data.get("current_password"), data.get("new_password")

    errors = {}
    if not isinstance(current, str) or not check_password_hash(g.user.password_hash, current):
        # 400 y no 401: un 401 haría que la app creyera que la sesión caducó
        errors["current_password"] = "La contraseña actual no es correcta"
    elif message := password_error(new):
        errors["new_password"] = message
    elif new == current:
        errors["new_password"] = "Debe ser distinta de la actual"
    if errors:
        raise ValidationError(errors)

    g.user.password_hash = generate_password_hash(new)
    db.session.commit()
    # Las demás sesiones abiertas quedan invalidadas (cambia la huella de la contraseña);
    # esta se renueva para que quien la cambia siga dentro.
    start_session(g.user)
    return "", 204
