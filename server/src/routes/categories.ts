import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { h } from "../lib/handler.js";
import { requireAuth } from "../middleware/auth.js";
import { categoryInput } from "../lib/schemas.js";
import { serializeCategory } from "../lib/serialize.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  h(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { userId: req.userId, deletedAt: null },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });
    res.json({ categories: categories.map(serializeCategory) });
  })
);

router.post(
  "/",
  h(async (req, res) => {
    const data = categoryInput.parse(req.body);
    const category = await prisma.category.create({
      data: {
        id: randomUUID(),
        userId: req.userId,
        name: data.name,
        type: data.type,
        icon: data.icon ?? null,
        updatedAt: new Date(),
      },
    });
    res.status(201).json({ category: serializeCategory(category) });
  })
);

router.put(
  "/:id",
  h(async (req, res) => {
    const data = categoryInput.partial().parse(req.body);
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "Categoría no encontrada" });
    const category = await prisma.category.update({
      where: { id: existing.id },
      data: { name: data.name, icon: data.icon, updatedAt: new Date() },
    });
    res.json({ category: serializeCategory(category) });
  })
);

router.delete(
  "/:id",
  h(async (req, res) => {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "Categoría no encontrada" });
    const inUse = await prisma.transaction.count({
      where: { categoryId: existing.id, deletedAt: null },
    });
    if (inUse > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: la categoría tiene ${inUse} movimiento(s)`,
      });
    }
    await prisma.category.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
    res.json({ ok: true });
  })
);

export default router;
