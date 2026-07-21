import { z } from 'zod';
import { sanitizedText } from '../../utils/validation';

export const createMessageSchema = z.object({
  content: sanitizedText(2000),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.date().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
