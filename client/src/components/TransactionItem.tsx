import { ArrowDownLeft, ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import type { Account, Category, Tx } from "../lib/types";
import { fmtDayLabel, fmtSigned } from "../lib/format";
import { SwipeRow } from "./SwipeRow";
import { cx } from "./ui";

interface Props {
  tx: Tx;
  category?: Category;
  account?: Account;
  showDate?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TransactionItem({ tx, category, account, showDate, onEdit, onDelete }: Props) {
  const isIncome = tx.type === "income";

  const row = (
    <div className="flex items-center gap-3 rounded-2xl border border-line/60 bg-card px-4 py-3.5">
      <div
        className={cx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg",
          isIncome ? "bg-income-tint" : "bg-expense-tint"
        )}
        aria-hidden
      >
        {category?.icon ??
          (isIncome ? (
            <ArrowDownLeft size={20} className="text-income-text" />
          ) : (
            <ArrowUpRight size={20} className="text-expense-text" />
          ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{tx.description}</p>
        <p className="truncate text-[12.5px] text-ink-soft">
          {category?.name ?? "Sin categoría"} · {account?.name ?? "Sin cuenta"}
          {showDate && ` · ${fmtDayLabel(tx.transactionDate)}`}
        </p>
      </div>
      <p
        className={cx(
          "tnum shrink-0 font-display text-[15px] font-bold",
          isIncome ? "text-income-text" : "text-expense-text"
        )}
      >
        {fmtSigned(tx.type, tx.amount)}
      </p>
      {onEdit && onDelete && (
        <div className="hidden shrink-0 gap-1 md:flex">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar movimiento"
            className="pressable flex h-9 w-9 items-center justify-center rounded-xl text-ink-faint hover:bg-surface hover:text-ink"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Eliminar movimiento"
            className="pressable flex h-9 w-9 items-center justify-center rounded-xl text-ink-faint hover:bg-expense-tint hover:text-expense-text"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );

  if (!onEdit || !onDelete) return row;
  return (
    <SwipeRow onEdit={onEdit} onDelete={onDelete}>
      {row}
    </SwipeRow>
  );
}
