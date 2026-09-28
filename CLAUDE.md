# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Gestor de gastos: a multi-user personal finance app. Next.js (App Router) frontend, Flask + SQLAlchemy backend, Postgres, orchestrated with Docker Compose. All user-facing text, code comments, and commit-adjacent writing in this repo are in Spanish — match that.

`backend/` = Flask API (`app/`, `migrations/`, `tests/`). `frontend/` = Next.js app (`app/`, `components/`, `lib/`).

## Commands

Run everything with Docker (`docker compose up --build` from the repo root; needs `.env`, see `.env.example` — `SECRET_KEY` is required or the backend refuses to start).

**Backend tests** (Postgres, in the container — this is the real test target):
```bash
docker compose run --rm --no-deps backend pytest
docker compose run --rm --no-deps backend pytest tests/test_history.py -k granularity
```
Backend tests also run standalone against SQLite (faster local loop, same test files):
```bash
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # once
SECRET_KEY=x .venv/Scripts/python -m pytest -q
```
`pytest.ini` sets `pythonpath = .`, so `python -m pytest` (not bare `pytest`) is what makes `from app import ...` resolve — see `tests/conftest.py`.

**Frontend** (`cd frontend`):
```bash
npm run lint       # eslint
npx tsc --noEmit    # typecheck — not wired to a package.json script
npm run build       # also regenerates .next/types; run this if tsc reports missing route modules
npm run dev
```

**Migrations** (from `backend/`, needs `FLASK_APP=wsgi.py` and `SECRET_KEY` set):
```bash
flask db revision -m "descripcion"   # empty revision — this repo hand-writes upgrade/downgrade (see below)
flask db upgrade
```

## Architecture

### Auth: signed-cookie sessions, not JWT

Login sets `session["user_id"]` and `session["pw"]` (a short hash of the password hash) via `start_session()` in `backend/app/auth.py`. Every protected blueprint registers `bp.before_request(require_login)`, which re-checks the user still exists **and** that `session["pw"]` still matches the current password hash — so changing your password invalidates every other session immediately, without a server-side session table. `require_login` stashes the user on `g.user`. Ownership checks go through `get_owned_or_404()`, which returns 404 (not 403) for another user's resource, so existence isn't leaked.

Rate limiting (Flask-Limiter, see `backend/app/routes/auth.py`) keys login attempts by **account** (`f"cuenta:{email}"`), not by IP: the Next.js rewrite proxy doesn't set `X-Forwarded-For`, so the backend only ever sees the proxy's own IP. Keep that in mind if you touch rate limiting — trusting `X-Forwarded-For` here would let anyone bypass the limit by spoofing the header.

### Same-origin API proxy

The browser only ever talks to the frontend origin. `frontend/next.config.ts` rewrites `/api/:path*` to `BACKEND_URL` (`http://backend:5000` inside Docker), so the session cookie is same-origin and the Flask backend is never exposed to the internet directly — only `frontend`'s port is published in `docker-compose.yml`. `BACKEND_URL` is a **build-time** arg (read in `next.config.ts`, which runs at `next build`), so changing it means rebuilding the frontend image, not just restarting the container.

### Data model and per-user isolation

`User`, `Category`, `Expense`, `Income`, `RecurringTransaction` in `backend/app/models.py`. Categories have a `kind` (`"expense"`/`"income"`) and are scoped per-user with a `(user_id, name, kind)` unique constraint — expense and income categories are independent lists, and two users can both have a category named "Otros". `Expense`/`Income` are otherwise structurally identical (see `frontend/lib/views.ts`'s `VIEWS` map, which drives shared UI copy/styling for both, and `TransactionsSection.tsx`, which is the one component behind both `/expenses` and `/incomes`).

`user_id` on `Category`/`Expense`/`Income` is nullable — not for new rows, but because early development happened before accounts existed. The **first user who registers claims all rows with `user_id IS NULL`** (see `register()` in `backend/app/routes/auth.py`). Every list/query filters by `current_user_id()`, so orphaned rows are invisible to anyone until claimed.

### Recurring expenses/incomes: no scheduler, generated lazily

`RecurringTransaction` (a single table with `kind`, like `Category`) is a template; `backend/app/recurring.py`'s `generate_for_template()`/`generate_due_recurring()` turn it into real `Expense`/`Income` rows (linked back via `recurring_id`), filling in every month between the last one generated and "today" — there is **no cron/Celery/APScheduler anywhere in this stack**, on purpose (see `docker-compose.yml`: just `db`/`backend`/`frontend`). Generation is triggered from `require_login()` in `backend/app/auth.py` (at most once per calendar day per session, cached in `session["recurring_checked"]`), so it happens lazily whenever someone opens any authenticated page — including catching up several missed months if the stack was down for a while — plus once synchronously right after creating/editing a template (`routes/recurring.py`), so a new one shows up immediately instead of waiting for the next day's check. Pausing (`active=False`) just stops future generation; reactivating backfills the whole gap in one go, same as if the app had been closed the whole time — there's no bookkeeping that distinguishes "paused" from "the server was off". `generate_for_template(template, today=...)` takes an optional override for exactly this reason: tests simulate elapsed time by passing a future `today` rather than manipulating the clock.

Deleting a template does **not** delete the `Expense`/`Income` rows it already generated — `routes/recurring.py`'s `delete_recurring()` explicitly sets `recurring_id` to `NULL` on them first. The FK also declares `ondelete="SET NULL"` as a Postgres-level backstop, but the route doesn't rely on it: SQLite (used in tests) ignores `ON DELETE` actions unless `PRAGMA foreign_keys=ON` is set per-connection, which this app doesn't do — so the explicit update is what actually makes tests (and SQLite deployments, if anyone ever runs one) behave the same as Postgres.

### Migrations are hand-edited, not pure autogenerate

`flask db migrate` doesn't reliably produce cross-database-safe migrations here (SQLite used in tests, Postgres in prod), so migrations in `backend/migrations/versions/` are generated empty (`flask db revision`) and hand-written using `batch_alter_table` with **explicit constraint names** throughout (needed for SQLite's ALTER TABLE emulation, and for `downgrade()` to be able to drop them by name). See `69951bd07b50_usuarios_y_datos_por_usuario.py` for the pattern, including backfilling a default value into existing rows mid-migration.

The `/api/summary/history` endpoint (`backend/app/routes/summary.py`) groups by day/week/month/year **in Python, not SQL** (`_totals_by_bucket`) — deliberately, because `SQLAlchemy`'s `extract('week', ...)` doesn't translate portably to SQLite (used in tests) the way it does to Postgres.

### Frontend structure

`app/(app)/` is a route group: `/dashboard`, `/expenses`, `/incomes`, `/profile` all share the `AppShell` layout (top nav + account menu), defined once in `app/(app)/layout.tsx`. `/`, `/login`, `/register` sit outside that group and render standalone. `AppShell` does the one client-side session check (`api.me()`) for every page under it and provides the current user via `lib/user-context.tsx`'s `useUser()`. There's no page-level `<h1>` on `/dashboard`, `/expenses` or `/incomes` — the top nav already highlights the current page, so a big repeated title would be redundant; each page's `<section>`/`<TabList>` content starts right below the nav.

`lib/api.ts` is the single fetch wrapper: it throws `ApiError` (with `.status`), and `isUnauthorized(err)` is the check every component uses to redirect to `/login` on a 401 rather than showing a generic error.

**Dark mode** is real (see `frontend/app/globals.css`'s `@custom-variant dark (&:where(.dark, .dark *))`) but class-based, not `prefers-color-scheme`-based — it only activates via a `dark` class on `<html>`. An inline blocking `<script>` in `app/layout.tsx`'s `<head>` sets that class before hydration (from `localStorage`, falling back to the system preference) so there's no flash. `components/ThemeToggle.tsx` reads/writes it through `useSyncExternalStore` rather than `useEffect` + `setState` — this repo's eslint config (`react-hooks/set-state-in-effect`) rejects the latter for syncing external/DOM state into React state.

**Category budgets**: `Category.budget` (nullable, expense-only — enforced in `routes/categories.py`, not at the DB level) is edited through its own `PUT /api/categories/<id>` (the only editable field on a category so far). There's no backend endpoint for "spent vs. budget" — `BudgetsCard.tsx` (part of the "Presupuestos" tab of `TransactionsSection.tsx`, expenses only) computes it client-side by joining `categories` (which carry `budget`) with the selected month's `summary.by_category` (which carries the spent total) by `category_id` — it reuses that page's own `categories`/`byCategory` state, so unlike the old standalone page it follows whatever month is selected there, not always the current month.

**Categories no longer have their own page** — `CategoryManager.tsx` (create/delete UI, deleting now guarded by `confirm()`) is the "Categorías" tab of `TransactionsSection.tsx`, fed by that page's own `categories`/`reload` state (same as before, just no longer wrapped in its own route). `/expenses/categories`/`/incomes/categories` and `CategoriesView.tsx` are gone.

**In-page tabs** (`components/Tabs.tsx`, `TabList`/`TabPanel`) cut down on scrolling on `/dashboard` (Balance vs. Evolución vs. Últimos movimientos — nothing is persistent, including the balance card itself; `DASHBOARD_TABS` in `Dashboard.tsx`, default tab `"balance"`) and `/expenses`/`/incomes` (Gráfico vs. Presupuestos vs. Evolución vs. Movimientos vs. Categorías — same 5 tabs in both views now, one shared `SECTION_TABS` array in `TransactionsSection.tsx` — behind the persistent header/month-picker/action buttons; Gráfico is the default tab there, same as Evolución is the default on `/dashboard`). The Evolución tab on `/expenses`/`/incomes` reuses `EvolutionChart.tsx` (the same component and the same `GET /api/summary/history` endpoint as the Resumen page) via a `series="expense"|"income"` prop that renders a single colored curve instead of both — clicking a point there sets that page's own `month` state (same one the header's month picker drives), filtering the Gráfico/Presupuestos/Movimientos tabs to that month, same UX as clicking a point does for the Resumen card on `/dashboard`. It's a real ARIA tablist (`role="tablist"`/`role="tab"`/`role="tabpanel"`, roving-tabindex arrow-key navigation), reusing the visual style of `EvolutionChart.tsx`'s Día/Semana/Mes/Año selector but not its `role="group"` filter semantics — don't confuse the two, they're unrelated state. `TabPanel` unmounts inactive content rather than hiding it, which is only safe because every component placed inside one (`EvolutionChart`, `RecentMovements`, `CategoryDonutChart`, `TransactionList`, `RecurringSection`, `BudgetsCard`, `CategoryManager`) is fully prop-controlled with no internal state or fetch-on-mount effect. Tab state is plain `useState` with no URL sync (switching pages/tabs resets to the default), and is intentionally kept out of each page's data-fetching `useEffect` dependency array so changing tabs never triggers a refetch.

**Presupuestos also nests Recurrentes**: the "Presupuestos" tab exists on both `/expenses` and `/incomes` (unlike budgets, which are expenses-only), because it's also where `RecurringSection.tsx` now lives — on `/expenses` the panel is `BudgetsCard` then a "Recurrentes" heading + `RecurringSection`; on `/incomes` (no budgets) it's just the "Recurrentes" heading + `RecurringSection`. There's no standalone `/recurring` route (removed earlier) and no dedicated Recurrentes tab anymore either.

**`TabList` renders as a fixed bottom bar**, not an inline pill row — `fixed inset-x-0 bottom-0` with `z-20` (below `Modal.tsx`'s `z-30`, so add/edit modals still layer on top of it), one icon (from `components/icons.tsx`, plain stroke SVGs, `aria-hidden`) over a text label per tab, applied at every screen size. It also needs `mb-0` explicitly: it's a non-last child of the `<main className="... space-y-6 ...">` that renders it, and Tailwind's `space-y-6` gives non-last children `margin-bottom`, not `margin-top` — combined with `position: fixed; bottom: 0` that invisible margin pushes the visible bar up off the true screen edge (found via `getBoundingClientRect()`/`getComputedStyle()` after a user report of the bar "not looking pinned down"; without `mb-0` there was a 24px gap between the bar and the real viewport bottom). `will-change-transform` is also set, to keep the bar on its own compositor layer during scroll on mobile browsers. Every page that renders a `TabList` must give its `<main>` bottom padding (`pb-28`) so the last bit of scrolled content doesn't end up hidden behind the bar — see the `pb-28` comment in `Dashboard.tsx`/`TransactionsSection.tsx`. `/expenses` and `/incomes` both have 5 tabs (the most of any page); labels still fit at 375px without overflow, but there's no overflow/scroll handling on the bar itself, so a 6th tab anywhere would need to check that at the narrowest phone width.

**The top nav (`AppShell.tsx`) is a 3-column grid**, not `flex justify-between` — `grid-cols-[1fr_auto_1fr]` (logo / nav / account, the two `1fr` columns keep the middle `auto` column mathematically centered regardless of how wide the logo or account controls are; `justify-between` doesn't guarantee that when the flanking children differ in width). On narrow screens it drops to `grid-cols-2` with the nav spanning both columns on its own row (`row-start-2`), still centered via `justify-center` on the nav itself.

**Recurring expenses/incomes have no standalone page** — there used to be a `/recurring` route (`RecurringView.tsx`) listing both kinds together; it's gone. `RecurringSection.tsx` (list of templates + pause/resume/edit/delete, same shape as before) is now the "Recurrentes" tab of `TransactionsSection.tsx`, one instance per view (`view="expenses"`/`view="incomes"`), so each only shows its own kind. The backend routes/endpoints (`routes/recurring.py`, `/api/recurring`) didn't change — this was a frontend-only move.

Any new `.tsx` work should check `frontend/node_modules/next/dist/docs/` first — this Next.js version's `AGENTS.md` (regenerated by `next dev`, don't hand-edit it) flags that APIs/conventions here may differ from training data.

### Manual verification workflow

There's no separate staging environment. Changes get smoke-tested by spinning up a **second, disposable** Docker Compose project (`docker compose -p gestortest ...`, different port mapping, its own throwaway Postgres volume) rather than touching the real running stack's data — see any prior session's use of an `override-test.yml` port override for the pattern. Always back up (`pg_dump`) before applying a migration to the real stack's volume.
