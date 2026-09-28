import { Transaction } from "./api";
import { parseLocalDate } from "./dates";

/** Encabezado de día para listas agrupadas, ej. "Domingo, 27 de septiembre". */
export function formatDayHeader(iso: string): string {
  const formatted = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseLocalDate(iso));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Agrupa una lista ya ordenada (más reciente primero) en bloques de días consecutivos,
 * sin reordenar nada. */
export function groupByDay<T extends Pick<Transaction, "date">>(
  items: T[],
): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}
