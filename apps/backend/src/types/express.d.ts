import type { User } from '@prisma/client';

// Augment Express Request with the anonymous identity resolved from X-User-ID.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      user?: User;
    }
  }
}

export {};
