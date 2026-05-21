"use client"

import * as React from "react"
import Image from "next/image"
import {
  Brain,
  Check,
  Clapperboard,
  Clock3,
  Database,
  Eye,
  Film,
  GitMerge,
  Heart,
  Loader2,
  Play,
  Route,
  Search,
  Server,
  Sparkles,
  Star,
  ThumbsUp,
  Users,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  createDemoUser,
  createInteraction,
  getMovieMeta,
  getRecommendationHistory,
  getReadiness,
  listMovies,
  recommendMovies,
  searchMovies,
} from "@/lib/moodflix/api"
import type {
  DemoUser,
  Movie,
  MovieMeta,
  Readiness,
  Recommendation,
  RecommendationHistory,
  RecommendationResponse,
} from "@/lib/moodflix/types"

const DEFAULT_PROMPT =
  "I want an emotional science fiction movie about memory, family, and human connection."

function parseOptionalYear(value: string): number | undefined {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  const year = Number(trimmed)

  return Number.isInteger(year) ? year : undefined
}

export function MoodflixDashboard() {
  const [readiness, setReadiness] = React.useState<Readiness | null>(null)
  const [meta, setMeta] = React.useState<MovieMeta | null>(null)
  const [movies, setMovies] = React.useState<Movie[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedMovies, setSelectedMovies] = React.useState<Movie[]>([])
  const [preferenceText, setPreferenceText] = React.useState(DEFAULT_PROMPT)
  const [genre, setGenre] = React.useState("all")
  const [minRating, setMinRating] = React.useState("7")
  const [yearFrom, setYearFrom] = React.useState("")
  const [yearTo, setYearTo] = React.useState("")
  const [demoUser, setDemoUser] = React.useState<DemoUser | null>(null)
  const [recommendation, setRecommendation] =
    React.useState<RecommendationResponse | null>(null)
  const [history, setHistory] = React.useState<RecommendationHistory["items"]>([])
  const [movieActionStatus, setMovieActionStatus] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [searching, setSearching] = React.useState(false)
  const [recommending, setRecommending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        setLoading(true)
        setError(null)
        const [readinessData, metaData, moviesData] = await Promise.all([
          getReadiness(),
          getMovieMeta(),
          listMovies(new URLSearchParams({ limit: "12", sort: "rating_desc" })),
        ])

        if (cancelled) {
          return
        }

        setReadiness(readinessData)
        setMeta(metaData)
        setMovies(moviesData.items)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load MoodFlix data")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitialData()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSearch() {
    const query = searchQuery.trim()

    if (!query) {
      const data = await listMovies(new URLSearchParams({ limit: "12", sort: "rating_desc" }))
      setMovies(data.items)
      return
    }

    try {
      setSearching(true)
      setError(null)
      const data = await searchMovies(query)
      setMovies(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  function toggleSelectedMovie(movie: Movie) {
    setSelectedMovies((current) => {
      const exists = current.some((item) => item.id === movie.id)

      if (exists) {
        return current.filter((item) => item.id !== movie.id)
      }

      return [...current, movie].slice(0, 5)
    })
  }

  async function ensureDemoUser() {
    if (demoUser) {
      return demoUser
    }

    const response = await createDemoUser("MoodFlix Demo User")
    setDemoUser(response.user)
    return response.user
  }

  async function refreshHistory(userId: string) {
    const response = await getRecommendationHistory(userId)
    setHistory(response.items)
  }

  async function handleMovieAction(
    movie: Movie,
    action: "liked" | "watched" | "skipped" | "rated",
    rating?: number,
  ) {
    try {
      setError(null)
      const user = await ensureDemoUser()
      await createInteraction({
        userId: user.id,
        movieId: movie.id,
        action,
        rating,
      })
      if (action === "liked" || action === "rated") {
        setSelectedMovies((current) => {
          const exists = current.some((item) => item.id === movie.id)
          return exists ? current : [...current, movie].slice(0, 5)
        })
      }
      setMovieActionStatus((current) => ({
        ...current,
        [movie.id]:
          action === "liked"
            ? "Liked signal saved"
            : action === "watched"
              ? "Watched signal saved"
              : action === "rated"
                ? "9/10 rating saved"
                : "Skipped signal saved",
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record interaction")
    }
  }

  async function handleRecommend() {
    if (selectedMovies.length === 0 && preferenceText.trim().length < 3) {
      setError("Select at least one movie or describe what you want to watch.")
      return
    }

    try {
      setRecommending(true)
      setError(null)
      const user = await ensureDemoUser()
      const favoriteMovieIds = selectedMovies.map((movie) => movie.id)
      const response = await recommendMovies({
        userId: user.id,
        favoriteMovieIds: favoriteMovieIds.length > 0 ? favoriteMovieIds : undefined,
        preferenceText: preferenceText.trim() || undefined,
        limit: 8,
        filters: {
          genres: genre === "all" ? undefined : [genre],
          minRating: minRating === "all" ? undefined : Number(minRating),
          yearFrom: parseOptionalYear(yearFrom),
          yearTo: parseOptionalYear(yearTo),
        },
      })
      setRecommendation(response)
      await refreshHistory(user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recommendation failed")
    } finally {
      setRecommending(false)
    }
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">MoodFlix</h1>
              <Badge variant={readiness?.status === "ready" ? "default" : "secondary"}>
                {readiness?.status === "ready" ? "Ready" : "Checking"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Movie recommendations powered by MongoDB Vector Search, Aggregation Pipeline,
              and OpenAI embeddings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricBadge icon={Database} label="Movies" value={readiness?.collections.movies.count} />
            <MetricBadge
              icon={Brain}
              label="Embeddings"
              value={readiness?.collections.movies.embeddedCount}
            />
            <MetricBadge
              icon={Users}
              label="Signals"
              value={readiness?.collections.interactions.count}
            />
          </div>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6">
        {error && (
          <Card className="mb-4 border-destructive/50">
            <CardContent className="text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  Recommendation request
                </CardTitle>
                <CardDescription>
                  Combine favorite movies with a mood or preference prompt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preference">Preference text</Label>
                  <Textarea
                    id="preference"
                    value={preferenceText}
                    onChange={(event) => setPreferenceText(event.target.value)}
                    className="min-h-24"
                    placeholder="Describe what you want to watch..."
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Genre filter</Label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All genres" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All genres</SelectItem>
                        {meta?.genres.map((item) => (
                          <SelectItem key={item.name} value={item.name}>
                            {item.name} ({item.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum rating</Label>
                    <Select value={minRating} onValueChange={setMinRating}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Any rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any rating</SelectItem>
                        <SelectItem value="6">6.0+</SelectItem>
                        <SelectItem value="7">7.0+</SelectItem>
                        <SelectItem value="8">8.0+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year-from">Year from</Label>
                    <Input
                      id="year-from"
                      inputMode="numeric"
                      value={yearFrom}
                      onChange={(event) => setYearFrom(event.target.value)}
                      placeholder={meta?.years.min ? String(meta.years.min) : "Any"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year-to">Year to</Label>
                    <Input
                      id="year-to"
                      inputMode="numeric"
                      value={yearTo}
                      onChange={(event) => setYearTo(event.target.value)}
                      placeholder={meta?.years.max ? String(meta.years.max) : "Any"}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Selected favorites</p>
                      <p className="text-muted-foreground text-xs">
                        {selectedMovies.length}/5 movies used as behavior signals.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedMovies([])}
                      disabled={selectedMovies.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex min-h-8 flex-wrap gap-2">
                    {selectedMovies.length === 0 ? (
                      <span className="text-muted-foreground text-sm">
                        Select or like movies from the discovery list.
                      </span>
                    ) : (
                      selectedMovies.map((movie) => (
                        <Badge
                          key={movie.id}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => toggleSelectedMovie(movie)}
                        >
                          {movie.title}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={handleRecommend}
                  disabled={recommending || loading}
                >
                  {recommending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  Generate recommendations
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="size-5" />
                  Movie discovery
                </CardTitle>
                <CardDescription>
                  Search movies, select favorites, or record demo interactions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleSearch()
                      }
                    }}
                    placeholder="Search Arrival, Inception, Coco..."
                  />
                  <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
                    {searching ? <Loader2 className="animate-spin" /> : <Search />}
                    Search
                  </Button>
                </div>

                {loading ? (
                  <MovieGridSkeleton />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {movies.map((movie) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        selected={selectedMovies.some((item) => item.id === movie.id)}
                        actionStatus={movieActionStatus[movie.id]}
                        onToggle={() => toggleSelectedMovie(movie)}
                        onAction={(action, rating) =>
                          void handleMovieAction(movie, action, rating)
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <SystemCard readiness={readiness} demoUser={demoUser} />
            <RecommendationPanel
              recommendation={recommendation}
              history={history}
              loading={recommending}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function MetricBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | undefined
}) {
  return (
    <div className="bg-card text-card-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm">
      <Icon className="text-muted-foreground size-4" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "-"}</span>
    </div>
  )
}

function MovieCard({
  movie,
  selected,
  actionStatus,
  onToggle,
  onAction,
}: {
  movie: Movie
  selected: boolean
  actionStatus?: string
  onToggle: () => void
  onAction: (
    action: "liked" | "watched" | "skipped" | "rated",
    rating?: number,
  ) => void
}) {
  return (
    <div
      className={cn(
        "bg-card grid grid-cols-[72px_1fr] gap-3 rounded-lg border p-3 shadow-sm transition-colors",
        selected && "border-primary",
      )}
    >
      <Poster movie={movie} className="h-28 w-[72px]" />
      <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">{movie.title}</h3>
            <p className="text-muted-foreground text-xs">
              {[movie.year, movie.runtime ? `${movie.runtime}m` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {movie.imdbRating ? (
            <Badge variant="outline">
              <Star className="fill-current" />
              {movie.imdbRating}
            </Badge>
          ) : null}
        </div>

        <p className="text-muted-foreground line-clamp-2 text-xs">{movie.plot}</p>

        <div className="flex flex-wrap gap-1">
          {movie.genres.slice(0, 3).map((genre) => (
            <Badge key={genre} variant="secondary">
              {genre}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            title="Use this movie as a favorite input for Vector Search"
            onClick={onToggle}
          >
            {selected ? <Check /> : <Film />}
            {selected ? "Selected" : "Select"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Save a liked interaction and use it as a favorite signal"
            onClick={() => onAction("liked", 9)}
          >
            <Heart />
            Like
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Mark ${movie.title} as watched`}
            title="Save a watched interaction so recommendations can avoid or learn from it"
            onClick={() => onAction("watched")}
          >
            <Eye />
            <span className="sr-only">Watched</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Rate ${movie.title} 9 out of 10`}
            title="Save a 9/10 rating interaction"
            onClick={() => onAction("rated", 9)}
          >
            <Star />
            <span className="sr-only">Rate 9/10</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Skip ${movie.title}`}
            title="Save a skipped interaction"
            onClick={() => onAction("skipped")}
          >
            <XCircle />
            <span className="sr-only">Skip</span>
          </Button>
        </div>

        <div className="text-muted-foreground flex min-h-5 flex-wrap gap-1 text-xs">
          {selected ? <Badge variant="secondary">Favorite input</Badge> : null}
          {actionStatus ? <Badge variant="outline">{actionStatus}</Badge> : null}
        </div>
      </div>
    </div>
  )
}

function RecommendationPanel({
  recommendation,
  history,
  loading,
}: {
  recommendation: RecommendationResponse | null
  history: RecommendationHistory["items"]
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clapperboard className="size-5" />
          Recommendations
        </CardTitle>
        <CardDescription>
          Ranked by vector similarity, scoring signals, and collaborative behavior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : recommendation ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Signal label="Similar viewers" value={recommendation.input.collaborativeUserCount} />
              <Signal
                label="Behavior candidates"
                value={recommendation.candidateSources.behavioralCandidates}
              />
              <Signal
                label="Vector candidates"
                value={recommendation.candidateSources.vectorCandidates}
              />
              <Signal label="Results" value={recommendation.recommendations.length} />
            </div>
            <Separator />
            <PipelineExplanation recommendation={recommendation} />
            <Separator />
            <div className="space-y-3">
              {recommendation.recommendations.map((movie, index) => (
                <RecommendationCard key={movie.id} movie={movie} rank={index + 1} />
              ))}
            </div>
            <HistoryList history={history} />
          </>
        ) : (
          <div className="text-muted-foreground flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm">
            <Sparkles className="size-8" />
            <p>Generate recommendations to see ranked movie matches here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PipelineExplanation({
  recommendation,
}: {
  recommendation: RecommendationResponse
}) {
  const vectorWeight = Math.round(recommendation.scoringWeights.vector * 100)
  const behaviorWeight = Math.round(recommendation.scoringWeights.collaborative * 100)
  const qualityWeight = Math.round(
    (recommendation.scoringWeights.rating +
      recommendation.scoringWeights.genreOverlap +
      recommendation.scoringWeights.popularity) *
      100,
  )
  const behaviorActive = recommendation.candidateSources.behavioralCandidates > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Route className="size-4" />
        How the engine ranked this
      </div>
      <div className="grid gap-2">
        <PipelineStep
          icon={Sparkles}
          label="Semantic search"
          value={`${recommendation.candidateSources.vectorCandidates} candidates`}
          body="MongoDB Vector Search matched your mood text and favorite movie embeddings against movie vectors."
        />
        <PipelineStep
          icon={Users}
          label="Behavior matching"
          value={
            behaviorActive
              ? `${recommendation.candidateSources.behavioralCandidates} candidates`
              : "No behavior candidates"
          }
          body={
            behaviorActive
              ? "Aggregation Pipeline found viewers with overlapping likes, then expanded to movies they liked, rated, or watched."
              : "Select or like favorite movies first to unlock similar-viewer collaborative filtering."
          }
        />
        <PipelineStep
          icon={GitMerge}
          label="Blended ranking"
          value={`${vectorWeight}% vector / ${behaviorWeight}% behavior / ${qualityWeight}% quality`}
          body="The final score merges semantic similarity, collaborative behavior, IMDb rating, genre overlap, and popularity."
        />
      </div>
    </div>
  )
}

function PipelineStep({
  icon: Icon,
  label,
  value,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  body: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="text-primary size-4" />
          {label}
        </div>
        <Badge variant="secondary">{value}</Badge>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{body}</p>
    </div>
  )
}

function HistoryList({ history }: { history: RecommendationHistory["items"] }) {
  if (history.length === 0) {
    return null
  }

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock3 className="size-4" />
          Recent runs
        </div>
        <div className="space-y-2">
          {history.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-xs">
              <div className="text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </div>
              <div className="mt-1 font-medium">
                {item.recommendedMovies
                  .slice(0, 3)
                  .map((movie) => movie.title)
                  .join(", ") || "No recommendations"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function RecommendationCard({ movie, rank }: { movie: Recommendation; rank: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex gap-3">
        <Poster movie={movie} className="h-24 w-16" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge>{rank}</Badge>
                <h3 className="truncate text-sm font-medium">{movie.title}</h3>
              </div>
              <p className="text-muted-foreground text-xs">
                Final score {(movie.score.final * 100).toFixed(1)}
              </p>
            </div>
            <Badge variant="outline">
              <Star className="fill-current" />
              {movie.imdbRating ?? "-"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-1 text-xs">
            <Score label="Vector" value={movie.score.vector} />
            <Score label="Behavior" value={movie.score.collaborative} />
            <Score label="Genre" value={movie.score.genreOverlap} />
            <Score label="Rating" value={movie.score.rating} />
          </div>

          {movie.evidence.similarViewerCount > 0 ? (
            <div className="text-muted-foreground flex flex-wrap gap-1 text-xs">
              <Badge variant="secondary">
                {movie.evidence.similarViewerCount} similar viewers
              </Badge>
              <Badge variant="outline">{movie.evidence.likedBySimilar} likes</Badge>
              <Badge variant="outline">{movie.evidence.watchedBySimilar} watched</Badge>
              {movie.evidence.ratedBySimilar > 0 ? (
                <Badge variant="outline">{movie.evidence.ratedBySimilar} ratings</Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
        {movie.explanation.map((item) => (
          <li key={item} className="flex gap-2">
            <ThumbsUp className="mt-0.5 size-3 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SystemCard({
  readiness,
  demoUser,
}: {
  readiness: Readiness | null
  demoUser: DemoUser | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-5" />
          System status
        </CardTitle>
        <CardDescription>Backend readiness for the hackathon demo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <StatusRow label="MongoDB" value={readiness?.database.name} ok={readiness?.database.connected} />
        <StatusRow
          label="Vector index"
          value={readiness?.vectorSearch.status ?? "Unknown"}
          ok={readiness?.vectorSearch.queryable === true}
        />
        <StatusRow
          label="OpenAI"
          value={readiness?.openai.embeddingModel}
          ok={readiness?.openai.configured}
        />
        <StatusRow
          label="Demo user"
          value={demoUser?.name ?? "Created on first action"}
          ok={Boolean(demoUser)}
        />
      </CardContent>
    </Card>
  )
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string
  value: string | undefined
  ok: boolean | undefined
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-right font-medium">
        <span
          className={cn(
            "size-2 rounded-full",
            ok ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
        {value ?? "-"}
      </span>
    </div>
  )
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{(value * 100).toFixed(0)}</span>
    </div>
  )
}

function Poster({
  movie,
  className,
}: {
  movie: Pick<Movie, "title" | "poster">
  className?: string
}) {
  if (!movie.poster) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-md border",
          className,
        )}
      >
        <Play className="size-5" />
      </div>
    )
  }

  return (
    <Image
      unoptimized
      src={movie.poster}
      alt={`${movie.title} poster`}
      width={72}
      height={112}
      className={cn("shrink-0 rounded-md border object-cover", className)}
    />
  )
}

function MovieGridSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-lg" />
      ))}
    </div>
  )
}
