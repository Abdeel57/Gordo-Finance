export type TxType = "income" | "expense";

// Todos los montos son enteros en centavos de peso (MXN).

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Category {
  id: string;
  name: string;
  type: TxType;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Tx {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  categoryId: string;
  accountId: string;
  transactionDate: string; // AAAA-MM-DD
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface OutboxEntry {
  key: string; // "entidad:id"
  entity: "account" | "category" | "transaction";
  entityId: string;
  queuedAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}
