import pytest

from app import create_app, db
from helpers import register


@pytest.fixture
def app():
    app = create_app(
        {
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "TESTING": True,
            "SECRET_KEY": "clave-de-tests",
            "RATELIMIT_ENABLED": False,
        }
    )
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Cliente con sesión iniciada de la usuaria Ana (con sus categorías por defecto)."""
    c = app.test_client()
    assert register(c, "ana@example.com").status_code == 201
    return c


@pytest.fixture
def other_client(app):
    """Cliente con sesión iniciada de otra usuaria distinta (Bea)."""
    c = app.test_client()
    assert register(c, "bea@example.com").status_code == 201
    return c
