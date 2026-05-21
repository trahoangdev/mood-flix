import { Router } from "express";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/async-handler";
import {
  createTextEmbedding,
  hasOpenAIEmbeddingConfig,
} from "../services/embedding-service";

export const embeddingRoutes = Router();

embeddingRoutes.get("/api/embeddings/config", (_req, res) => {
  res.json({
    provider: "openai",
    configured: hasOpenAIEmbeddingConfig(),
    model: env.OPENAI_EMBEDDING_MODEL,
    dimensions: env.OPENAI_EMBEDDING_DIMENSIONS ?? "model-default",
    movieEmbeddingField: env.MOVIE_EMBEDDING_FIELD,
  });
});

embeddingRoutes.post(
  "/api/embeddings/preview",
  asyncHandler(async (req, res) => {
    const input = String(req.body?.input ?? "").trim();
    const embedding = await createTextEmbedding(input);

    res.json({
      model: env.OPENAI_EMBEDDING_MODEL,
      dimensions: embedding.length,
      preview: embedding.slice(0, 5),
    });
  }),
);
