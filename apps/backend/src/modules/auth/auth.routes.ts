import { Router } from 'express';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { anonBootstrapLimiter } from '../../middleware/rateLimit';
import { linkSchema } from './auth.schemas';
import { anonymous, me, link, logout } from './auth.controller';

export const authRouter = Router();

// Bootstrap is the only auth endpoint that needs no existing identity.
authRouter.post('/auth/anonymous', anonBootstrapLimiter, asyncHandler(anonymous));

authRouter.get('/auth/me', requireIdentity, asyncHandler(me));

// Account-linking (M2 — Logto/OIDC). `link` is identity-OPTIONAL: an anonymous
// session (if present) is upgraded in place; otherwise it's a fresh sign-in.
authRouter.post('/auth/link', validate({ body: linkSchema }), asyncHandler(link));
authRouter.post('/auth/logout', asyncHandler(logout));
