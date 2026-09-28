import type { Metadata } from "next";
import Link from "next/link";
import LandingNav from "@/components/LandingNav";

export const metadata: Metadata = {
  title: "Gestor de gastos · Controla tus ingresos y gastos",
  description:
    "Registra tus ingresos y gastos, organízalos por categorías y mira cada mes cuánto te queda.",
};

const FEATURES = [
  {
    title: "Ingresos y gastos en un solo lugar",
    text: "Anota cada movimiento en segundos y edítalo o bórralo cuando quieras. Sin hojas de cálculo.",
  },
  {
    title: "Categorías a tu medida",
    text: "Empiezas con categorías listas (Comida, Transporte, Salario…) y creas las tuyas, por separado para gastos e ingresos.",
  },
  {
    title: "Balance y evolución mensual",
    text: "Mira cuánto entra, cuánto sale y cuánto te queda cada mes, y compara los últimos 6 o 12 meses de un vistazo.",
  },
  {
    title: "Tus datos son solo tuyos",
    text: "Cada cuenta ve únicamente su información. Las contraseñas se guardan cifradas con hash, nunca en texto plano.",
  },
];

const STEPS = [
  { title: "Crea tu cuenta", text: "Solo necesitas un email y una contraseña." },
  { title: "Registra tus movimientos", text: "Ingresos y gastos, con su categoría y su fecha." },
  { title: "Revisa tu balance", text: "El panel te muestra el resumen del mes y cómo evolucionas." },
];

const primaryLink =
  "rounded-md bg-emerald-600 px-6 py-3 text-base font-medium text-white hover:bg-emerald-700";
const secondaryLink =
  "rounded-md border border-zinc-300 px-6 py-3 text-base font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

/** Vista previa ilustrativa del panel (datos de ejemplo, no reales). */
function PreviewCard() {
  const months = [
    { label: "may", income: 55, expense: 38 },
    { label: "jun", income: 60, expense: 44 },
    { label: "jul", income: 58, expense: 62 },
    { label: "ago", income: 72, expense: 40 },
    { label: "sep", income: 80, expense: 46 },
  ];
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-md rounded-2xl border border-zinc-200 bg-background p-5 shadow-lg dark:border-zinc-800"
    >
      <p className="text-sm text-zinc-500">Balance del mes</p>
      <p className="mb-4 text-3xl font-semibold tabular-nums text-emerald-600">1250,00 US$</p>
      <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-zinc-500">Ingresos</p>
          <p className="font-medium tabular-nums">2400,00 US$</p>
        </div>
        <div>
          <p className="text-zinc-500">Gastos</p>
          <p className="font-medium tabular-nums">1150,00 US$</p>
        </div>
      </div>
      <ul className="flex h-28 items-end justify-between gap-3">
        {months.map((m) => (
          <li key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="flex h-full w-full items-end justify-center gap-1">
              <span className="w-3 rounded-t bg-emerald-500" style={{ height: `${m.income}%` }} />
              <span className="w-3 rounded-t bg-rose-500" style={{ height: `${m.expense}%` }} />
            </span>
            <span className="text-xs text-zinc-500">{m.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-xs text-zinc-400">Ejemplo ilustrativo</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingNav />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 pt-8 pb-16 md:grid-cols-2 md:pt-16">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Ten claro en qué se va <span className="text-emerald-600">tu dinero</span>
            </h1>
            <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400">
              Registra tus ingresos y gastos, organízalos por categorías y descubre cada mes cuánto te
              queda. Simple, rápido y privado.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={primaryLink}>
                Crear cuenta
              </Link>
              <Link href="/login" className={secondaryLink}>
                Iniciar sesión
              </Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <PreviewCard />
          </div>
        </section>

        <section aria-labelledby="funciones" className="border-y border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 id="funciones" className="text-2xl font-semibold">
              Todo lo que necesitas para llevar tus cuentas
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="como-funciona" className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 id="como-funciona" className="text-2xl font-semibold">
            Empieza en tres pasos
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-20">
          <div className="rounded-2xl bg-emerald-600 px-6 py-12 text-center text-white">
            <h2 className="text-2xl font-semibold">¿Listo para ordenar tus finanzas?</h2>
            <p className="mt-2 text-emerald-50">Crear tu cuenta lleva menos de un minuto.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="rounded-md bg-white px-6 py-3 text-base font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Crear cuenta
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-white/60 px-6 py-3 text-base font-medium hover:bg-emerald-700"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
        Gestor de gastos
      </footer>
    </div>
  );
}
