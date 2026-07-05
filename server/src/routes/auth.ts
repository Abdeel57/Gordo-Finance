import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { h } from "../lib/handler.js";
import { requireAuth } from "../middleware/auth.js";
import {
  DEFAULT_ACCOUNT,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "../lib/defaults.js";

const router = Router();

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(100),
  name: z.string().trim().max(60).optional(),
});

function signToken(userId: string) {
  return jwt.sign({}, env.jwtSecret, { subject: userId, expiresIn: "90d" });
}

function publicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

router.post(
  "/register",
  h(async (req, res) => {
    const { email, password, name } = credentials.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    // El registro deja al usuario listo para usar la app:
    // cuenta "Efectivo" + categorías estándar de ingresos y gastos.
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        settings: { create: {} },
        accounts: {
          create: {
            id: randomUUID(),
            name: DEFAULT_ACCOUNT.name,
            icon: DEFAULT_ACCOUNT.icon,
            initialBalance: 0,
            updatedAt: now,
          },
        },
        categories: {
          create: [
            ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
              id: randomUUID(),
              name: c.name,
              icon: c.icon,
              type: "income",
              updatedAt: now,
            })),
            ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
              id: randomUUID(),
              name: c.name,
              icon: c.icon,
              type: "expense",
              updatedAt: now,
            })),
          ],
        },
      },
    });
    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  })
);

router.post(
  "/login",
  h(async (req, res) => {
    const { email, password } = credentials.omit({ name: true }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  h(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: publicUser(user) });
  })
);

export default router;
