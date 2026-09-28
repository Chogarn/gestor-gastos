from datetime import date, timedelta
from decimal import Decimal

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from .. import db
from ..auth import current_user_id, require_login
from ..models import Category, Expense, Income
from ..schemas import ValidationError, parse_month

bp = Blueprint("summary", __name__)
bp.before_request(require_login)


@bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify(errors=err.errors), 400


def _by_category(model, start, end):
    """Total del periodo por categoría (de mayor a menor) y suma global."""
    total = func.sum(model.amount)
    rows = (
        db.session.query(Category.id, Category.name, total)
        .join(model, model.category_id == Category.id)
        .filter(model.user_id == current_user_id(), model.date >= start, model.date < end)
        .group_by(Category.id, Category.name)
        .order_by(total.desc())
        .all()
    )
    breakdown = [
        {"category_id": cid, "category": name, "total": str(amount)}
        for cid, name, amount in rows
    ]
    return breakdown, sum((Decimal(amount) for _, _, amount in rows), Decimal("0"))


@bp.get("/summary")
def summary():
    month = request.args.get("month") or date.today().strftime("%Y-%m")
    start, end = parse_month(month)

    by_category, expense_total = _by_category(Expense, start, end)
    income_by_category, income_total = _by_category(Income, start, end)

    return jsonify(
        month=month,
        total=str(expense_total),
        income_total=str(income_total),
        balance=str(income_total - expense_total),
        by_category=by_category,
        income_by_category=income_by_category,
    )


# --- Evolución en el tiempo: ingresos y gastos agrupados por día, semana, mes o año ---
# Se agrupa en Python (no con SQL) para que el mismo código funcione igual en SQLite
# (tests) y en Postgres: no todos los motores soportan agrupar por semana del año.

# nombre -> (periodos por defecto, periodos máximos)
GRANULARITIES = {
    "day": (30, 90),
    "week": (12, 52),
    "month": (6, 24),
    "year": (5, 10),
}


def _parse_end_date(value):
    if not value:
        return date.today()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({"end": "Formato esperado: YYYY-MM-DD"})


def _parse_periods(value, default, maximum):
    if value is None:
        return default
    try:
        periods = int(value)
    except ValueError:
        periods = 0
    if not 1 <= periods <= maximum:
        raise ValidationError({"periods": f"Debe ser un número entre 1 y {maximum}"})
    return periods


def _week_start(day):
    """Lunes de la semana de `day`."""
    return day - timedelta(days=day.weekday())


def _add_months(day, offset):
    index = day.year * 12 + day.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def _bucket_key(granularity, day):
    if granularity == "day":
        return day.isoformat()
    if granularity == "week":
        return _week_start(day).isoformat()
    if granularity == "month":
        return f"{day.year:04d}-{day.month:02d}"
    return str(day.year)  # year


def _period_bounds(granularity, end, periods):
    """(primer_bucket, inicio_consulta, fin_consulta_excluido)."""
    if granularity == "day":
        first = end - timedelta(days=periods - 1)
        return first, first, end + timedelta(days=1)
    if granularity == "week":
        last_start = _week_start(end)
        first = last_start - timedelta(weeks=periods - 1)
        return first, first, last_start + timedelta(weeks=1)
    if granularity == "month":
        last_month = date(end.year, end.month, 1)
        first = _add_months(last_month, -(periods - 1))
        return first, first, _add_months(last_month, 1)
    # year
    first = date(end.year - (periods - 1), 1, 1)
    return first, first, date(end.year + 1, 1, 1)


def _iter_buckets(granularity, first, periods):
    """`periods` fechas de referencia (una por bucket), desde `first` hacia adelante."""
    day = first
    for _ in range(periods):
        yield day
        if granularity == "day":
            day += timedelta(days=1)
        elif granularity == "week":
            day += timedelta(weeks=1)
        elif granularity == "month":
            day = _add_months(day, 1)
        else:
            day = date(day.year + 1, 1, 1)


def _totals_by_bucket(model, granularity, query_start, query_end):
    """{clave_de_bucket: total} del usuario actual entre `query_start` y `query_end`."""
    rows = (
        db.session.query(model.date, func.sum(model.amount))
        .filter(
            model.user_id == current_user_id(),
            model.date >= query_start,
            model.date < query_end,
        )
        .group_by(model.date)
        .all()
    )
    totals: dict[str, Decimal] = {}
    for day, amount in rows:
        key = _bucket_key(granularity, day)
        totals[key] = totals.get(key, Decimal("0")) + Decimal(str(amount))
    return totals


@bp.get("/summary/history")
def history():
    """Ingresos y gastos por periodo (con ceros en los periodos sin datos)."""
    granularity = request.args.get("granularity", "month")
    if granularity not in GRANULARITIES:
        raise ValidationError({"granularity": "Debe ser 'day', 'week', 'month' o 'year'"})
    default_periods, max_periods = GRANULARITIES[granularity]
    periods = _parse_periods(request.args.get("periods"), default_periods, max_periods)
    end = _parse_end_date(request.args.get("end"))

    first, query_start, query_end = _period_bounds(granularity, end, periods)
    incomes = _totals_by_bucket(Income, granularity, query_start, query_end)
    expenses = _totals_by_bucket(Expense, granularity, query_start, query_end)

    zero = Decimal("0")
    result = []
    for day in _iter_buckets(granularity, first, periods):
        key = _bucket_key(granularity, day)
        income = incomes.get(key, zero)
        expense = expenses.get(key, zero)
        result.append(
            {
                "period": key,
                "income_total": str(income),
                "expense_total": str(expense),
                "balance": str(income - expense),
            }
        )
    return jsonify(granularity=granularity, periods=result)
