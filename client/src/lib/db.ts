import Dexie, { type Table } from "dexie";
import type { Account, Category, OutboxEntry, Tx } from "./types";

// Base local (IndexedDB). La app lee y escribe SIEMPRE aquí primero; la
// sincronización con el servidor ocurre en segundo plano (ver sync.ts).

class CuentaClaraDB extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Tx, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("cuenta-clara");
    this.version(1).stores({
      accounts: "id, updatedAt",
      categories: "id, type, updatedAt",
      transactions: "id, transactionDate, updatedAt, categoryId, accountId",
      outbox: "key, entity",
      meta: "key",
    });
  }
}

export const db = new CuentaClaraDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function resetLocalData(): Promise<void> {
  await Promise.all([
    db.accounts.clear(),
    db.categories.clear(),
    db.transactions.clear(),
    db.outbox.clear(),
    db.meta.clear(),
  ]);
}
