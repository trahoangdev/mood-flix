import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { listMovies, searchMovies } from "../services/movie-service";

export const movieRoutes = Router();

movieRoutes.get(
  "/api/movies",
  asyncHandler(async (req, res) => {
    res.json(await listMovies(req.query));
  }),
);

movieRoutes.get(
  "/api/movies/search",
  asyncHandler(async (req, res) => {
    res.json(await searchMovies(req.query));
  }),
);
