import calendar
from datetime import date

from helpers import cat, new_expense, new_income

from app import db
from app.models import RecurringTransaction
from app.recurring import generate_due_recurring, generate_for_template


def create_recurring(client, **overrides):
    body = {
        "amount": "50",
        "description": "Netflix",
        "category_id": cat(client, "Ocio"),
        "day_of_month": 15,
        "kind": "expense",
    }
    body.update(overrides)
    return client.post("/api/recurring", json=body)


def _shift_months(d, n):
    """`d` (día 1 de un mes) desplazado `n` meses (n puede ser negativo)."""
    month = d.month - 1 + n
    year = d.year + month // 12
    return date(year, month % 12 + 1, 1)


def test_create_recurring_generates_current_month(client):
    response = create_recurring(client)
    assert response.status_code == 201
    assert response.json["active"] is True

    expenses = client.get("/api/expenses").json
    assert len(expenses) == 1
    assert expenses[0]["recurring_id"] == response.json["id"]
    assert expenses[0]["date"] == date.today().replace(day=15).isoformat()


def test_create_recurring_income(client):
    response = create_recurring(
        client, kind="income", category_id=cat(client, "Salario", "income"), day_of_month=1
    )
    assert response.status_code == 201
    incomes = client.get("/api/incomes").json
    assert len(incomes) == 1
    assert incomes[0]["recurring_id"] == response.json["id"]


def test_day_is_clamped_to_last_day_of_month(client):
    create_recurring(client, day_of_month=31)
    expenses = client.get("/api/expenses").json
    today = date.today()
    last_day = calendar.monthrange(today.year, today.month)[1]
    assert expenses[0]["date"] == today.replace(day=last_day).isoformat()


def test_recurring_list_filters_by_kind(client):
    create_recurring(client, kind="expense")
    create_recurring(
        client, kind="income", category_id=cat(client, "Salario", "income"), day_of_month=1
    )
    assert len(client.get("/api/recurring?kind=expense").json) == 1
    assert len(client.get("/api/recurring?kind=income").json) == 1


def test_create_recurring_rejects_category_of_wrong_kind(client):
    response = create_recurring(client, category_id=cat(client, "Salario", "income"))
    assert response.status_code == 400
    assert "category_id" in response.json["errors"]


def test_create_recurring_validation(client):
    response = client.post(
        "/api/recurring",
        json={"amount": "0", "description": "", "category_id": "x", "day_of_month": 40, "kind": "otro"},
    )
    assert response.status_code == 400
    errors = response.json["errors"]
    for field in ("amount", "description", "category_id", "day_of_month", "kind"):
        assert field in errors


def test_recurring_is_per_user(client, other_client):
    template_id = create_recurring(client).json["id"]
    assert other_client.get("/api/recurring?kind=expense").json == []
    update_body = {
        "amount": "50",
        "description": "Netflix",
        "category_id": cat(other_client, "Ocio"),
        "day_of_month": 15,
        "kind": "expense",
    }
    assert other_client.put(f"/api/recurring/{template_id}", json=update_body).status_code == 404
    assert other_client.delete(f"/api/recurring/{template_id}").status_code == 404


def test_backfills_missed_months(client, app):
    template_id = create_recurring(client, day_of_month=1).json["id"]
    future = _shift_months(date.today().replace(day=1), 3)

    with app.app_context():
        template = db.session.get(RecurringTransaction, template_id)
        generate_for_template(template, today=future)  # simula 3 meses sin abrir la app
        db.session.commit()

    expenses = client.get("/api/expenses").json
    assert len(expenses) == 4  # el de la creación + los 3 meses atrasados


def test_pause_stops_generation_and_resume_backfills_the_gap(client, app):
    template_id = create_recurring(client, day_of_month=1).json["id"]
    body = {
        "amount": "50",
        "description": "Netflix",
        "category_id": cat(client, "Ocio"),
        "day_of_month": 1,
        "kind": "expense",
    }
    future = _shift_months(date.today().replace(day=1), 2)

    user_id = client.get("/api/auth/me").json["id"]
    assert client.put(f"/api/recurring/{template_id}", json={**body, "active": False}).status_code == 200
    with app.app_context():
        # Pausada: aunque pasen los meses, no debe generar nada.
        generate_due_recurring(user_id, today=future)

    # Solo el que ya se había generado al crear la plantilla
    assert len(client.get("/api/expenses").json) == 1

    assert client.put(f"/api/recurring/{template_id}", json={**body, "active": True}).status_code == 200
    with app.app_context():
        template = db.session.get(RecurringTransaction, template_id)
        # Al reactivar, se pone al día de una vez (igual que si la app hubiese estado
        # apagada: no se distingue "pausada" de "apagada").
        generate_for_template(template, today=future)
        db.session.commit()

    expenses = client.get("/api/expenses").json
    assert len(expenses) == 3  # el de la creación + los 2 meses que estuvo pausada


def test_edit_recurring_does_not_change_already_generated_expense(client):
    template_id = create_recurring(client, day_of_month=1).json["id"]
    original_date = client.get("/api/expenses").json[0]["date"]

    body = {
        "amount": "99",
        "description": "Netflix Premium",
        "category_id": cat(client, "Ocio"),
        "day_of_month": 20,
        "kind": "expense",
    }
    assert client.put(f"/api/recurring/{template_id}", json=body).status_code == 200

    expenses = client.get("/api/expenses").json
    assert len(expenses) == 1  # no generó un segundo movimiento para el mes actual
    assert expenses[0]["date"] == original_date
    assert expenses[0]["amount"] == "50.00"
    assert expenses[0]["description"] == "Netflix"


def test_delete_recurring_detaches_generated_expenses(client):
    template_id = create_recurring(client, day_of_month=1).json["id"]
    assert len(client.get("/api/expenses").json) == 1

    assert client.delete(f"/api/recurring/{template_id}").status_code == 204

    expenses = client.get("/api/expenses").json
    assert len(expenses) == 1
    assert expenses[0]["recurring_id"] is None


def test_cannot_delete_category_used_by_recurring(client):
    category_id = cat(client, "Ocio")
    create_recurring(client, category_id=category_id)
    assert client.delete(f"/api/categories/{category_id}").status_code == 409


def test_manual_expenses_are_not_affected_by_recurring_generation(client):
    new_expense(client)
    new_income(client)
    create_recurring(client, day_of_month=1)

    assert len(client.get("/api/expenses").json) == 2
    assert len(client.get("/api/incomes").json) == 1
