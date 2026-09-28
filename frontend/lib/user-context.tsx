"use client";

import { createContext, useContext } from "react";
import { formatMoney, type User } from "./api";

type UserContextValue = { user: User; setUser: (user: User) => void };

const UserContext = createContext<UserContextValue | null>(null);

export const UserProvider = UserContext.Provider;

/** Usuario de la sesión actual. Solo disponible dentro de las páginas con sesión (AppShell). */
export function useUser() {
  const value = useContext(UserContext);
  if (!value) throw new Error("useUser debe usarse dentro de <AppShell>");
  return value;
}

/**
 * `formatMoney` ya atado a la moneda elegida en el perfil del usuario actual. Al consumir el
 * contexto, los componentes que la usan se vuelven a renderizar solos cuando la moneda cambia.
 */
export function useFormatMoney() {
  const { user } = useUser();
  return (value: string | number) => formatMoney(value, user.currency);
}
