import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireIdentity } from '../../middleware/identity';
import { writeLimiter } from '../../middleware/rateLimit';
import { eventParamsSchema, listMediaQuerySchema } from './media.schemas';
import { list, upload as handleUpload } from './media.controller';

export const mediaRouter = Router();

// In-memory uploads, capped at 25MB, images and videos only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^(image|video)\//.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error('unsupported file type')),
});

mediaRouter.get(
  '/events/:eventId/media',
  requireIdentity,
  validate({ params: eventParamsSchema, query: listMediaQuerySchema }),
  asyncHandler(list),
);

mediaRouter.post(
  '/events/:eventId/media',
  requireIdentity,
  writeLimiter,
  validate({ params: eventParamsSchema }),
  upload.single('file'),
  asyncHandler(handleUpload),
);
