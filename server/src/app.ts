import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { getCorsOrigin } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { healthRoutes } from "./routes/health-routes";
import { movieRoutes } from "./routes/movie-routes";
import { recommendationRoutes } from "./routes/recommendation-routes";
import { userRoutes } from "./routes/user-routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: getCorsOrigin(),
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use(healthRoutes);
  app.use(movieRoutes);
  app.use(userRoutes);
  app.use(recommendationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
