import { db, getMeta, setMeta } from "./db";
import { api, getToken } from "./api";
import type { Account, Category, Tx } from "./types";

// Motor de sincronización local-first:
// 1. push: manda al servidor las filas marcadas como pendientes (outbox).
// 2. pull: trae lo que cambió en el servidor desde la última sincronización.
// Conflictos: gana la escritura con updatedAt más reciente.

export type SyncState = "idle" | "syncing" | "error";

let state: SyncState = "idle";
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
const listeners = new Set<(s: SyncState) => void>();

function setState(next: SyncState) {
  state = next;
  listeners.forEach((fn) => fn(next));
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

interface PullResponse {
  serverTime: number;
  accounts: Account[];
  categories: Category[];
  transactions: Tx[];
}

async function push(): Promise<void> {
  const entries = await db.outbox.toArray();
  if (entries.length === 0) return;
  const snapshot = new Map(entries.map((e) => [e.key, e.queuedAt]));

  const accounts: Account[] = [];
  const categories: Category[] = [];
  const transactions: Tx[] = [];
  for (const entry of entries) {
    if (entry.entity === "account") {
      const row = await db.accounts.get(entry.entityId);
      if (row) accounts.push(row);
    } else if (entry.entity === "category") {
      const row = await db.categories.get(entry.entityId);
      if (row) categories.push(row);
    } else {
      const row = await db.transactions.get(entry.entityId);
      if (row) transactions.push(row);
    }
  }

  await api("/sync/push", { method: "POST", body: { accounts, categories, transactions } });

  // Solo se limpian las entradas que no volvieron a modificarse durante el push.
  await db.transaction("rw", db.outbox, async () => {
    for (const [key, queuedAt] of snapshot) {
      const current = await db.outbox.get(key);
      if (current && current.queuedAt <= queuedAt) {
        await db.outbox.delete(key);
      }
    }
  });
}

async function pull(): Promise<void> {
  const since = (await getMeta<number>("lastPulledAt")) ?? 0;
  const data = await api<PullResponse>(`/sync/pull?since=${since}`);

  await db.transaction(
    "rw",
    [db.accounts, db.categories, db.transactions, db.outbox],
    async () => {
      await applyIncoming(db.accounts, data.accounts, "account");
      await applyIncoming(db.categories, data.categories, "category");
      await applyIncoming(db.transactions, data.transactions, "transaction");
    }
  );
  await setMeta("lastPulledAt", data.serverTime);
}

async function applyIncoming<T extends { id: string; updatedAt: number }>(
  table: { get(id: string): Promise<T | undefined>; put(row: T): Promise<string> },
  rows: T[],
  entity: string
): Promise<void> {
  for (const row of rows) {
    // Si hay una edición local pendiente más reciente, se respeta la local.
    const dirty = await db.outbox.get(`${entity}:${row.id}`);
    if (dirty) {
      const local = await table.get(row.id);
      if (local && local.updatedAt >= row.updatedAt) continue;
    }
    await table.put(row);
  }
}

export async function syncNow(): Promise<boolean> {
  if (!getToken() || !navigator.onLine || state === "syncing") return false;
  setState("syncing");
  try {
    await push();
    await pull();
    await setMeta("lastSyncedAt", Date.now());
    setState("idle");
    return true;
  } catch (error) {
    console.warn("Sincronización fallida:", error);
    setState("error");
    return false;
  }
}

/** Agenda una sincronización próxima (con debounce tras cada cambio local). */
export function scheduleSync(delayMs = 1500): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delayMs);
}

/** Arranca los disparadores automáticos. Se llama una vez al iniciar sesión. */
export function startSyncLoop(): void {
  if (started) return;
  started = true;
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleSync(300);
  });
  setInterval(() => scheduleSync(0), 120_000);
  void syncNow();
}
