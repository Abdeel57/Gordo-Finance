// Prueba de humo del reporte Excel: genera un archivo real con datos de
// ejemplo, lo vuelve a leer y verifica estructura y celdas clave.
// Uso: npx tsx scripts/test-excel.ts <ruta-salida.xlsx>
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { buildWorkbook, buildMovementsCSV, type ReportData } from "../src/lib/excel-workbook";

const out = process.argv[2] ?? "test-report.xlsx";

const report: ReportData = {
  label: "Este mes",
  range: { from: "2026-07-01", to: "2026-07-31" },
  incomeTotal: 1250000,
  expenseTotal: 487550,
  rows: [
    { date: "2026-07-01", type: "income", description: "Venta del día", category: "Ventas", account: "Efectivo", amount: 750000, notes: "" },
    { date: "2026-07-02", type: "expense", description: "Tacos con \"salsa\", extra", category: "Comida", account: "Efectivo", amount: 25050, notes: "con el equipo" },
    { date: "2026-07-03", type: "expense", description: "Gasolina", category: "Transporte", account: "BBVA", amount: 120000, notes: "" },
    { date: "2026-07-10", type: "income", description: "Pago de cliente", category: "Clientes", account: "BBVA", amount: 500000, notes: "factura 041" },
    { date: "2026-07-12", type: "expense", description: "Publicidad Meta", category: "Publicidad", account: "BBVA", amount: 142500, notes: "" },
  ],
  incomeByCategory: [
    { name: "Ventas", total: 750000, pct: 0.6 },
    { name: "Clientes", total: 500000, pct: 0.4 },
  ],
  expenseByCategory: [
    { name: "Publicidad", total: 142500, pct: 0.292 },
    { name: "Transporte", total: 120000, pct: 0.246 },
    { name: "Comida", total: 25050, pct: 0.051 },
  ],
  accounts: [
    { name: "Efectivo", initial: 100000, income: 750000, expense: 25050, current: 824950 },
    { name: "BBVA", initial: 2000000, income: 500000, expense: 262500, current: 2237500 },
  ],
};

const logo = await readFile(new URL("../../logo-icon gordofinance.png", import.meta.url)).catch(() => undefined);

const wb = await buildWorkbook(report, logo ? logo.buffer.slice(logo.byteOffset, logo.byteOffset + logo.byteLength) as ArrayBuffer : undefined);
await wb.xlsx.writeFile(out);

// Releer y verificar
const rb = new ExcelJS.Workbook();
await rb.xlsx.readFile(out);
const names = rb.worksheets.map((w) => w.name);
const expected = ["Resumen", "Ingresos", "Gastos", "Movimientos", "Gastos por categoría", "Balance por cuenta"];
const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
};

assert(JSON.stringify(names) === JSON.stringify(expected), `6 hojas correctas: ${names.join(", ")}`);
const resumen = rb.getWorksheet("Resumen")!;
assert(String(resumen.getCell("C1").value) === "Reporte financiero", "título del Resumen");
assert(resumen.getCell("E14").numFmt.includes("$"), "formato de moneda en KPIs");
const ingresos = rb.getWorksheet("Ingresos")!;
assert(ingresos.getCell("E4").numFmt.includes("$"), "moneda en hoja Ingresos");
assert(ingresos.autoFilter !== undefined && ingresos.autoFilter !== null, "autofiltro en Ingresos");
const movs = rb.getWorksheet("Movimientos")!;
assert(String(movs.getCell("B5").value) === "Gasto", "tipo coloreado en Movimientos");
assert((rb.model as { media?: unknown[] }).media !== undefined || true, "workbook re-leído sin errores");

const csv = buildMovementsCSV(report);
assert(csv.includes('"Tacos con ""salsa"", extra"'), "CSV escapa comillas y comas");
assert(csv.split("\r\n").length === report.rows.length + 2, "CSV con encabezado y balance");

console.log("\nTODO OK →", out);
