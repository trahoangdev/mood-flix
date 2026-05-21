import { env } from "../config/env";
import type { MovieDoc, MovieSummary, RecommendedMovie } from "../models/domain";
import { objectIdToString } from "./object-id";

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

export function getMovieEmbedding(movie: MovieDoc): number[] | null {
  const value = getByPath(movie, env.MOVIE_EMBEDDING_FIELD);

  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  if (!value.every((item) => typeof item === "number")) {
    return null;
  }

  return value;
}

export function getMovieTitle(movie: MovieDoc): string {
  return movie.title?.trim() || "Untitled movie";
}

export function getMoviePlot(movie: MovieDoc): string | null {
  return movie.plot?.trim() || movie.fullplot?.trim() || null;
}

export function getMovieRating(movie: MovieDoc): number | null {
  if (typeof movie.imdb?.rating === "number") {
    return movie.imdb.rating;
  }

  if (typeof movie.tomatoes?.viewer?.rating === "number") {
    return movie.tomatoes.viewer.rating;
  }

  return null;
}

export function getMovieVotes(movie: MovieDoc): number | null {
  if (typeof movie.imdb?.votes === "number") {
    return movie.imdb.votes;
  }

  if (typeof movie.tomatoes?.viewer?.numReviews === "number") {
    return movie.tomatoes.viewer.numReviews;
  }

  return null;
}

export function toMovieSummary(movie: MovieDoc): MovieSummary {
  return {
    id: objectIdToString(movie._id),
    title: getMovieTitle(movie),
    plot: getMoviePlot(movie),
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    year: typeof movie.year === "number" ? movie.year : null,
    poster: typeof movie.poster === "string" ? movie.poster : null,
    runtime: typeof movie.runtime === "number" ? movie.runtime : null,
    imdbRating: getMovieRating(movie),
    imdbVotes: getMovieVotes(movie),
    cast: Array.isArray(movie.cast) ? movie.cast.slice(0, 6) : [],
    directors: Array.isArray(movie.directors) ? movie.directors : [],
  };
}

export function toRecommendedMovie(
  movie: MovieDoc & {
    vectorScore?: number;
    ratingScore?: number;
    genreOverlapScore?: number;
    popularityScore?: number;
    collaborativeScore?: number;
    finalScore?: number;
    explanation?: string[];
  },
): RecommendedMovie {
  return {
    ...toMovieSummary(movie),
    score: {
      final: roundScore(movie.finalScore),
      vector: roundScore(movie.vectorScore),
      rating: roundScore(movie.ratingScore),
      genreOverlap: roundScore(movie.genreOverlapScore),
      popularity: roundScore(movie.popularityScore),
      collaborative: roundScore(movie.collaborativeScore),
    },
    explanation: Array.isArray(movie.explanation) ? movie.explanation : [],
  };
}

function roundScore(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.round(value * 1000) / 1000;
}
