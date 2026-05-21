import { env } from "../config/env";
import {
  interactionsCollection,
  moviesCollection,
  recommendationLogsCollection,
  usersCollection,
} from "../db/collections";
import { getDb } from "../db/mongo";
import { hasOpenAIEmbeddingConfig } from "./embedding-service";

export async function getSystemReadiness() {
  const db = await getDb();
  await db.command({ ping: 1 });

  const movies = await moviesCollection();
  const users = await usersCollection();
  const interactions = await interactionsCollection();
  const logs = await recommendationLogsCollection();

  const [movieCount, embeddedMovieCount, userCount, interactionCount, logCount, indexes] =
    await Promise.all([
      movies.countDocuments(),
      movies.countDocuments({
        [env.MOVIE_EMBEDDING_FIELD]: { $exists: true, $type: "array" },
      }),
      users.countDocuments(),
      interactions.countDocuments(),
      logs.countDocuments(),
      movies.listSearchIndexes().toArray().catch(() => []),
    ]);

  const vectorIndex = indexes.find((index) => index.name === env.VECTOR_INDEX_NAME);
  const vectorIndexStatus =
    vectorIndex && "status" in vectorIndex && typeof vectorIndex.status === "string"
      ? vectorIndex.status
      : null;
  const vectorIndexQueryable =
    vectorIndex && "queryable" in vectorIndex && typeof vectorIndex.queryable === "boolean"
      ? vectorIndex.queryable
      : null;
  const embeddingCoverage =
    movieCount > 0 ? Math.round((embeddedMovieCount / movieCount) * 1000) / 1000 : 0;

  return {
    status:
      movieCount > 0 &&
      embeddedMovieCount === movieCount &&
      Boolean(vectorIndex) &&
      vectorIndexQueryable !== false
        ? "ready"
        : "needs_attention",
    database: {
      name: env.MONGODB_DB_NAME,
      connected: true,
    },
    collections: {
      movies: {
        name: env.MOVIES_COLLECTION,
        count: movieCount,
        embeddedCount: embeddedMovieCount,
        embeddingCoverage,
        embeddingField: env.MOVIE_EMBEDDING_FIELD,
      },
      users: {
        name: env.USERS_COLLECTION,
        count: userCount,
      },
      interactions: {
        name: env.INTERACTIONS_COLLECTION,
        count: interactionCount,
      },
      recommendationLogs: {
        name: env.RECOMMENDATION_LOGS_COLLECTION,
        count: logCount,
      },
    },
    vectorSearch: {
      indexName: env.VECTOR_INDEX_NAME,
      exists: Boolean(vectorIndex),
      status: vectorIndexStatus,
      queryable: vectorIndexQueryable,
      dimensions: env.OPENAI_EMBEDDING_DIMENSIONS ?? "model-default",
      numCandidates: env.VECTOR_NUM_CANDIDATES,
    },
    openai: {
      configured: hasOpenAIEmbeddingConfig(),
      embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    },
  };
}
