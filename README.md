# MoodFlix

MoodFlix is a movie recommendation engine for the MUGVN x MongoDB Mini Hackathon 2026. It combines user intent, favorite movies, MongoDB Atlas Vector Search, and an Aggregation Pipeline collaborative-filtering branch built from demo user behavior.

## Stack

| Layer | Technology |
| --- | --- |
| Client | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Server | Express, TypeScript, MongoDB Node.js driver, Zod |
| Database | MongoDB Atlas |
| AI | OpenAI embeddings |

## Repository Layout

```txt
project/
├── client/     Next.js dashboard
├── server/     Express API and recommendation engine
├── docs/       Submission notes and setup references
└── README.md
```

## Quick Start

Prerequisites: Node.js 20+, MongoDB Atlas cluster, OpenAI API key.

```bash
cd server
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

```bash
cd client
pnpm install
copy .env.example .env.local
pnpm dev
```

Local URLs:

- Client: `http://localhost:3000/dashboard`
- Server: `http://localhost:4000`
- Health: `http://localhost:4000/health`
- Readiness: `http://localhost:4000/api/system/readiness`

## Data Setup

`npm run db:setup` from `server/` runs the full demo setup:

1. Seed curated movie documents.
2. Backfill OpenAI embeddings into `MOVIE_EMBEDDING_FIELD`.
3. Create the MongoDB Atlas Vector Search index.
4. Seed demo users and interactions for collaborative scoring.

The default Vector Search setup is:

| Setting | Value |
| --- | --- |
| Collection | `movies` |
| Vector field | `embedding` |
| Index name | `movie_vector_index` |
| Similarity | `cosine` |
| Dimensions | model default, usually `1536` for `text-embedding-3-small` |

## API Surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Basic API and MongoDB health |
| `GET` | `/api/system/readiness` | Dataset, embedding, index, OpenAI readiness |
| `GET` | `/api/embeddings/config` | Runtime embedding config |
| `POST` | `/api/embeddings/preview` | Generate a short embedding diagnostic |
| `GET` | `/api/movies` | Paginated movie list |
| `GET` | `/api/movies/search` | Movie search |
| `GET` | `/api/movies/meta` | Filter metadata |
| `POST` | `/api/users/demo` | Create a demo user |
| `POST` | `/api/interactions` | Record liked/watched/skipped/rated actions |
| `POST` | `/api/recommendations` | Generate blended Vector Search + collaborative recommendations |
| `GET` | `/api/recommendations/:userId/history` | Demo user recommendation history |

## MongoDB Requirement Mapping

| Requirement | MoodFlix implementation |
| --- | --- |
| Recommendation engine | Blended movie recommendation flow |
| User behavior | Demo user interactions: liked, watched, skipped, rated |
| Atlas Vector Search | `$vectorSearch` over movie embeddings |
| Aggregation Pipeline | Similar-user discovery, behavioral candidate generation, `$lookup`, `$group`, score normalization, final ranking |
| Explainability | Score breakdown and explanation bullets per result |

## Recommendation Engine Design

`POST /api/recommendations` now runs two recommendation branches:

1. **Semantic branch**: builds a query vector from preference text and favorite movie embeddings, then runs `$vectorSearch` over the movie collection.
2. **Behavioral branch**: starts from `interactions`, finds users who liked/rated/watched the same favorite movies, expands to movies those similar users also liked/rated/watched, then ranks those candidates with Aggregation Pipeline stages.

The final list merges both branches and weights behavior strongly:

| Signal | Weight |
| --- | ---: |
| Vector similarity | `0.42` |
| Collaborative behavior | `0.33` |
| Rating | `0.12` |
| Genre overlap | `0.08` |
| Popularity | `0.05` |

Each result includes `evidence.similarViewerCount`, behavior counts, score breakdown, and explanation text so the demo clearly shows where Vector Search and Aggregation Pipeline contribute.

## Verification

```bash
cd server
npm run typecheck
npm run lint
npm test
npm run build
```

```bash
cd client
npm run lint
npx tsc --noEmit -p tsconfig.json
npm run build
```
