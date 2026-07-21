import type { Request, Response } from 'express';
import { ApiError } from '../../utils/http';
import { listMedia, uploadMedia } from './media.service';

/** GET /events/:eventId/media */
export async function list(req: Request, res: Response) {
  const media = await listMedia(req.params.eventId!);
  res.json({ media });
}

/** POST /events/:eventId/media — multipart upload parsed by multer into req.file. */
export async function upload(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('file is required');
  const media = await uploadMedia({
    eventId: req.params.eventId!,
    userId: req.userId!,
    file: req.file,
  });
  res.status(201).json(media);
}
