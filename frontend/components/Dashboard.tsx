"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Category, Granularity, PeriodTotals, Summary, api, isUnauthorized } from "@/lib/api";
import { currentMonth, todayISO } from "@/lib/dates";
import { useFormatMoney } from "@/lib/user-context";
import { VIEWS, View } from "@/lib/views";
import { DollarIcon, ListIcon, TrendIcon } from "./icons";
import { TabList, TabPanel } from "./Tabs";
import EvolutionChart, { DEFAULT_PERIODS } from "./EvolutionChart";
import TransactionModal from "./TransactionModal";
import RecentMovements, { RecentMovement } from "./RecentMovements";

type DashboardTab = "balance" | "evolucion" | "movimientos";
const DASHBOARD_TABS = [
  { value: "balance" as const, label: "Balance", icon: <DollarIcon /> },
  { value: "evolucion" as const, label: "Evolución", icon: <TrendIcon /> },
  { value: "movimientos" as const, label: "Últimos movimientos", icon: <ListIcon /> },
];

/** Cuántos movimientos se muestran en "últimos movimientos" (de gastos e ingresos juntos) */
const RECENT_COUNT = 6;

/** Los `n` más recientes de ambas listas, ya ordenadas por fecha, mezclados por fecha */
function mergeRecent(
  expenses: RecentMovement[],
  incomes: RecentMovement[],
  n: number,
): RecentMovement[] {
  return [...expenses, ...incomes].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n);
}

/** Página principal: solo lectura. Balance del mes, evolución y últimos movimientos,
 * cada uno detrás de su propia pestaña — nada queda visible de forma persistente. */
export default function Dashboard() {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  // La granularidad elegida (resalta el botón al instante) puede no coincidir por un
  // momento con los datos que aún se están pidiendo. `history` guarda ambos juntos y solo
  // se actualiza cuando responde el pedido, para que nunca lleguen a EvolutionChart una
  // granularidad y unos periodos de formatos distintos (eso rompía la página).
  const [pendingGranularity, setPendingGranularity] = useState<Granularity>("month");
  const [history, setHistory] = useState<{ granularity: Granularity; periods: PeriodTotals[] }>({
    granularity: "month",
    periods: [],
  });
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quickAdd, setQuickAdd] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<DashboardTab>("balance");
  const tabsId = useId();

  // Botones que abren el alta rápida: para devolverles el foco al cerrar el modal
  const addIncomeRef = useRef<HTMLButtonElement>(null);
  const addExpenseRef = useRef<HTMLButtonElement>(null);

  // Se incrementa tras crear un movimiento, para volver a pedir los datos al backend
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.summary(month),
      api.history(pendingGranularity, DEFAULT_PERIODS[pendingGranularity], todayISO()),
      // Los más recientes de todo el histórico: no dependen del mes elegido
      api.expenses.list({ limit: RECENT_COUNT }),
      api.incomes.list({ limit: RECENT_COUNT }),
      api.categories(),
    ])
      .then(([sum, hist, expenses, incomes, cats]) => {
        if (cancelled) return;
        setSummary(sum);
        setHistory(hist);
        setRecentMovements(
          mergeRecent(
            expenses.map((e) => ({ ...e, view: "expenses" as const })),
            incomes.map((i) => ({ ...i, view: "incomes" as const })),
            RECENT_COUNT,
          ),
        );
        setCategories(cats);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) router.replace("/login");
        else setError("No se pudo conectar con el servidor. ¿Está el backend en marcha?");
      });
    return () => {
      cancelled = true;
    };
  }, [router, month, pendingGranularity, version]);

  function closeQuickAdd() {
    setQuickAdd(null);
    (quickAdd === "incomes" ? addIncomeRef : addExpenseRef).current?.focus();
  }

  const balance = Number(summary?.balance ?? 0);

  return (
    // pb-28: deja lugar para que la barra de pestañas fija abajo no tape el contenido
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 pt-6 pb-28">
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <TabList
        id={tabsId}
        label="Secciones del resumen"
        items={DASHBOARD_TABS}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id={tabsId} value="balance" activeValue={tab}>
        <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="text-center">
            <p className="text-sm text-zinc-500">Balance del mes</p>
            <p
              className={`text-4xl font-semibold tabular-nums ${
                balance < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {formatMoney(balance)}
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <dt className="text-sm text-zinc-500">Gastos</dt>
                <dd>
                  <Link
                    href={VIEWS.expenses.href}
                    title="Ver gastos"
                    className={`text-lg font-medium tabular-nums hover:underline ${VIEWS.expenses.amountClass}`}
                  >
                    {formatMoney(summary?.total ?? 0)}
                  </Link>
                </dd>
              </div>
              <button
                ref={addExpenseRef}
                onClick={() => setQuickAdd("expenses")}
                aria-label="Añadir gasto"
                title="Añadir gasto"
                className="mx-auto mt-2 flex size-6 items-center justify-center rounded-full border border-rose-300 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-950/40"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  −
                </span>
              </button>
            </div>
            <div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <dt className="text-sm text-zinc-500">Ingresos</dt>
                <dd>
                  <Link
                    href={VIEWS.incomes.href}
                    title="Ver ingresos"
                    className={`text-lg font-medium tabular-nums hover:underline ${VIEWS.incomes.amountClass}`}
                  >
                    {formatMoney(summary?.income_total ?? 0)}
                  </Link>
                </dd>
              </div>
              <button
                ref={addIncomeRef}
                onClick={() => setQuickAdd("incomes")}
                aria-label="Añadir ingreso"
                title="Añadir ingreso"
                className="mx-auto mt-2 flex size-6 items-center justify-center rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  +
                </span>
              </button>
            </div>
          </dl>
        </section>
      </TabPanel>

      <TabPanel id={tabsId} value="evolucion" activeValue={tab}>
        <EvolutionChart
          granularity={pendingGranularity}
          onGranularityChange={setPendingGranularity}
          chartGranularity={history.granularity}
          periods={history.periods}
          selectedMonth={month}
          onSelectMonth={setMonth}
        />
      </TabPanel>

      <TabPanel id={tabsId} value="movimientos" activeValue={tab}>
        <RecentMovements items={recentMovements} />
      </TabPanel>

      {quickAdd && (
        <TransactionModal
          view={quickAdd}
          categories={categories.filter((c) => c.kind === VIEWS[quickAdd].kind)}
          editing={null}
          onClose={closeQuickAdd}
          onSaved={() => setVersion((v) => v + 1)}
          onUnauthorized={() => router.replace("/login")}
        />
      )}
    </main>
  );
}
