import pytest
from helpers import PASSWORD, login, new_expense, new_income, register

from app import create_app, db
from app.models import User

NEW_PASSWORD = "otra-clave-nueva-2"


def change_password(client, current=PASSWORD, new=NEW_PASSWORD):
    return client.put(
        "/api/profile/password", json={"current_password": current, "new_password": new}
    )


def test_profile_shows_account_and_stats(client):
    profile = client.get("/api/profile").json
    assert profile["email"] == "ana@example.com"
    assert profile["name"] is None
    assert profile["created_at"]
    assert "password_hash" not in profile
    # Categorías por defecto: 5 de gasto + 4 de ingreso
    assert profile["stats"] == {"expenses": 0, "incomes": 0, "categories": 9}

    new_expense(client)
    new_expense(client)
    new_income(client)
    assert client.get("/api/profile").json["stats"] == {"expenses": 2, "incomes": 1, "categories": 9}


def test_stats_are_per_user(client, other_client):
    new_expense(client)
    assert other_client.get("/api/profile").json["stats"]["expenses"] == 0


def test_update_name(client):
    response = client.patch("/api/profile", json={"name": "  Ana Pérez  "})
    assert response.status_code == 200
    assert response.json["name"] == "Ana Pérez"
    assert client.get("/api/auth/me").json["name"] == "Ana Pérez"

    # Vacío = quitar el nombre
    assert client.patch("/api/profile", json={"name": "   "}).json["name"] is None


def test_update_name_validation(client):
    response = client.patch("/api/profile", json={"name": "x" * 81})
    assert response.status_code == 400
    assert "name" in response.json["errors"]


def test_name_is_per_user(client, other_client):
    client.patch("/api/profile", json={"name": "Ana"})
    assert other_client.get("/api/profile").json["name"] is None


def test_currency_defaults_to_usd(client):
    assert client.get("/api/profile").json["currency"] == "USD"


def test_update_currency(client):
    response = client.patch("/api/profile", json={"name": "", "currency": "eur"})
    assert response.status_code == 200
    assert response.json["currency"] == "EUR"
    assert client.get("/api/auth/me").json["currency"] == "EUR"


def test_update_currency_validation(client):
    response = client.patch("/api/profile", json={"name": "", "currency": "XXX"})
    assert response.status_code == 400
    assert "currency" in response.json["errors"]


def test_currency_is_optional_in_patch(client):
    # Mandar solo `name` (sin `currency`) no debe tocar la moneda ya elegida.
    client.patch("/api/profile", json={"name": "", "currency": "EUR"})
    response = client.patch("/api/profile", json={"name": "Ana"})
    assert response.status_code == 200
    assert response.json["currency"] == "EUR"


def test_change_password_success(client, app):
    assert change_password(client).status_code == 204
    # La sesión de quien cambia la clave sigue siendo válida
    assert client.get("/api/auth/me").status_code == 200

    fresh = app.test_client()
    assert login(fresh, "ana@example.com", PASSWORD).status_code == 401
    assert login(fresh, "ana@example.com", NEW_PASSWORD).status_code == 200


def test_change_password_wrong_current(client):
    response = change_password(client, current="no-es-mi-clave")
    # 400 (no 401): la app no debe pensar que la sesión caducó
    assert response.status_code == 400
    assert "current_password" in response.json["errors"]
    assert client.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(
    "new,expected",
    [
        ("corta", "new_password"),
        (PASSWORD, "new_password"),
        (None, "new_password"),
        ("qwerty123", "new_password"),  # contraseña común
        ("zzzzzzzzzz", "new_password"),  # un solo carácter repetido
    ],
)
def test_change_password_validation(client, new, expected):
    response = change_password(client, new=new)
    assert response.status_code == 400
    assert expected in response.json["errors"]


def test_change_password_rejects_own_email(app):
    client = app.test_client()
    assert register(client, "maria@example.com").status_code == 201
    response = change_password(client, new="Maria-2024-nueva")
    assert response.status_code == 400
    assert "new_password" in response.json["errors"]
    # Una contraseña sin el email sigue funcionando
    assert change_password(client).status_code == 204


def test_change_password_closes_other_sessions(client, app):
    other_device = app.test_client()
    assert login(other_device, "ana@example.com").status_code == 200
    assert other_device.get("/api/expenses").status_code == 200

    assert change_password(client).status_code == 204

    # La sesión abierta en el otro dispositivo deja de valer
    assert other_device.get("/api/expenses").status_code == 401
    assert other_device.get("/api/auth/me").status_code == 401
    # y la actual sigue funcionando
    assert client.get("/api/expenses").status_code == 200


def test_session_of_deleted_account_is_rejected(client):
    User.query.filter_by(email="ana@example.com").delete()
    db.session.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_change_password_is_rate_limited():
    app = create_app(
        {
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "TESTING": True,
            "SECRET_KEY": "clave-de-tests",
            "RATELIMIT_ENABLED": True,
        }
    )
    with app.app_context():
        db.create_all()
        client = app.test_client()
        assert register(client, "ana@example.com").status_code == 201
        statuses = [change_password(client, current="incorrecta-123").status_code for _ in range(12)]
        assert statuses[:10] == [400] * 10
        assert statuses[10:] == [429, 429]
