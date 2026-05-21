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
GET  /api/movies
GET  /api/movies/search?q=
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
