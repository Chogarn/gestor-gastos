// Las peticiones van al propio frontend y Next las reenvía al backend (ver next.config.ts)
const API_BASE = "/api";

export type Kind = "expense" | "income";

export type User = {
  id: number;
  email: string;
  /** Nombre para mostrar (opcional) */
  name: string | null;
  /** Código ISO 4217 (3 letras) elegido en el perfil */
  currency: string;
  /** ISO 8601 */
  created_at: string | null;
};

export type Profile = User & {
  stats: { expenses: number; incomes: number; categories: number };
};

export type Category = {
  id: number;
  name: string;
  kind: Kind;
  /** Tope mensual (solo categorías de gasto); `null` = sin presupuesto puesto */
  budget: string | null;
};

// Los gastos y los ingresos tienen exactamente los mismos campos
export type Transaction = {
  id: number;
  amount: string;
  description: string;
  date: string;
  category_id: number;
  category: string;
};

export type TransactionInput = Omit<Transaction, "id" | "category">;

export type Expense = Transaction;
export type Income = Transaction;

/** Plantilla de gasto o ingreso que se repite todos los meses (ver `/recurring`). */
export type RecurringTransaction = {
  id: number;
  kind: Kind;
  amount: string;
  description: string;
  category_id: number;
  category: string;
  /** 1 a 31; en meses más cortos se ajusta al último día */
  day_of_month: number;
  active: boolean;
};

export type RecurringInput = Omit<RecurringTransaction, "id" | "category">;

export type CategoryTotal = { category_id: number; category: string; total: string };

export type Summary = {
  month: string;
  /** Total de gastos del mes */
  total: string;
  income_total: string;
  balance: string;
  by_category: CategoryTotal[];
  income_by_category: CategoryTotal[];
};

export type Granularity = "day" | "week" | "month" | "year";

export type PeriodTotals = {
  /** Clave del periodo: YYYY-MM-DD (día/semana), YYYY-MM (mes) o YYYY (año) */
  period: string;
  income_total: string;
  expense_total: string;
  balance: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Sesión caducada o inexistente (los componentes protegidos redirigen a /login) */
export const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fields: Record<string, string> = body.errors ?? {};
    throw new ApiError(
      Object.values(fields).join(". ") || "Error inesperado",
      res.status,
      fields,
    );
  }
  return body as T;
}

/** Endpoints CRUD de gastos (`/expenses`) o de ingresos (`/incomes`): tienen el mismo contrato. */
function transactionsApi(path: "/expenses" | "/incomes") {
  return {
    /** Más recientes primero. Sin filtros devuelve todo el histórico; `limit` acota el número. */
    list: (opts: { month?: string; categoryId?: number; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (opts.month) params.set("month", opts.month);
      if (opts.categoryId) params.set("category_id", String(opts.categoryId));
      if (opts.limit) params.set("limit", String(opts.limit));
      const query = params.toString();
      return request<Transaction[]>(query ? `${path}?${query}` : path);
    },
    create: (data: TransactionInput) =>
      request<Transaction>(path, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: TransactionInput) =>
      request<Transaction>(`${path}/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    remove: (id: number) => request<void>(`${path}/${id}`, { method: "DELETE" }),
  };
}

export const api = {
  me: () => request<User>("/auth/me"),
  register: (email: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  profile: () => request<Profile>("/profile"),
  updateProfile: (name: string, currency: string) =>
    request<Profile>("/profile", { method: "PATCH", body: JSON.stringify({ name, currency }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/profile/password", {
      method: "PUT",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  categories: () => request<Category[]>("/categories"),
  createCategory: (name: string, kind: Kind) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify({ name, kind }),
    }),
  deleteCategory: (id: number) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),
  updateCategoryBudget: (id: number, budget: string | null) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify({ budget }) }),

  expenses: transactionsApi("/expenses"),
  incomes: transactionsApi("/incomes"),

  recurring: {
    list: (kind: Kind) => request<RecurringTransaction[]>(`/recurring?kind=${kind}`),
    create: (data: RecurringInput) =>
      request<RecurringTransaction>("/recurring", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: RecurringInput) =>
      request<RecurringTransaction>(`/recurring/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    remove: (id: number) => request<void>(`/recurring/${id}`, { method: "DELETE" }),
  },

  summary: (month: string) => request<Summary>(`/summary?month=${month}`),
  /** `periods` periodos de la granularidad indicada, terminando en `end` (YYYY-MM-DD) */
  history: (granularity: Granularity, periods: number, end: string) =>
    request<{ granularity: Granularity; periods: PeriodTotals[] }>(
      `/summary/history?granularity=${granularity}&periods=${periods}&end=${end}`,
    ),
};

/** La moneda real sale de `user.currency` (ver `useFormatMoney` en `lib/user-context.tsx`);
 * "USD" acá es solo un valor de respaldo antes de tener el usuario cargado. */
export const formatMoney = (value: string | number, currency: string = "USD") =>
  new Intl.NumberFormat("es", { style: "currency", currency }).format(Number(value));
