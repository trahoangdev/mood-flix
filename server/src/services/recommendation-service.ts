import type { Document, Filter } from "mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env";
import {
  interactionsCollection,
  moviesCollection,
  recommendationLogsCollection,
  usersCollection,
} from "../db/collections";
import { ApiError } from "../middleware/error-handler";
import type { MovieDoc } from "../models/domain";
import { createTextEmbedding } from "./embedding-service";
import {
  getMovieEmbedding,
  getMovieRating,
  getMovieTitle,
  getMovieVotes,
  toRecommendedMovie,
} from "../utils/movie-mapper";
import { objectIdToString, parseObjectId, parseObjectIds } from "../utils/object-id";
import { averageVectors } from "../utils/vector";

export const recommendationRequestSchema = z.object({
  userId: z.string().trim().optional(),
  favoriteMovieIds: z.array(z.string().trim().min(1)).min(1).optional(),
  preferenceText: z.string().trim().min(3).max(1000).optional(),
  limit: z.number().int().min(1).max(30).default(env.DEFAULT_RECOMMENDATION_LIMIT),
  filters: z
    .object({
      genres: z.array(z.string().trim().min(1)).max(10).optional(),
      yearFrom: z.number().int().optional(),
      yearTo: z.number().int().optional(),
      minRating: z.number().min(0).max(10).optional(),
    })
    .default({}),
});

export async function recommendMovies(rawBody: unknown) {
  const body = recommendationRequestSchema.parse(rawBody);
  const collection = await moviesCollection();
  const userId = body.userId ? parseObjectId(body.userId, "userId") : undefined;
  const user = userId
    ? await (await usersCollection()).findOne({ _id: userId })
    : null;

  const requestedFavoriteIds = body.favoriteMovieIds
    ? parseObjectIds(body.favoriteMovieIds, "favoriteMovieIds")
    : [];
  const persistedFavoriteIds = user?.likedMovieIds ?? [];
  const favoriteMovieIds = uniqueObjectIds([
    ...requestedFavoriteIds,
    ...persistedFavoriteIds,
  ]);

  if (favoriteMovieIds.length === 0 && !body.preferenceText) {
    throw new ApiError(
      400,
      "At least one favorite movie or preferenceText is required to generate recommendations",
    );
  }

  const favoriteMovies =
    favoriteMovieIds.length > 0
      ? await collection
          .find(
            { _id: { $in: favoriteMovieIds } },
            {
              projection: {
                title: 1,
                genres: 1,
                [env.MOVIE_EMBEDDING_FIELD]: 1,
              },
            },
          )
          .toArray()
      : [];

  const favoriteMovieVectors = favoriteMovies
    .map((movie) => getMovieEmbedding(movie))
    .filter((vector): vector is number[] => Boolean(vector));
  const preferenceTextVector = body.preferenceText
    ? await createTextEmbedding(body.preferenceText)
    : null;
  const vectors = preferenceTextVector
    ? [...favoriteMovieVectors, preferenceTextVector]
    : favoriteMovieVectors;

  if (vectors.length === 0) {
    throw new ApiError(
      422,
      `No embeddings found on selected movies. Check MOVIE_EMBEDDING_FIELD=${env.MOVIE_EMBEDDING_FIELD}.`,
    );
  }

  const queryVector = averageVectors(vectors);
  const preferredGenres = buildPreferredGenres(favoriteMovies, body.filters.genres);
  const excludedMovieIds = uniqueObjectIds([
    ...favoriteMovieIds,
    ...(user?.watchedMovieIds ?? []),
  ]);
  const collaborativeUserIds = await findCollaborativeUserIds(
    favoriteMovieIds,
    userId,
  );

  const pipeline = buildRecommendationPipeline({
    queryVector,
    excludedMovieIds,
    preferredGenres,
    collaborativeUserIds,
    limit: body.limit,
    filters: body.filters,
  });

  const rawResults = await collection.aggregate<MovieDoc & ScoredMovie>(pipeline).toArray();
  const enrichedResults = rawResults.map((movie) =>
    addRecommendationExplanation(movie, preferredGenres),
  );
  const recommendations = enrichedResults.map(toRecommendedMovie);

  if (userId) {
    await (await recommendationLogsCollection()).insertOne({
      _id: new ObjectId(),
      userId,
      preferenceText: body.preferenceText,
      favoriteMovieIds,
      recommendedMovieIds: rawResults.map((movie) => movie._id),
      filters: body.filters,
      createdAt: new Date(),
    });
  }

  return {
    input: {
      userId: userId ? objectIdToString(userId) : null,
      preferenceText: body.preferenceText ?? null,
      favoriteMovies: favoriteMovies.map((movie) => ({
        id: objectIdToString(movie._id),
        title: getMovieTitle(movie),
      })),
      preferredGenres,
      collaborativeUserCount: collaborativeUserIds.length,
      filters: body.filters,
    },
    scoringWeights: {
      vector: 0.55,
      rating: 0.16,
      genreOverlap: 0.12,
      popularity: 0.07,
      collaborative: 0.1,
    },
    recommendations,
  };
}

export async function getRecommendationHistory(userIdValue: string) {
  const userId = parseObjectId(userIdValue, "userId");
  const logs = await recommendationLogsCollection();
  const movies = await moviesCollection();

  const items = await logs
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  const movieIds = uniqueObjectIds(
    items.flatMap((item) => [
      ...item.favoriteMovieIds,
      ...item.recommendedMovieIds,
    ]),
  );
  const movieMap = new Map(
    (
      await movies
        .find(
          { _id: { $in: movieIds } },
          {
            projection: {
              title: 1,
            },
          },
        )
        .toArray()
    ).map((movie) => [objectIdToString(movie._id), getMovieTitle(movie)]),
  );

  return {
    items: items.map((item) => ({
      id: objectIdToString(item._id),
      userId: objectIdToString(item.userId as ObjectId),
      favoriteMovies: item.favoriteMovieIds.map((movieId) => ({
        id: objectIdToString(movieId),
        title: movieMap.get(objectIdToString(movieId)) ?? "Unknown movie",
      })),
      recommendedMovies: item.recommendedMovieIds.map((movieId) => ({
        id: objectIdToString(movieId),
        title: movieMap.get(objectIdToString(movieId)) ?? "Unknown movie",
      })),
      filters: item.filters ?? {},
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

interface RecommendationPipelineInput {
  queryVector: number[];
  excludedMovieIds: ObjectId[];
  preferredGenres: string[];
  collaborativeUserIds: ObjectId[];
  limit: number;
  filters: {
    genres?: string[];
    yearFrom?: number;
    yearTo?: number;
    minRating?: number;
  };
}

interface ScoredMovie {
  vectorScore?: number;
  ratingValue?: number;
  votesValue?: number;
  ratingScore?: number;
  popularityScore?: number;
  genreOverlapScore?: number;
  collaborativeCount?: number;
  collaborativeScore?: number;
  finalScore?: number;
  explanation?: string[];
}

function buildRecommendationPipeline(input: RecommendationPipelineInput): Document[] {
  const candidateLimit = Math.max(input.limit * 8, 50);
  const matchFilter = buildRecommendationMatchFilter(input);
  const genreDivisor = Math.max(Math.min(input.preferredGenres.length, 3), 1);

  return [
    {
      $vectorSearch: {
        index: env.VECTOR_INDEX_NAME,
        path: env.MOVIE_EMBEDDING_FIELD,
        queryVector: input.queryVector,
        numCandidates: env.VECTOR_NUM_CANDIDATES,
        limit: candidateLimit,
      },
    },
    {
      $addFields: {
        vectorScore: { $meta: "vectorSearchScore" },
      },
    },
    {
      $match: matchFilter,
    },
    {
      $addFields: {
        ratingValue: {
          $ifNull: ["$imdb.rating", { $ifNull: ["$tomatoes.viewer.rating", 0] }],
        },
        votesValue: {
          $ifNull: ["$imdb.votes", { $ifNull: ["$tomatoes.viewer.numReviews", 0] }],
        },
        genreOverlapCount: {
          $size: {
            $setIntersection: [{ $ifNull: ["$genres", []] }, input.preferredGenres],
          },
        },
      },
    },
    {
      $lookup: {
        from: env.INTERACTIONS_COLLECTION,
        let: {
          candidateMovieId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$movieId", "$$candidateMovieId"] },
                  { $in: ["$userId", input.collaborativeUserIds] },
                  { $in: ["$action", ["liked", "rated", "watched"]] },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$movieId",
              count: { $sum: 1 },
              averageRating: { $avg: { $ifNull: ["$rating", 0] } },
            },
          },
        ],
        as: "collaborativeMatches",
      },
    },
    {
      $addFields: {
        ratingScore: {
          $divide: [{ $min: [{ $max: ["$ratingValue", 0] }, 10] }, 10],
        },
        popularityScore: {
          $min: [
            1,
            {
              $divide: [{ $log10: { $add: ["$votesValue", 1] } }, 6],
            },
          ],
        },
        genreOverlapScore: {
          $divide: ["$genreOverlapCount", genreDivisor],
        },
        collaborativeCount: {
          $ifNull: [{ $first: "$collaborativeMatches.count" }, 0],
        },
      },
    },
    {
      $addFields: {
        collaborativeScore: {
          $min: [
            1,
            {
              $divide: [
                "$collaborativeCount",
                Math.max(input.collaborativeUserIds.length, 1),
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        finalScore: {
          $add: [
            { $multiply: ["$vectorScore", 0.55] },
            { $multiply: ["$ratingScore", 0.16] },
            { $multiply: ["$genreOverlapScore", 0.12] },
            { $multiply: ["$popularityScore", 0.07] },
            { $multiply: ["$collaborativeScore", 0.1] },
          ],
        },
      },
    },
    {
      $sort: {
        finalScore: -1,
        vectorScore: -1,
      },
    },
    {
      $limit: input.limit,
    },
    {
      $project: {
        [env.MOVIE_EMBEDDING_FIELD]: 0,
        collaborativeMatches: 0,
      },
    },
  ];
}

function buildRecommendationMatchFilter(input: RecommendationPipelineInput): Filter<MovieDoc> {
  const filter: Filter<MovieDoc> = {
    _id: { $nin: input.excludedMovieIds },
  };

  if (input.filters.genres?.length) {
    filter.genres = { $in: input.filters.genres };
  }

  if (input.filters.yearFrom || input.filters.yearTo) {
    filter.year = {};

    if (input.filters.yearFrom) {
      filter.year.$gte = input.filters.yearFrom;
    }

    if (input.filters.yearTo) {
      filter.year.$lte = input.filters.yearTo;
    }
  }

  if (typeof input.filters.minRating === "number") {
    filter["imdb.rating"] = { $gte: input.filters.minRating };
  }

  return filter;
}

function buildPreferredGenres(movies: MovieDoc[], filterGenres?: string[]): string[] {
  const counts = new Map<string, number>();

  for (const genre of filterGenres ?? []) {
    counts.set(genre, (counts.get(genre) ?? 0) + 3);
  }

  for (const movie of movies) {
    for (const genre of movie.genres ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre)
    .slice(0, 6);
}

function addRecommendationExplanation<T extends MovieDoc & ScoredMovie>(
  movie: T,
  preferredGenres: string[],
): T {
  const explanations: string[] = [];
  const matchingGenres = (movie.genres ?? []).filter((genre) =>
    preferredGenres.includes(genre),
  );
  const rating = getMovieRating(movie);
  const votes = getMovieVotes(movie);

  if (movie.vectorScore && movie.vectorScore > 0) {
    explanations.push("Matches the semantic profile of your request or favorite movies");
  }

  if (matchingGenres.length > 0) {
    explanations.push(`Matches preferred genres: ${matchingGenres.slice(0, 3).join(", ")}`);
  }

  if (typeof rating === "number" && rating >= 7) {
    explanations.push(`Strong audience signal with IMDb rating ${rating}`);
  }

  if (typeof votes === "number" && votes >= 10000) {
    explanations.push("Popular movie with broad audience validation");
  }

  if (typeof movie.collaborativeCount === "number" && movie.collaborativeCount > 0) {
    explanations.push(
      `Also liked or watched by ${movie.collaborativeCount} similar viewer${movie.collaborativeCount > 1 ? "s" : ""}`,
    );
  }

  if (explanations.length === 0) {
    explanations.push("Recommended by the blended scoring model");
  }

  return {
    ...movie,
    explanation: explanations,
  };
}

async function findCollaborativeUserIds(
  favoriteMovieIds: ObjectId[],
  currentUserId?: ObjectId,
): Promise<ObjectId[]> {
  if (favoriteMovieIds.length === 0) {
    return [];
  }

  const interactions = await interactionsCollection();
  const match: Record<string, unknown> = {
    movieId: { $in: favoriteMovieIds },
    action: { $in: ["liked", "rated", "watched"] },
  };

  if (currentUserId) {
    match.userId = { $ne: currentUserId };
  }

  const userIds = await interactions.distinct("userId", match);

  return uniqueObjectIds(userIds.filter((value): value is ObjectId => value instanceof ObjectId));
}

function uniqueObjectIds(values: ObjectId[]): ObjectId[] {
  const seen = new Set<string>();
  const unique: ObjectId[] = [];

  for (const value of values) {
    const key = objectIdToString(value);

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }

  return unique;
}
