from datetime import date

import pytest
from helpers import PASSWORD, cat, login, new_expense, new_income, register

from app import create_app, db
from app.models import Category, Expense, Income, User


def test_register_starts_session_with_default_categories(app):
    client = app.test_client()
    response = register(client, "Ana@Example.com")
    assert response.status_code == 201
    assert response.json["email"] == "ana@example.com"  # se guarda en minúsculas

    assert client.get("/api/auth/me").json["email"] == "ana@example.com"
    expense_names = {c["name"] for c in client.get("/api/categories?kind=expense").json}
    income_names = {c["name"] for c in client.get("/api/categories?kind=income").json}
    assert expense_names == {"Comida", "Transporte", "Hogar", "Ocio", "Otros"}
    assert income_names == {"Salario", "Freelance", "Inversiones", "Otros"}


def test_password_is_hashed(client, app):
    user = User.query.filter_by(email="ana@example.com").one()
    assert user.password_hash != PASSWORD
    assert PASSWORD not in user.password_hash


@pytest.mark.parametrize(
    "email,password,field",
    [
        ("no-es-un-email", PASSWORD, "email"),
        ("", PASSWORD, "email"),
        ("x@example.com", "corta", "password"),
        ("x@example.com", "a" * 129, "password"),
        ("x@example.com", None, "password"),
        ("x@example.com", "Password123", "password"),  # contraseña común
        ("x@example.com", "aaaaaaaa", "password"),  # un solo carácter repetido
        ("maria.lopez@example.com", "MARIA.LOPEZ-2024", "password"),  # contiene el email
    ],
)
def test_register_validation(app, email, password, field):
    response = app.test_client().post(
        "/api/auth/register", json={"email": email, "password": password}
    )
    assert response.status_code == 400
    assert field in response.json["errors"]


def test_register_allows_short_email_local_part_in_password(app):
    # La parte local de menos de 4 caracteres no cuenta como "contiene el email"
    response = register(app.test_client(), "ana@example.com", "ana-clave-larga-9")
    assert response.status_code == 201


def test_register_duplicate_email(client, app):
    response = register(app.test_client(), "ANA@example.com")
    assert response.status_code == 409
    assert "email" in response.json["errors"]


def test_login_and_logout(client, app):
    other = app.test_client()
    assert login(other, "ana@example.com").status_code == 200
    assert other.get("/api/auth/me").status_code == 200

    assert other.post("/api/auth/logout").status_code == 204
    assert other.get("/api/auth/me").status_code == 401
    assert other.get("/api/expenses").status_code == 401


def test_logout_invalidates_copied_cookie(client, app):
    """Una copia de la cookie (robada, o de otro dispositivo) deja de valer al cerrar sesión."""
    thief = app.test_client()
    thief.set_cookie("session", client.get_cookie("session").value)
    assert thief.get("/api/auth/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 204
    assert thief.get("/api/auth/me").status_code == 401
    assert thief.get("/api/expenses").status_code == 401

    # Se puede volver a entrar con normalidad
    assert login(client, "ana@example.com").status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_logout_without_session_is_harmless(app):
    assert app.test_client().post("/api/auth/logout").status_code == 204


def test_login_rejects_bad_credentials(client, app):
    anonymous = app.test_client()
    wrong = login(anonymous, "ana@example.com", "otra-clave-larga")
    unknown = login(anonymous, "nadie@example.com")
    assert wrong.status_code == unknown.status_code == 401
    # Mismo mensaje: no revela si el email existe
    assert wrong.json == unknown.json
    assert anonymous.get("/api/auth/me").status_code == 401


def test_session_cookie_is_httponly_and_lax(app):
    response = register(app.test_client(), "ana@example.com")
    cookie = response.headers["Set-Cookie"]
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/expenses"),
        ("post", "/api/expenses"),
        ("put", "/api/expenses/1"),
        ("delete", "/api/expenses/1"),
        ("get", "/api/incomes"),
        ("post", "/api/incomes"),
        ("get", "/api/categories"),
        ("post", "/api/categories"),
        ("delete", "/api/categories/1"),
        ("get", "/api/summary"),
        ("get", "/api/summary/history"),
        ("get", "/api/auth/me"),
        ("get", "/api/profile"),
        ("patch", "/api/profile"),
        ("put", "/api/profile/password"),
    ],
)
def test_data_endpoints_require_login(app, method, path):
    response = getattr(app.test_client(), method)(path, json={})
    assert response.status_code == 401


def test_users_cannot_see_or_touch_each_others_data(client, other_client):
    expense = new_expense(client).json
    income = new_income(client).json
    category = client.post("/api/categories", json={"name": "Privada"}).json

    # Bea no ve nada de Ana
    assert other_client.get("/api/expenses").json == []
    assert other_client.get("/api/incomes").json == []
    assert "Privada" not in {c["name"] for c in other_client.get("/api/categories").json}
    summary = other_client.get("/api/summary?month=2026-09").json
    assert float(summary["total"]) == float(summary["income_total"]) == 0
    assert summary["by_category"] == summary["income_by_category"] == []

    # ...ni puede modificarlo o borrarlo: 404, como si no existiera
    body = {"amount": "1", "description": "x", "date": "2026-09-01"}
    bea_food = cat(other_client, "Comida")
    bea_salary = cat(other_client, "Salario", "income")
    assert (
        other_client.put(
            f"/api/expenses/{expense['id']}", json={**body, "category_id": bea_food}
        ).status_code
        == 404
    )
    assert other_client.delete(f"/api/expenses/{expense['id']}").status_code == 404
    assert (
        other_client.put(
            f"/api/incomes/{income['id']}", json={**body, "category_id": bea_salary}
        ).status_code
        == 404
    )
    assert other_client.delete(f"/api/incomes/{income['id']}").status_code == 404
    assert other_client.delete(f"/api/categories/{category['id']}").status_code == 404

    # Los datos de Ana siguen intactos
    assert len(client.get("/api/expenses").json) == 1
    assert len(client.get("/api/incomes").json) == 1
    assert "Privada" in {c["name"] for c in client.get("/api/categories").json}


def test_cannot_use_another_users_category(client, other_client):
    anas_food = cat(client, "Comida")
    anas_salary = cat(client, "Salario", "income")
    assert new_expense(other_client, category_id=anas_food).status_code == 400
    assert new_income(other_client, category_id=anas_salary).status_code == 400


def test_each_user_has_own_category_names(client, other_client):
    # El mismo nombre en cuentas distintas no choca
    assert client.post("/api/categories", json={"name": "Mascotas"}).status_code == 201
    assert other_client.post("/api/categories", json={"name": "Mascotas"}).status_code == 201


def test_first_user_claims_pre_existing_data(app):
    # Datos creados antes de que existieran las cuentas (user_id vacío)
    legacy_category = Category(name="Antigua", kind="expense")
    db.session.add(legacy_category)
    db.session.flush()
    db.session.add(
        Expense(
            amount=10,
            description="Gasto antiguo",
            date=date(2026, 9, 1),
            category_id=legacy_category.id,
        )
    )
    db.session.commit()

    first = app.test_client()
    assert register(first, "primera@example.com").status_code == 201
    second = app.test_client()
    assert register(second, "segunda@example.com").status_code == 201

    assert [e["description"] for e in first.get("/api/expenses").json] == ["Gasto antiguo"]
    assert "Antigua" in {c["name"] for c in first.get("/api/categories").json}
    assert second.get("/api/expenses").json == []
    assert "Antigua" not in {c["name"] for c in second.get("/api/categories").json}
    assert Expense.query.filter(Expense.user_id.is_(None)).count() == 0
    assert Income.query.filter(Income.user_id.is_(None)).count() == 0


def test_login_is_rate_limited_per_account():
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
        statuses = [login(client, "victima@example.com").status_code for _ in range(12)]
        assert statuses[:10] == [401] * 10
        assert statuses[10:] == [429, 429]

        # El límite es por cuenta: intentar entrar en otra no se ve afectado
        assert login(client, "otra@example.com").status_code == 401
        # y el email cuenta igual aunque cambie el uso de mayúsculas
        assert login(client, "VICTIMA@example.com").status_code == 429


def test_forged_forwarded_for_does_not_bypass_rate_limit():
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
        statuses = [
            client.post(
                "/api/auth/login",
                json={"email": "victima@example.com", "password": PASSWORD},
                headers={"X-Forwarded-For": f"10.0.0.{i}"},
            ).status_code
            for i in range(12)
        ]
        assert statuses[10:] == [429, 429]


def test_secret_key_is_required(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        create_app({"SQLALCHEMY_DATABASE_URI": "sqlite://"})
