// `toISOString()` usa UTC: pasadas las 21:00 en UTC-3 ya devolvería el día siguiente.
// Estas funciones usan la fecha local del usuario.
const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha de hoy en formato YYYY-MM-DD (hora local) */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Mes actual en formato YYYY-MM (hora local) */
export const currentMonth = () => todayISO().slice(0, 7);

/** "YYYY-MM-DD" -> Date en hora local (evita que `new Date(string)` lo interprete en UTC). */
export const parseLocalDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
