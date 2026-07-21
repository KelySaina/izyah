import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ApiError } from '../utils/http';
import { isUuid } from '../utils/validation';

export const IDENTITY_HEADER = 'x-user-id';

/**
 * Resolve the anonymous identity from the `X-User-ID` header.
 *
 * Frictionless model: there are no login screens. The frontend bootstraps an
 * identity (POST /api/users) on first visit, stores it locally, and sends it
 * on every request. This middleware validates the header, touches lastSeenAt,
 * and attaches `req.userId` / `req.user`. It never rejects — routes that need
 * an identity use `requireIdentity` below.
 */
export const identity: RequestHandler = asyncHandler(async (req, _res, next) => {
  const headerId = req.header(IDENTITY_HEADER);
  if (headerId && isUuid(headerId)) {
    const user = await prisma.user
      .update({ where: { id: headerId }, data: { lastSeenAt: new Date() } })
      .catch(() => null);
    if (user) {
      req.userId = user.id;
      req.user = user;
    }
  }
  next();
});

/** Guard for routes that require a known identity. */
export const requireIdentity: RequestHandler = (req, _res, next) => {
  if (!req.userId) {
    throw ApiError.unauthorized('A valid X-User-ID header is required');
  }
  next();
};
