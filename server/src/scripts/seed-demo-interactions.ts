import { ObjectId } from "mongodb";
import {
  interactionsCollection,
  moviesCollection,
  usersCollection,
} from "../db/collections";
import { closeMongoConnection } from "../db/mongo";
import type { InteractionAction } from "../models/domain";

interface DemoProfile {
  name: string;
  likes: string[];
  watched: string[];
  skipped?: string[];
}

const demoProfiles: DemoProfile[] = [
  {
    name: "Seed Viewer: Emotional Sci-Fi",
    likes: [
      "arrival-2016",
      "her-2013",
      "eternal-sunshine-2004",
      "interstellar-2014",
    ],
    watched: ["blade-runner-2049-2017", "ex-machina-2014"],
  },
  {
    name: "Seed Viewer: Mind-Bending Sci-Fi",
    likes: ["inception-2010", "the-matrix-1999", "blade-runner-2049-2017"],
    watched: ["arrival-2016", "ex-machina-2014", "the-martian-2015"],
  },
  {
    name: "Seed Viewer: Data And Ambition",
    likes: [
      "moneyball-2011",
      "the-social-network-2010",
      "the-imitation-game-2014",
      "hidden-figures-2016",
    ],
    watched: ["whiplash-2014"],
  },
  {
    name: "Seed Viewer: Warm Family Stories",
    likes: [
      "coco-2017",
      "inside-out-2015",
      "up-2009",
      "the-pursuit-of-happyness-2006",
    ],
    watched: ["minari-2020", "little-miss-sunshine-2006"],
  },
  {
    name: "Seed Viewer: Stylish Mystery Drama",
    likes: [
      "parasite-2019",
      "knives-out-2019",
      "the-grand-budapest-hotel-2014",
    ],
    watched: ["the-dark-knight-2008"],
  },
];

async function main() {
  const movies = await moviesCollection();
  const users = await usersCollection();
  const interactions = await interactionsCollection();
  const movieDocs = await movies
    .find({
      slug: {
        $in: [
          ...new Set(
            demoProfiles.flatMap((profile) => [
              ...profile.likes,
              ...profile.watched,
              ...(profile.skipped ?? []),
            ]),
          ),
        ],
      },
    })
    .project<{ _id: ObjectId; slug: string }>({ _id: 1, slug: 1 })
    .toArray();
  const movieBySlug = new Map(movieDocs.map((movie) => [movie.slug, movie]));
  const now = new Date();
  const seedUserIds: ObjectId[] = [];

  for (const profile of demoProfiles) {
    const likedMovieIds = profile.likes
      .map((slug) => movieBySlug.get(slug)?._id)
      .filter((movieId): movieId is ObjectId => Boolean(movieId));
    const watchedMovieIds = profile.watched
      .map((slug) => movieBySlug.get(slug)?._id)
      .filter((movieId): movieId is ObjectId => Boolean(movieId));

    await users.updateOne(
      { name: profile.name, isSeedUser: true },
      {
        $set: {
          name: profile.name,
          likedMovieIds,
          watchedMovieIds,
          isSeedUser: true,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: now,
        },
      },
      { upsert: true },
    );

    const user = await users.findOne({ name: profile.name, isSeedUser: true });

    if (!user) {
      continue;
    }

    seedUserIds.push(user._id);
  }

  await interactions.deleteMany({ userId: { $in: seedUserIds } });

  const interactionDocs = demoProfiles.flatMap((profile) => {
    const user = seedUserIds[demoProfiles.indexOf(profile)];

    if (!user) {
      return [];
    }

    return [
      ...buildInteractions(user, profile.likes, movieBySlug, "liked", 9),
      ...buildInteractions(user, profile.watched, movieBySlug, "watched", 7),
      ...buildInteractions(user, profile.skipped ?? [], movieBySlug, "skipped"),
    ];
  });

  if (interactionDocs.length > 0) {
    await interactions.insertMany(interactionDocs);
  }

  console.log(
    JSON.stringify(
      {
        seedUsers: seedUserIds.length,
        seededInteractions: interactionDocs.length,
      },
      null,
      2,
    ),
  );
}

function buildInteractions(
  userId: ObjectId,
  slugs: string[],
  movieBySlug: Map<string, { _id: ObjectId; slug: string }>,
  action: InteractionAction,
  rating?: number,
) {
  return slugs
    .map((slug) => {
      const movie = movieBySlug.get(slug);

      if (!movie) {
        return null;
      }

      return {
        _id: new ObjectId(),
        userId,
        movieId: movie._id,
        action,
        rating,
        createdAt: new Date(),
      };
    })
    .filter((interaction): interaction is NonNullable<typeof interaction> =>
      Boolean(interaction),
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
