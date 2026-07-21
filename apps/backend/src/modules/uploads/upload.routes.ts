import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { writeLimiter } from '../../middleware/rateLimit';
import { uploadImage } from './upload.controller';

export const uploadsRouter = Router();

// In-memory, images only, hard-capped at 5 MB (clients also compress first).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\//.test(file.mimetype)
      ? cb(null, true)
      : cb(ApiError.badRequest('Only image files are allowed')),
});

uploadsRouter.post(
  '/uploads/:kind',
  requireIdentity,
  writeLimiter,
  validate({ params: z.object({ kind: z.enum(['cover', 'avatar']) }) }),
  upload.single('file'),
  asyncHandler(uploadImage),
);
