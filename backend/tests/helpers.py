PASSWORD = "clave-segura-1"


def register(client, email, password=PASSWORD):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def login(client, email, password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def cat(client, name, kind="expense"):
    """Id de una categoría del usuario del cliente, buscada por nombre y tipo."""
    for category in client.get(f"/api/categories?kind={kind}").json:
        if category["name"] == name:
            return category["id"]
    raise LookupError(f"No existe la categoría {name!r} ({kind})")


def new_expense(client, **overrides):
    body = {
        "amount": "12.50",
        "description": "Almuerzo",
        "date": "2026-09-10",
        "category_id": cat(client, "Comida"),
    }
    body.update(overrides)
    return client.post("/api/expenses", json=body)


def new_income(client, **overrides):
    body = {
        "amount": "1000",
        "description": "Sueldo",
        "date": "2026-09-01",
        "category_id": cat(client, "Salario", "income"),
    }
    body.update(overrides)
    return client.post("/api/incomes", json=body)
