import OpenAI from "openai";
import { env } from "../config/env";
import { ApiError } from "../middleware/error-handler";

let openaiClient: OpenAI | undefined;

function getOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(
      500,
      "OPENAI_API_KEY is required to generate text embeddings",
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export function hasOpenAIEmbeddingConfig(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

export async function createTextEmbedding(input: string): Promise<number[]> {
  const [embedding] = await createTextEmbeddings([input]);

  if (!embedding) {
    throw new ApiError(502, "OpenAI returned no embedding");
  }

  return embedding;
}

export async function createTextEmbeddings(
  inputs: string[],
): Promise<number[][]> {
  const cleanInputs = inputs.map(normalizeEmbeddingInput);

  if (cleanInputs.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: cleanInputs,
    ...(env.OPENAI_EMBEDDING_DIMENSIONS
      ? { dimensions: env.OPENAI_EMBEDDING_DIMENSIONS }
      : {}),
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export function buildMovieEmbeddingText(movie: {
  title?: string;
  plot?: string;
  fullplot?: string;
  genres?: string[];
  year?: number;
  cast?: string[];
  directors?: string[];
}): string {
  const parts = [
    movie.title ? `Title: ${movie.title}` : null,
    movie.year ? `Year: ${movie.year}` : null,
    movie.genres?.length ? `Genres: ${movie.genres.join(", ")}` : null,
    movie.directors?.length ? `Directors: ${movie.directors.join(", ")}` : null,
    movie.cast?.length ? `Cast: ${movie.cast.slice(0, 8).join(", ")}` : null,
    movie.plot || movie.fullplot
      ? `Story: ${movie.plot ?? movie.fullplot}`
      : null,
  ].filter(Boolean);

  return normalizeEmbeddingInput(parts.join("\n"));
}

function normalizeEmbeddingInput(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, 8000);
}
