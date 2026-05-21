import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { createDemoUser, createInteraction } from "../services/user-service";

export const userRoutes = Router();

userRoutes.post(
  "/api/users/demo",
  asyncHandler(async (req, res) => {
    res.status(201).json(await createDemoUser(req.body));
  }),
);

userRoutes.post(
  "/api/interactions",
  asyncHandler(async (req, res) => {
    res.status(201).json(await createInteraction(req.body));
  }),
);
