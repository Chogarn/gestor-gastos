"use client";

import { useSyncExternalStore } from "react";

const THEME_KEY = "theme";

// No hay ningún evento nativo para "cambió la clase de <html>": el único lugar que la
// cambia es `setDark` acá abajo, así que estos listeners alcanzan para mantener a
// useSyncExternalStore al día sin necesidad de un MutationObserver.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

// Durante el renderizado en el servidor no hay `document`; el script inline de
// app/layout.tsx ya deja la clase puesta antes de hidratar, así que React solo usa este
// valor un instante y enseguida pasa a `getSnapshot` (sin parpadeo ni descalce).
function getServerSnapshot() {
  return false;
}

function setDark(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  } catch {
    // Sin localStorage (privado, bloqueado): el cambio sigue funcionando esta sesión,
    // simplemente no se recuerda la próxima vez.
  }
  listeners.forEach((l) => l());
}

/** Botón sol/luna que alterna la clase `dark` en <html> y guarda la elección. */
export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex size-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
    >
      {dark ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
