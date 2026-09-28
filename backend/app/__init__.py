import os
from datetime import timedelta

from flask import Flask, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from werkzeug.middleware.proxy_fix import ProxyFix

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(key_func=get_remote_address)


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", "sqlite:///gastos.db"),
        SECRET_KEY=os.environ.get("SECRET_KEY"),
        # La cookie de sesión es HttpOnly por defecto; Lax evita que otros sitios la envíen
        SESSION_COOKIE_SAMESITE="Lax",
        # Activar (SESSION_COOKIE_SECURE=true) cuando la app se sirva por HTTPS
        SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "").lower() == "true",
        PERMANENT_SESSION_LIFETIME=timedelta(days=30),
        RATELIMIT_STORAGE_URI="memory://",
    )
    if config:
        app.config.update(config)
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("Falta SECRET_KEY: define la variable de entorno (ver .env.example)")

    # Solo activar si hay un proxy de confianza justo delante que SOBRESCRIBE X-Forwarded-For
    # (nginx, Caddy...). El proxy de Next no lo hace y reenvía el que mande el cliente, así que
    # confiar en él permitiría falsear la IP. Por eso el límite de intentos es por cuenta.
    proxies = int(os.environ.get("TRUSTED_PROXIES", "0"))
    if proxies:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=proxies)

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)

    from .routes.auth import bp as auth_bp
    from .routes.categories import bp as categories_bp
    from .routes.expenses import bp as expenses_bp
    from .routes.incomes import bp as incomes_bp
    from .routes.profile import bp as profile_bp
    from .routes.recurring import bp as recurring_bp
    from .routes.summary import bp as summary_bp

    for bp in (
        auth_bp,
        categories_bp,
        expenses_bp,
        incomes_bp,
        profile_bp,
        recurring_bp,
        summary_bp,
    ):
        app.register_blueprint(bp, url_prefix="/api")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.errorhandler(404)
    def not_found(_err):
        return jsonify(errors={"not_found": "No encontrado"}), 404

    @app.errorhandler(429)
    def too_many_requests(_err):
        return jsonify(errors={"rate_limit": "Demasiados intentos, espera un minuto"}), 429

    return app
