"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Category, Granularity, PeriodTotals, Summary, Transaction, api, isUnauthorized } from "@/lib/api";
import { currentMonth, todayISO } from "@/lib/dates";
import { VIEWS, View } from "@/lib/views";
import BudgetsCard from "./BudgetsCard";
import CategoryDonutChart from "./CategoryDonutChart";
import CategoryManager from "./CategoryManager";
import EvolutionChart, { DEFAULT_PERIODS } from "./EvolutionChart";
import { ChartIcon, ListIcon, TagIcon, TargetIcon, TrendIcon } from "./icons";
import RecurringSection from "./RecurringSection";
import { TabList, TabPanel } from "./Tabs";
import TransactionList from "./TransactionList";
import TransactionModal from "./TransactionModal";

type SectionTab = "grafico" | "presupuestos" | "evolucion" | "movimientos" | "categorias";
// Mismas 5 pestañas en gastos e ingresos — "Presupuestos" existe en las dos, pero en
// ingresos solo aloja la sección Recurrentes (los presupuestos en sí son solo de gastos).
const SECTION_TABS = [
  { value: "grafico" as const, label: "Gráfico", icon: <ChartIcon /> },
  { value: "presupuestos" as const, label: "Presupuestos", icon: <TargetIcon /> },
  { value: "evolucion" as const, label: "Evolución", icon: <TrendIcon /> },
  { value: "movimientos" as const, label: "Movimientos", icon: <ListIcon /> },
  { value: "categorias" as const, label: "Categorías", icon: <TagIcon /> },
];

const controlClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const primaryButton =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700";

/**
 * Sección completa de gastos o de ingresos: un botón para agregar un movimiento (en una
 * ventana emergente) y el resto — gráfico por categoría, presupuestos (con Recurrentes
 * adentro), evolución, lista de movimientos y categorías — detrás de la barra de pestañas
 * de `Tabs.tsx`. Ambas secciones son el mismo componente con distinto `view`.
 */
export default function TransactionsSection({ view }: { view: View }) {
  const router = useRouter();
  const config = VIEWS[view];
  const resource = api[view];

  const [month, setMonth] = useState(currentMonth);
  const [categoryFilter, setCategoryFilter] = useState(0); // 0 = todas
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<SectionTab>("grafico");
  const tabsId = useId();
  // Mismo patrón que Dashboard.tsx: la granularidad elegida puede ir un instante por
  // delante de `history` mientras se pide de nuevo, para no mezclar formatos de periodo.
  const [pendingGranularity, setPendingGranularity] = useState<Granularity>("month");
  const [history, setHistory] = useState<{ granularity: Granularity; periods: PeriodTotals[] }>({
    granularity: "month",
    periods: [],
  });

  // Se incrementa tras cada cambio para volver a pedir los datos al backend
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  const goToLogin = () => router.replace("/login");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.categories(),
      resource.list({ month, categoryId: categoryFilter || undefined }),
      api.summary(month),
      api.history(pendingGranularity, DEFAULT_PERIODS[pendingGranularity], todayISO()),
    ])
      .then(([cats, list, sum, hist]) => {
        if (cancelled) return;
        setCategories(cats.filter((c) => c.kind === config.kind));
        setItems(list);
        setSummary(sum);
        setHistory(hist);
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
  }, [router, resource, config.kind, month, categoryFilter, pendingGranularity, version]);

  function closeTransactionModal() {
    setAddOpen(false);
    setEditing(null);
  }

  async function remove(item: Transaction) {
    if (!confirm(`¿Borrar "${item.description}"?`)) return;
    try {
      await resource.remove(item.id);
    } catch (err) {
      if (isUnauthorized(err)) goToLogin();
      else setError("No se pudo borrar");
      return;
    }
    if (editing?.id === item.id) setEditing(null);
    reload();
  }

  // Si la categoría borrada era la del filtro activo, se resetea a "Todas" para no
  // quedar filtrando por un id que ya no existe.
  function handleCategoryDeleted(categoryId: number) {
    if (categoryFilter === categoryId) setCategoryFilter(0);
  }

  const byCategory = view === "expenses" ? summary?.by_category : summary?.income_by_category;

  return (
    // pb-28: deja lugar para que la barra de pestañas fija abajo no tape el contenido
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 pt-6 pb-28">
      <header className="flex flex-wrap items-center justify-end gap-4">
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          aria-label="Mes"
          className={controlClass}
        />
      </header>

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
        label={`Secciones de ${config.listTitle.toLowerCase()}`}
        items={SECTION_TABS}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id={tabsId} value="grafico" activeValue={tab}>
        <CategoryDonutChart
          title={config.chartTitle}
          rows={byCategory ?? []}
          emptyText={config.emptyText}
          categories={categories}
        />
      </TabPanel>

      <TabPanel id={tabsId} value="presupuestos" activeValue={tab}>
        <div className="space-y-6">
          {view === "expenses" && (
            <BudgetsCard
              categories={categories}
              byCategory={byCategory ?? []}
              onChanged={reload}
              onUnauthorized={goToLogin}
            />
          )}
          <div>
            <h2 className="mb-4 font-medium">Recurrentes</h2>
            <RecurringSection view={view} onUnauthorized={goToLogin} />
          </div>
        </div>
      </TabPanel>

      <TabPanel id={tabsId} value="evolucion" activeValue={tab}>
        <EvolutionChart
          series={view === "expenses" ? "expense" : "income"}
          monthHint="Pulsa un mes para filtrar la lista."
          granularity={pendingGranularity}
          onGranularityChange={setPendingGranularity}
          chartGranularity={history.granularity}
          periods={history.periods}
          selectedMonth={month}
          onSelectMonth={setMonth}
        />
      </TabPanel>

      <TabPanel id={tabsId} value="movimientos" activeValue={tab}>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => setAddOpen(true)} className={primaryButton}>
            + {config.newTitle}
          </button>
        </div>
        <TransactionList
          emptyText={config.emptyText}
          items={items}
          categories={categories}
          filter={categoryFilter}
          onFilterChange={setCategoryFilter}
          amountClass={config.amountClass}
          onEdit={setEditing}
          onDelete={remove}
        />
      </TabPanel>

      <TabPanel id={tabsId} value="categorias" activeValue={tab}>
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <CategoryManager
            kind={config.kind}
            categories={categories}
            onChange={reload}
            onDeleted={handleCategoryDeleted}
            onUnauthorized={goToLogin}
          />
        </section>
      </TabPanel>

      {(addOpen || editing) && (
        <TransactionModal
          view={view}
          categories={categories}
          editing={editing}
          onClose={closeTransactionModal}
          onSaved={reload}
          onUnauthorized={goToLogin}
        />
      )}
    </main>
  );
}
