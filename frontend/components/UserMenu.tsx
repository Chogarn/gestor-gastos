"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { User } from "@/lib/api";

type Props = { user: User; onLogout: () => void };

const itemClass =
  "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900";

/** Avatar con la inicial que abre un menú: perfil y cerrar sesión. */
export default function UserMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const displayName = user.name || user.email;

  useEffect(() => {
    if (!open) return;
    const items = () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();

    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = items();
        const index = list.indexOf(document.activeElement as HTMLElement);
        const step = e.key === "ArrowDown" ? 1 : -1;
        list[(index + step + list.length) % list.length]?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${displayName}`}
        className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pr-3 pl-1 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate text-sm sm:block">{displayName}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Cuenta"
          className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-zinc-200 bg-background p-1 shadow-lg dark:border-zinc-800"
        >
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {user.name && <p className="truncate text-xs text-zinc-500">{user.email}</p>}
          </div>
          <div className="pt-1">
            <Link
              role="menuitem"
              href="/profile"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              Mi perfil
            </Link>
            <button role="menuitem" onClick={onLogout} className={itemClass}>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
