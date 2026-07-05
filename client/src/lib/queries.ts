import { useLiveQuery } from "dexie-react-hooks";
import { db, getMeta } from "./db";
import type { Account, Category, Tx, TxType } from "./types";

// Hooks reactivos sobre IndexedDB: cualquier cambio local o traído por la
// sincronización actualiza la interfaz al instante.

export function useAccounts(): Account[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.accounts.toArray();
    return rows
      .filter((a) => a.deletedAt === null)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, []);
}

export function useCategories(type?: TxType): Category[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.categories.toArray();
    return rows
      .filter((c) => c.deletedAt === null && (!type || c.type === type))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [type]);
}

/** Todos los movimientos vivos, del más reciente al más antiguo. */
export function useTransactions(): Tx[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.transactions.toArray();
    return rows
      .filter((t) => t.deletedAt === null)
      .sort(
        (a, b) =>
          b.transactionDate.localeCompare(a.transactionDate) || b.createdAt - a.createdAt
      );
  }, []);
}

export interface AccountBalance {
  income: number;
  expense: number;
  current: number;
}

export interface Balances {
  total: number;
  byAccount: Map<string, AccountBalance>;
}

/** Saldo actual por cuenta y total: inicial + ingresos - gastos (histórico). */
export function useBalances(): Balances | undefined {
  return useLiveQuery(async () => {
    const [accounts, txs] = await Promise.all([
      db.accounts.toArray(),
      db.transactions.toArray(),
    ]);
    const live = accounts.filter((a) => a.deletedAt === null);
    const byAccount = new Map<string, AccountBalance>(
      live.map((a) => [a.id, { income: 0, expense: 0, current: a.initialBalance }])
    );
    for (const t of txs) {
      if (t.deletedAt !== null) continue;
      const entry = byAccount.get(t.accountId);
      if (!entry) continue;
      if (t.type === "income") {
        entry.income += t.amount;
        entry.current += t.amount;
      } else {
        entry.expense += t.amount;
        entry.current -= t.amount;
      }
    }
    let total = 0;
    for (const entry of byAccount.values()) total += entry.current;
    return { total, byAccount };
  }, []);
}

export function usePendingCount(): number | undefined {
  return useLiveQuery(() => db.outbox.count(), []);
}

export function useLastSyncedAt(): number | undefined {
  return useLiveQuery(async () => (await getMeta<number>("lastSyncedAt")) ?? 0, []);
}
