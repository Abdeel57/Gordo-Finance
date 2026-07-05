import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { h } from "../lib/handler.js";
import { requireAuth } from "../middleware/auth.js";
import { accountInput } from "../lib/schemas.js";
import { serializeAccount } from "../lib/serialize.js";

const router = Router();
router.use(requireAuth);

// Lista de cuentas con su saldo actual (inicial + ingresos - gastos).
router.get(
  "/",
  h(async (req, res) => {
    const [accounts, sums] = await Promise.all([
      prisma.account.findMany({
        where: { userId: req.userId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.groupBy({
        by: ["accountId", "type"],
        where: { userId: req.userId, deletedAt: null },
        _sum: { amount: true },
      }),
    ]);
    const byAccount = new Map<string, { income: number; expense: number }>();
    for (const s of sums) {
      const entry = byAccount.get(s.accountId) ?? { income: 0, expense: 0 };
      entry[s.type as "income" | "expense"] += s._sum.amount ?? 0;
      byAccount.set(s.accountId, entry);
    }
    res.json({
      accounts: accounts.map((a) => {
        const sums = byAccount.get(a.id) ?? { income: 0, expense: 0 };
        return {
          ...serializeAccount(a),
          currentBalance: a.initialBalance + sums.income - sums.expense,
        };
      }),
    });
  })
);

router.post(
  "/",
  h(async (req, res) => {
    const data = accountInput.parse(req.body);
    const account = await prisma.account.create({
      data: {
        id: randomUUID(),
        userId: req.userId,
        name: data.name,
        initialBalance: data.initialBalance,
        icon: data.icon ?? null,
        updatedAt: new Date(),
      },
    });
    res.status(201).json({ account: serializeAccount(account) });
  })
);

router.put(
  "/:id",
  h(async (req, res) => {
    const data = accountInput.partial().parse(req.body);
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "Cuenta no encontrada" });
    const account = await prisma.account.update({
      where: { id: existing.id },
      data: { ...data, updatedAt: new Date() },
    });
    res.json({ account: serializeAccount(account) });
  })
);

router.delete(
  "/:id",
  h(async (req, res) => {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "Cuenta no encontrada" });
    const inUse = await prisma.transaction.count({
      where: { accountId: existing.id, deletedAt: null },
    });
    if (inUse > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: la cuenta tiene ${inUse} movimiento(s)`,
      });
    }
    await prisma.account.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
    res.json({ ok: true });
  })
);

export default router;
