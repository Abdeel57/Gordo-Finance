import type { TxType } from "./types";

export const TZ = "America/Mexico_City";

const moneyFmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

/** Formatea centavos como pesos: 25000 → "$250.00" */
export function fmtMXN(cents: number): string {
  return moneyFmt.format(cents / 100);
}

/** "+$250.00" para ingresos, "-$250.00" para gastos */
export function fmtSigned(type: TxType, cents: number): string {
  return (type === "income" ? "+" : "-") + fmtMXN(cents);
}

/**
 * Convierte texto del usuario a centavos. Acepta "250", "250.5", "1,250.75",
 * "$300". Devuelve null si no es un monto válido mayor a cero.
 */
export function parseAmountToCents(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const cents = Math.round(parseFloat(clean) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > 999_999_999_999) return null;
  return cents;
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria de México */
export function todayYMD(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Convierte "AAAA-MM-DD" a Date local (mediodía, para evitar saltos de día) */
export function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function dateToYMD(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + days);
  return dateToYMD(d);
}

/** "Hoy", "Ayer" o "vie 3 jul" */
export function fmtDayLabel(ymd: string): string {
  const today = todayYMD();
  if (ymd === today) return "Hoy";
  if (ymd === addDays(today, -1)) return "Ayer";
  return ymdToDate(ymd).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "3 jul 2026" */
export function fmtDate(ymd: string): string {
  return ymdToDate(ymd).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Fecha y hora de generación de reportes, en horario de México */
export function fmtNowMX(): string {
  return new Date().toLocaleString("es-MX", {
    timeZone: TZ,
    dateStyle: "long",
    timeStyle: "short",
  });
}
