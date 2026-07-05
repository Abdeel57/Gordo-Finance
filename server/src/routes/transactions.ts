import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { h } from "../lib/handler.js";
import { requireAuth } from "../middleware/auth.js";
import { transactionInput, ymd } from "../lib/schemas.js";
import { serializeTransaction } from "../lib/serialize.js";

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  from: ymd.optional(),
  to: ymd.optional(),
  type: z.enum(["income", "expense"]).optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/",
  h(async (req, res) => {
    const query = listQuery.parse(req.query);
    const where = {
      userId: req.userId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.q
        ? { description: { contains: query.q, mode: "insensitive" as const } }
        : {}),
      ...(query.from || query.to
        ? {
            transactionDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: query.take,
        skip: query.skip,
        include: {
          category: { select: { name: true, icon: true } },
          account: { select: { name: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);
    res.json({
      total,
      transactions: transactions.map((t) => ({
        ...serializeTransaction(t),
        categoryName: t.category.name,
        categoryIcon: t.category.icon,
        accountName: t.account.name,
      })),
    });
  })
);

async function assertOwnership(userId: string, accountId: string, categoryId: string) {
  const [account, category] = await Promise.all([
    prisma.account.findFirst({ where: { id: accountId, userId, deletedAt: null } }),
    prisma.category.findFirst({ where: { id: categoryId, userId, deletedAt: null } }),
  ]);
  if (!account) return "La cuenta seleccionada no existe";
  if (!category) return "La categoría seleccionada no existe";
  return null;
}

router.post(
  "/",
  h(async (req, res) => {
    const data = transactionInput.parse(req.body);
    const ownershipError = await assertOwnership(req.userId, data.accountId, data.categoryId);
    if (ownershipError) return res.status(400).json({ error: ownershipError });
    const transaction = await prisma.transaction.create({
      data: {
        id: randomUUID(),
        userId: req.userId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        accountId: data.accountId,
        categoryId: data.categoryId,
        transactionDate: new Date(data.transactionDate),
        notes: data.notes ?? null,
        updatedAt: new Date(),
      },
    });
    res.status(201).json({ transaction: serializeTransaction(transaction) });
  })
);

router.put(
  "/:id",
  h(async (req, res) => {
    const data = transactionInput.parse(req.body);
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "Movimiento no encontrado" });
    const ownershipError = await assertOwnership(req.userId, data.accountId, data.categoryId);
    if (ownershipError) return res.status(400).json({ error: ownershipError });
    const transaction = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        type: data.type,
        amount: data.amount,
        description: data.description,
        accountId: data.accountId,
        categoryId: data.categoryId,
        transactionDate: new Date(data.transactionDate),
        notes: data.notes ?? null,
        updatedAt: new Date(),
      },
    });
    res.json({ transaction: serializeTransaction(transaction) });
  })
);

router.delete(
  "/:id",
  h(async (req, res) => {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "Movimiento no encontrado" });
    await prisma.transaction.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
    res.json({ ok: true });
  })
);

export default router;
