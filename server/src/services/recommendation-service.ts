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
import {
  objectIdToString,
  parseObjectId,
  parseObjectIds,
} from "../utils/object-id";
import { averageVectors } from "../utils/vector";

export const recommendationRequestSchema = z.object({
  userId: z.string().trim().optional(),
  favoriteMovieIds: z.array(z.string().trim().min(1)).min(1).optional(),
  preferenceText: z.string().trim().min(3).max(1000).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(env.DEFAULT_RECOMMENDATION_LIMIT),
  filters: z
    .object({
      genres: z.array(z.string().trim().min(1)).max(10).optional(),
      yearFrom: z.number().int().optional(),
      yearTo: z.number().int().optional(),
      minRating: z.number().min(0).max(10).optional(),
    })
    .default({}),
});

const scoringWeights = {
  vector: 0.42,
  rating: 0.12,
  genreOverlap: 0.08,
  popularity: 0.05,
  collaborative: 0.33,
} as const;

const positiveInteractionActions = ["liked", "rated", "watched"] as const;

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
  const preferredGenres = buildPreferredGenres(
    favoriteMovies,
    body.filters.genres,
  );
  const excludedMovieIds = uniqueObjectIds([
    ...favoriteMovieIds,
    ...(user?.watchedMovieIds ?? []),
  ]);
  const collaborativeUserIds = await findCollaborativeUserIds(
    favoriteMovieIds,
    userId,
  );

  const candidateLimit = Math.max(body.limit * 4, 24);
  const pipeline = buildRecommendationPipeline({
    queryVector,
    excludedMovieIds,
    preferredGenres,
    collaborativeUserIds,
    limit: candidateLimit,
    filters: body.filters,
  });

  const [vectorResults, behavioralResults] = await Promise.all([
    collection.aggregate<MovieDoc & ScoredMovie>(pipeline).toArray(),
    findBehavioralCandidates({
      favoriteMovieIds,
      excludedMovieIds,
      currentUserId: userId,
      preferredGenres,
      limit: candidateLimit,
      filters: body.filters,
    }),
  ]);
  const rawResults = mergeRecommendationCandidates(
    vectorResults,
    behavioralResults,
    body.limit,
  );
  const enrichedResults = rawResults.map((movie) =>
    addRecommendationExplanation(movie, preferredGenres),
  );
  const recommendations = enrichedResults.map(toRecommendedMovie);

  if (userId) {
    await (
      await recommendationLogsCollection()
    ).insertOne({
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
    scoringWeights,
    candidateSources: {
      vectorCandidates: vectorResults.length,
      behavioralCandidates: behavioralResults.length,
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
  similarViewerCount?: number;
  coLikeCount?: number;
  coWatchCount?: number;
  coRatingCount?: number;
  averageBehaviorRating?: number | null;
  evidenceSources?: string[];
  finalScore?: number;
  explanation?: string[];
}

function buildRecommendationPipeline(
  input: RecommendationPipelineInput,
): Document[] {
  const candidateLimit = Math.min(
    Math.max(input.limit, 1),
    env.VECTOR_NUM_CANDIDATES,
  );
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
          $ifNull: [
            "$imdb.rating",
            { $ifNull: ["$tomatoes.viewer.rating", 0] },
          ],
        },
        votesValue: {
          $ifNull: [
            "$imdb.votes",
            { $ifNull: ["$tomatoes.viewer.numReviews", 0] },
          ],
        },
        genreOverlapCount: {
          $size: {
            $setIntersection: [
              { $ifNull: ["$genres", []] },
              input.preferredGenres,
            ],
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
                  { $in: ["$action", positiveInteractionActions] },
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
        similarViewerCount: {
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
            { $multiply: ["$vectorScore", scoringWeights.vector] },
            { $multiply: ["$ratingScore", scoringWeights.rating] },
            { $multiply: ["$genreOverlapScore", scoringWeights.genreOverlap] },
            { $multiply: ["$popularityScore", scoringWeights.popularity] },
            {
              $multiply: ["$collaborativeScore", scoringWeights.collaborative],
            },
          ],
        },
        evidenceSources: ["vector_search", "aggregation_lookup"],
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

interface BehavioralCandidatesInput {
  favoriteMovieIds: ObjectId[];
  excludedMovieIds: ObjectId[];
  currentUserId?: ObjectId;
  preferredGenres: string[];
  limit: number;
  filters: RecommendationPipelineInput["filters"];
}

async function findBehavioralCandidates(
  input: BehavioralCandidatesInput,
): Promise<Array<MovieDoc & ScoredMovie>> {
  if (input.favoriteMovieIds.length === 0) {
    return [];
  }

  const interactions = await interactionsCollection();
  const genreDivisor = Math.max(Math.min(input.preferredGenres.length, 3), 1);
  const matchFavoriteInteractions: Document = {
    movieId: { $in: input.favoriteMovieIds },
    action: { $in: positiveInteractionActions },
  };

  if (input.currentUserId) {
    matchFavoriteInteractions.userId = { $ne: input.currentUserId };
  }

  const pipeline: Document[] = [
    {
      $match: matchFavoriteInteractions,
    },
    {
      $group: {
        _id: "$userId",
        overlapCount: { $sum: 1 },
        likedOverlap: {
          $sum: { $cond: [{ $eq: ["$action", "liked"] }, 1, 0] },
        },
      },
    },
    {
      $sort: {
        overlapCount: -1,
        likedOverlap: -1,
      },
    },
    {
      $limit: 50,
    },
    {
      $lookup: {
        from: env.INTERACTIONS_COLLECTION,
        let: {
          similarUserId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$similarUserId"] },
                  { $in: ["$action", positiveInteractionActions] },
                  { $not: [{ $in: ["$movieId", input.excludedMovieIds] }] },
                ],
              },
            },
          },
          {
            $project: {
              movieId: 1,
              action: 1,
              rating: 1,
            },
          },
        ],
        as: "candidateInteractions",
      },
    },
    {
      $unwind: "$candidateInteractions",
    },
    {
      $group: {
        _id: "$candidateInteractions.movieId",
        similarViewerIds: { $addToSet: "$_id" },
        overlapStrength: { $sum: "$overlapCount" },
        coLikeCount: {
          $sum: {
            $cond: [{ $eq: ["$candidateInteractions.action", "liked"] }, 1, 0],
          },
        },
        coWatchCount: {
          $sum: {
            $cond: [
              { $eq: ["$candidateInteractions.action", "watched"] },
              1,
              0,
            ],
          },
        },
        coRatingCount: {
          $sum: {
            $cond: [{ $eq: ["$candidateInteractions.action", "rated"] }, 1, 0],
          },
        },
        averageBehaviorRating: { $avg: "$candidateInteractions.rating" },
      },
    },
    {
      $addFields: {
        similarViewerCount: { $size: "$similarViewerIds" },
      },
    },
    {
      $addFields: {
        collaborativeScore: {
          $min: [
            1,
            {
              $divide: [
                {
                  $add: [
                    "$coLikeCount",
                    { $multiply: ["$coRatingCount", 0.8] },
                    { $multiply: ["$coWatchCount", 0.45] },
                    { $multiply: ["$overlapStrength", 0.2] },
                  ],
                },
                Math.max(input.favoriteMovieIds.length * 3, 1),
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: env.MOVIES_COLLECTION,
        localField: "_id",
        foreignField: "_id",
        as: "movie",
      },
    },
    {
      $unwind: "$movie",
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            "$movie",
            {
              collaborativeCount: "$similarViewerCount",
              collaborativeScore: "$collaborativeScore",
              similarViewerCount: "$similarViewerCount",
              coLikeCount: "$coLikeCount",
              coWatchCount: "$coWatchCount",
              coRatingCount: "$coRatingCount",
              averageBehaviorRating: "$averageBehaviorRating",
              evidenceSources: ["aggregation_collaborative_filtering"],
            },
          ],
        },
      },
    },
    {
      $match: buildRecommendationMatchFilter({
        queryVector: [],
        excludedMovieIds: input.excludedMovieIds,
        preferredGenres: input.preferredGenres,
        collaborativeUserIds: [],
        limit: input.limit,
        filters: input.filters,
      }),
    },
    {
      $addFields: {
        vectorScore: 0,
        ratingValue: {
          $ifNull: [
            "$imdb.rating",
            { $ifNull: ["$tomatoes.viewer.rating", 0] },
          ],
        },
        votesValue: {
          $ifNull: [
            "$imdb.votes",
            { $ifNull: ["$tomatoes.viewer.numReviews", 0] },
          ],
        },
        genreOverlapCount: {
          $size: {
            $setIntersection: [
              { $ifNull: ["$genres", []] },
              input.preferredGenres,
            ],
          },
        },
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
      },
    },
    {
      $addFields: {
        finalScore: {
          $add: [
            { $multiply: ["$vectorScore", scoringWeights.vector] },
            { $multiply: ["$ratingScore", scoringWeights.rating] },
            { $multiply: ["$genreOverlapScore", scoringWeights.genreOverlap] },
            { $multiply: ["$popularityScore", scoringWeights.popularity] },
            {
              $multiply: ["$collaborativeScore", scoringWeights.collaborative],
            },
          ],
        },
      },
    },
    {
      $sort: {
        finalScore: -1,
        collaborativeScore: -1,
        similarViewerCount: -1,
      },
    },
    {
      $limit: input.limit,
    },
    {
      $project: {
        [env.MOVIE_EMBEDDING_FIELD]: 0,
        movie: 0,
        similarViewerIds: 0,
      },
    },
  ];

  return interactions.aggregate<MovieDoc & ScoredMovie>(pipeline).toArray();
}

function mergeRecommendationCandidates(
  vectorResults: Array<MovieDoc & ScoredMovie>,
  behavioralResults: Array<MovieDoc & ScoredMovie>,
  limit: number,
): Array<MovieDoc & ScoredMovie> {
  const merged = new Map<string, MovieDoc & ScoredMovie>();

  for (const movie of [...vectorResults, ...behavioralResults]) {
    const key = objectIdToString(movie._id);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, recomputeFinalScore(movie));
      continue;
    }

    merged.set(
      key,
      recomputeFinalScore({
        ...existing,
        vectorScore: Math.max(
          existing.vectorScore ?? 0,
          movie.vectorScore ?? 0,
        ),
        ratingScore: Math.max(
          existing.ratingScore ?? 0,
          movie.ratingScore ?? 0,
        ),
        genreOverlapScore: Math.max(
          existing.genreOverlapScore ?? 0,
          movie.genreOverlapScore ?? 0,
        ),
        popularityScore: Math.max(
          existing.popularityScore ?? 0,
          movie.popularityScore ?? 0,
        ),
        collaborativeScore: Math.max(
          existing.collaborativeScore ?? 0,
          movie.collaborativeScore ?? 0,
        ),
        collaborativeCount: Math.max(
          existing.collaborativeCount ?? 0,
          movie.collaborativeCount ?? 0,
        ),
        similarViewerCount: Math.max(
          existing.similarViewerCount ?? 0,
          movie.similarViewerCount ?? 0,
        ),
        coLikeCount: Math.max(
          existing.coLikeCount ?? 0,
          movie.coLikeCount ?? 0,
        ),
        coWatchCount: Math.max(
          existing.coWatchCount ?? 0,
          movie.coWatchCount ?? 0,
        ),
        coRatingCount: Math.max(
          existing.coRatingCount ?? 0,
          movie.coRatingCount ?? 0,
        ),
        averageBehaviorRating:
          movie.averageBehaviorRating ?? existing.averageBehaviorRating,
        evidenceSources: [
          ...new Set([
            ...(existing.evidenceSources ?? []),
            ...(movie.evidenceSources ?? []),
          ]),
        ],
      }),
    );
  }

  return [...merged.values()]
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
    .slice(0, limit);
}

function recomputeFinalScore<T extends ScoredMovie>(movie: T): T {
  return {
    ...movie,
    finalScore:
      (movie.vectorScore ?? 0) * scoringWeights.vector +
      (movie.ratingScore ?? 0) * scoringWeights.rating +
      (movie.genreOverlapScore ?? 0) * scoringWeights.genreOverlap +
      (movie.popularityScore ?? 0) * scoringWeights.popularity +
      (movie.collaborativeScore ?? 0) * scoringWeights.collaborative,
  };
}

function buildRecommendationMatchFilter(
  input: RecommendationPipelineInput,
): Filter<MovieDoc> {
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

function buildPreferredGenres(
  movies: MovieDoc[],
  filterGenres?: string[],
): string[] {
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
    explanations.push(
      "Matches the semantic profile of your request or favorite movies",
    );
  }

  if (matchingGenres.length > 0) {
    explanations.push(
      `Matches preferred genres: ${matchingGenres.slice(0, 3).join(", ")}`,
    );
  }

  if (typeof rating === "number" && rating >= 7) {
    explanations.push(`Strong audience signal with IMDb rating ${rating}`);
  }

  if (typeof votes === "number" && votes >= 10000) {
    explanations.push("Popular movie with broad audience validation");
  }

  const similarViewerCount =
    typeof movie.similarViewerCount === "number"
      ? movie.similarViewerCount
      : movie.collaborativeCount;

  if (typeof similarViewerCount === "number" && similarViewerCount > 0) {
    explanations.push(
      `Behavioral match from Aggregation Pipeline: ${similarViewerCount} similar viewer${similarViewerCount > 1 ? "s" : ""} liked, rated, or watched this`,
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
    action: { $in: positiveInteractionActions },
  };

  if (currentUserId) {
    match.userId = { $ne: currentUserId };
  }

  const userIds = await interactions.distinct("userId", match);

  return uniqueObjectIds(
    userIds.filter((value): value is ObjectId => value instanceof ObjectId),
  );
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
