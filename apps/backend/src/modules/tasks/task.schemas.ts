import { z } from 'zod';
import { sanitizedText, uuid } from '../../utils/validation';

export const createTaskSchema = z.object({
  title: sanitizedText(140),
});

export const updateTaskSchema = z
  .object({
    title: sanitizedText(140).optional(),
    status: z.enum(['OPEN', 'CLAIMED', 'DONE']).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

export const eventTaskParams = z.object({ eventId: uuid });
export const taskParams = z.object({ eventId: uuid, taskId: uuid });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
