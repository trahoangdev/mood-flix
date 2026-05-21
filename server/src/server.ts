import { env } from "./config/env";
import { closeMongoConnection } from "./db/mongo";
import { createApp } from "./app";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`MoodFlix API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down MoodFlix API`);
  server.close(async () => {
    await closeMongoConnection();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
