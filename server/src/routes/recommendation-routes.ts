import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  getRecommendationHistory,
  recommendMovies,
} from "../services/recommendation-service";

export const recommendationRoutes = Router();

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
