import { env } from "../config/env";
import { moviesCollection } from "../db/collections";
import { closeMongoConnection } from "../db/mongo";
import { createTextEmbedding } from "../services/embedding-service";

async function main() {
  const collection = await moviesCollection();
  const dimensions =
    env.OPENAI_EMBEDDING_DIMENSIONS ??
    (await createTextEmbedding("dimension probe for vector search index")).length;

  const existingIndexes = await collection.listSearchIndexes().toArray();
  const existing = existingIndexes.find((index) => index.name === env.VECTOR_INDEX_NAME);

  if (existing) {
    const existingStatus =
      "status" in existing && typeof existing.status === "string"
        ? existing.status
        : "unknown";

    console.log(
      JSON.stringify(
        {
          message: "Vector Search index already exists",
          name: env.VECTOR_INDEX_NAME,
          status: existingStatus,
        },
        null,
        2,
      ),
    );
    return;
  }

  const name = await collection.createSearchIndex({
    name: env.VECTOR_INDEX_NAME,
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: env.MOVIE_EMBEDDING_FIELD,
          numDimensions: dimensions,
          similarity: "cosine",
        },
        {
          type: "filter",
          path: "genres",
        },
        {
          type: "filter",
          path: "year",
        },
        {
          type: "filter",
          path: "imdb.rating",
        },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        message: "Vector Search index creation requested",
        name,
        dimensions,
        vectorField: env.MOVIE_EMBEDDING_FIELD,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoConnection();
  });
