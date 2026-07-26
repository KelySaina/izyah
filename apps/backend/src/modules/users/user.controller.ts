import type { Request, Response } from 'express';
import { createUser, getUserById, updateUser, getMyAnalytics, toMeDTO } from './user.service';

/** POST /users — bootstrap an anonymous identity (no header required). */
export async function bootstrap(req: Request, res: Response) {
  const user = await createUser(req.body);
  res.status(201).json(user);
}

/** GET /users/me — the caller's own identity (private projection). */
export async function me(req: Request, res: Response) {
  // `identity` middleware already loaded and touched the user.
  res.json(toMeDTO(req.user!));
}

/** PATCH /users/me — edit display name / avatar. */
export async function updateMe(req: Request, res: Response) {
  const user = await updateUser(req.userId!, req.body);
  res.json(user);
}

/** GET /users/:id — public profile of any user. */
export async function getById(req: Request, res: Response) {
  const user = await getUserById(req.params.id!);
  res.json(user);
}

/** GET /users/me/analytics — the caller's own hosting stats, aggregated
 *  across every event they've created. */
export async function myAnalytics(req: Request, res: Response) {
  const result = await getMyAnalytics(req.userId!);
  res.json(result);
}
