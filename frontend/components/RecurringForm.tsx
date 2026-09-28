"use client";

import { useState } from "react";
import { ApiError, Category, Kind, RecurringInput, RecurringTransaction } from "@/lib/api";

type Props = {
  /** Sustantivo para los textos del botón: "gasto" o "ingreso". */
  noun: string;
  kind: Kind;
  categories: Category[];
  editing: RecurringTransaction | null;
  onSubmit: (data: RecurringInput) => Promise<void>;
  onCancel: () => void;
};

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function RecurringForm({
  noun,
  kind,
  categories,
  editing,
  onSubmit,
  onCancel,
}: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        amount: String(data.get("amount")),
        description: String(data.get("description")),
        category_id: Number(data.get("category_id")),
        day_of_month: Number(data.get("day_of_month")),
        kind,
        // Pausar/reanudar se hace desde la lista, no desde este formulario.
        active: editing?.active ?? true,
      });
      if (!editing) form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    // key fuerza a React a recrear el form (y sus valores) al cambiar de plantilla
    <form
      key={editing?.id ?? "new"}
      onSubmit={handleSubmit}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input
        name="description"
        placeholder="Descripción"
        required
        maxLength={200}
        defaultValue={editing?.description}
        className={`${inputClass} sm:col-span-2`}
      />
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="Monto"
        required
        defaultValue={editing?.amount}
        className={inputClass}
      />
      <select
        name="day_of_month"
        required
        defaultValue={editing?.day_of_month ?? 1}
        aria-label="Día del mes"
        className={inputClass}
      >
        {DAYS.map((d) => (
          <option key={d} value={d}>
            Día {d}
          </option>
        ))}
      </select>
      <select
        name="category_id"
        required
        defaultValue={editing?.category_id}
        className={`${inputClass} sm:col-span-2`}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-500 sm:col-span-2">
        Si el mes no tiene ese día (por ejemplo el 31 en uno de 30), se carga el último día del
        mes.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={saving || categories.length === 0}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {editing ? "Guardar cambios" : `Añadir ${noun} recurrente`}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
