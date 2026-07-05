import ExcelJS from "exceljs";
import type {
  Border,
  Buffer as ExcelBuffer,
  Cell,
  CellValue,
  ConditionalFormattingRule,
  Fill,
  Workbook,
  Worksheet,
} from "exceljs";
import { fmtDate, fmtNowMX } from "./format";
import type { DateRange } from "./periods";

// Construcción del reporte Excel con la identidad Gordo Finance.
// Módulo puro (sin Dexie/DOM) para poder probarlo también en Node.

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

// ——— Identidad ———
const GREEN = "FF067647";
const GREEN_TEXT = "FF04613A";
const GREEN_TINT = "FFE4F3EA";
const RED = "FFC94326";
const RED_TEXT = "FFB93A21";
const RED_TINT = "FFFCEAE5";
const CARBON = "FF15201A";
const INK = "FF0D1512";
const INK_SOFT = "FF5A6B61";
const ZEBRA = "FFF4F7F5";
const BORDER = "FFD9E3DD";
const WHITE = "FFFFFFFF";

const MONEY = '"$"#,##0.00';
const MONEY_SIGNED = '"$"#,##0.00;[Red]-"$"#,##0.00';
const PCT = "0.0%";

const pesos = (cents: number) => cents / 100;

type WS = Worksheet;

function fill(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const thin = (argb: string): Partial<Border> => ({ style: "thin", color: { argb } });

function banner(ws: WS, cols: number, title: string, subtitle: string, argb: string) {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.fill = fill(argb);
  t.font = { size: 15, bold: true, color: { argb: WHITE } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, cols);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.fill = fill(argb);
  s.font = { size: 10, color: { argb: WHITE } };
  s.alignment = { vertical: "top", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 16;
}

function headerRow(ws: WS, rowIdx: number, labels: string[], argb: string) {
  const row = ws.getRow(rowIdx);
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    cell.fill = fill(argb);
    cell.font = { bold: true, size: 10.5, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: i === labels.length - 1 && label === "Monto" ? "right" : "left", indent: 1 };
    cell.border = { bottom: thin(BORDER) };
  });
  row.height = 22;
}

function dataCell(
  cell: Cell,
  value: CellValue,
  opts: { numFmt?: string; bold?: boolean; color?: string; align?: "left" | "right"; zebra?: boolean } = {}
) {
  cell.value = value;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  cell.font = { size: 10.5, bold: opts.bold ?? false, color: { argb: opts.color ?? INK } };
  cell.alignment = { vertical: "middle", horizontal: opts.align ?? "left", indent: opts.align === "right" ? 0 : 1, wrapText: false };
  if (opts.zebra) cell.fill = fill(ZEBRA);
  cell.border = { bottom: thin(BORDER) };
}

function totalRow(ws: WS, rowIdx: number, cells: Array<{ col: number; value: CellValue; numFmt?: string; color?: string }>, span: number, tint: string) {
  const row = ws.getRow(rowIdx);
  for (let c = 1; c <= span; c++) {
    const cell = row.getCell(c);
    cell.fill = fill(tint);
    cell.border = { top: { style: "double", color: { argb: CARBON } } };
  }
  for (const def of cells) {
    const cell = row.getCell(def.col);
    cell.value = def.value;
    if (def.numFmt) cell.numFmt = def.numFmt;
    cell.font = { bold: true, size: 11, color: { argb: def.color ?? INK } };
    cell.alignment = { vertical: "middle", horizontal: def.col === 1 ? "left" : "right", indent: def.col === 1 ? 1 : 0 };
  }
  row.height = 20;
}

function widths(ws: WS, list: number[]) {
  list.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

// ——— Hojas ———

function sheetResumen(wb: Workbook, r: ReportData, logoId: number | null) {
  const ws = wb.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: GREEN } },
  });
  widths(ws, [30, 18, 18, 18, 18]);

  // Encabezado blanco con logo + acento verde
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 26;
  ws.getRow(3).height = 10;
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { col: 0.15, row: 0.25 },
      ext: { width: 150, height: 55 },
      editAs: "absolute",
    });
  } else {
    const brand = ws.getCell("A1");
    brand.value = "GORDO FINANCE";
    brand.font = { size: 16, bold: true, color: { argb: GREEN } };
    brand.alignment = { vertical: "middle", indent: 1 };
  }
  const title = ws.getCell("C1");
  title.value = "Reporte financiero";
  title.font = { size: 15, bold: true, color: { argb: INK } };
  title.alignment = { vertical: "middle", horizontal: "right" };
  ws.mergeCells("C1:E1");
  const sub = ws.getCell("C2");
  sub.value = `${r.label} · ${fmtDate(r.range.from)} — ${fmtDate(r.range.to)}`;
  sub.font = { size: 10, color: { argb: INK_SOFT } };
  sub.alignment = { vertical: "top", horizontal: "right" };
  ws.mergeCells("C2:E2");
  // Línea de acento
  ws.mergeCells("A4:E4");
  ws.getCell("A4").fill = fill(GREEN);
  ws.getRow(4).height = 4;

  // Datos del reporte
  const info: Array<[string, string]> = [
    ["Periodo", r.label],
    ["Desde", fmtDate(r.range.from)],
    ["Hasta", fmtDate(r.range.to)],
    ["Generado", fmtNowMX()],
    ["Moneda", "MXN (pesos mexicanos)"],
    ["Movimientos en el periodo", String(r.rows.length)],
  ];
  let rowIdx = 6;
  for (const [label, value] of info) {
    const lc = ws.getCell(rowIdx, 1);
    lc.value = label;
    lc.font = { size: 10.5, bold: true, color: { argb: INK_SOFT } };
    lc.alignment = { indent: 1 };
    const vc = ws.getCell(rowIdx, 2);
    vc.value = value;
    vc.font = { size: 10.5, color: { argb: INK } };
    ws.mergeCells(rowIdx, 2, rowIdx, 4);
    rowIdx++;
  }

  // Totales grandes
  rowIdx += 1;
  const kpis: Array<[string, number, string, string]> = [
    ["Total de ingresos", pesos(r.incomeTotal), GREEN_TEXT, GREEN_TINT],
    ["Total de gastos", pesos(r.expenseTotal), RED_TEXT, RED_TINT],
    [
      "Balance del periodo",
      pesos(r.incomeTotal - r.expenseTotal),
      r.incomeTotal - r.expenseTotal >= 0 ? GREEN_TEXT : RED_TEXT,
      ZEBRA,
    ],
  ];
  for (const [label, value, color, tint] of kpis) {
    const row = ws.getRow(rowIdx);
    row.height = 24;
    for (let c = 1; c <= 5; c++) {
      row.getCell(c).fill = fill(tint);
      row.getCell(c).border = { bottom: thin(WHITE) };
    }
    const lc = row.getCell(1);
    lc.value = label;
    lc.font = { size: 12, bold: true, color: { argb: INK } };
    lc.alignment = { vertical: "middle", indent: 1 };
    const vc = row.getCell(5);
    vc.value = value;
    vc.numFmt = MONEY_SIGNED;
    vc.font = { size: 13, bold: true, color: { argb: color } };
    vc.alignment = { vertical: "middle", horizontal: "right" };
    rowIdx++;
  }

  // Balance por cuenta
  rowIdx += 2;
  const section = ws.getCell(rowIdx, 1);
  section.value = "Balance por cuenta";
  section.font = { size: 12, bold: true, color: { argb: GREEN } };
  section.alignment = { indent: 1 };
  rowIdx++;
  appendAccountsTable(ws, rowIdx, r);
}

function appendAccountsTable(ws: WS, startRow: number, r: ReportData) {
  headerRow(ws, startRow, ["Cuenta", "Saldo inicial", "Ingresos (periodo)", "Gastos (periodo)", "Saldo actual"], CARBON);
  // Alinear a la derecha los encabezados numéricos
  for (let c = 2; c <= 5; c++) {
    ws.getCell(startRow, c).alignment = { vertical: "middle", horizontal: "right" };
  }
  let rowIdx = startRow + 1;
  r.accounts.forEach((a, i) => {
    const zebra = i % 2 === 1;
    dataCell(ws.getCell(rowIdx, 1), a.name, { zebra });
    dataCell(ws.getCell(rowIdx, 2), pesos(a.initial), { numFmt: MONEY, align: "right", zebra });
    dataCell(ws.getCell(rowIdx, 3), pesos(a.income), { numFmt: MONEY, align: "right", zebra, color: GREEN_TEXT });
    dataCell(ws.getCell(rowIdx, 4), pesos(a.expense), { numFmt: MONEY, align: "right", zebra, color: RED_TEXT });
    dataCell(ws.getCell(rowIdx, 5), pesos(a.current), {
      numFmt: MONEY_SIGNED,
      align: "right",
      zebra,
      bold: true,
      color: a.current >= 0 ? INK : RED_TEXT,
    });
    rowIdx++;
  });
  const sum = (fn: (a: AccountSummary) => number) => pesos(r.accounts.reduce((s, a) => s + fn(a), 0));
  totalRow(
    ws,
    rowIdx,
    [
      { col: 1, value: "Total" },
      { col: 2, value: sum((a) => a.initial), numFmt: MONEY },
      { col: 3, value: sum((a) => a.income), numFmt: MONEY, color: GREEN_TEXT },
      { col: 4, value: sum((a) => a.expense), numFmt: MONEY, color: RED_TEXT },
      { col: 5, value: sum((a) => a.current), numFmt: MONEY_SIGNED },
    ],
    5,
    GREEN_TINT
  );
}

function sheetTxList(wb: Workbook, name: string, r: ReportData, kind: "income" | "expense") {
  const isIncome = kind === "income";
  const accent = isIncome ? GREEN : RED;
  const rows = r.rows.filter((x) => x.type === kind);
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { tabColor: { argb: accent } },
  });
  widths(ws, [14, 38, 20, 18, 15]);
  banner(
    ws,
    5,
    isIncome ? "Ingresos" : "Gastos",
    `${r.label} · ${fmtDate(r.range.from)} — ${fmtDate(r.range.to)} · Gordo Finance`,
    accent
  );
  headerRow(ws, 3, ["Fecha", "Descripción", "Categoría", "Cuenta", "Monto"], CARBON);
  ws.getCell(3, 5).alignment = { vertical: "middle", horizontal: "right" };
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 5 } };

  let rowIdx = 4;
  rows.forEach((x, i) => {
    const zebra = i % 2 === 1;
    dataCell(ws.getCell(rowIdx, 1), fmtDate(x.date), { zebra });
    dataCell(ws.getCell(rowIdx, 2), x.description, { zebra });
    dataCell(ws.getCell(rowIdx, 3), x.category, { zebra });
    dataCell(ws.getCell(rowIdx, 4), x.account, { zebra });
    dataCell(ws.getCell(rowIdx, 5), pesos(x.amount), {
      numFmt: MONEY,
      align: "right",
      zebra,
      color: isIncome ? GREEN_TEXT : RED_TEXT,
    });
    rowIdx++;
  });
  if (rows.length === 0) {
    dataCell(ws.getCell(rowIdx, 1), "Sin movimientos en este periodo", { color: INK_SOFT });
    ws.mergeCells(rowIdx, 1, rowIdx, 5);
    rowIdx++;
  }
  totalRow(
    ws,
    rowIdx,
    [
      { col: 1, value: "Total" },
      {
        col: 5,
        value: pesos(rows.reduce((s, x) => s + x.amount, 0)),
        numFmt: MONEY,
        color: isIncome ? GREEN_TEXT : RED_TEXT,
      },
    ],
    5,
    isIncome ? GREEN_TINT : RED_TINT
  );
}

function sheetMovimientos(wb: Workbook, r: ReportData) {
  const ws = wb.addWorksheet("Movimientos", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { tabColor: { argb: CARBON } },
  });
  widths(ws, [14, 11, 34, 18, 16, 15, 32]);
  banner(
    ws,
    7,
    "Todos los movimientos",
    `${r.label} · ${fmtDate(r.range.from)} — ${fmtDate(r.range.to)} · Gordo Finance`,
    CARBON
  );
  headerRow(ws, 3, ["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Monto", "Notas"], CARBON);
  ws.getCell(3, 6).alignment = { vertical: "middle", horizontal: "right" };
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 7 } };

  let rowIdx = 4;
  r.rows.forEach((x, i) => {
    const zebra = i % 2 === 1;
    const isIncome = x.type === "income";
    dataCell(ws.getCell(rowIdx, 1), fmtDate(x.date), { zebra });
    dataCell(ws.getCell(rowIdx, 2), isIncome ? "Ingreso" : "Gasto", {
      zebra,
      bold: true,
      color: isIncome ? GREEN_TEXT : RED_TEXT,
    });
    dataCell(ws.getCell(rowIdx, 3), x.description, { zebra });
    dataCell(ws.getCell(rowIdx, 4), x.category, { zebra });
    dataCell(ws.getCell(rowIdx, 5), x.account, { zebra });
    dataCell(ws.getCell(rowIdx, 6), pesos(isIncome ? x.amount : -x.amount), {
      numFmt: MONEY_SIGNED,
      align: "right",
      zebra,
      color: isIncome ? GREEN_TEXT : RED_TEXT,
    });
    dataCell(ws.getCell(rowIdx, 7), x.notes, { zebra, color: INK_SOFT });
    rowIdx++;
  });
  if (r.rows.length === 0) {
    dataCell(ws.getCell(rowIdx, 1), "Sin movimientos en este periodo", { color: INK_SOFT });
    ws.mergeCells(rowIdx, 1, rowIdx, 7);
    rowIdx++;
  }
  const balance = r.incomeTotal - r.expenseTotal;
  totalRow(
    ws,
    rowIdx,
    [
      { col: 1, value: "Balance del periodo" },
      {
        col: 6,
        value: pesos(balance),
        numFmt: MONEY_SIGNED,
        color: balance >= 0 ? GREEN_TEXT : RED_TEXT,
      },
    ],
    7,
    ZEBRA
  );
}

function sheetCategorias(wb: Workbook, r: ReportData) {
  const ws = wb.addWorksheet("Gastos por categoría", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: RED } },
  });
  widths(ws, [28, 16, 12]);
  banner(
    ws,
    3,
    "Gastos por categoría",
    `${r.label} · ${fmtDate(r.range.from)} — ${fmtDate(r.range.to)} · Gordo Finance`,
    RED
  );
  headerRow(ws, 3, ["Categoría", "Total", "% del total"], CARBON);
  ws.getCell(3, 2).alignment = { vertical: "middle", horizontal: "right" };
  ws.getCell(3, 3).alignment = { vertical: "middle", horizontal: "right" };

  let rowIdx = 4;
  r.expenseByCategory.forEach((c, i) => {
    const zebra = i % 2 === 1;
    dataCell(ws.getCell(rowIdx, 1), c.name, { zebra });
    dataCell(ws.getCell(rowIdx, 2), pesos(c.total), { numFmt: MONEY, align: "right", zebra });
    dataCell(ws.getCell(rowIdx, 3), c.pct, { numFmt: PCT, align: "right", zebra, color: INK_SOFT });
    rowIdx++;
  });
  if (r.expenseByCategory.length === 0) {
    dataCell(ws.getCell(rowIdx, 1), "Sin gastos en este periodo", { color: INK_SOFT });
    ws.mergeCells(rowIdx, 1, rowIdx, 3);
    rowIdx++;
  } else {
    // Barras de datos dentro de la columna Total (efecto gráfico en Excel)
    ws.addConditionalFormatting({
      ref: `B4:B${rowIdx - 1}`,
      rules: [
        {
          type: "dataBar",
          priority: 1,
          gradient: false,
          minLength: 0,
          maxLength: 100,
          showValue: true,
          border: false,
          negativeBarBorderColorSameAsPositive: true,
          cfvo: [{ type: "min" }, { type: "max" }],
          color: { argb: "FFF3B7A8" },
        },
      ] as unknown as ConditionalFormattingRule[],
    });
  }
  totalRow(
    ws,
    rowIdx,
    [
      { col: 1, value: "Total" },
      { col: 2, value: pesos(r.expenseTotal), numFmt: MONEY, color: RED_TEXT },
      { col: 3, value: r.expenseTotal > 0 ? 1 : 0, numFmt: PCT },
    ],
    3,
    RED_TINT
  );
}

function sheetCuentas(wb: Workbook, r: ReportData) {
  const ws = wb.addWorksheet("Balance por cuenta", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: GREEN } },
  });
  widths(ws, [26, 17, 18, 18, 17]);
  banner(
    ws,
    5,
    "Balance por cuenta",
    `Saldo actual = saldo inicial + ingresos − gastos (histórico) · Gordo Finance`,
    GREEN
  );
  appendAccountsTable(ws, 3, r);
}

export async function buildWorkbook(
  report: ReportData,
  logo?: ArrayBuffer
): Promise<Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gordo Finance";
  wb.created = new Date();

  let logoId: number | null = null;
  if (logo) {
    logoId = wb.addImage({ buffer: logo as unknown as ExcelBuffer, extension: "png" });
  }

  sheetResumen(wb, report, logoId);
  sheetTxList(wb, "Ingresos", report, "income");
  sheetTxList(wb, "Gastos", report, "expense");
  sheetMovimientos(wb, report);
  sheetCategorias(wb, report);
  sheetCuentas(wb, report);
  return wb;
}

// ——— CSV (movimientos) ———

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildMovementsCSV(report: ReportData): string {
  const lines = ["Fecha,Tipo,Descripción,Categoría,Cuenta,Monto,Notas"];
  for (const x of report.rows) {
    const signed = (x.type === "income" ? x.amount : -x.amount) / 100;
    lines.push(
      [
        x.date,
        x.type === "income" ? "Ingreso" : "Gasto",
        csvField(x.description),
        csvField(x.category),
        csvField(x.account),
        signed.toFixed(2),
        csvField(x.notes),
      ].join(",")
    );
  }
  lines.push(["Balance", "", "", "", "", ((report.incomeTotal - report.expenseTotal) / 100).toFixed(2), ""].join(","));
  return lines.join("\r\n");
}
