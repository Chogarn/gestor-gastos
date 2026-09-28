import { Category, CategoryTotal } from "@/lib/api";
import { useFormatMoney } from "@/lib/user-context";
import BudgetBar from "./BudgetBar";

type Props = {
  title: string;
  rows: CategoryTotal[];
  emptyText: string;
  /** Para mostrar la barra de presupuesto de cada categoría que tenga uno (solo gastos) */
  categories: Category[];
};

// Paleta categórica de la skill dataviz (references/palette.md): orden fijo, validada
// contra confusión de color (CVD) — nunca se cicla ni se generan tonos nuevos.
const PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;
// Más categorías que colores: las últimas se agrupan en "Otras categorías" (gris neutro,
// no es una identidad propia) en vez de generar un noveno color — regla de la paleta.
const OTHER_COLOR = "#898781";

const SIZE = 160;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2; // separador entre porciones (mismo criterio que el resto de los gráficos)

/** Gráfico circular de un desglose por categoría, con leyenda (nombre, monto y %) y, para
 * las categorías con presupuesto, una barra de cuánto se completó (mismo criterio que la
 * pestaña "Presupuestos", ver `BudgetBar.tsx`). */
export default function CategoryDonutChart({ title, rows, emptyText, categories }: Props) {
  const formatMoney = useFormatMoney();
  const total = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const budgetById = new Map(
    categories.filter((c) => c.budget != null).map((c) => [c.id, Number(c.budget)]),
  );

  if (rows.length === 0 || total <= 0) {
    return (
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="py-8 text-center text-sm text-zinc-500">{emptyText}</p>
      </section>
    );
  }

  // Ya llegan ordenadas de mayor a menor (ver `_by_category` en el backend).
  const visible = rows.length > PALETTE.length ? rows.slice(0, PALETTE.length - 1) : rows;
  const restTotal =
    rows.length > PALETTE.length
      ? rows.slice(PALETTE.length - 1).reduce((sum, r) => sum + Number(r.total), 0)
      : 0;

  const slices = [
    ...visible.map((r, i) => ({
      label: r.category,
      amount: Number(r.total),
      color: PALETTE[i],
      categoryId: r.category_id as number | undefined,
    })),
    ...(restTotal > 0
      ? [
          {
            label: "Otras categorías",
            amount: restTotal,
            color: OTHER_COLOR,
            categoryId: undefined,
          },
        ]
      : []),
  ];

  let offset = 0;
  const arcs = slices.map((s) => {
    const length = Math.max((s.amount / total) * CIRCUMFERENCE - GAP, 0);
    // Redondeado para mostrar: la suma de los % puede no dar 100 exacto, es normal.
    const pct = Math.round((s.amount / total) * 100);
    const arc = { ...s, length, dashoffset: -offset, pct };
    offset += length + GAP;
    return arc;
  });

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {/* En pantallas estrechas la leyenda va debajo, a todo el ancho, para que no
          se corten los nombres de categoría. Centrado con un ancho máximo para que no
          quede estirado en tarjetas anchas (la tarjeta ocupa el mismo ancho que el
          resto de la página, ver `TransactionsSection.tsx`). */}
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          className="shrink-0"
          role="img"
          aria-label={`${title}: ${formatMoney(total)} en total`}
        >
          {/* Empieza arriba (12 en punto) en vez del 3 en punto por defecto de SVG */}
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              className="text-zinc-100 dark:text-zinc-800"
            />
            {arcs.map((a) => (
              <circle
                key={a.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
                strokeDashoffset={a.dashoffset}
              >
                <title>{`${a.label}: ${formatMoney(a.amount)} · ${a.pct}%`}</title>
              </circle>
            ))}
          </g>
          <text
            x={SIZE / 2}
            y={SIZE / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-current text-sm font-semibold"
          >
            {formatMoney(total)}
          </text>
        </svg>

        <ul className="w-full min-w-0 flex-1 space-y-3 text-sm">
          {arcs.map((a) => {
            const budget = a.categoryId != null ? budgetById.get(a.categoryId) : undefined;
            return (
              <li key={a.label}>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="text-right font-medium tabular-nums">
                      {formatMoney(a.amount)}
                    </span>
                    <span className="w-9 text-right text-zinc-500 tabular-nums dark:text-zinc-400">
                      {a.pct}%
                    </span>
                  </span>
                </div>
                {budget != null && (
                  <div className="mt-1.5">
                    <BudgetBar spent={a.amount} budget={budget} label={`Presupuesto de ${a.label}`} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
