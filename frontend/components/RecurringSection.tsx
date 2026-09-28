"use client";

import { useEffect, useState } from "react";
import { Category, RecurringTransaction, api, isUnauthorized } from "@/lib/api";
import { useFormatMoney } from "@/lib/user-context";
import { View, VIEWS } from "@/lib/views";
import RecurringModal from "./RecurringModal";

const primaryButton =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700";

type Props = { view: View; onUnauthorized: () => void };

/**
 * Gastos o ingresos recurrentes de un tipo: la lista de plantillas (con pausar/reanudar,
 * editar y borrar) y el botón para crear una nueva. Es la sección "Recurrentes" dentro de
 * la pestaña Presupuestos de `TransactionsSection` (en gastos, debajo de `BudgetsCard`; en
 * ingresos, sola) — un mismo componente con distinto `view` para cada una.
 */
export default function RecurringSection({ view, onUnauthorized }: Props) {
  const config = VIEWS[view];
  const formatMoney = useFormatMoney();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.categories(), api.recurring.list(config.kind)])
      .then(([cats, list]) => {
        if (cancelled) return;
        setCategories(cats.filter((c) => c.kind === config.kind));
        setItems(list);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) onUnauthorized();
        else setError("No se pudo conectar con el servidor. ¿Está el backend en marcha?");
      });
    return () => {
      cancelled = true;
    };
  }, [config.kind, version, onUnauthorized]);

  async function toggleActive(item: RecurringTransaction) {
    try {
      await api.recurring.update(item.id, {
        amount: item.amount,
        description: item.description,
        category_id: item.category_id,
        day_of_month: item.day_of_month,
        kind: item.kind,
        active: !item.active,
      });
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError("No se pudo actualizar");
      return;
    }
    reload();
  }

  async function remove(item: RecurringTransaction) {
    if (!confirm(`¿Borrar "${item.description}"? Los movimientos que ya generó no se borran.`)) {
      return;
    }
    try {
      await api.recurring.remove(item.id);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError("No se pudo borrar");
      return;
    }
    if (editing?.id === item.id) setEditing(null);
    reload();
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => setAddOpen(true)} className={primaryButton}>
          + {config.newTitle} recurrente
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          Todavía no hay {config.listTitle.toLowerCase()} recurrentes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="py-2 pr-4 font-medium">Descripción</th>
                <th className="py-2 pr-4 font-medium">Categoría</th>
                <th className="py-2 pr-4 font-medium">Día</th>
                <th className="py-2 pr-4 text-right font-medium">Monto</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{item.description}</td>
                  <td className="py-2 pr-4">{item.category}</td>
                  <td className="py-2 pr-4 tabular-nums">{item.day_of_month}</td>
                  <td
                    className={`py-2 pr-4 text-right font-medium tabular-nums ${config.amountClass}`}
                  >
                    {formatMoney(item.amount)}
                  </td>
                  <td className="py-2 pr-4">
                    {item.active ? (
                      "Activo"
                    ) : (
                      <span className="text-zinc-500">Pausado</span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => toggleActive(item)}
                      className="mr-3 text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      {item.active ? "Pausar" : "Reanudar"}
                    </button>
                    <button
                      onClick={() => setEditing(item)}
                      className="mr-3 text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      Editar
                    </button>
                    <button onClick={() => remove(item)} className="text-red-600 hover:underline">
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(addOpen || editing) && (
        <RecurringModal
          view={view}
          categories={categories}
          editing={editing}
          onClose={() => {
            setAddOpen(false);
            setEditing(null);
          }}
          onSaved={reload}
          onUnauthorized={onUnauthorized}
        />
      )}
    </section>
  );
}
