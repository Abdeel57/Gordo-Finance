import * as XLSX from "xlsx";
import { db } from "./db";
import { fmtDate, fmtNowMX } from "./format";
import { inRange, type DateRange } from "./periods";

// Reporte con SheetJS: 6 hojas (Resumen, Ingresos, Gastos, Movimientos,
// Gastos por categoría, Balance por cuenta), montos con formato de moneda
// MXN y totales. Se genera 100% en el dispositivo, funciona sin conexión.

export interface ReportRow {
  date: string;
  type: "income" | "expense";
  description: string;
  category: string;
  account: string;
  amount: number; // centavos
  notes: string;
}

export interface CategoryTotal {
  name: string;
  total: number;
  pct: number; // fracción 0..1
}

export interface AccountSummary {
  name: string;
  initial: number;
  income: number; // del periodo
  expense: number; // del periodo
  current: number; // saldo actual histórico
}

export interface ReportData {
  label: string;
  range: DateRange;
  incomeTotal: number;
  expenseTotal: number;
  rows: ReportRow[];
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  accounts: AccountSummary[];
}

export async function buildReport(range: DateRange, label: string): Promise<ReportData> {
  const [accounts, categories, allTxs] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
  ]);
  const liveAccounts = accounts.filter((a) => a.deletedAt === null);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const liveTxs = allTxs.filter((t) => t.deletedAt === null);
  const periodTxs = liveTxs
    .filter((t) => inRange(t.transactionDate, range))
    .sort(
      (a, b) =>
        a.transactionDate.localeCompare(b.transactionDate) || a.createdAt - b.createdAt
    );

  const rows: ReportRow[] = periodTxs.map((t) => ({
    date: t.transactionDate,
    type: t.type,
    description: t.description,
    category: categoryName.get(t.categoryId) ?? "Sin categoría",
    account: accountName.get(t.accountId) ?? "Sin cuenta",
    amount: t.amount,
    notes: t.notes ?? "",
  }));

  const incomeTotal = rows
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);
  const expenseTotal = rows
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);

  const groupByCategory = (type: "income" | "expense"): CategoryTotal[] => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      if (r.type !== type) continue;
      totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
    }
    const grandTotal = type === "income" ? incomeTotal : expenseTotal;
    return [...totals.entries()]
      .map(([name, total]) => ({
        name,
        total,
        pct: grandTotal > 0 ? total / grandTotal : 0,
      }))
      .sort((a, b) => b.total - a.total);
  };

  const accountSummaries: AccountSummary[] = liveAccounts.map((a) => {
    let periodIncome = 0;
    let periodExpense = 0;
    let current = a.initialBalance;
    for (const t of liveTxs) {
      if (t.accountId !== a.id) continue;
      const inPeriod = inRange(t.transactionDate, range);
      if (t.type === "income") {
        current += t.amount;
        if (inPeriod) periodIncome += t.amount;
      } else {
        current -= t.amount;
        if (inPeriod) periodExpense += t.amount;
      }
    }
    return {
      name: a.name,
      initial: a.initialBalance,
      income: periodIncome,
      expense: periodExpense,
      current,
    };
  });

  return {
    label,
    range,
    incomeTotal,
    expenseTotal,
    rows,
    incomeByCategory: groupByCategory("income"),
    expenseByCategory: groupByCategory("expense"),
    accounts: accountSummaries,
  };
}

// ——— Construcción del archivo ———

const MONEY_FMT = '"$"#,##0.00';

const money = (cents: number) => ({ t: "n" as const, v: cents / 100, z: MONEY_FMT });
const pct = (fraction: number) => ({ t: "n" as const, v: fraction, z: "0.0%" });

type Row = unknown[];

function makeSheet(rows: Row[], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows as XLSX.CellObject[][]);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

function txListRows(rows: ReportRow[]): Row[] {
  const out: Row[] = [["Fecha", "Descripción", "Categoría", "Cuenta", "Monto"]];
  for (const r of rows) {
    out.push([fmtDate(r.date), r.description, r.category, r.account, money(r.amount)]);
  }
  out.push([]);
  out.push([
    "Total",
    "",
    "",
    "",
    money(rows.reduce((sum, r) => sum + r.amount, 0)),
  ]);
  return out;
}

function movementsSheetRows(report: ReportData): Row[] {
  const out: Row[] = [
    ["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Monto", "Notas"],
  ];
  for (const r of report.rows) {
    out.push([
      fmtDate(r.date),
      r.type === "income" ? "Ingreso" : "Gasto",
      r.description,
      r.category,
      r.account,
      money(r.type === "income" ? r.amount : -r.amount),
      r.notes,
    ]);
  }
  out.push([]);
  out.push([
    "Balance",
    "",
    "",
    "",
    "",
    money(report.incomeTotal - report.expenseTotal),
    "",
  ]);
  return out;
}

function accountsSheetRows(report: ReportData): Row[] {
  const out: Row[] = [
    ["Cuenta", "Saldo inicial", "Ingresos (periodo)", "Gastos (periodo)", "Saldo actual"],
  ];
  for (const a of report.accounts) {
    out.push([a.name, money(a.initial), money(a.income), money(a.expense), money(a.current)]);
  }
  out.push([]);
  out.push([
    "Total",
    money(report.accounts.reduce((s, a) => s + a.initial, 0)),
    money(report.accounts.reduce((s, a) => s + a.income, 0)),
    money(report.accounts.reduce((s, a) => s + a.expense, 0)),
    money(report.accounts.reduce((s, a) => s + a.current, 0)),
  ]);
  return out;
}

function fileName(report: ReportData, ext: string): string {
  const label = report.label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-");
  return `CuentaClara_${label}_${report.range.from}_a_${report.range.to}.${ext}`;
}

export function exportExcel(report: ReportData): void {
  const wb = XLSX.utils.book_new();

  const resumen: Row[] = [
    ["Cuenta Clara — Reporte financiero"],
    [],
    ["Periodo", report.label],
    ["Desde", fmtDate(report.range.from)],
    ["Hasta", fmtDate(report.range.to)],
    ["Generado", fmtNowMX()],
    ["Moneda", "MXN (pesos mexicanos)"],
    [],
    ["Total de ingresos", money(report.incomeTotal)],
    ["Total de gastos", money(report.expenseTotal)],
    ["Balance del periodo", money(report.incomeTotal - report.expenseTotal)],
    [],
    ["Movimientos en el periodo", report.rows.length],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(resumen, [28, 24]), "Resumen");

  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(txListRows(report.rows.filter((r) => r.type === "income")), [14, 32, 18, 16, 14]),
    "Ingresos"
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(txListRows(report.rows.filter((r) => r.type === "expense")), [14, 32, 18, 16, 14]),
    "Gastos"
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(movementsSheetRows(report), [14, 10, 32, 18, 16, 14, 28]),
    "Movimientos"
  );

  const gastosCat: Row[] = [["Categoría", "Total", "% del total"]];
  for (const c of report.expenseByCategory) {
    gastosCat.push([c.name, money(c.total), pct(c.pct)]);
  }
  gastosCat.push([]);
  gastosCat.push(["Total", money(report.expenseTotal), pct(report.expenseTotal > 0 ? 1 : 0)]);
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(gastosCat, [22, 16, 12]),
    "Gastos por categoría"
  );

  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(accountsSheetRows(report), [20, 16, 18, 18, 16]),
    "Balance por cuenta"
  );

  XLSX.writeFile(wb, fileName(report, "xlsx"));
}

export function exportCSV(report: ReportData): void {
  const ws = makeSheet(movementsSheetRows(report), []);
  const csv = "﻿" + XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(report, "csv");
  a.click();
  URL.revokeObjectURL(url);
}
