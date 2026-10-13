from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path


class ValidationError(Exception):
    def __init__(self, errors):
        self.errors = errors


def parse_month(value):
    """'YYYY-MM' -> (primer día del mes, primer día del mes siguiente)."""
    try:
        start = datetime.strptime(value, "%Y-%m").date()
    except (TypeError, ValueError):
        raise ValidationError({"month": "Formato esperado: YYYY-MM"})
    end = date(start.year + (start.month == 12), start.month % 12 + 1, 1)
    return start, end


MAX_LIMIT = 100


def parse_limit(value):
    """`?limit=N` opcional (1 a MAX_LIMIT). Devuelve None si no se indicó."""
    if value is None:
        return None
    try:
        limit = int(value)
    except ValueError:
        limit = 0
    if not 1 <= limit <= MAX_LIMIT:
        raise ValidationError({"limit": f"Debe ser un número entre 1 y {MAX_LIMIT}"})
    return limit


def _validate_amount(data, errors):
    try:
        amount = Decimal(str(data.get("amount")))
        if not amount.is_finite() or amount <= 0:
            raise InvalidOperation
        return amount.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        errors["amount"] = "Debe ser un número mayor que 0"
        return None


def _validate_description(data, errors):
    description = (data.get("description") or "").strip()
    if not description or len(description) > 200:
        errors["description"] = "Obligatoria, máximo 200 caracteres"
    return description


def _validate_common(data, errors):
    """Valida monto, descripción y fecha (comunes a gastos e ingresos)."""
    amount = _validate_amount(data, errors)
    description = _validate_description(data, errors)

    try:
        day = date.fromisoformat(data.get("date"))
    except (TypeError, ValueError):
        errors["date"] = "Formato esperado: YYYY-MM-DD"
        day = None

    return {"amount": amount, "description": description, "date": day}


def validate_transaction(data):
    """Valida un gasto o un ingreso (mismos campos) y devuelve los valores ya convertidos."""
    errors = {}
    data = data or {}
    fields = _validate_common(data, errors)

    category_id = data.get("category_id")
    if not isinstance(category_id, int) or isinstance(category_id, bool):
        errors["category_id"] = "Debe ser un id de categoría"

    if errors:
        raise ValidationError(errors)
    return {**fields, "category_id": category_id}


MIN_PASSWORD = 8
MAX_PASSWORD = 128
MAX_NAME = 80


# Contraseñas muy comunes (minúsculas, una por línea); se cargan una sola vez al importar.
COMMON_PASSWORDS = frozenset(
    line.strip()
    for line in (Path(__file__).parent / "common_passwords.txt").read_text(encoding="utf-8").splitlines()
    if line.strip()
)


def password_error(password, email=None):
    """Mensaje de error si la contraseña no es aceptable; None si es válida.

    Además de la longitud, rechaza las contraseñas muy comunes, un solo carácter repetido
    y las que contienen la parte local del email (si tiene 4+ caracteres).
    """
    if not (isinstance(password, str) and MIN_PASSWORD <= len(password) <= MAX_PASSWORD):
        return f"Debe tener entre {MIN_PASSWORD} y {MAX_PASSWORD} caracteres"
    lowered = password.lower()
    if lowered in COMMON_PASSWORDS:
        return "Es una contraseña demasiado común; elige otra"
    if len(set(password)) == 1:
        return "No puede ser un único carácter repetido"
    local = (email or "").partition("@")[0].lower()
    if len(local) >= 4 and local in lowered:
        return "No puede contener tu email"
    return None


# Lista curada, no las ~180 de ISO 4217 (se puede ampliar). Debe coincidir con
# `CURRENCIES` en frontend/lib/currencies.ts.
CURRENCIES = {"USD", "EUR", "ARS", "UYU", "MXN", "CLP", "COP", "PEN", "BRL", "GBP"}


def validate_profile(data):
    """Nombre para mostrar (opcional, vacío = sin nombre) y moneda de la app.

    `currency` es opcional en el body: si no viene, se deja como estaba (para no
    romper un PATCH que solo mande `name`, como ya podía hacerse).
    """
    data = data or {}
    name = (data.get("name") or "").strip()
    if len(name) > MAX_NAME:
        raise ValidationError({"name": f"Máximo {MAX_NAME} caracteres"})

    result = {"name": name or None}
    if "currency" in data:
        currency = str(data.get("currency") or "").strip().upper()
        if currency not in CURRENCIES:
            raise ValidationError({"currency": "Moneda no soportada"})
        result["currency"] = currency
    return result


def validate_recurring(data):
    """Valida una plantilla de gasto/ingreso recurrente."""
    data = data or {}
    errors = {}
    amount = _validate_amount(data, errors)
    description = _validate_description(data, errors)

    category_id = data.get("category_id")
    if not isinstance(category_id, int) or isinstance(category_id, bool):
        errors["category_id"] = "Debe ser un id de categoría"

    day_of_month = data.get("day_of_month")
    if (
        not isinstance(day_of_month, int)
        or isinstance(day_of_month, bool)
        or not 1 <= day_of_month <= 31
    ):
        errors["day_of_month"] = "Debe ser un número entre 1 y 31"

    kind = data.get("kind")
    if kind not in ("expense", "income"):
        errors["kind"] = "Debe ser 'expense' o 'income'"

    active = data.get("active", True)
    if not isinstance(active, bool):
        errors["active"] = "Debe ser verdadero o falso"

    if errors:
        raise ValidationError(errors)
    return {
        "amount": amount,
        "description": description,
        "category_id": category_id,
        "day_of_month": day_of_month,
        "kind": kind,
        "active": active,
    }


def validate_category(data):
    data = data or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 50:
        raise ValidationError({"name": "Obligatorio, máximo 50 caracteres"})
    kind = data.get("kind", "expense")
    if kind not in ("expense", "income"):
        raise ValidationError({"kind": "Debe ser 'expense' o 'income'"})
    return {"name": name, "kind": kind}


def validate_budget(data):
    """Presupuesto mensual de una categoría de gasto: positivo, o `null` para quitarlo."""
    data = data or {}
    if "budget" not in data:
        raise ValidationError({"budget": "Falta el campo 'budget'"})
    raw = data.get("budget")
    if raw is None:
        return None
    try:
        budget = Decimal(str(raw))
        if not budget.is_finite() or budget <= 0:
            raise InvalidOperation
        return budget.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise ValidationError({"budget": "Debe ser un número mayor que 0, o vacío para quitarlo"})
