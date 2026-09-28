/**
 * Monedas disponibles para elegir en el perfil: solo cambian el símbolo/formato con el que
 * se muestran los montos, no convierten valores ya cargados.
 *
 * Lista curada (no las ~180 de ISO 4217, se puede ampliar). Debe coincidir con `CURRENCIES`
 * en `backend/app/schemas.py`.
 */
export const CURRENCIES = [
  { code: "USD", label: "Dólar estadounidense" },
  { code: "EUR", label: "Euro" },
  { code: "ARS", label: "Peso argentino" },
  { code: "UYU", label: "Peso uruguayo" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "CLP", label: "Peso chileno" },
  { code: "COP", label: "Peso colombiano" },
  { code: "PEN", label: "Sol peruano" },
  { code: "BRL", label: "Real brasileño" },
  { code: "GBP", label: "Libra esterlina" },
] as const;
