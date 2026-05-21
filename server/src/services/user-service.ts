import { ObjectId } from "mongodb";
import { z } from "zod";
import { interactionsCollection, usersCollection } from "../db/collections";
import type { InteractionAction } from "../models/domain";
import { objectIdToString, parseObjectId } from "../utils/object-id";

export const createDemoUserSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Demo User"),
});

export const createInteractionSchema = z.object({
  userId: z.string().trim().min(1),
  movieId: z.string().trim().min(1),
  action: z.enum(["liked", "watched", "skipped", "rated"]),
  rating: z.number().min(0).max(10).optional(),
});

export async function createDemoUser(rawBody: unknown) {
  const body = createDemoUserSchema.parse(rawBody);
  const now = new Date();
  const collection = await usersCollection();

  const result = await collection.insertOne({
    _id: new ObjectId(),
    name: body.name,
    likedMovieIds: [],
    watchedMovieIds: [],
    createdAt: now,
    updatedAt: now,
  });

  return {
    user: {
      id: objectIdToString(result.insertedId),
      name: body.name,
      likedMovieIds: [],
      watchedMovieIds: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
}

export async function createInteraction(rawBody: unknown) {
  const body = createInteractionSchema.parse(rawBody);
  const userId = parseObjectId(body.userId, "userId");
  const movieId = parseObjectId(body.movieId, "movieId");
  const action = body.action as InteractionAction;
  const now = new Date();

  const users = await usersCollection();
  const interactions = await interactionsCollection();

  await interactions.insertOne({
    _id: new ObjectId(),
    userId,
    movieId,
    action,
    rating: body.rating,
    createdAt: now,
  });

  const update: Record<string, unknown> = {
    $set: { updatedAt: now },
  };

  if (action === "liked" || action === "rated") {
    update.$addToSet = { likedMovieIds: movieId };
  }

  if (action === "watched") {
    update.$addToSet = { watchedMovieIds: movieId };
  }

  await users.updateOne({ _id: userId }, update);

  return {
    interaction: {
      userId: objectIdToString(userId),
      movieId: objectIdToString(movieId),
      action,
      rating: body.rating ?? null,
      createdAt: now.toISOString(),
    },
  };
}
