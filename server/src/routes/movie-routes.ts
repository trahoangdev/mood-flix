import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  getMovieById,
  getMovieMeta,
  listMovies,
  searchMovies,
} from "../services/movie-service";

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

movieRoutes.get(
  "/api/movies/meta",
  asyncHandler(async (_req, res) => {
    res.json(await getMovieMeta());
  }),
);

movieRoutes.get(
  "/api/movies/:movieId",
  asyncHandler(async (req, res) => {
    res.json(await getMovieById(req.params.movieId));
  }),
);
