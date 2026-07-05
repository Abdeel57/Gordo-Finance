import { addDays, dateToYMD, fmtDate, todayYMD, ymdToDate } from "./format";

export interface DateRange {
  from: string;
  to: string;
}

export function rangeToday(): DateRange {
  const t = todayYMD();
  return { from: t, to: t };
}

/** Semana actual, de lunes a domingo */
export function rangeThisWeek(): DateRange {
  const t = todayYMD();
  const dow = (ymdToDate(t).getDay() + 6) % 7; // 0 = lunes
  const from = addDays(t, -dow);
  return { from, to: addDays(from, 6) };
}

export function rangeThisMonth(): DateRange {
  const t = todayYMD();
  const d = ymdToDate(t);
  const from = `${t.slice(0, 7)}-01`;
  const to = dateToYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { from, to };
}

export function rangeLastMonth(): DateRange {
  const d = ymdToDate(todayYMD());
  const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const last = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: dateToYMD(first), to: dateToYMD(last) };
}

export function rangeThisYear(): DateRange {
  const year = todayYMD().slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function inRange(ymd: string, range: DateRange): boolean {
  return ymd >= range.from && ymd <= range.to;
}

export function fmtRangeLabel(range: DateRange): string {
  if (range.from === range.to) return fmtDate(range.from);
  return `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
}
