import { Router } from "express";
import { env } from "../config/env";
import { getDb } from "../db/mongo";
import { asyncHandler } from "../middleware/async-handler";
import { getSystemReadiness } from "../services/system-service";

export const healthRoutes = Router();

healthRoutes.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    await db.command({ ping: 1 });

    res.json({
      status: "ok",
      service: "moodflix-api",
      environment: env.NODE_ENV,
      database: env.MONGODB_DB_NAME,
      moviesCollection: env.MOVIES_COLLECTION,
    });
  }),
);

healthRoutes.get(
  "/api/system/readiness",
  asyncHandler(async (_req, res) => {
    res.json(await getSystemReadiness());
  }),
);
