export interface Movie {
  id: string
  title: string
  plot: string | null
  genres: string[]
  year: number | null
  poster: string | null
  runtime: number | null
  imdbRating: number | null
  imdbVotes: number | null
  cast: string[]
  directors: string[]
}

export interface MovieMeta {
  totalMovies: number
  genres: Array<{
    name: string
    count: number
  }>
  years: {
    min: number | null
    max: number | null
  }
  ratings: {
    min: number | null
    max: number | null
  }
  sorts: string[]
}

export interface Readiness {
  status: "ready" | "needs_attention"
  database: {
    name: string
    connected: boolean
  }
  collections: {
    movies: {
      name: string
      count: number
      embeddedCount: number
      embeddingCoverage: number
      embeddingField: string
    }
    users: {
      name: string
      count: number
    }
    interactions: {
      name: string
      count: number
    }
    recommendationLogs: {
      name: string
      count: number
    }
  }
  vectorSearch: {
    indexName: string
    exists: boolean
    status: string | null
    queryable: boolean | null
    dimensions: number | string
    numCandidates: number
  }
  openai: {
    configured: boolean
    embeddingModel: string
  }
}

export interface Recommendation {
  id: string
  title: string
  plot: string | null
  genres: string[]
  year: number | null
  poster: string | null
  runtime: number | null
  imdbRating: number | null
  imdbVotes: number | null
  cast: string[]
  directors: string[]
  score: {
    final: number
    vector: number
    rating: number
    genreOverlap: number
    popularity: number
    collaborative: number
  }
  evidence: {
    similarViewerCount: number
    likedBySimilar: number
    watchedBySimilar: number
    ratedBySimilar: number
    averageBehaviorRating: number | null
    sources: string[]
  }
  explanation: string[]
}

export interface RecommendationResponse {
  input: {
    userId: string | null
    preferenceText: string | null
    favoriteMovies: Array<{
      id: string
      title: string
    }>
    preferredGenres: string[]
    collaborativeUserCount: number
    filters: Record<string, unknown>
  }
  scoringWeights: {
    vector: number
    rating: number
    genreOverlap: number
    popularity: number
    collaborative: number
  }
  candidateSources: {
    vectorCandidates: number
    behavioralCandidates: number
  }
  recommendations: Recommendation[]
}

export interface RecommendationHistory {
  items: Array<{
    id: string
    userId: string
    favoriteMovies: Array<{
      id: string
      title: string
    }>
    recommendedMovies: Array<{
      id: string
      title: string
    }>
    filters: Record<string, unknown>
    createdAt: string
  }>
}

export interface DemoUser {
  id: string
  name: string
  likedMovieIds: string[]
  watchedMovieIds: string[]
  createdAt: string
  updatedAt: string
}
