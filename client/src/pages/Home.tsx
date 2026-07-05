import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Inbox, Minus, Plus } from "lucide-react";
import { useBalances, useTransactions, useAccounts, useCategories } from "../lib/queries";
import { fmtMXN } from "../lib/format";
import {
  inRange,
  rangeThisMonth,
  rangeThisWeek,
  rangeToday,
  type DateRange,
} from "../lib/periods";
import type { Tx, TxType } from "../lib/types";
import { deleteTransaction } from "../lib/repo";
import { Button, Card, ConfirmDialog, EmptyState } from "../components/ui";
import { PeriodSelector } from "../components/PeriodSelector";
import { TransactionItem } from "../components/TransactionItem";
import { TransactionSheet } from "../components/TransactionSheet";
import { IncomeExpenseBars } from "../components/charts";
import { useToast } from "../components/toast";

const PERIODS = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "custom", label: "Personalizado" },
];

export default function Home() {
  const toast = useToast();
  const balances = useBalances();
  const txs = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();

  const [periodKey, setPeriodKey] = useState("month");
  const [customRange, setCustomRange] = useState<DateRange>(rangeThisMonth());
  const [addType, setAddType] = useState<TxType | null>(null);
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [deleteTx, setDeleteTx] = useState<Tx | null>(null);

  const range = useMemo<DateRange>(() => {
    if (periodKey === "today") return rangeToday();
    if (periodKey === "week") return rangeThisWeek();
    if (periodKey === "month") return rangeThisMonth();
    return customRange;
  }, [periodKey, customRange]);

  const { income, expense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txs ?? []) {
      if (!inRange(t.transactionDate, range)) continue;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense };
  }, [txs, range]);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  );
  const accountById = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a])),
    [accounts]
  );
  const recent = (txs ?? []).slice(0, 8);

  async function confirmDelete() {
    if (!deleteTx) return;
    await deleteTransaction(deleteTx.id);
    setDeleteTx(null);
    toast.show("Movimiento eliminado");
  }

  return (
    <div className="space-y-5">
      <header className="rise-in pt-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-faint">
          Cuenta Clara
        </p>
        <h1 className="font-display text-[27px] font-bold text-ink">Tu dinero hoy</h1>
      </header>

      {/* Balance disponible */}
      <section
        className="rise-in relative overflow-hidden rounded-[28px] bg-navy p-6 text-white shadow-[0_18px_44px_-18px_rgba(9,15,35,0.55)]"
        style={{ animationDelay: "60ms" }}
      >
        <div
          aria-hidden
          className="absolute -right-14 -top-20 h-52 w-52 rounded-full bg-[#10b981] opacity-25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-14 h-44 w-44 rounded-full bg-[#e4572e] opacity-15 blur-3xl"
        />
        <p className="relative text-[13px] font-medium text-white/60">
          Lo que deberías tener en tus cuentas
        </p>
        <p className="tnum relative mt-1.5 font-display text-[42px] font-extrabold leading-none">
          {balances ? fmtMXN(balances.total) : "—"}
        </p>
        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/60">
              <ArrowDownLeft size={13} className="text-[#3ecf9a]" />
              Ingresos
            </p>
            <p className="tnum mt-1 font-display text-[17px] font-bold">{fmtMXN(income)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/60">
              <ArrowUpRight size={13} className="text-[#fb8a5c]" />
              Gastos
            </p>
            <p className="tnum mt-1 font-display text-[17px] font-bold">{fmtMXN(expense)}</p>
          </div>
        </div>
      </section>

      <div className="rise-in" style={{ animationDelay: "110ms" }}>
        <PeriodSelector
          options={PERIODS}
          activeKey={periodKey}
          onSelect={setPeriodKey}
          customRange={customRange}
          onCustomChange={setCustomRange}
        />
      </div>

      {/* Acciones principales de toda la app */}
      <div className="rise-in grid grid-cols-2 gap-3" style={{ animationDelay: "150ms" }}>
        <Button variant="income" size="lg" onClick={() => setAddType("income")}>
          <Plus size={20} strokeWidth={2.5} />
          Agregar ingreso
        </Button>
        <Button variant="expense" size="lg" onClick={() => setAddType("expense")}>
          <Minus size={20} strokeWidth={2.5} />
          Agregar gasto
        </Button>
      </div>

      <div className="rise-in" style={{ animationDelay: "190ms" }}>
        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">Ingresos vs gastos</h2>
            <span className="text-[12px] font-medium text-ink-faint">
              {PERIODS.find((p) => p.key === periodKey)?.label}
            </span>
          </div>
          <IncomeExpenseBars income={income} expense={expense} />
        </Card>
      </div>

      <section className="rise-in" style={{ animationDelay: "220ms" }}>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="font-display text-[15px] font-bold text-ink">Últimos movimientos</h2>
          <Link
            to="/movimientos"
            className="text-[13px] font-semibold text-ink-soft underline-offset-2 hover:underline"
          >
            Ver todos
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<Inbox size={24} />}
            title="Aún no hay movimientos"
            hint="Registra tu primer ingreso o gasto con los botones de arriba. Toma menos de 5 segundos."
          />
        ) : (
          <div className="space-y-2">
            {recent.map((t) => (
              <TransactionItem
                key={t.id}
                tx={t}
                category={categoryById.get(t.categoryId)}
                account={accountById.get(t.accountId)}
                showDate
                onEdit={() => setEditTx(t)}
                onDelete={() => setDeleteTx(t)}
              />
            ))}
          </div>
        )}
      </section>

      <TransactionSheet
        open={addType !== null}
        type={addType ?? "expense"}
        onClose={() => setAddType(null)}
      />
      <TransactionSheet
        open={editTx !== null}
        type={editTx?.type ?? "expense"}
        initial={editTx}
        onClose={() => setEditTx(null)}
      />
      <ConfirmDialog
        open={deleteTx !== null}
        title="¿Eliminar movimiento?"
        message={
          deleteTx
            ? `"${deleteTx.description}" por ${fmtMXN(deleteTx.amount)}. Esta acción no se puede deshacer.`
            : ""
        }
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTx(null)}
      />
    </div>
  );
}
