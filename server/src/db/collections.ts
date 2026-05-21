import type { Collection } from "mongodb";
import { env } from "../config/env";
import type {
  InteractionDoc,
  MovieDoc,
  RecommendationLogDoc,
  UserDoc,
} from "../models/domain";
import { getDb } from "./mongo";

export async function moviesCollection(): Promise<Collection<MovieDoc>> {
  return (await getDb()).collection<MovieDoc>(env.MOVIES_COLLECTION);
}

export async function usersCollection(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>(env.USERS_COLLECTION);
}

export async function interactionsCollection(): Promise<Collection<InteractionDoc>> {
  return (await getDb()).collection<InteractionDoc>(env.INTERACTIONS_COLLECTION);
}

export async function recommendationLogsCollection(): Promise<
  Collection<RecommendationLogDoc>
> {
  return (await getDb()).collection<RecommendationLogDoc>(
    env.RECOMMENDATION_LOGS_COLLECTION,
  );
}
