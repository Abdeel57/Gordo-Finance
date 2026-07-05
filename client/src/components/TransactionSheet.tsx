import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Tx, TxType } from "../lib/types";
import { addTransaction, updateTransaction } from "../lib/repo";
import { fmtMXN, parseAmountToCents, todayYMD, addDays } from "../lib/format";
import { useAccounts, useCategories } from "../lib/queries";
import { Button, Field, Sheet, TextInput, cx } from "./ui";
import { useToast } from "./toast";

interface Props {
  open: boolean;
  type: TxType;
  /** Si se pasa un movimiento, la hoja funciona en modo edición. */
  initial?: Tx | null;
  onClose: () => void;
}

/**
 * Captura rápida: monto → descripción → categoría → cuenta → guardar.
 * El monto abre teclado numérico automáticamente. Tras guardar se puede
 * "Agregar otro" sin salir de la hoja.
 */
export function TransactionSheet({ open, type, initial, onClose }: Props) {
  const toast = useToast();
  const categories = useCategories(type);
  const accounts = useAccounts();

  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayYMD());
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAmount, setSavedAmount] = useState<number | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);

  // Reinicia el formulario cada vez que se abre la hoja.
  useEffect(() => {
    if (!open) return;
    setAmountStr(initial ? (initial.amount / 100).toString() : "");
    setDescription(initial?.description ?? "");
    setCategoryId(initial?.categoryId ?? "");
    setAccountId(initial?.accountId ?? "");
    setDate(initial?.transactionDate ?? todayYMD());
    setNotes(initial?.notes ?? "");
    setShowNotes(Boolean(initial?.notes));
    setSavedAmount(null);
    const t = setTimeout(() => amountRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [open, initial]);

  // En capturas nuevas preselecciona la primera cuenta cuando carguen.
  // (En edición la cuenta viene del movimiento y no debe tocarse.)
  useEffect(() => {
    if (open && !initial && !accountId && accounts && accounts.length > 0) {
      setAccountId(accounts[0]!.id);
    }
  }, [open, initial, accountId, accounts]);

  const cents = useMemo(() => parseAmountToCents(amountStr), [amountStr]);
  const valid = Boolean(cents && description.trim() && categoryId && accountId && date);

  function handleAmountChange(raw: string) {
    // Solo dígitos y un punto con hasta 2 decimales.
    const clean = raw.replace(/[^\d.]/g, "");
    const match = clean.match(/^\d*(\.\d{0,2})?/);
    setAmountStr(match ? match[0] : "");
  }

  async function handleSave() {
    if (!valid || !cents || saving) return;
    setSaving(true);
    try {
      const data = {
        type,
        amount: cents,
        description,
        categoryId,
        accountId,
        transactionDate: date,
        notes: notes.trim() ? notes.trim() : null,
      };
      if (initial) {
        await updateTransaction(initial.id, data);
        toast.show("Movimiento actualizado");
        onClose();
      } else {
        await addTransaction(data);
        setSavedAmount(cents);
      }
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleAddAnother() {
    setAmountStr("");
    setDescription("");
    setNotes("");
    setShowNotes(false);
    setDate(todayYMD());
    setSavedAmount(null);
    setTimeout(() => amountRef.current?.focus(), 50);
  }

  const isIncome = type === "income";
  const noun = isIncome ? "ingreso" : "gasto";
  const title = initial
    ? `Editar ${noun}`
    : isIncome
      ? "Agregar ingreso"
      : "Agregar gasto";

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {savedAmount !== null ? (
        <div className="flex flex-col items-center py-6 text-center">
          <div
            className={cx(
              "pop-check flex h-20 w-20 items-center justify-center rounded-full",
              isIncome ? "bg-income" : "bg-expense"
            )}
          >
            <Check size={40} strokeWidth={3} className="text-white" />
          </div>
          <h3 className="mt-4 font-display text-xl font-bold text-ink">
            ¡{isIncome ? "Ingreso" : "Gasto"} guardado!
          </h3>
          <p
            className={cx(
              "tnum mt-1 font-display text-3xl font-extrabold",
              isIncome ? "text-income-text" : "text-expense-text"
            )}
          >
            {fmtMXN(savedAmount)}
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">Tu balance ya está actualizado</p>
          <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
            <Button variant="outline" size="lg" onClick={handleAddAnother}>
              <Plus size={18} />
              Agregar otro
            </Button>
            <Button variant={type} size="lg" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Monto — lo primero y lo más grande */}
          <div className="rounded-3xl border border-line/60 bg-card py-5">
            <p className="text-center text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
              Monto en pesos
            </p>
            <div className="mt-1 flex items-center justify-center">
              <span
                className={cx(
                  "font-display text-3xl font-bold",
                  amountStr ? "text-ink" : "text-ink-faint/60"
                )}
              >
                $
              </span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                aria-label="Monto"
                className="tnum w-auto min-w-[70px] max-w-[240px] bg-transparent text-center font-display text-[46px] font-extrabold leading-none text-ink outline-none placeholder:text-ink-faint/50"
                style={{ width: `${Math.max(amountStr.length, 1) + 0.5}ch` }}
              />
            </div>
          </div>

          <Field label="Descripción corta">
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isIncome ? "Venta del día, pago de cliente…" : "Tacos, gasolina, súper…"}
              maxLength={80}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Categoría</p>
            <div className="flex flex-wrap gap-2">
              {(categories ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cx(
                    "pressable flex h-11 items-center gap-1.5 rounded-2xl border px-3.5 text-[13.5px] font-semibold",
                    c.id === categoryId
                      ? isIncome
                        ? "border-income bg-income-tint text-income-text"
                        : "border-expense bg-expense-tint text-expense-text"
                      : "border-line bg-card text-ink-soft"
                  )}
                >
                  {c.icon && <span aria-hidden>{c.icon}</span>}
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Cuenta</p>
            <div className="flex flex-wrap gap-2">
              {(accounts ?? []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={cx(
                    "pressable flex h-11 items-center gap-1.5 rounded-2xl border px-3.5 text-[13.5px] font-semibold",
                    a.id === accountId
                      ? "border-navy bg-navy text-white dark:border-ink-faint dark:bg-raised dark:text-ink"
                      : "border-line bg-card text-ink-soft"
                  )}
                >
                  {a.icon && <span aria-hidden>{a.icon}</span>}
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Fecha</p>
            <div className="flex gap-2">
              {[
                { label: "Hoy", value: todayYMD() },
                { label: "Ayer", value: addDays(todayYMD(), -1) },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setDate(d.value)}
                  className={cx(
                    "pressable h-11 rounded-2xl border px-4 text-[13.5px] font-semibold",
                    date === d.value
                      ? "border-navy bg-navy text-white dark:border-ink-faint dark:bg-raised dark:text-ink"
                      : "border-line bg-card text-ink-soft"
                  )}
                >
                  {d.label}
                </button>
              ))}
              <input
                type="date"
                value={date}
                max={todayYMD()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="Otra fecha"
                className="h-11 flex-1 rounded-2xl border border-line bg-card px-3 text-[16px] font-semibold text-ink-soft focus:border-ink-faint focus:outline-none"
              />
            </div>
          </div>

          {showNotes ? (
            <Field label="Nota (opcional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Detalle adicional…"
                className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-[16px] text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none"
              />
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-[13.5px] font-semibold text-ink-soft underline underline-offset-2"
            >
              + Agregar nota
            </button>
          )}

          <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-surface via-surface to-transparent px-5 pb-1 pt-3">
            <Button
              variant={type}
              size="lg"
              full
              disabled={!valid || saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : initial ? "Guardar cambios" : `Guardar ${noun}`}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
