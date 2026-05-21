import { env } from "../config/env";
import { seedMovies } from "../data/seed-movies";
import { moviesCollection } from "../db/collections";
import { closeMongoConnection } from "../db/mongo";

async function main() {
  const collection = await moviesCollection();
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({
    title: "text",
    plot: "text",
    fullplot: "text",
  });
  await collection.createIndex({ genres: 1, year: -1, "imdb.rating": -1 });

  const now = new Date();
  const result = await collection.bulkWrite(
    seedMovies.map((movie) => ({
      updateOne: {
        filter: { slug: movie.slug },
        update: {
          $set: {
            ...movie,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  const total = await collection.countDocuments();

  console.log(
    JSON.stringify(
      {
        database: env.MONGODB_DB_NAME,
        collection: env.MOVIES_COLLECTION,
        inserted: result.upsertedCount,
        modified: result.modifiedCount,
        matched: result.matchedCount,
        total,
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
