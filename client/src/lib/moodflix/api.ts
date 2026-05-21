import type {
  DemoUser,
  Movie,
  MovieMeta,
  Readiness,
  RecommendationResponse,
} from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with ${response.status}`

    try {
      const data = await response.json()
      message = data?.error?.message ?? message
    } catch {
      // Keep the generic message when the server did not return JSON.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export async function getReadiness() {
  return request<Readiness>("/api/system/readiness")
}

export async function getMovieMeta() {
  return request<MovieMeta>("/api/movies/meta")
}

export async function listMovies(params = new URLSearchParams({ limit: "12" })) {
  return request<{
    items: Movie[]
    pagination: {
      total: number
      limit: number
      skip: number
      hasMore: boolean
    }
  }>(`/api/movies?${params.toString()}`)
}

export async function searchMovies(query: string, limit = 8) {
  return request<{ items: Movie[] }>(
    `/api/movies/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  )
}

export async function createDemoUser(name: string) {
  return request<{ user: DemoUser }>("/api/users/demo", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export async function createInteraction(input: {
  userId: string
  movieId: string
  action: "liked" | "watched" | "skipped" | "rated"
  rating?: number
}) {
  return request<{
    interaction: {
      userId: string
      movieId: string
      action: string
      rating: number | null
      createdAt: string
    }
  }>("/api/interactions", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function recommendMovies(input: {
  userId?: string
  favoriteMovieIds?: string[]
  preferenceText?: string
  limit?: number
  filters?: {
    genres?: string[]
    yearFrom?: number
    yearTo?: number
    minRating?: number
  }
}) {
  return request<RecommendationResponse>("/api/recommendations", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
