import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("moodflix"),

  MOVIES_COLLECTION: z.string().min(1).default("movies"),
  MOVIE_EMBEDDING_FIELD: z.string().min(1).default("embedding"),
  VECTOR_INDEX_NAME: z.string().min(1).default("movie_vector_index"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  OPENAI_EMBEDDING_DIMENSIONS: z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) {
      return undefined;
    }

    return value;
  }, z.coerce.number().int().positive().optional()),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(2048).default(50),

  USERS_COLLECTION: z.string().min(1).default("users"),
  INTERACTIONS_COLLECTION: z.string().min(1).default("interactions"),
  RECOMMENDATION_LOGS_COLLECTION: z
    .string()
    .min(1)
    .default("recommendation_logs"),

  DEFAULT_RECOMMENDATION_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10),
  VECTOR_NUM_CANDIDATES: z.coerce
    .number()
    .int()
    .min(10)
    .max(10000)
    .default(150),
});

export const env = envSchema.parse(process.env);

export function getCorsOrigin(): string | string[] {
  if (env.CORS_ORIGIN === "*") {
    return "*";
  }

  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
