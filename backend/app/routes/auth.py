import re

from flask import Blueprint, g, jsonify, request, session
from flask_limiter.util import get_remote_address
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from .. import db, limiter
from ..auth import require_login, session_user, start_session
from ..models import Category, Expense, Income, User
from ..schemas import ValidationError, password_error
from ..seed import seed_categories

bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Hash de relleno: comprobarlo cuando el email no existe iguala el tiempo de respuesta
_DUMMY_HASH = generate_password_hash("relleno-para-igualar-tiempos")


@bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify(errors=err.errors), 400


def _credentials(data):
    data = data or {}
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password")
    return email, password if isinstance(password, str) else ""


def _account_key():
    """Clave del límite de intentos: la cuenta a la que se intenta entrar.

    No se usa la IP porque el backend solo ve la del proxy de Next (que no añade
    X-Forwarded-For): todos los usuarios compartirían contador y se podría bloquear
    el acceso a todos. Sin email en la petición se cae a la IP.
    """
    email, _ = _credentials(request.get_json(silent=True))
    return f"cuenta:{email}" if email else get_remote_address()


@bp.post("/auth/register")
@limiter.limit("20 per minute")  # contador compartido: solo frena inundaciones de altas
def register():
    email, password = _credentials(request.get_json(silent=True))

    errors = {}
    if not EMAIL_RE.match(email) or len(email) > 254:
        errors["email"] = "Introduce un email válido"
    if message := password_error(password):
        errors["password"] = message
    if errors:
        raise ValidationError(errors)

    if User.query.filter_by(email=email).first():
        return jsonify(errors={"email": "Ya existe una cuenta con ese email"}), 409

    is_first_user = User.query.first() is None
    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    try:
        db.session.flush()
        if is_first_user:
            # Los datos anteriores a las cuentas pasan a ser de la primera persona registrada
            for model in (Category, Expense, Income):
                model.query.filter(model.user_id.is_(None)).update({"user_id": user.id})
        seed_categories(user.id)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(errors={"email": "Ya existe una cuenta con ese email"}), 409

    start_session(user)
    return jsonify(user.to_dict()), 201


@bp.post("/auth/login")
@limiter.limit("10 per minute", key_func=_account_key)  # fuerza bruta contra una cuenta
@limiter.limit("200 per minute")  # contador compartido: frena probar una clave en muchas cuentas
def login():
    email, password = _credentials(request.get_json(silent=True))
    user = User.query.filter_by(email=email).first()
    valid = check_password_hash(user.password_hash if user else _DUMMY_HASH, password)
    if not user or not valid:
        return jsonify(errors={"auth": "Email o contraseña incorrectos"}), 401
    start_session(user)
    return jsonify(user.to_dict())


@bp.post("/auth/logout")
def logout():
    # Borrar la cookie no basta: es una sesión firmada sin tabla en el servidor, así que una
    # copia (robada, o en otro dispositivo) seguiría valiendo. Subir la versión las invalida
    # todas: cerrar sesión cierra la sesión en todos los dispositivos.
    if (user := session_user()) is not None:
        user.session_version += 1
        db.session.commit()
    session.clear()
    return "", 204


@bp.get("/auth/me")
def me():
    if (denied := require_login()) is not None:
        return denied
    return jsonify(g.user.to_dict())
