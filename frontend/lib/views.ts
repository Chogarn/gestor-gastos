import type { Kind } from "./api";

/** Los dos tipos de movimiento: se corresponden con `api.expenses` y `api.incomes`. */
export type View = "expenses" | "incomes";

// Textos y valores que cambian según se trate de gastos o de ingresos
export const VIEWS: Record<
  View,
  {
    kind: Kind;
    /** Ruta de la sección */
    href: string;
    noun: string;
    newTitle: string;
    editTitle: string;
    listTitle: string;
    emptyText: string;
    categoriesTitle: string;
    chartTitle: string;
    /** Color de las barras de los gráficos */
    barClass: string;
    /** Color del importe en las listas */
    amountClass: string;
  }
> = {
  expenses: {
    kind: "expense",
    href: "/expenses",
    noun: "gasto",
    newTitle: "Nuevo gasto",
    editTitle: "Editar gasto",
    listTitle: "Gastos",
    emptyText: "No hay gastos en este periodo.",
    categoriesTitle: "Categorías de gastos",
    chartTitle: "Gastos por categoría",
    barClass: "bg-rose-500",
    amountClass: "text-rose-600",
  },
  incomes: {
    kind: "income",
    href: "/incomes",
    noun: "ingreso",
    newTitle: "Nuevo ingreso",
    editTitle: "Editar ingreso",
    listTitle: "Ingresos",
    emptyText: "No hay ingresos en este periodo.",
    categoriesTitle: "Categorías de ingresos",
    chartTitle: "Ingresos por categoría",
    barClass: "bg-emerald-500",
    amountClass: "text-emerald-600",
  },
};

export const VIEW_KEYS = Object.keys(VIEWS) as View[];
