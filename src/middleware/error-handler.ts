import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

interface HttpError extends Error {
  statusCode?: number;
  exposeMessage?: boolean;
  quota?: unknown;
  resetsAt?: unknown;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: 'Validation failed', errors: error.flatten() });
    return;
  }

  const httpError = error as HttpError;
  const status = typeof httpError?.statusCode === 'number' ? httpError.statusCode : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    message: status >= 500 && !httpError.exposeMessage ? 'Internal server error' : (httpError.message || 'Request failed'),
    ...(httpError.quota ? { quota: httpError.quota } : {}),
    ...(httpError.resetsAt ? { resetsAt: httpError.resetsAt } : {})
  });
};
