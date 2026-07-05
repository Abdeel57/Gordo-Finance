import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  CloudOff,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useAccounts,
  useBalances,
  useCategories,
  useLastSyncedAt,
  usePendingCount,
  useTransactions,
} from "../lib/queries";
import {
  addAccount,
  addCategory,
  deleteAccount,
  deleteCategory,
  updateAccount,
  updateCategory,
} from "../lib/repo";
import { getSyncState, subscribeSync, syncNow, type SyncState } from "../lib/sync";
import { applyTheme, getTheme, type Theme } from "../lib/theme";
import { fmtMXN, fmtSigned, fmtDayLabel, parseAmountToCents } from "../lib/format";
import type { Account, Category, TxType } from "../lib/types";
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  Segmented,
  Sheet,
  TextInput,
  cx,
} from "../components/ui";
import { useToast } from "../components/toast";

const ACCOUNT_EMOJIS = ["💵", "🏦", "💳", "📱", "🐷", "🏢", "👛", "🪙"];
const CATEGORY_EMOJIS = [
  "🍔", "🚗", "🏠", "💡", "🛒", "📺", "📣", "💳", "🏢", "📦",
  "💵", "🤝", "💼", "🔄", "🪙", "✨", "🎁", "⚕️", "🎓", "🎬",
];

export default function Settings() {
  const { user, logout } = useAuth();

  const [accountSheet, setAccountSheet] = useState<{ account: Account | null } | null>(null);
  const [categorySheet, setCategorySheet] = useState<{ category: Category | null; type: TxType } | null>(null);
  const [catTab, setCatTab] = useState<TxType>("expense");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme());

  const accounts = useAccounts();
  const balances = useBalances();
  const categories = useCategories(catTab);
  const pending = usePendingCount();

  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  async function handleLogout() {
    setConfirmLogout(false);
    await logout();
  }

  return (
    <div className="space-y-4">
      <header className="rise-in pt-2">
        <h1 className="font-display text-[27px] font-bold text-ink">Ajustes</h1>
        <p className="text-[13px] text-ink-soft">{user?.email}</p>
      </header>

      {/* Apariencia */}
      <Card className="rise-in">
        <h2 className="mb-3 font-display text-[15px] font-bold text-ink">Apariencia</h2>
        <Segmented<Theme>
          options={[
            { value: "system", label: "Sistema" },
            { value: "light", label: "Claro" },
            { value: "dark", label: "Oscuro" },
          ]}
          value={theme}
          onChange={changeTheme}
        />
      </Card>

      {/* Mis cuentas */}
      <Card className="rise-in">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">Mis cuentas</h2>
          <Button variant="ghost" size="sm" onClick={() => setAccountSheet({ account: null })}>
            <Plus size={16} />
            Agregar
          </Button>
        </div>
        <div className="divide-y divide-line/70">
          {(accounts ?? []).map((a) => {
            const current = balances?.byAccount.get(a.id)?.current ?? a.initialBalance;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountSheet({ account: a })}
                className="flex w-full items-center gap-3 py-3 text-left first:pt-1 last:pb-1"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-lg" aria-hidden>
                  {a.icon ?? "💼"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{a.name}</p>
                  <p className="tnum text-[12px] text-ink-soft">
                    Saldo inicial {fmtMXN(a.initialBalance)}
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
                <ChevronRight size={16} className="shrink-0 text-ink-faint" />
              </button>
            );
          })}
          {(accounts ?? []).length === 0 && (
            <p className="py-4 text-center text-[13px] text-ink-faint">
              Agrega tu primera cuenta (Efectivo, banco, tarjeta…)
            </p>
          )}
        </div>
      </Card>

      {/* Categorías */}
      <Card className="rise-in">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">Categorías</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCategorySheet({ category: null, type: catTab })}
          >
            <Plus size={16} />
            Nueva
          </Button>
        </div>
        <Segmented<TxType>
          options={[
            { value: "expense", label: "Gastos" },
            { value: "income", label: "Ingresos" },
          ]}
          value={catTab}
          onChange={setCatTab}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategorySheet({ category: c, type: c.type })}
              className="pressable flex h-10 items-center gap-1.5 rounded-2xl border border-line bg-card px-3 text-[13px] font-semibold text-ink-soft"
            >
              {c.icon && <span aria-hidden>{c.icon}</span>}
              {c.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Sincronización */}
      <SyncCard pending={pending ?? 0} />

      {/* Sesión */}
      <Card className="rise-in">
        <h2 className="mb-3 font-display text-[15px] font-bold text-ink">Sesión</h2>
        <Button variant="danger" full onClick={() => setConfirmLogout(true)}>
          <LogOut size={17} />
          Cerrar sesión
        </Button>
      </Card>

      <p className="pb-2 text-center text-[11.5px] text-ink-faint">
        Cuenta Clara · Hecho para registrar tu dinero en segundos
      </p>

      {accountSheet && (
        <AccountSheet account={accountSheet.account} onClose={() => setAccountSheet(null)} />
      )}
      {categorySheet && (
        <CategorySheet
          category={categorySheet.category}
          type={categorySheet.type}
          onClose={() => setCategorySheet(null)}
        />
      )}
      <ConfirmDialog
        open={confirmLogout}
        title="¿Cerrar sesión?"
        message={
          (pending ?? 0) > 0
            ? `Tienes ${pending} cambio(s) sin sincronizar que se perderán. Conéctate a internet y sincroniza antes de salir.`
            : "Tus datos están sincronizados. Podrás volver a entrar cuando quieras."
        }
        confirmLabel="Salir"
        onConfirm={() => void handleLogout()}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}

// ——— Sincronización ———

function SyncCard({ pending }: { pending: number }) {
  const toast = useToast();
  const lastSyncedAt = useLastSyncedAt();
  const [state, setState] = useState<SyncState>(getSyncState());

  useEffect(() => subscribeSync(setState), []);

  async function handleSync() {
    if (!navigator.onLine) {
      toast.show("Sin conexión: se sincronizará automáticamente", "error");
      return;
    }
    const ok = await syncNow();
    toast.show(ok ? "Todo sincronizado" : "No se pudo sincronizar", ok ? "success" : "error");
  }

  return (
    <Card className="rise-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[15px] font-bold text-ink">Sincronización</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {pending > 0
              ? `${pending} cambio(s) pendiente(s)`
              : lastSyncedAt
                ? `Al día · ${new Date(lastSyncedAt).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : "Aún no se ha sincronizado"}
          </p>
        </div>
        {navigator.onLine ? (
          <Button
            variant="outline"
            size="sm"
            disabled={state === "syncing"}
            onClick={() => void handleSync()}
          >
            <RefreshCw size={15} className={state === "syncing" ? "animate-spin" : ""} />
            {state === "syncing" ? "Sincronizando" : "Sincronizar"}
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint">
            <CloudOff size={15} />
            Sin conexión
          </span>
        )}
      </div>
    </Card>
  );
}

// ——— Editor de cuenta ———

function AccountSheet({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const toast = useToast();
  const txs = useTransactions();
  const categoriesAll = useCategories();
  const balances = useBalances();

  const [name, setName] = useState(account?.name ?? "");
  const [initialStr, setInitialStr] = useState(
    account ? (account.initialBalance / 100).toString() : ""
  );
  const [icon, setIcon] = useState(account?.icon ?? ACCOUNT_EMOJIS[0]!);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const recent = useMemo(
    () => (txs ?? []).filter((t) => t.accountId === account?.id).slice(0, 5),
    [txs, account]
  );
  const categoryById = useMemo(
    () => new Map((categoriesAll ?? []).map((c) => [c.id, c])),
    [categoriesAll]
  );

  const trimmedInitial = initialStr.trim();
  const initialCents =
    trimmedInitial === "" || parseFloat(trimmedInitial) === 0
      ? 0
      : parseAmountToCents(trimmedInitial);
  const valid = name.trim() !== "" && initialCents !== null;

  async function handleSave() {
    if (!valid || initialCents === null) return;
    try {
      if (account) {
        await updateAccount(account.id, { name, initialBalance: initialCents, icon });
        toast.show("Cuenta actualizada");
      } else {
        await addAccount({ name, initialBalance: initialCents, icon });
        toast.show("Cuenta agregada");
      }
      onClose();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "No se pudo guardar", "error");
    }
  }

  async function handleDelete() {
    if (!account) return;
    const result = await deleteAccount(account.id);
    setConfirmDelete(false);
    if (result.ok) {
      toast.show("Cuenta eliminada");
      onClose();
    } else {
      toast.show(result.error ?? "No se pudo eliminar", "error");
    }
  }

  const current = account
    ? (balances?.byAccount.get(account.id)?.current ?? account.initialBalance)
    : null;

  return (
    <Sheet open onClose={onClose} title={account ? "Editar cuenta" : "Nueva cuenta"}>
      <div className="space-y-4">
        {account && current !== null && (
          <div className="rounded-3xl border border-line/60 bg-card p-4 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
              Saldo actual
            </p>
            <p className="tnum mt-1 font-display text-3xl font-extrabold text-ink">
              {current < 0 ? "-" : ""}
              {fmtMXN(Math.abs(current))}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              Saldo inicial + ingresos - gastos
            </p>
          </div>
        )}

        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Efectivo, BBVA, Mercado Pago…"
            maxLength={40}
          />
        </Field>

        <Field label="Saldo inicial (pesos)">
          <TextInput
            value={initialStr}
            onChange={(e) => setInitialStr(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Icono</p>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={cx(
                  "pressable flex h-11 w-11 items-center justify-center rounded-2xl border text-lg",
                  e === icon ? "border-navy bg-navy/5 dark:border-ink-faint dark:bg-raised" : "border-line bg-card"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {account && recent.length > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">
              Últimos movimientos de esta cuenta
            </p>
            <div className="divide-y divide-line/70 rounded-2xl border border-line/60 bg-card px-4">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-2.5">
                  <span className="text-base" aria-hidden>
                    {categoryById.get(t.categoryId)?.icon ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{t.description}</p>
                    <p className="text-[11.5px] text-ink-faint">{fmtDayLabel(t.transactionDate)}</p>
                  </div>
                  <span
                    className={cx(
                      "tnum text-[13px] font-bold",
                      t.type === "income" ? "text-income-text" : "text-expense-text"
                    )}
                  >
                    {fmtSigned(t.type, t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          <Button variant="primary" size="lg" full disabled={!valid} onClick={() => void handleSave()}>
            {account ? "Guardar cambios" : "Agregar cuenta"}
          </Button>
          {account && (
            <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
              Eliminar cuenta
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar cuenta?"
        message={`Se eliminará "${account?.name}". Solo es posible si no tiene movimientos.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  );
}

// ——— Editor de categoría ———

function CategorySheet({
  category,
  type,
  onClose,
}: {
  category: Category | null;
  type: TxType;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_EMOJIS[0]!);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    try {
      if (category) {
        await updateCategory(category.id, { name, icon });
        toast.show("Categoría actualizada");
      } else {
        await addCategory({ name, type, icon });
        toast.show("Categoría agregada");
      }
      onClose();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "No se pudo guardar", "error");
    }
  }

  async function handleDelete() {
    if (!category) return;
    const result = await deleteCategory(category.id);
    setConfirmDelete(false);
    if (result.ok) {
      toast.show("Categoría eliminada");
      onClose();
    } else {
      toast.show(result.error ?? "No se pudo eliminar", "error");
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        category
          ? "Editar categoría"
          : type === "income"
            ? "Nueva categoría de ingreso"
            : "Nueva categoría de gasto"
      }
    >
      <div className="space-y-4">
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "income" ? "Ventas, propinas…" : "Comida, gasolina…"}
            maxLength={30}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Icono</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={cx(
                  "pressable flex h-11 w-11 items-center justify-center rounded-2xl border text-lg",
                  e === icon ? "border-navy bg-navy/5 dark:border-ink-faint dark:bg-raised" : "border-line bg-card"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2.5 pt-1">
          <Button
            variant="primary"
            size="lg"
            full
            disabled={!name.trim()}
            onClick={() => void handleSave()}
          >
            {category ? "Guardar cambios" : "Agregar categoría"}
          </Button>
          {category && (
            <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
              Eliminar categoría
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar categoría?"
        message={`Se eliminará "${category?.name}". Solo es posible si no tiene movimientos.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  );
}
