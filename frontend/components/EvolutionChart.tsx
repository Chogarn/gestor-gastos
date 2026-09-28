import { Granularity, PeriodTotals } from "@/lib/api";
import { useFormatMoney } from "@/lib/user-context";

type Props = {
  /** Granularidad elegida: resalta el botón correspondiente al instante */
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  /**
   * Granularidad a la que corresponden realmente `periods`. Puede quedar un instante
   * detrás de `granularity` mientras se piden los nuevos datos: el gráfico sigue
   * mostrando los anteriores hasta que responde el pedido, en vez de mezclar una
   * granularidad con periodos de otro formato (p. ej. "2026" interpretado como día).
   */
  chartGranularity: Granularity;
  periods: PeriodTotals[];
  /** Mes seleccionado en el resumen (YYYY-MM); solo se usa con chartGranularity === "month" */
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  /** Qué curva(s) mostrar. Por defecto ambas (uso en el Resumen); una sola en las
   * páginas de Gastos/Ingresos, con el color que ya usa el resto de esa vista. */
  series?: "both" | "income" | "expense";
  /** Texto bajo el título, ej. "Pulsa un mes para filtrar la lista." en Gastos/Ingresos */
  monthHint?: string;
};

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

/** Cuántos periodos se piden por defecto según la granularidad (igual que el backend) */
export const DEFAULT_PERIODS: Record<Granularity, number> = {
  day: 30,
  week: 12,
  month: 6,
  year: 5,
};

const WIDTH = 600;
const HEIGHT = 180;
const PAD_X = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

// Interpretar "YYYY-MM-DD"/"YYYY-MM" con `new Date(string)` usa UTC y podría mostrar
// el día o el mes anterior; se arman las fechas en hora local a partir de las partes.
function parsePeriod(period: string, granularity: Granularity): Date {
  if (granularity === "year") return new Date(Number(period), 0, 1);
  const [y, m, d] = period.split("-").map(Number);
  return new Date(y, m - 1, d || 1);
}

function formatLabel(period: string, granularity: Granularity): string {
  const date = parsePeriod(period, granularity);
  if (granularity === "year") return period;
  if (granularity === "month")
    return new Intl.DateTimeFormat("es", { month: "short" }).format(date).replace(".", "");
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" })
    .format(date)
    .replace(".", "");
}

function formatTitle(period: string, granularity: Granularity): string {
  const date = parsePeriod(period, granularity);
  if (granularity === "year") return period;
  const opts: Intl.DateTimeFormatOptions =
    granularity === "month"
      ? { month: "long", year: "numeric" }
      : { day: "numeric", month: "long", year: "numeric" };
  return new Intl.DateTimeFormat("es", opts).format(date);
}

/** Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos. */
function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [[x, y]] = points;
    // Un solo punto: un trazo mínimo para que la línea sea visible
    return `M ${x - 1} ${y} L ${x + 1} ${y}`;
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Evolución de ingresos y/o gastos en el tiempo, con selector de día/semana/mes/año. Una
 * sola curva (Gastos o Ingresos) en `/expenses`/`/incomes`, las dos juntas en el Resumen. */
export default function EvolutionChart({
  granularity,
  onGranularityChange,
  chartGranularity,
  periods,
  selectedMonth,
  onSelectMonth,
  series = "both",
  monthHint = "Pulsa un mes para verlo en el resumen.",
}: Props) {
  const formatMoney = useFormatMoney();
  const showIncome = series !== "expense";
  const showExpense = series !== "income";
  const hasData = periods.some(
    (p) =>
      (showIncome && Number(p.income_total) > 0) || (showExpense && Number(p.expense_total) > 0),
  );
  const max = Math.max(
    1,
    ...periods.flatMap((p) => [
      ...(showIncome ? [Number(p.income_total)] : []),
      ...(showExpense ? [Number(p.expense_total)] : []),
    ]),
  );

  const innerWidth = WIDTH - PAD_X * 2;
  const x = (i: number) =>
    periods.length > 1 ? PAD_X + (i / (periods.length - 1)) * innerWidth : WIDTH / 2;
  const y = (value: number) =>
    HEIGHT - PAD_BOTTOM - (value / max) * (HEIGHT - PAD_BOTTOM - PAD_TOP);

  const incomePoints: [number, number][] = periods.map((p, i) => [x(i), y(Number(p.income_total))]);
  const expensePoints: [number, number][] = periods.map((p, i) => [
    x(i),
    y(Number(p.expense_total)),
  ]);

  // Con muchos puntos se muestran como máximo 8 etiquetas, repartidas en partes iguales
  // (incluyendo siempre la primera y la última) para que no se amontonen entre sí.
  const labelCount = Math.min(periods.length, 8);
  const labelIndices = new Set<number>(
    periods.length <= 1
      ? [0]
      : Array.from({ length: labelCount }, (_, k) =>
          Math.round((k * (periods.length - 1)) / (labelCount - 1)),
        ),
  );
  const hitWidth = Math.min(28, innerWidth / Math.max(periods.length, 1));

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-4 text-sm">
        {series === "both" && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Ingresos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500" /> Gastos
            </span>
          </>
        )}
        <div
          role="group"
          aria-label="Periodo"
          className="flex rounded-md border border-zinc-300 dark:border-zinc-700"
        >
          {GRANULARITY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              aria-pressed={granularity === value}
              onClick={() => onGranularityChange(value)}
              className={`px-3 py-1 first:rounded-l-md last:rounded-r-md ${
                granularity === value ? "bg-emerald-600 text-white" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          Aún no hay movimientos en este periodo.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-zinc-500">
            {chartGranularity === "month" ? monthHint : `Máximo del periodo: ${formatMoney(max)}.`}
          </p>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label={
              series === "both"
                ? "Evolución de ingresos y gastos"
                : series === "income"
                  ? "Evolución de ingresos"
                  : "Evolución de gastos"
            }
          >
            {showIncome && (
              <path
                d={smoothPath(incomePoints)}
                fill="none"
                className="stroke-emerald-500"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
            {showExpense && (
              <path
                d={smoothPath(expensePoints)}
                fill="none"
                className="stroke-rose-500"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
            {periods.map((p, i) => {
              const showLabel = labelIndices.has(i);
              const isSelected = chartGranularity === "month" && p.period === selectedMonth;
              const title =
                series === "both"
                  ? `${formatTitle(p.period, chartGranularity)}: ingresos ${formatMoney(p.income_total)}, gastos ${formatMoney(p.expense_total)}, balance ${formatMoney(p.balance)}`
                  : `${formatTitle(p.period, chartGranularity)}: ${formatMoney(
                      series === "income" ? p.income_total : p.expense_total,
                    )}`;
              return (
                <g key={p.period}>
                  {showIncome && (
                    <circle cx={x(i)} cy={y(Number(p.income_total))} r={isSelected ? 4 : 2.5} className="fill-emerald-500" />
                  )}
                  {showExpense && (
                    <circle cx={x(i)} cy={y(Number(p.expense_total))} r={isSelected ? 4 : 2.5} className="fill-rose-500" />
                  )}
                  {chartGranularity === "month" ? (
                    <rect
                      x={x(i) - hitWidth / 2}
                      y={0}
                      width={hitWidth}
                      height={HEIGHT - PAD_BOTTOM}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={title}
                      onClick={() => onSelectMonth(p.period)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectMonth(p.period);
                        }
                      }}
                      className={`cursor-pointer outline-none ${
                        isSelected ? "fill-emerald-500/10" : "fill-transparent hover:fill-zinc-500/5"
                      } focus-visible:fill-emerald-500/15`}
                    >
                      <title>{title}</title>
                    </rect>
                  ) : (
                    <rect
                      x={x(i) - hitWidth / 2}
                      y={0}
                      width={hitWidth}
                      height={HEIGHT - PAD_BOTTOM}
                      fill="transparent"
                    >
                      <title>{title}</title>
                    </rect>
                  )}
                  {showLabel && (
                    <text
                      x={x(i)}
                      y={HEIGHT - 8}
                      // Los extremos anclan hacia adentro para no salirse del gráfico
                      textAnchor={i === 0 ? "start" : i === periods.length - 1 ? "end" : "middle"}
                      className={`fill-zinc-500 text-[10px] ${
                        isSelected ? "fill-zinc-900 font-semibold dark:fill-zinc-100" : ""
                      }`}
                    >
                      {formatLabel(p.period, chartGranularity)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </>
      )}
    </section>
  );
}
