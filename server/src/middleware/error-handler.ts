import type { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Invalid request",
        details: error.flatten(),
      },
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof MongoServerError) {
    return res.status(500).json({
      error: {
        message: "MongoDB operation failed",
        details: error.message,
      },
    });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";

  return res.status(500).json({
    error: {
      message,
    },
  });
}
