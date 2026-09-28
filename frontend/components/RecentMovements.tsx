import Link from "next/link";
import { Transaction } from "@/lib/api";
import { formatDayHeader, groupByDay } from "@/lib/transactions";
import { useFormatMoney } from "@/lib/user-context";
import { VIEWS, View } from "@/lib/views";

export type RecentMovement = Transaction & { view: View };

type Props = { items: RecentMovement[] };

/** Tarjeta de solo lectura con los últimos movimientos, mezclando gastos e ingresos,
 * agrupados por día — mismo formato que las listas de `/expenses` y `/incomes`
 * (`TransactionsByDay.tsx`), sin acciones de editar/borrar por ser de solo lectura. El
 * color del monto (rojo/verde) ya distingue gasto de ingreso, como en el resto de la app. */
export default function RecentMovements({ items }: Props) {
  const formatMoney = useFormatMoney();
  const groups = groupByDay(items);

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          Aún no has registrado ningún movimiento.{" "}
          <Link
            href={VIEWS.expenses.href}
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Empieza aquí
          </Link>
        </p>
      ) : (
        // `divide-y` en Tailwind v4 le da el borde a `border-bottom` de los elementos que
        // NO son el último (no `border-top` a los que no son el primero) — mismo patrón
        // invertido que `space-y` con `margin-bottom` (ver Tabs.tsx). El relleno de cada
        // lado de la línea se arma a mano: `pb-5` antes (todos menos el último) y `pt-5`
        // después (todos menos el primero) — igual que en `TransactionsByDay.tsx`.
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
                  {group.items.map((t) => {
                    const config = VIEWS[t.view];
                    return (
                      <li
                        key={`${t.view}-${t.id}`}
                        className="flex items-center justify-between gap-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.category}</p>
                          <p className="truncate text-xs text-zinc-500">{t.description}</p>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-medium tabular-nums ${config.amountClass}`}
                        >
                          {formatMoney(t.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
