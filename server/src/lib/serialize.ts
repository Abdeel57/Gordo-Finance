import type { Account, Category, Transaction } from "@prisma/client";

const toMs = (d: Date) => d.getTime();
const toMsOrNull = (d: Date | null) => (d ? d.getTime() : null);

export function serializeAccount(a: Account) {
  return {
    id: a.id,
    name: a.name,
    initialBalance: a.initialBalance,
    icon: a.icon,
    createdAt: toMs(a.createdAt),
    updatedAt: toMs(a.updatedAt),
    deletedAt: toMsOrNull(a.deletedAt),
  };
}

export function serializeCategory(c: Category) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    createdAt: toMs(c.createdAt),
    updatedAt: toMs(c.updatedAt),
    deletedAt: toMsOrNull(c.deletedAt),
  };
}

export function serializeTransaction(t: Transaction) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    description: t.description,
    categoryId: t.categoryId,
    accountId: t.accountId,
    transactionDate: t.transactionDate.toISOString().slice(0, 10),
    notes: t.notes,
    createdAt: toMs(t.createdAt),
    updatedAt: toMs(t.updatedAt),
    deletedAt: toMsOrNull(t.deletedAt),
  };
}
