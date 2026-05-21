# MoodFlix API Server

Express + TypeScript API server for the MoodFlix recommendation engine.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

The server listens on `http://localhost:4000` by default.

## Required MongoDB Atlas Setup

Create a Vector Search index on the configured movie collection.

For a custom `moodflix.movies` dataset:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

For `sample_mflix.embedded_movies`, use the embedding field configured in `.env`:

```env
MONGODB_DB_NAME=sample_mflix
MOVIES_COLLECTION=embedded_movies
MOVIE_EMBEDDING_FIELD=plot_embedding
VECTOR_INDEX_NAME=vector_index
```

Make sure the index name matches `VECTOR_INDEX_NAME`.

## API

```txt
GET  /health
GET  /api/system/readiness
GET  /api/embeddings/config
POST /api/embeddings/preview
GET  /api/movies
GET  /api/movies/search?q=
GET  /api/movies/meta
GET  /api/movies/:movieId
POST /api/users/demo
POST /api/interactions
POST /api/recommendations
GET  /api/recommendations/:userId/history
```

## Recommendation Request Example

```json
{
  "userId": "665f1dca6b3c2e8f52dd1001",
  "favoriteMovieIds": [
    "573a1390f29313caabcd4135",
    "573a1395f29313caabce2498"
  ],
  "limit": 10,
  "filters": {
    "genres": ["Drama", "Sci-Fi"],
    "minRating": 7
  }
}
```

You can also recommend from text-only preferences:

```json
{
  "preferenceText": "I want a thoughtful sci-fi movie with emotional family themes",
  "limit": 10
}
```

## OpenAI Embeddings

The API uses OpenAI embeddings when `preferenceText` is provided or when backfilling movie embeddings.

```env
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
MOVIE_EMBEDDING_FIELD=embedding
```

Backfill missing movie embeddings:

```bash
npm run embeddings:backfill
```

The Vector Search index dimension must match the embedding model output dimension. For the default `text-embedding-3-small` setup, use `1536` dimensions unless `OPENAI_EMBEDDING_DIMENSIONS` is configured differently.

## Dataset and Index Scripts

Seed the curated hackathon movie dataset:

```bash
npm run db:seed
```

Seed demo users and interactions for collaborative scoring:

```bash
npm run db:seed-demo-interactions
```

Create the MongoDB Vector Search index:

```bash
npm run db:create-vector-index
```

Check runtime readiness:

```bash
curl http://localhost:4000/api/system/readiness
```

The readiness endpoint verifies MongoDB connectivity, movie count, embedding coverage, Vector Search index status, and OpenAI embedding configuration.
