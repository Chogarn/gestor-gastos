import pytest
from helpers import cat, new_expense, new_income


def test_health(app):
    assert app.test_client().get("/api/health").json == {"status": "ok"}


def test_expense_crud(client):
    created = new_expense(client)
    assert created.status_code == 201
    expense = created.json
    assert expense["amount"] == "12.50"
    assert expense["category"] == "Comida"

    updated = client.put(
        f"/api/expenses/{expense['id']}",
        json={**expense, "amount": "20", "category_id": cat(client, "Ocio")},
    )
    assert updated.status_code == 200
    assert updated.json["amount"] == "20.00"
    assert updated.json["category"] == "Ocio"

    assert len(client.get("/api/expenses").json) == 1
    assert client.delete(f"/api/expenses/{expense['id']}").status_code == 204
    assert client.get("/api/expenses").json == []


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"amount": "-5"}, "amount"),
        ({"amount": "abc"}, "amount"),
        ({"description": "  "}, "description"),
        ({"date": "10/09/2026"}, "date"),
        ({"category_id": 999}, "category_id"),
    ],
)
def test_expense_validation(client, overrides, field):
    response = new_expense(client, **overrides)
    assert response.status_code == 400
    assert field in response.json["errors"]


def test_expense_rejects_income_category(client):
    response = new_expense(client, category_id=cat(client, "Salario", "income"))
    assert response.status_code == 400
    assert "category_id" in response.json["errors"]


def test_filters_by_month_and_category(client):
    ocio = cat(client, "Ocio")
    new_expense(client, date="2026-09-10")
    new_expense(client, date="2026-10-02", category_id=ocio)
    new_expense(client, date="2026-12-31")

    assert len(client.get("/api/expenses?month=2026-09").json) == 1
    assert len(client.get("/api/expenses?month=2026-12").json) == 1
    assert len(client.get(f"/api/expenses?category_id={ocio}").json) == 1
    assert client.get("/api/expenses?month=mal").status_code == 400


def test_summary(client):
    new_expense(client, amount="10.00")
    new_expense(client, amount="5.50")
    new_expense(client, amount="4.00", category_id=cat(client, "Ocio"))
    new_expense(client, amount="99.00", date="2026-08-01")

    data = client.get("/api/summary?month=2026-09").json
    assert float(data["total"]) == 19.5
    assert data["by_category"][0]["category"] == "Comida"
    assert float(data["by_category"][0]["total"]) == 15.5


def test_income_crud(client):
    created = new_income(client)
    assert created.status_code == 201
    income = created.json
    assert income["amount"] == "1000.00"
    assert income["category"] == "Salario"

    updated = client.put(
        f"/api/incomes/{income['id']}",
        json={**income, "amount": "1200.50", "category_id": cat(client, "Freelance", "income")},
    )
    assert updated.status_code == 200
    assert updated.json["amount"] == "1200.50"
    assert updated.json["category"] == "Freelance"

    assert len(client.get("/api/incomes?month=2026-09").json) == 1
    assert client.get("/api/incomes?month=2026-08").json == []
    assert client.delete(f"/api/incomes/{income['id']}").status_code == 204
    assert client.get("/api/incomes").json == []


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"amount": "0"}, "amount"),
        ({"description": ""}, "description"),
        ({"date": "ayer"}, "date"),
        ({"category_id": 999}, "category_id"),
    ],
)
def test_income_validation(client, overrides, field):
    response = new_income(client, **overrides)
    assert response.status_code == 400
    assert field in response.json["errors"]


def test_income_rejects_expense_category(client):
    response = new_income(client, category_id=cat(client, "Comida"))
    assert response.status_code == 400
    assert "category_id" in response.json["errors"]


def test_income_filter_by_category(client):
    freelance = cat(client, "Freelance", "income")
    new_income(client)
    new_income(client, category_id=freelance)
    assert len(client.get(f"/api/incomes?category_id={freelance}").json) == 1


def test_summary_balance(client):
    new_income(client, amount="1000")
    new_income(client, amount="250.50", date="2026-09-15", category_id=cat(client, "Freelance", "income"))
    new_income(client, amount="500", date="2026-08-01")
    new_expense(client, amount="300")

    data = client.get("/api/summary?month=2026-09").json
    assert float(data["income_total"]) == 1250.5
    assert float(data["total"]) == 300
    assert float(data["balance"]) == 950.5
    assert [c["category"] for c in data["income_by_category"]] == ["Salario", "Freelance"]
    assert [c["category"] for c in data["by_category"]] == ["Comida"]

    empty = client.get("/api/summary?month=2025-01").json
    assert float(empty["balance"]) == 0


def test_category_rules(client):
    # "Comida" ya existe por defecto
    assert client.post("/api/categories", json={"name": "Comida"}).status_code == 409
    created = client.post("/api/categories", json={"name": "Salud"})
    assert created.status_code == 201
    assert created.json["kind"] == "expense"

    new_expense(client)
    assert client.delete(f"/api/categories/{cat(client, 'Comida')}").status_code == 409
    assert client.delete(f"/api/categories/{created.json['id']}").status_code == 204


def test_income_categories_are_independent(client):
    # El mismo nombre puede existir como categoría de gasto y de ingreso
    assert client.post("/api/categories", json={"name": "Salud"}).status_code == 201
    other = client.post("/api/categories", json={"name": "Salud", "kind": "income"})
    assert other.status_code == 201
    assert other.json["kind"] == "income"
    assert (
        client.post("/api/categories", json={"name": "Salud", "kind": "income"}).status_code == 409
    )
    assert client.post("/api/categories", json={"name": "X", "kind": "raro"}).status_code == 400

    incomes = client.get("/api/categories?kind=income").json
    assert {c["name"] for c in incomes} == {"Salario", "Freelance", "Inversiones", "Otros", "Salud"}

    # Una categoría de ingreso con movimientos no se puede borrar
    new_income(client)
    assert client.delete(f"/api/categories/{cat(client, 'Salario', 'income')}").status_code == 409


def test_category_budget(client):
    category_id = cat(client, "Comida")
    assert next(c for c in client.get("/api/categories").json if c["id"] == category_id)["budget"] is None

    response = client.put(f"/api/categories/{category_id}", json={"budget": "300"})
    assert response.status_code == 200
    assert response.json["budget"] == "300.00"

    updated = next(c for c in client.get("/api/categories").json if c["id"] == category_id)
    assert updated["budget"] == "300.00"

    # null lo quita
    assert client.put(f"/api/categories/{category_id}", json={"budget": None}).json["budget"] is None


@pytest.mark.parametrize("budget", ["0", "-5", "no-es-un-numero"])
def test_category_budget_validation(client, budget):
    category_id = cat(client, "Comida")
    response = client.put(f"/api/categories/{category_id}", json={"budget": budget})
    assert response.status_code == 400
    assert "budget" in response.json["errors"]


def test_category_budget_requires_the_field(client):
    category_id = cat(client, "Comida")
    assert client.put(f"/api/categories/{category_id}", json={}).status_code == 400


def test_income_categories_cannot_have_a_budget(client):
    category_id = cat(client, "Salario", "income")
    response = client.put(f"/api/categories/{category_id}", json={"budget": "300"})
    assert response.status_code == 400
    assert "budget" in response.json["errors"]


def test_category_budget_is_per_user(client, other_client):
    category_id = cat(client, "Comida")
    assert client.put(f"/api/categories/{category_id}", json={"budget": "300"}).status_code == 200
    other_category_id = cat(other_client, "Comida")
    assert other_category_id != category_id
    response = other_client.put(f"/api/categories/{category_id}", json={"budget": "50"})
    assert response.status_code == 404


# --- ?limit=N: los N movimientos más recientes (para "últimos movimientos" del panel) ---

RESOURCES = [("expenses", new_expense), ("incomes", new_income)]


@pytest.mark.parametrize("path,create", RESOURCES)
def test_limit_returns_most_recent_first(client, path, create):
    for day in ("2026-01-05", "2026-03-10", "2026-02-20", "2026-04-01", "2026-03-15"):
        create(client, date=day, description=f"del {day}")
    # Mismo día: el creado después va primero (desempata por id)
    create(client, date="2026-04-01", description="segundo del 1 de abril")

    latest = client.get(f"/api/{path}?limit=4").json
    assert [m["description"] for m in latest] == [
        "segundo del 1 de abril",
        "del 2026-04-01",
        "del 2026-03-15",
        "del 2026-03-10",
    ]
    # Atraviesa varios meses: sin `month` es todo el histórico
    assert len(client.get(f"/api/{path}").json) == 6
    assert len(client.get(f"/api/{path}?limit=100").json) == 6


@pytest.mark.parametrize("path,create", RESOURCES)
def test_limit_combines_with_other_filters(client, path, create):
    for day in ("2026-09-01", "2026-09-05", "2026-09-09", "2026-08-30"):
        create(client, date=day)
    september = client.get(f"/api/{path}?month=2026-09&limit=2").json
    assert [m["date"] for m in september] == ["2026-09-09", "2026-09-05"]


@pytest.mark.parametrize("path,create", RESOURCES)
@pytest.mark.parametrize("value", ["0", "-1", "101", "abc", "1.5", ""])
def test_limit_validation(client, path, create, value):
    response = client.get(f"/api/{path}?limit={value}")
    assert response.status_code == 400
    assert "limit" in response.json["errors"]


@pytest.mark.parametrize("path,create", RESOURCES)
def test_limit_only_counts_own_movements(client, other_client, path, create):
    create(client, date="2026-09-01")
    create(other_client, date="2026-09-02")
    only_mine = client.get(f"/api/{path}?limit=4").json
    assert [m["date"] for m in only_mine] == ["2026-09-01"]
