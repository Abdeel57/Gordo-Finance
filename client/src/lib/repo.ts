import { db } from "./db";
import { scheduleSync } from "./sync";
import type { Account, Category, Tx, TxType } from "./types";

// Mutaciones locales. Cada cambio se guarda al instante en IndexedDB,
// se marca como pendiente en el outbox y se agenda una sincronización.

const now = () => Date.now();
export const uid = () => crypto.randomUUID();

async function markDirty(
  entity: "account" | "category" | "transaction",
  entityId: string
): Promise<void> {
  await db.outbox.put({ key: `${entity}:${entityId}`, entity, entityId, queuedAt: now() });
}

// ——— Movimientos ———

export interface TxInput {
  type: TxType;
  amount: number;
  description: string;
  categoryId: string;
  accountId: string;
  transactionDate: string;
  notes: string | null;
}

function assertValidTx(input: TxInput): void {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("El monto debe ser mayor a cero");
  }
  if (!input.description.trim()) throw new Error("La descripción es obligatoria");
  if (!input.categoryId) throw new Error("Elige una categoría");
  if (!input.accountId) throw new Error("Elige una cuenta");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) throw new Error("Fecha inválida");
}

export async function addTransaction(input: TxInput): Promise<Tx> {
  assertValidTx(input);
  const t = now();
  const tx: Tx = {
    ...input,
    description: input.description.trim(),
    id: uid(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  };
  await db.transactions.put(tx);
  await markDirty("transaction", tx.id);
  scheduleSync();
  return tx;
}

export async function updateTransaction(id: string, input: TxInput): Promise<void> {
  assertValidTx(input);
  await db.transactions.update(id, {
    ...input,
    description: input.description.trim(),
    updatedAt: now(),
  });
  await markDirty("transaction", id);
  scheduleSync();
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.update(id, { deletedAt: now(), updatedAt: now() });
  await markDirty("transaction", id);
  scheduleSync();
}

// ——— Cuentas ———

export async function addAccount(input: {
  name: string;
  initialBalance: number;
  icon: string | null;
}): Promise<Account> {
  const t = now();
  const account: Account = {
    id: uid(),
    name: input.name.trim(),
    initialBalance: input.initialBalance,
    icon: input.icon,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  };
  if (!account.name) throw new Error("El nombre es obligatorio");
  await db.accounts.put(account);
  await markDirty("account", account.id);
  scheduleSync();
  return account;
}

export async function updateAccount(
  id: string,
  input: { name: string; initialBalance: number; icon: string | null }
): Promise<void> {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  await db.accounts.update(id, { ...input, name: input.name.trim(), updatedAt: now() });
  await markDirty("account", id);
  scheduleSync();
}

export async function deleteAccount(id: string): Promise<{ ok: boolean; error?: string }> {
  const inUse = await db.transactions
    .where("accountId")
    .equals(id)
    .filter((t) => t.deletedAt === null)
    .count();
  if (inUse > 0) {
    return { ok: false, error: `No se puede eliminar: tiene ${inUse} movimiento(s)` };
  }
  await db.accounts.update(id, { deletedAt: now(), updatedAt: now() });
  await markDirty("account", id);
  scheduleSync();
  return { ok: true };
}

// ——— Categorías ———

export async function addCategory(input: {
  name: string;
  type: TxType;
  icon: string | null;
}): Promise<Category> {
  const t = now();
  const category: Category = {
    id: uid(),
    name: input.name.trim(),
    type: input.type,
    icon: input.icon,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  };
  if (!category.name) throw new Error("El nombre es obligatorio");
  await db.categories.put(category);
  await markDirty("category", category.id);
  scheduleSync();
  return category;
}

export async function updateCategory(
  id: string,
  input: { name: string; icon: string | null }
): Promise<void> {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  await db.categories.update(id, { ...input, name: input.name.trim(), updatedAt: now() });
  await markDirty("category", id);
  scheduleSync();
}

export async function deleteCategory(id: string): Promise<{ ok: boolean; error?: string }> {
  const inUse = await db.transactions
    .where("categoryId")
    .equals(id)
    .filter((t) => t.deletedAt === null)
    .count();
  if (inUse > 0) {
    return { ok: false, error: `No se puede eliminar: tiene ${inUse} movimiento(s)` };
  }
  await db.categories.update(id, { deletedAt: now(), updatedAt: now() });
  await markDirty("category", id);
  scheduleSync();
  return { ok: true };
}
