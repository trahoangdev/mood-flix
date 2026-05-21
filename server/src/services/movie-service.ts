import type { Filter, Sort } from "mongodb";
import { z } from "zod";
import { moviesCollection } from "../db/collections";
import { ApiError } from "../middleware/error-handler";
import type { MovieDoc } from "../models/domain";
import { toMovieSummary } from "../utils/movie-mapper";
import { parseObjectId } from "../utils/object-id";

export const listMoviesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  skip: z.coerce.number().int().min(0).default(0),
  genre: z.string().trim().optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  sort: z
    .enum(["title", "year_desc", "rating_desc", "votes_desc"])
    .default("rating_desc"),
});

export const searchMoviesQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export async function listMovies(rawQuery: unknown) {
  const query = listMoviesQuerySchema.parse(rawQuery);
  const collection = await moviesCollection();
  const filter = buildMovieFilter(query);

  const [items, total] = await Promise.all([
    collection
      .find(filter, { projection: movieSummaryProjection() })
      .sort(buildSort(query.sort))
      .skip(query.skip)
      .limit(query.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    items: items.map(toMovieSummary),
    pagination: {
      total,
      limit: query.limit,
      skip: query.skip,
      hasMore: query.skip + items.length < total,
    },
  };
}

export async function searchMovies(rawQuery: unknown) {
  const query = searchMoviesQuerySchema.parse(rawQuery);
  const collection = await moviesCollection();
  const escaped = escapeRegex(query.q);
  const regex = new RegExp(escaped, "i");

  const filter: Filter<MovieDoc> = {
    $or: [
      { title: regex },
      { plot: regex },
      { fullplot: regex },
      { genres: regex },
      { cast: regex },
      { directors: regex },
    ],
  };

  const items = await collection
    .find(filter, { projection: movieSummaryProjection() })
    .sort({ "imdb.rating": -1, "imdb.votes": -1, year: -1 })
    .limit(query.limit)
    .toArray();

  return {
    items: items.map(toMovieSummary),
  };
}

export async function getMovieById(movieIdValue: string) {
  const movieId = parseObjectId(movieIdValue, "movieId");
  const collection = await moviesCollection();
  const movie = await collection.findOne(
    { _id: movieId },
    { projection: movieSummaryProjection() },
  );

  if (!movie) {
    throw new ApiError(404, "Movie not found");
  }

  return {
    movie: toMovieSummary(movie),
  };
}

export async function getMovieMeta() {
  const collection = await moviesCollection();
  const [genreRows, yearBounds, ratingBounds, total] = await Promise.all([
    collection
      .aggregate<{
        _id: string;
        count: number;
      }>([
        { $unwind: "$genres" },
        { $group: { _id: "$genres", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ])
      .toArray(),
    collection
      .aggregate<{ minYear: number; maxYear: number }>([
        {
          $group: {
            _id: null,
            minYear: { $min: "$year" },
            maxYear: { $max: "$year" },
          },
        },
      ])
      .next(),
    collection
      .aggregate<{ minRating: number; maxRating: number }>([
        {
          $group: {
            _id: null,
            minRating: { $min: "$imdb.rating" },
            maxRating: { $max: "$imdb.rating" },
          },
        },
      ])
      .next(),
    collection.countDocuments(),
  ]);

  return {
    totalMovies: total,
    genres: genreRows.map((row) => ({
      name: row._id,
      count: row.count,
    })),
    years: {
      min: yearBounds?.minYear ?? null,
      max: yearBounds?.maxYear ?? null,
    },
    ratings: {
      min: ratingBounds?.minRating ?? null,
      max: ratingBounds?.maxRating ?? null,
    },
    sorts: ["rating_desc", "votes_desc", "year_desc", "title"],
  };
}

function buildMovieFilter(
  query: z.infer<typeof listMoviesQuerySchema>,
): Filter<MovieDoc> {
  const filter: Filter<MovieDoc> = {};

  if (query.genre) {
    filter.genres = query.genre;
  }

  if (query.yearFrom || query.yearTo) {
    filter.year = {};

    if (query.yearFrom) {
      filter.year.$gte = query.yearFrom;
    }

    if (query.yearTo) {
      filter.year.$lte = query.yearTo;
    }
  }

  if (typeof query.minRating === "number") {
    filter["imdb.rating"] = { $gte: query.minRating };
  }

  return filter;
}

function buildSort(sort: z.infer<typeof listMoviesQuerySchema>["sort"]): Sort {
  switch (sort) {
    case "title":
      return { title: 1 };
    case "year_desc":
      return { year: -1, "imdb.rating": -1 };
    case "votes_desc":
      return { "imdb.votes": -1, "imdb.rating": -1 };
    case "rating_desc":
    default:
      return { "imdb.rating": -1, "imdb.votes": -1, year: -1 };
  }
}

function movieSummaryProjection() {
  return {
    title: 1,
    plot: 1,
    fullplot: 1,
    genres: 1,
    year: 1,
    poster: 1,
    runtime: 1,
    cast: 1,
    directors: 1,
    imdb: 1,
    tomatoes: 1,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
