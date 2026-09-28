import pytest
from helpers import new_expense, new_income


def by_period(data):
    return {p["period"]: p for p in data["periods"]}


def test_history_defaults_to_month_with_six_periods(client):
    data = client.get("/api/summary/history").json
    assert data["granularity"] == "month"
    assert len(data["periods"]) == 6


# --- día ---


def test_history_by_day_fills_gaps_with_zero(client):
    new_income(client, amount="1000", date="2026-09-24")
    new_expense(client, amount="40.50", date="2026-09-26")

    data = client.get("/api/summary/history?granularity=day&periods=4&end=2026-09-27").json
    assert data["granularity"] == "day"
    assert [p["period"] for p in data["periods"]] == [
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
    ]
    by = by_period(data)
    assert float(by["2026-09-24"]["income_total"]) == 1000
    assert float(by["2026-09-25"]["balance"]) == 0
    assert float(by["2026-09-26"]["expense_total"]) == 40.5
    assert float(by["2026-09-27"]["balance"]) == 0


def test_history_by_day_two_movements_same_day_are_summed(client):
    new_expense(client, amount="10", date="2026-09-27")
    new_expense(client, amount="15", date="2026-09-27")
    data = client.get("/api/summary/history?granularity=day&periods=1&end=2026-09-27").json
    assert float(data["periods"][0]["expense_total"]) == 25


# --- semana ---


def test_history_by_week_groups_by_monday(client):
    # 2026-09-21 es lunes; el domingo 27 pertenece a la misma semana
    new_income(client, amount="100", date="2026-09-21")
    new_income(client, amount="50", date="2026-09-27")
    new_expense(client, amount="20", date="2026-09-28")  # lunes siguiente: otra semana

    data = client.get("/api/summary/history?granularity=week&periods=2&end=2026-09-28").json
    assert [p["period"] for p in data["periods"]] == ["2026-09-21", "2026-09-28"]
    by = by_period(data)
    assert float(by["2026-09-21"]["income_total"]) == 150
    assert float(by["2026-09-28"]["expense_total"]) == 20


# --- mes (equivalente a los tests anteriores, con el nuevo formato) ---


def test_history_by_month_fills_empty_months_with_zero(client):
    new_income(client, amount="1000", date="2026-07-05")
    new_expense(client, amount="250", date="2026-07-20")
    new_expense(client, amount="40.50", date="2026-09-03")

    data = client.get("/api/summary/history?granularity=month&periods=4&end=2026-09-30").json
    assert [p["period"] for p in data["periods"]] == ["2026-06", "2026-07", "2026-08", "2026-09"]

    by = by_period(data)
    assert float(by["2026-06"]["balance"]) == 0
    assert float(by["2026-07"]["income_total"]) == 1000
    assert float(by["2026-07"]["expense_total"]) == 250
    assert float(by["2026-07"]["balance"]) == 750
    assert float(by["2026-08"]["income_total"]) == 0
    assert float(by["2026-09"]["expense_total"]) == 40.5
    assert float(by["2026-09"]["balance"]) == -40.5


def test_history_by_month_crosses_year_boundary(client):
    new_income(client, amount="300", date="2025-12-31")
    new_expense(client, amount="50", date="2026-01-01")

    data = client.get("/api/summary/history?granularity=month&periods=3&end=2026-01-15").json
    assert [p["period"] for p in data["periods"]] == ["2025-11", "2025-12", "2026-01"]
    by = by_period(data)
    assert float(by["2025-12"]["income_total"]) == 300
    assert float(by["2026-01"]["expense_total"]) == 50


def test_history_by_month_ignores_movements_outside_range(client):
    new_expense(client, amount="99", date="2026-01-15")  # antes del rango
    new_expense(client, amount="77", date="2026-10-01")  # después del rango

    data = client.get("/api/summary/history?granularity=month&periods=3&end=2026-09-15").json
    assert all(float(p["expense_total"]) == 0 for p in data["periods"])


# --- año ---


def test_history_by_year(client):
    new_income(client, amount="500", date="2025-06-01")
    new_expense(client, amount="200", date="2026-01-01")

    data = client.get("/api/summary/history?granularity=year&periods=3&end=2026-09-27").json
    assert [p["period"] for p in data["periods"]] == ["2024", "2025", "2026"]
    by = by_period(data)
    assert float(by["2025"]["income_total"]) == 500
    assert float(by["2026"]["expense_total"]) == 200
    assert float(by["2024"]["balance"]) == 0


# --- validación ---


@pytest.mark.parametrize(
    "query",
    [
        "granularity=raro",
        "granularity=day&periods=0",
        "granularity=day&periods=91",
        "granularity=week&periods=53",
        "granularity=month&periods=25",
        "granularity=year&periods=11",
        "periods=abc",
        "end=mal",
    ],
)
def test_history_validation(client, query):
    assert client.get(f"/api/summary/history?{query}").status_code == 400


def test_history_is_per_user(client, other_client):
    new_income(client, amount="500", date="2026-09-01")
    data = other_client.get("/api/summary/history?granularity=month&periods=2&end=2026-09-15").json
    assert all(float(p["income_total"]) == 0 for p in data["periods"])
