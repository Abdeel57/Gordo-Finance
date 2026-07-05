import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { useAccounts, useCategories, useTransactions } from "../lib/queries";
import { deleteTransaction } from "../lib/repo";
import { fmtDayLabel, fmtMXN } from "../lib/format";
import {
  inRange,
  rangeThisMonth,
  rangeThisWeek,
  rangeToday,
  type DateRange,
} from "../lib/periods";
import type { Tx } from "../lib/types";
import { ConfirmDialog, EmptyState, Segmented, TextInput } from "../components/ui";
import { PeriodSelector } from "../components/PeriodSelector";
import { TransactionItem } from "../components/TransactionItem";
import { TransactionSheet } from "../components/TransactionSheet";
import { useToast } from "../components/toast";

type TypeFilter = "all" | "income" | "expense";

const PERIODS = [
  { key: "all", label: "Todo" },
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "custom", label: "Personalizado" },
];

export default function Movements() {
  const toast = useToast();
  const txs = useTransactions();
  const categories = useCategories();
  const accounts = useAccounts();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState("");
  const [periodKey, setPeriodKey] = useState("all");
  const [customRange, setCustomRange] = useState<DateRange>(rangeThisMonth());
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [deleteTx, setDeleteTx] = useState<Tx | null>(null);

  const range = useMemo<DateRange | null>(() => {
    if (periodKey === "today") return rangeToday();
    if (periodKey === "week") return rangeThisWeek();
    if (periodKey === "month") return rangeThisMonth();
    if (periodKey === "custom") return customRange;
    return null;
  }, [periodKey, customRange]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return (txs ?? []).filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (range && !inRange(t.transactionDate, range)) return false;
      if (search && !t.description.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [txs, typeFilter, categoryId, range, q]);

  // Agrupa por día conservando el orden (ya vienen del más reciente al más antiguo).
  const grouped = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const t of filtered) {
      const list = map.get(t.transactionDate);
      if (list) list.push(t);
      else map.set(t.transactionDate, [t]);
    }
    return [...map.entries()];
  }, [filtered]);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  );
  const accountById = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a])),
    [accounts]
  );

  const categoryOptions = useMemo(
    () =>
      (categories ?? []).filter((c) => typeFilter === "all" || c.type === typeFilter),
    [categories, typeFilter]
  );

  const hasFilters = q.trim() !== "" || typeFilter !== "all" || categoryId !== "" || periodKey !== "all";

  async function confirmDelete() {
    if (!deleteTx) return;
    await deleteTransaction(deleteTx.id);
    setDeleteTx(null);
    toast.show("Movimiento eliminado");
  }

  return (
    <div className="space-y-4">
      <header className="rise-in flex items-baseline justify-between pt-2">
        <h1 className="font-display text-[27px] font-bold text-ink">Movimientos</h1>
        <span className="tnum text-[13px] font-medium text-ink-faint">
          {filtered.length}
        </span>
      </header>

      <div className="rise-in space-y-3" style={{ animationDelay: "60ms" }}>
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por descripción"
            className="pl-11"
            type="search"
          />
        </div>

        <Segmented<TypeFilter>
          options={[
            { value: "all", label: "Todos" },
            { value: "income", label: "Ingresos" },
            { value: "expense", label: "Gastos" },
          ]}
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            setCategoryId("");
          }}
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filtrar por categoría"
          className="h-11 w-full rounded-2xl border border-line bg-card px-3.5 text-[16px] font-medium text-ink focus:border-ink-faint focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </option>
          ))}
        </select>

        <PeriodSelector
          options={PERIODS}
          activeKey={periodKey}
          onSelect={setPeriodKey}
          customRange={customRange}
          onCustomChange={setCustomRange}
        />
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<SearchX size={24} />}
          title={hasFilters ? "Nada por aquí" : "Aún no hay movimientos"}
          hint={
            hasFilters
              ? "Prueba con otros filtros o limpia la búsqueda."
              : "Registra tu primer ingreso o gasto desde Inicio."
          }
        />
      ) : (
        <div className="rise-in space-y-1" style={{ animationDelay: "110ms" }}>
          {grouped.map(([date, items]) => {
            const net = items.reduce(
              (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
              0
            );
            return (
              <div key={date}>
                <div className="flex items-baseline justify-between px-1 pb-1.5 pt-3">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                    {fmtDayLabel(date)}
                  </span>
                  <span className="tnum text-[12px] font-medium text-ink-faint">
                    {net >= 0 ? "+" : "-"}
                    {fmtMXN(Math.abs(net))}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <TransactionItem
                      key={t.id}
                      tx={t}
                      category={categoryById.get(t.categoryId)}
                      account={accountById.get(t.accountId)}
                      onEdit={() => setEditTx(t)}
                      onDelete={() => setDeleteTx(t)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <p className="px-1 pt-3 text-center text-[11.5px] text-ink-faint">
            Desliza a la derecha para editar · a la izquierda para eliminar
          </p>
        </div>
      )}

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
