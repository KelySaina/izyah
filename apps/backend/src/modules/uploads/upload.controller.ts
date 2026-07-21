import type { Request, Response } from 'express';
import { ApiError } from '../../utils/http';
import { putImage, type UploadKind } from './upload.service';

/** POST /uploads/:kind — store one image, return its public URL. */
export async function uploadImage(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('An image file is required');
  const result = await putImage(req.params.kind as UploadKind, req.file);
  res.status(201).json(result);
}
