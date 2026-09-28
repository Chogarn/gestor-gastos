"use client";

import { useState } from "react";
import { ApiError, Category, Transaction, TransactionInput } from "@/lib/api";
import { todayISO } from "@/lib/dates";

type Props = {
  /** Sustantivo para los textos del botón: "gasto" o "ingreso". */
  noun: string;
  categories: Category[];
  editing: Transaction | null;
  onSubmit: (data: TransactionInput) => Promise<void>;
  onCancel: () => void;
};

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

export default function TransactionForm({
  noun,
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
        date: String(data.get("date")),
        category_id: Number(data.get("category_id")),
      });
      if (!editing) form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    // key fuerza a React a recrear el form (y sus valores) al cambiar de movimiento
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
      <input
        name="date"
        type="date"
        required
        defaultValue={editing?.date ?? todayISO()}
        className={inputClass}
      />
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
          {editing ? "Guardar cambios" : `Añadir ${noun}`}
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
