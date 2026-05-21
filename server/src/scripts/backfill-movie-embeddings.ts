import { env } from "../config/env";
import { moviesCollection } from "../db/collections";
import { closeMongoConnection } from "../db/mongo";
import {
  buildMovieEmbeddingText,
  createTextEmbeddings,
} from "../services/embedding-service";

async function main() {
  const collection = await moviesCollection();
  const batchSize = env.EMBEDDING_BATCH_SIZE;
  let processed = 0;

  while (true) {
    const movies = await collection
      .find(
        {
          $or: [
            { [env.MOVIE_EMBEDDING_FIELD]: { $exists: false } },
            { [env.MOVIE_EMBEDDING_FIELD]: { $size: 0 } },
          ],
        },
        {
          projection: {
            title: 1,
            plot: 1,
            fullplot: 1,
            genres: 1,
            year: 1,
            cast: 1,
            directors: 1,
          },
        },
      )
      .limit(batchSize)
      .toArray();

    if (movies.length === 0) {
      break;
    }

    const inputs = movies.map(buildMovieEmbeddingText);
    const embeddings = await createTextEmbeddings(inputs);

    await collection.bulkWrite(
      movies.map((movie, index) => ({
        updateOne: {
          filter: { _id: movie._id },
          update: {
            $set: {
              [env.MOVIE_EMBEDDING_FIELD]: embeddings[index],
              embeddingProvider: "openai",
              embeddingModel: env.OPENAI_EMBEDDING_MODEL,
              embeddingUpdatedAt: new Date(),
            },
          },
        },
      })),
    );

    processed += movies.length;
    console.log(`Backfilled ${processed} movie embeddings`);
  }

  console.log("Movie embedding backfill complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoConnection();
  });
