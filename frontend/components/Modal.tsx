"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Ancho máximo del diálogo (clase de Tailwind) */
  maxWidthClassName?: string;
};

/**
 * Diálogo genérico: superposición, cierre con Escape o clic fuera, foco en el primer
 * campo al abrir. Lo usan `TransactionModal` y `CategoryModal`.
 */
export default function Modal({ title, onClose, children, maxWidthClassName = "max-w-sm" }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${maxWidthClassName} rounded-xl border border-zinc-200 bg-background p-5 shadow-lg dark:border-zinc-800`}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={titleId} className="font-medium">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
