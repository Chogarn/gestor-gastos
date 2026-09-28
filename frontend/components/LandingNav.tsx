"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const buttonBase = "rounded-md px-4 py-2 text-sm font-medium";

/** Barra superior de la página de inicio: adapta los botones según haya sesión o no. */
export default function LandingNav() {
  // undefined mientras se comprueba, para no mostrar botones equivocados por un instante
  const [loggedIn, setLoggedIn] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    api
      .me()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 p-6">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white"
        >
          $
        </span>
        Gestor de gastos
      </Link>

      <nav aria-label="Acceso" className="flex items-center gap-2 min-h-10">
        {loggedIn === true && (
          <Link
            href="/dashboard"
            className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            Ir a mi panel
          </Link>
        )}
        {loggedIn === false && (
          <>
            <Link
              href="/login"
              className={`${buttonBase} hover:bg-zinc-100 dark:hover:bg-zinc-900`}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              Crear cuenta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
