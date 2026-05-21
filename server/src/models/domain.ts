import type { ObjectId } from "mongodb";

export type InteractionAction = "liked" | "watched" | "skipped" | "rated";

export interface MovieDoc {
  _id: ObjectId;
  title?: string;
  plot?: string;
  fullplot?: string;
  genres?: string[];
  year?: number;
  poster?: string;
  runtime?: number;
  cast?: string[];
  directors?: string[];
  imdb?: {
    rating?: number;
    votes?: number;
  };
  tomatoes?: {
    viewer?: {
      rating?: number;
      numReviews?: number;
    };
  };
  [key: string]: unknown;
}

export interface UserDoc {
  _id: ObjectId;
  name: string;
  likedMovieIds: ObjectId[];
  watchedMovieIds: ObjectId[];
  isSeedUser?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InteractionDoc {
  _id: ObjectId;
  userId: ObjectId;
  movieId: ObjectId;
  action: InteractionAction;
  rating?: number;
  createdAt: Date;
}

export interface RecommendationLogDoc {
  _id: ObjectId;
  userId?: ObjectId;
  preferenceText?: string;
  favoriteMovieIds: ObjectId[];
  recommendedMovieIds: ObjectId[];
  filters?: Record<string, unknown>;
  createdAt: Date;
}

export interface MovieSummary {
  id: string;
  title: string;
  plot: string | null;
  genres: string[];
  year: number | null;
  poster: string | null;
  runtime: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  cast: string[];
  directors: string[];
}

export interface RecommendedMovie extends MovieSummary {
  score: {
    final: number;
    vector: number;
    rating: number;
    genreOverlap: number;
    popularity: number;
    collaborative: number;
  };
  evidence: {
    similarViewerCount: number;
    likedBySimilar: number;
    watchedBySimilar: number;
    ratedBySimilar: number;
    averageBehaviorRating: number | null;
    sources: string[];
  };
  explanation: string[];
}
