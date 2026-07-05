import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useAccounts, useCategories, useTransactions } from "../lib/queries";
import { fmtMXN } from "../lib/format";
import {
  fmtRangeLabel,
  inRange,
  rangeLastMonth,
  rangeThisMonth,
  rangeThisWeek,
  rangeThisYear,
  type DateRange,
} from "../lib/periods";
import type { CategoryTotal } from "../lib/excel";
import { Button, Card, cx } from "../components/ui";
import { PeriodSelector } from "../components/PeriodSelector";
import { CategoryBars } from "../components/charts";
import { useToast } from "../components/toast";

const PERIODS = [
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "lastMonth", label: "Mes anterior" },
  { key: "year", label: "Este año" },
  { key: "custom", label: "Personalizado" },
];

export default function Reports() {
  const toast = useToast();
  const txs = useTransactions();
  const categories = useCategories();
  const accounts = useAccounts();

  const [periodKey, setPeriodKey] = useState("month");
  const [customRange, setCustomRange] = useState<DateRange>(rangeThisMonth());
  const [exporting, setExporting] = useState(false);

  const range = useMemo<DateRange>(() => {
    if (periodKey === "week") return rangeThisWeek();
    if (periodKey === "month") return rangeThisMonth();
    if (periodKey === "lastMonth") return rangeLastMonth();
    if (periodKey === "year") return rangeThisYear();
    return customRange;
  }, [periodKey, customRange]);

  const label = PERIODS.find((p) => p.key === periodKey)?.label ?? "Personalizado";

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  );

  const data = useMemo(() => {
    const periodTxs = (txs ?? []).filter((t) => inRange(t.transactionDate, range));
    let incomeTotal = 0;
    let expenseTotal = 0;
    const incomeCat = new Map<string, number>();
    const expenseCat = new Map<string, number>();
    const perAccount = new Map<string, { income: number; expense: number }>();

    for (const t of periodTxs) {
      const catName = categoryById.get(t.categoryId)?.name ?? "Sin categoría";
      const acc = perAccount.get(t.accountId) ?? { income: 0, expense: 0 };
      if (t.type === "income") {
        incomeTotal += t.amount;
        incomeCat.set(catName, (incomeCat.get(catName) ?? 0) + t.amount);
        acc.income += t.amount;
      } else {
        expenseTotal += t.amount;
        expenseCat.set(catName, (expenseCat.get(catName) ?? 0) + t.amount);
        acc.expense += t.amount;
      }
      perAccount.set(t.accountId, acc);
    }

    const toTotals = (map: Map<string, number>, grand: number): CategoryTotal[] =>
      [...map.entries()]
        .map(([name, total]) => ({ name, total, pct: grand > 0 ? total / grand : 0 }))
        .sort((a, b) => b.total - a.total);

    // Saldo actual histórico por cuenta (no depende del periodo).
    const currentByAccount = new Map<string, number>();
    for (const a of accounts ?? []) currentByAccount.set(a.id, a.initialBalance);
    for (const t of txs ?? []) {
      const cur = currentByAccount.get(t.accountId);
      if (cur === undefined) continue;
      currentByAccount.set(t.accountId, cur + (t.type === "income" ? t.amount : -t.amount));
    }

    return {
      incomeTotal,
      expenseTotal,
      count: periodTxs.length,
      incomeByCategory: toTotals(incomeCat, incomeTotal),
      expenseByCategory: toTotals(expenseCat, expenseTotal),
      perAccount,
      currentByAccount,
    };
  }, [txs, range, categoryById, accounts]);

  const categoryIcons = useMemo(
    () => new Map((categories ?? []).map((c) => [c.name, c.icon])),
    [categories]
  );

  const balance = data.incomeTotal - data.expenseTotal;

  async function handleExport(kind: "xlsx" | "csv") {
    if (exporting) return;
    setExporting(true);
    try {
      // ExcelJS se carga bajo demanda para mantener ligera la app.
      const { buildReport, exportExcel, exportCSV } = await import("../lib/excel");
      const report = await buildReport(range, label);
      if (kind === "xlsx") await exportExcel(report);
      else await exportCSV(report);
      toast.show(kind === "xlsx" ? "Reporte Excel listo" : "CSV listo");
    } catch (error) {
      console.error(error);
      toast.show("No se pudo generar el reporte", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="rise-in pt-2">
        <h1 className="font-display text-[27px] font-bold text-ink">Reportes</h1>
        <p className="text-[13px] text-ink-soft">{fmtRangeLabel(range)}</p>
      </header>

      <div className="rise-in" style={{ animationDelay: "50ms" }}>
        <PeriodSelector
          options={PERIODS}
          activeKey={periodKey}
          onSelect={setPeriodKey}
          customRange={customRange}
          onCustomChange={setCustomRange}
        />
      </div>

      {/* Totales del periodo */}
      <div className="rise-in grid grid-cols-3 gap-2.5" style={{ animationDelay: "90ms" }}>
        <Card className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Ingresos
          </p>
          <p className="tnum mt-1 font-display text-[15px] font-bold text-income-text">
            {fmtMXN(data.incomeTotal)}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Gastos
          </p>
          <p className="tnum mt-1 font-display text-[15px] font-bold text-expense-text">
            {fmtMXN(data.expenseTotal)}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Balance
          </p>
          <p className="tnum mt-1 font-display text-[15px] font-bold text-ink">
            {balance < 0 ? "-" : ""}
            {fmtMXN(Math.abs(balance))}
          </p>
        </Card>
      </div>

      <div className="rise-in space-y-4" style={{ animationDelay: "130ms" }}>
        <Card>
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">
            Gastos por categoría
          </h2>
          <CategoryBars items={data.expenseByCategory} kind="expense" icons={categoryIcons} />
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">
            Ingresos por categoría
          </h2>
          <CategoryBars items={data.incomeByCategory} kind="income" icons={categoryIcons} />
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            Resumen por cuenta
          </h2>
          <div className="divide-y divide-line/70">
            {(accounts ?? []).map((a) => {
              const period = data.perAccount.get(a.id) ?? { income: 0, expense: 0 };
              const current = data.currentByAccount.get(a.id) ?? a.initialBalance;
              return (
                <div key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-xl" aria-hidden>
                    {a.icon ?? "💼"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{a.name}</p>
                    <p className="tnum truncate text-[12px] text-ink-soft">
                      +{fmtMXN(period.income)} · -{fmtMXN(period.expense)} en el periodo
                    </p>
                  </div>
                  <p
                    className={cx(
                      "tnum shrink-0 font-display text-[15px] font-bold",
                      current < 0 ? "text-expense-text" : "text-ink"
                    )}
                  >
                    {current < 0 ? "-" : ""}
                    {fmtMXN(Math.abs(current))}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="rise-in space-y-2.5 pb-2" style={{ animationDelay: "170ms" }}>
        <Button
          variant="income"
          size="lg"
          full
          disabled={exporting || data.count === 0}
          onClick={() => void handleExport("xlsx")}
        >
          <FileSpreadsheet size={20} />
          {exporting ? "Generando…" : "Descargar reporte Excel"}
        </Button>
        <Button
          variant="outline"
          full
          disabled={exporting || data.count === 0}
          onClick={() => void handleExport("csv")}
        >
          <FileDown size={17} />
          Exportar CSV
        </Button>
        {data.count === 0 && (
          <p className="text-center text-[12.5px] text-ink-faint">
            No hay movimientos en este periodo para exportar
          </p>
        )}
      </div>
    </div>
  );
}
