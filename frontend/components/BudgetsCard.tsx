"use client";

import { useState } from "react";
import { ApiError, Category, CategoryTotal, api, isUnauthorized } from "@/lib/api";
import { useFormatMoney } from "@/lib/user-context";
import BudgetBar from "./BudgetBar";

type Props = {
  /** Categorías de gasto (ya filtradas por `kind`) */
  categories: Category[];
  /** Gastado por categoría en el mes elegido (de `summary.by_category`) */
  byCategory: CategoryTotal[];
  onChanged: () => void;
  onUnauthorized: () => void;
};

/**
 * Tarjeta con el presupuesto mensual de cada categoría de gasto: una barra de progreso
 * (gastado sobre el tope) y, para las que todavía no tienen uno, un enlace para ponerlo.
 * Es la pestaña "Presupuestos" de `TransactionsSection.tsx` (solo en `view="expenses"`) —
 * sin envoltorio propio, mismo criterio que `CategoryManager.tsx`.
 */
export default function BudgetsCard({ categories, byCategory, onChanged, onUnauthorized }: Props) {
  const formatMoney = useFormatMoney();
  const spentByCategory = new Map(byCategory.map((c) => [c.category_id, Number(c.total)]));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function save(categoryId: number, budget: string | null) {
    try {
      await api.updateCategoryBudget(categoryId, budget);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
      return;
    }
    setError("");
    setEditingId(null);
    onChanged();
  }

  if (categories.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="py-8 text-center text-sm text-zinc-500">
          Todavía no hay categorías de gasto.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <ul className="space-y-4">
        {categories.map((c) => {
          const spent = spentByCategory.get(c.id) ?? 0;
          const budget = c.budget != null ? Number(c.budget) : null;

          return (
            <li key={c.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {editingId === c.id ? (
                  <BudgetEditor
                    initial={c.budget}
                    onSave={(value) => save(c.id, value)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : budget != null ? (
                  <button
                    onClick={() => setEditingId(c.id)}
                    className="shrink-0 font-medium tabular-nums hover:underline"
                  >
                    {formatMoney(spent)} / {formatMoney(budget)}
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingId(c.id)}
                    className="shrink-0 text-zinc-500 hover:underline"
                  >
                    Poner presupuesto
                  </button>
                )}
              </div>
              {budget != null && editingId !== c.id && (
                <BudgetBar spent={spent} budget={budget} label={`Presupuesto de ${c.name}`} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BudgetEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string | null;
  onSave: (value: string | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(value.trim() === "" ? null : value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-1">
      <input
        type="number"
        step="0.01"
        min="0.01"
        placeholder="Monto"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        className="w-24 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
      />
      <button type="submit" className="text-emerald-700 hover:underline dark:text-emerald-400">
        Guardar
      </button>
      {initial != null && (
        <button
          type="button"
          onClick={() => onSave(null)}
          className="text-red-600 hover:underline"
        >
          Quitar
        </button>
      )}
      <button type="button" onClick={onCancel} className="text-zinc-500 hover:underline">
        Cancelar
      </button>
    </form>
  );
}
