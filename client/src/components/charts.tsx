import { fmtMXN } from "../lib/format";
import type { CategoryTotal } from "../lib/excel";
import { cx } from "./ui";

// Gráficas mínimas de la app. Siguen las reglas del sistema de visualización:
// marcas delgadas con extremos redondeados, etiquetas directas en tinta (no en
// el color de la serie), pistas neutras y color solo como identidad de la marca.

/** Comparación simple ingresos vs gastos del periodo. */
export function IncomeExpenseBars({
  income,
  expense,
}: {
  income: number;
  expense: number;
}) {
  const max = Math.max(income, expense, 1);
  const rows = [
    { label: "Ingresos", value: income, mark: "bg-income" },
    { label: "Gastos", value: expense, mark: "bg-expense" },
  ];
  return (
    <div className="space-y-3.5" role="img" aria-label={`Ingresos ${fmtMXN(income)}, gastos ${fmtMXN(expense)}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-[72px] shrink-0 text-[12.5px] font-medium text-ink-soft">
            {r.label}
          </span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-[4px] bg-line/50">
            <div
              className={cx("absolute inset-y-0 left-0 rounded-[4px]", r.mark)}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="tnum w-[92px] shrink-0 text-right text-[13px] font-bold text-ink">
            {fmtMXN(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Desglose por categoría con barras horizontales y etiquetas directas. */
export function CategoryBars({
  items,
  kind,
  icons,
}: {
  items: CategoryTotal[];
  kind: "income" | "expense";
  icons?: Map<string, string | null>;
}) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-[13px] text-ink-faint">
        Sin movimientos en este periodo
      </p>
    );
  }
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-[13.5px] font-medium text-ink">
              {icons?.get(item.name) ? `${icons.get(item.name)} ` : ""}
              {item.name}
            </span>
            <span className="tnum shrink-0 text-[13px] font-bold text-ink">
              {fmtMXN(item.total)}
              <span className="ml-1.5 font-sans text-[11.5px] font-medium text-ink-faint">
                {(item.pct * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-[4px] bg-line/50">
            <div
              className={cx(
                "h-full rounded-[4px]",
                kind === "income" ? "bg-income" : "bg-expense"
              )}
              style={{ width: `${(item.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
