"use client";

import { useState } from "react";
import { ApiError, Category, Kind, api, isUnauthorized } from "@/lib/api";

type Props = {
  kind: Kind;
  /** Categorías de este tipo */
  categories: Category[];
  /** Se llama tras crear o borrar una categoría, para volver a cargar los datos */
  onChange: () => void;
  /** Se llama con el id de la categoría borrada (para limpiar filtros que la usaran) */
  onDeleted: (categoryId: number) => void;
  onUnauthorized: () => void;
};

const inputClass =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

/**
 * Categorías de un tipo (gastos o ingresos): ver, crear y borrar. Sin envoltorio propio
 * (ni título): quien lo use aporta el contenedor, hoy `CategoryModal`.
 */
export default function CategoryManager({
  kind,
  categories,
  onChange,
  onDeleted,
  onUnauthorized,
}: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function report(err: unknown, fallback: string) {
    if (isUnauthorized(err)) return onUnauthorized();
    setError(err instanceof ApiError ? err.message : fallback);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    try {
      await api.createCategory(trimmed, kind);
      setName("");
      onChange();
    } catch (err) {
      report(err, "No se pudo crear");
    }
  }

  async function remove(category: Category) {
    if (!confirm(`¿Borrar la categoría "${category.name}"?`)) return;
    setError("");
    try {
      await api.deleteCategory(category.id);
      onDeleted(category.id);
      onChange();
    } catch (err) {
      report(err, "No se pudo borrar");
    }
  }

  return (
    <div>
      {categories.length === 0 && (
        <p className="mb-4 text-sm text-zinc-500">Todavía no hay categorías.</p>
      )}
      <ul className="mb-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-900"
          >
            {c.name}
            <button
              onClick={() => remove(c)}
              aria-label={`Borrar categoría ${c.name}`}
              className="text-zinc-400 hover:text-red-600"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva categoría"
          maxLength={50}
          aria-label="Nombre de la nueva categoría"
          className={inputClass}
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Añadir
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
