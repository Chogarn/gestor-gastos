"""Generación de movimientos a partir de plantillas recurrentes (RecurringTransaction).

No hay ninguna tarea programada: se pone al día "al entrar a la app" (ver `require_login`
en `app/auth.py`, que llama a `generate_due_recurring` como mucho una vez por día por sesión)
y también justo al crear o editar una plantilla, para que el mes actual aparezca al toque.
"""
import calendar
from datetime import date

from . import db
from .models import EXPENSE, Expense, Income, RecurringTransaction


def _next_month(d):
    """Primer día del mes siguiente a `d` (mismo cálculo que `parse_month` en schemas.py)."""
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def generate_for_template(template, today=None):
    """Genera (sin hacer commit) los movimientos que falten para esta plantilla, hasta el mes
    actual inclusive. No hace nada si está pausada. La llaman `generate_due_recurring` (todas
    las plantillas del usuario) y las rutas de alta/edición (para esa plantilla, al toque).

    Si estuvo pausada, al reactivarla recupera de una vez los meses de atraso — igual que si
    la app hubiese estado apagada ese tiempo: no hay forma de saber "cuándo" habría tocado
    generar cada uno, así que se tratan igual que cualquier otro atraso.

    `today` es solo para tests: por defecto usa la fecha real.
    """
    if not template.active:
        return

    model = Expense if template.kind == EXPENSE else Income
    last = (
        db.session.query(db.func.max(model.date))
        .filter_by(recurring_id=template.id)
        .scalar()
    )
    cursor = _next_month(last) if last else template.created_at.date().replace(day=1)
    current_month = (today or date.today()).replace(day=1)

    while cursor <= current_month:
        last_day = calendar.monthrange(cursor.year, cursor.month)[1]
        db.session.add(
            model(
                user_id=template.user_id,
                amount=template.amount,
                description=template.description,
                date=cursor.replace(day=min(template.day_of_month, last_day)),
                category_id=template.category_id,
                recurring_id=template.id,
            )
        )
        cursor = _next_month(cursor)


def generate_due_recurring(user_id, today=None):
    """Pone al día todas las plantillas activas del usuario (varios meses atrasados incluidos)."""
    templates = RecurringTransaction.query.filter_by(user_id=user_id, active=True).all()
    for template in templates:
        generate_for_template(template, today=today)
    db.session.commit()
