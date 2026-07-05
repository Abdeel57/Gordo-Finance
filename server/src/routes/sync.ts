import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { h } from "../lib/handler.js";
import { requireAuth } from "../middleware/auth.js";
import { pushBody } from "../lib/schemas.js";
import {
  serializeAccount,
  serializeCategory,
  serializeTransaction,
} from "../lib/serialize.js";

// Sincronización local-first:
// - El cliente guarda todo en IndexedDB y manda aquí sus cambios pendientes (push).
// - Luego pide lo que cambió en el servidor desde su última sincronización (pull).
// - Conflictos: gana la escritura más reciente (updatedAt). Los borrados son
//   lógicos, así que los tombstones viajan igual que cualquier otra fila.

const router = Router();
router.use(requireAuth);

router.get(
  "/pull",
  h(async (req, res) => {
    const since = Number(req.query.since ?? 0) || 0;
    const sinceDate = new Date(since);
    const changedSince = { userId: req.userId, updatedAt: { gt: sinceDate } };
    const [accounts, categories, transactions] = await Promise.all([
      prisma.account.findMany({ where: changedSince }),
      prisma.category.findMany({ where: changedSince }),
      prisma.transaction.findMany({ where: changedSince }),
    ]);
    res.json({
      serverTime: Date.now(),
      accounts: accounts.map(serializeAccount),
      categories: categories.map(serializeCategory),
      transactions: transactions.map(serializeTransaction),
    });
  })
);

router.post(
  "/push",
  h(async (req, res) => {
    const body = pushBody.parse(req.body);
    const userId = req.userId;
    let applied = 0;
    let skipped = 0;

    await prisma.$transaction(
      async (db) => {
        // Orden importante: cuentas y categorías antes que transacciones (FK).
        for (const row of body.accounts) {
          const existing = await db.account.findUnique({ where: { id: row.id } });
          if (existing && existing.userId !== userId) { skipped++; continue; }
          if (existing && existing.updatedAt.getTime() >= row.updatedAt) { skipped++; continue; }
          const data = {
            name: row.name,
            initialBalance: row.initialBalance,
            icon: row.icon,
            updatedAt: new Date(row.updatedAt),
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
          };
          if (existing) {
            await db.account.update({ where: { id: row.id }, data });
          } else {
            await db.account.create({
              data: { ...data, id: row.id, userId, createdAt: new Date(row.createdAt) },
            });
          }
          applied++;
        }

        for (const row of body.categories) {
          const existing = await db.category.findUnique({ where: { id: row.id } });
          if (existing && existing.userId !== userId) { skipped++; continue; }
          if (existing && existing.updatedAt.getTime() >= row.updatedAt) { skipped++; continue; }
          const data = {
            name: row.name,
            type: row.type,
            icon: row.icon,
            updatedAt: new Date(row.updatedAt),
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
          };
          if (existing) {
            await db.category.update({ where: { id: row.id }, data });
          } else {
            await db.category.create({
              data: { ...data, id: row.id, userId, createdAt: new Date(row.createdAt) },
            });
          }
          applied++;
        }

        for (const row of body.transactions) {
          const existing = await db.transaction.findUnique({ where: { id: row.id } });
          if (existing && existing.userId !== userId) { skipped++; continue; }
          if (existing && existing.updatedAt.getTime() >= row.updatedAt) { skipped++; continue; }
          const [account, category] = await Promise.all([
            db.account.findUnique({ where: { id: row.accountId } }),
            db.category.findUnique({ where: { id: row.categoryId } }),
          ]);
          if (!account || account.userId !== userId || !category || category.userId !== userId) {
            skipped++;
            continue;
          }
          const data = {
            type: row.type,
            amount: row.amount,
            description: row.description,
            accountId: row.accountId,
            categoryId: row.categoryId,
            transactionDate: new Date(row.transactionDate),
            notes: row.notes,
            updatedAt: new Date(row.updatedAt),
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
          };
          if (existing) {
            await db.transaction.update({ where: { id: row.id }, data });
          } else {
            await db.transaction.create({
              data: { ...data, id: row.id, userId, createdAt: new Date(row.createdAt) },
            });
          }
          applied++;
        }
      },
      { timeout: 30_000 }
    );

    res.json({ applied, skipped, serverTime: Date.now() });
  })
);

export default router;
