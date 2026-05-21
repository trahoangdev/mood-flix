import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  getRecommendationHistory,
  recommendMovies,
} from "../services/recommendation-service";

export const recommendationRoutes = Router();

recommendationRoutes.get("/api/recommendations", (_req, res) => {
  res.json({
    service: "moodflix-recommendations",
    generate: {
      method: "POST",
      path: "/api/recommendations",
      body: {
        userId: "optional ObjectId",
        favoriteMovieIds: ["optional movie ObjectId"],
        preferenceText:
          "optional natural language mood or preference, minimum 3 characters",
        limit: 8,
        filters: {
          genres: ["Drama", "Sci-Fi"],
          yearFrom: 2000,
          yearTo: 2024,
          minRating: 7,
        },
      },
    },
    history: {
      method: "GET",
      path: "/api/recommendations/:userId/history",
    },
    signals: {
      vectorSearch: "semantic similarity over movie embeddings",
      aggregationPipeline:
        "similar-user collaborative filtering from liked/rated/watched interactions",
    },
  });
});

recommendationRoutes.post(
  "/api/recommendations",
  asyncHandler(async (req, res) => {
    res.json(await recommendMovies(req.body));
  }),
);

recommendationRoutes.get(
  "/api/recommendations/:userId/history",
  asyncHandler(async (req, res) => {
    res.json(await getRecommendationHistory(req.params.userId));
  }),
);
