"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, api, isUnauthorized } from "@/lib/api";
import { UserProvider } from "@/lib/user-context";
import { VIEWS } from "@/lib/views";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

const NAV = [
  { href: "/dashboard", label: "Resumen" },
  { href: VIEWS.expenses.href, label: "Gastos" },
  { href: VIEWS.incomes.href, label: "Ingresos" },
];

/**
 * Marco de las páginas con sesión: comprueba que hay sesión, dibuja la cabecera con la
 * navegación y el menú de la cuenta, y comparte el usuario con las páginas hijas.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // null mientras se comprueba la sesión
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (isUnauthorized(err)) router.replace("/login");
        else setError("No se pudo conectar con el servidor. ¿Está el backend en marcha?");
      });
  }, [router]);

  async function logout() {
    await api.logout();
    router.replace("/");
  }

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!user) return <p className="p-6 text-sm text-zinc-500">Cargando…</p>;

  return (
    <UserProvider value={{ user, setUser }}>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        {/* Grid de 3 columnas (logo / nav / cuenta) en vez de `justify-between`, para que
            la navegación quede centrada de verdad — con `justify-between` el hijo del
            medio no cae en el centro real si el logo y los controles de la derecha no
            miden lo mismo. Las columnas de los costados son `1fr` (iguales entre sí) y la
            del medio es `auto` (del ancho del contenido), así el medio siempre queda
            centrado sin importar cuánto midan logo/cuenta. En pantallas angostas la
            navegación baja a su propia fila, también centrada. */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-x-6 gap-y-2 px-6 py-3 sm:grid-cols-[1fr_auto_1fr]">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white"
            >
              $
            </span>
            Gestor de gastos
          </Link>

          <nav
            aria-label="Principal"
            className="col-span-2 row-start-2 flex justify-center gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1"
          >
            {NAV.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-1">
            <ThemeToggle />
            <UserMenu user={user} onLogout={logout} />
          </div>
        </div>
      </header>
      {children}
    </UserProvider>
  );
}
