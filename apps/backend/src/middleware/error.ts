import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/http';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';

/** 404 for unmatched routes. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/** Central error handler — the last middleware mounted. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Known application errors.
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details ?? undefined },
    });
  }

  // Zod (in case one slips past the validate middleware).
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Validation failed', details: err.flatten().fieldErrors },
    });
  }

  // Prisma constraint / lookup errors mapped to sensible HTTP codes.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: { message: 'Resource already exists' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { message: 'Resource not found' } });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: { message: 'Invalid reference' } });
    }
  }

  logger.error({ err }, 'unhandled error');
  return res.status(500).json({
    error: {
      message: 'Internal server error',
      ...(isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
    },
  });
};
