"use client";

import { Transaction } from "@/lib/api";
import { formatDayHeader, groupByDay } from "@/lib/transactions";
import { useFormatMoney } from "@/lib/user-context";

type Props = {
  items: Transaction[];
  emptyText: string;
  /** Color del monto (verde para ingresos, rojo para gastos) */
  amountClass: string;
  onEdit: (item: Transaction) => void;
  onDelete: (item: Transaction) => void;
};

/** Lista de gastos o ingresos agrupada por día: encabezado de fecha y, debajo, cada
 * movimiento con la categoría, la descripción, el monto y las acciones de editar/borrar. */
export default function TransactionsByDay({
  items,
  emptyText,
  amountClass,
  onEdit,
  onDelete,
}: Props) {
  const formatMoney = useFormatMoney();

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">{emptyText}</p>;
  }

  const groups = groupByDay(items);

  // `divide-y` en Tailwind v4 le da el borde a `border-bottom` de los elementos que NO
  // son el último (no `border-top` a los que no son el primero, como en v3) — mismo
  // patrón invertido que `space-y` con `margin-bottom` (ver Tabs.tsx). Por eso el
  // relleno de cada lado de la línea se arma a mano: `pb-5` antes (todos menos el
  // último, ya que ahí es donde cae la línea) y `pt-5` después (todos menos el primero).
  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {groups.map((group, i) => {
        const spacing = [i !== groups.length - 1 && "pb-5", i !== 0 && "pt-5"]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={group.date} className={spacing || undefined}>
            <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {formatDayHeader(group.date)}
            </h3>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {group.items.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.category}</p>
                    <p className="truncate text-xs text-zinc-500">{t.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`mr-2 text-sm font-medium tabular-nums ${amountClass}`}>
                      {formatMoney(t.amount)}
                    </span>
                    <button
                      onClick={() => onEdit(t)}
                      aria-label={`Editar ${t.description}`}
                      className="rounded-md p-1.5 text-emerald-700 hover:bg-zinc-100 dark:text-emerald-400 dark:hover:bg-zinc-900"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(t)}
                      aria-label={`Borrar ${t.description}`}
                      className="rounded-md p-1.5 text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
