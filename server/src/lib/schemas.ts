import { z } from "zod";

export const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida, usa AAAA-MM-DD");

const ms = z.number().int().nonnegative();

export const accountInput = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(40),
  initialBalance: z.number().int().min(0).max(999_999_999_999),
  icon: z.string().max(8).nullable().optional(),
});

export const categoryInput = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(30),
  type: z.enum(["income", "expense"]),
  icon: z.string().max(8).nullable().optional(),
});

export const transactionInput = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().int().positive("El monto debe ser mayor a cero").max(999_999_999_999),
  description: z.string().trim().min(1, "La descripción es obligatoria").max(80),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  transactionDate: ymd,
  notes: z.string().max(300).nullable().optional(),
});

// ——— Payloads de sincronización (el cliente manda filas completas con timestamps) ———

const syncBase = {
  id: z.string().uuid(),
  createdAt: ms,
  updatedAt: ms,
  deletedAt: ms.nullable(),
};

export const syncAccount = z.object({
  ...syncBase,
  name: accountInput.shape.name,
  initialBalance: accountInput.shape.initialBalance,
  icon: z.string().max(8).nullable(),
});

export const syncCategory = z.object({
  ...syncBase,
  name: categoryInput.shape.name,
  type: categoryInput.shape.type,
  icon: z.string().max(8).nullable(),
});

export const syncTransaction = z.object({
  ...syncBase,
  type: transactionInput.shape.type,
  amount: transactionInput.shape.amount,
  description: transactionInput.shape.description,
  categoryId: transactionInput.shape.categoryId,
  accountId: transactionInput.shape.accountId,
  transactionDate: ymd,
  notes: z.string().max(300).nullable(),
});

export const pushBody = z.object({
  accounts: z.array(syncAccount).max(1000).default([]),
  categories: z.array(syncCategory).max(1000).default([]),
  transactions: z.array(syncTransaction).max(5000).default([]),
});
