import { db } from "./db";
import { inRange, type DateRange } from "./periods";
import { buildMovementsCSV, buildWorkbook } from "./excel-workbook";
import type { AccountSummary, CategoryTotal, ReportData, ReportRow } from "./excel-workbook";

// Reporte Excel con ExcelJS: 6 hojas con la identidad Gordo Finance (logo,
// banners, cebra, totales, filtros y paneles congelados). Se genera 100% en
// el dispositivo, funciona sin conexión.

export type { AccountSummary, CategoryTotal, ReportData, ReportRow };

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

function fileName(report: ReportData, ext: string): string {
  const label = report.label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-");
  return `GordoFinance_${label}_${report.range.from}_a_${report.range.to}.${ext}`;
}

function anchorDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS se reporta como Mac, pero con pantalla táctil
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Entrega el archivo al usuario. En iOS (sobre todo con la app instalada)
 * la descarga clásica no funciona bien, así que se usa la hoja nativa de
 * compartir: permite guardar en Archivos, abrir en Excel o enviarlo.
 * En escritorio y Android se descarga directamente.
 */
async function deliver(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  if (isIOS() && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // canceló el usuario
      // si el share falla, intenta la descarga clásica
    }
  }
  anchorDownload(blob, name);
}

export async function exportExcel(report: ReportData): Promise<void> {
  // El logo va incrustado en la hoja Resumen; está precacheado por el
  // service worker, así que también funciona sin conexión.
  let logo: ArrayBuffer | undefined;
  try {
    const res = await fetch("/logo.png");
    if (res.ok) logo = await res.arrayBuffer();
  } catch {
    // sin logo: la hoja usa el wordmark en texto
  }
  const wb = await buildWorkbook(report, logo);
  const buffer = await wb.xlsx.writeBuffer();
  await deliver(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName(report, "xlsx")
  );
}

export async function exportCSV(report: ReportData): Promise<void> {
  const csv = "﻿" + buildMovementsCSV(report);
  await deliver(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName(report, "csv"));
}
