import type { DateRange } from "../lib/periods";
import { cx } from "./ui";

export interface PeriodOption {
  key: string;
  label: string;
}

/**
 * Chips de periodo. Cuando se elige "Personalizado" aparecen dos campos
 * de fecha para definir el rango.
 */
export function PeriodSelector({
  options,
  activeKey,
  onSelect,
  customRange,
  onCustomChange,
}: {
  options: PeriodOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  customRange: DateRange;
  onCustomChange: (range: DateRange) => void;
}) {
  return (
    <div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSelect(opt.key)}
            className={cx(
              "pressable h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold",
              opt.key === activeKey
                ? "border-navy bg-navy text-white dark:border-raised dark:bg-raised dark:text-ink"
                : "border-line bg-card text-ink-soft"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {activeKey === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Desde</span>
            <input
              type="date"
              value={customRange.from}
              max={customRange.to}
              onChange={(e) =>
                e.target.value && onCustomChange({ ...customRange, from: e.target.value })
              }
              className="h-11 w-full rounded-xl border border-line bg-card px-3 text-[16px] text-ink focus:border-ink-faint focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Hasta</span>
            <input
              type="date"
              value={customRange.to}
              min={customRange.from}
              onChange={(e) =>
                e.target.value && onCustomChange({ ...customRange, to: e.target.value })
              }
              className="h-11 w-full rounded-xl border border-line bg-card px-3 text-[16px] text-ink focus:border-ink-faint focus:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
