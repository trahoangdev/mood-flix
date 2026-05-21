import { Db, MongoClient } from "mongodb";
import { env } from "../config/env";

let client: MongoClient | undefined;
let db: Db | undefined;

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();
  }

  return client;
}

export async function getDb(): Promise<Db> {
  if (!db) {
    const mongoClient = await getMongoClient();
    db = mongoClient.db(env.MONGODB_DB_NAME);
  }

  return db;
}

export async function closeMongoConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
