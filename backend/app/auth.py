import hashlib
import hmac
from datetime import date

from flask import abort, g, jsonify, session

from . import db
from .models import User
from .recurring import generate_due_recurring


def password_fingerprint(user):
    """Huella corta del hash de contraseña.

    Va dentro de la cookie de sesión: al cambiar la contraseña la huella cambia y las
    sesiones abiertas antes (en otros dispositivos, por ejemplo) dejan de ser válidas.
    """
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]


def start_session(user):
    session.clear()  # evita reutilizar una sesión anterior
    session["user_id"] = user.id
    session["pw"] = password_fingerprint(user)
    session["sv"] = user.session_version
    session.permanent = True


def current_user_id():
    return session.get("user_id")


def session_user():
    """Usuario de la sesión actual si sigue siendo válida; None si no.

    Comprueba contra la base de datos que la cuenta sigue existiendo, que la contraseña
    no ha cambiado desde que se inició la sesión y que no se cerró sesión después.
    """
    user_id = current_user_id()
    user = db.session.get(User, user_id) if user_id else None
    if (
        user is None
        or not hmac.compare_digest(str(session.get("pw", "")), password_fingerprint(user))
        or session.get("sv") != user.session_version
    ):
        return None
    return user


def require_login():
    """`before_request` de los blueprints protegidos: 401 si no hay sesión válida.

    Ver `session_user()` para lo que se comprueba. Deja el usuario en `g.user`.
    """
    user = session_user()
    if user is None:
        session.clear()
        return jsonify(errors={"auth": "Inicia sesión para continuar"}), 401
    g.user = user

    # Al entrar a la app (como mucho una vez por día por sesión) se ponen al día los gastos
    # e ingresos recurrentes: no hay ninguna tarea programada, esto es lo que los genera.
    today = date.today().isoformat()
    if session.get("recurring_checked") != today:
        generate_due_recurring(user.id)
        session["recurring_checked"] = today


def get_owned_or_404(model, object_id):
    """Devuelve el objeto solo si es del usuario actual; si no, 404 (no revela que existe)."""
    obj = db.session.get(model, object_id)
    if obj is None or obj.user_id != current_user_id():
        abort(404)
    return obj
