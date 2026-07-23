import { Router } from 'express';
import { asyncHandler } from '../../utils/http';
import { requireIdentity } from '../../middleware/identity';
import { anonymous, me } from './auth.controller';

export const authRouter = Router();

// Bootstrap is the only auth endpoint that needs no existing identity.
authRouter.post('/auth/anonymous', asyncHandler(anonymous));

authRouter.get('/auth/me', requireIdentity, asyncHandler(me));

// NOTE (M2 — OIDC account-linking, added once Logto is provisioned):
//   POST /auth/link    — attach a verified OIDC identity to the current user
//   POST /auth/logout  — drop back to anonymous
