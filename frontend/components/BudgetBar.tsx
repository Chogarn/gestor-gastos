type Props = {
  spent: number;
  budget: number;
  /** Describe qué presupuesto es, para lectores de pantalla (ej. "Presupuesto de Comida") */
  label?: string;
};

/** Barra fina de progreso de un presupuesto: verde hasta el 80%, ámbar hasta el 100%,
 * roja al superarlo — mismo criterio en todos los lugares que la usan (`BudgetsCard.tsx`,
 * la pestaña "Presupuestos"; `CategoryDonutChart.tsx`, la pestaña "Gráfico"). */
export default function BudgetBar({ spent, budget, label }: Props) {
  const pct = Math.min((spent / budget) * 100, 100);
  const over = spent > budget;
  const color = over ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(Math.min((spent / budget) * 100, 999))}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
