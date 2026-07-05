import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { env } from "./lib/env.js";
import authRouter from "./routes/auth.js";
import syncRouter from "./routes/sync.js";
import accountsRouter from "./routes/accounts.js";
import categoriesRouter from "./routes/categories.js";
import transactionsRouter from "./routes/transactions.js";
import type { NextFunction, Request, Response } from "express";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Gordo Finance API" });
});

app.use("/api/auth", authRouter);
app.use("/api/sync", syncRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transactions", transactionsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first?.message ?? "Datos inválidos" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(env.port, () => {
  console.log(`Gordo Finance API escuchando en http://localhost:${env.port}`);
});
