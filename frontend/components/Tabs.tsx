import { KeyboardEvent, ReactNode } from "react";

export type TabItem<T extends string> = { value: T; label: string; icon?: ReactNode };

type TabListProps<T extends string> = {
  id: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Describe el grupo de pestañas para lectores de pantalla (no se ve) */
  label: string;
};

/** Barra de pestañas fija abajo de la pantalla (`role="tablist"`, un ícono arriba y el
 * texto abajo por botón — mismo patrón que un tab bar nativo). Semántica ARIA de
 * pestañas de verdad (no un `role="group"` de filtro). Navegación con flechas
 * izquierda/derecha y Home/End (roving tabindex, activación automática al moverse con
 * el teclado). Fija en todos los tamaños de pantalla: el `<main>` que la usa necesita
 * relleno abajo para que el contenido no quede tapado (ver `Dashboard.tsx`/
 * `TransactionsSection.tsx`). `z-20`, por debajo del `z-30` de `Modal.tsx`, así los
 * modales de alta/edición siguen por encima.
 *
 * `mb-0` es necesario: este `<nav>` vive adentro de un `<main className="... space-y-6
 * ...">`, y como no es el último hijo, `space-y-6` le da `margin-bottom: 1.5rem` — con
 * `position: fixed; bottom: 0` ese margen invisible empuja la barra 24px por encima del
 * borde real de la pantalla (el "footer" deja de verse pegado abajo del todo, y se nota
 * sobre todo scrolleando). `mb-0` cancela ese margen. `will-change-transform` promueve la
 * barra a su propia capa de composición desde el inicio en vez de que el navegador la
 * recalcule durante el scroll, para que no se vea "atrasada" respecto del contenido en
 * navegadores mobile durante un scroll rápido. */
export function TabList<T extends string>({ id, items, value, onChange, label }: TabListProps<T>) {
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const next = items[nextIndex];
    onChange(next.value);
    document.getElementById(`${id}-tab-${next.value}`)?.focus();
  }

  return (
    <nav
      role="tablist"
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-20 mb-0 flex will-change-transform border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950"
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={`${id}-tab-${item.value}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${id}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              selected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {item.icon}
            <span className="truncate px-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

type TabPanelProps<T extends string> = {
  id: string;
  value: T;
  activeValue: T;
  children: ReactNode;
};

/** Contenido de una pestaña. Se desmonta cuando no está activa — es seguro porque los
 * componentes que van adentro (`EvolutionChart`, `RecentMovements`, `CategoryDonutChart`,
 * `TransactionList`) reciben todo por props, sin estado propio ni fetch al montarse. */
export function TabPanel<T extends string>({ id, value, activeValue, children }: TabPanelProps<T>) {
  if (value !== activeValue) return null;
  return (
    <div role="tabpanel" id={`${id}-panel-${value}`} aria-labelledby={`${id}-tab-${value}`} tabIndex={0}>
      {children}
    </div>
  );
}
