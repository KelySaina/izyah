import { z } from 'zod';
import { sanitizedText, uuid } from '../../utils/validation';

export const createPollSchema = z.object({
  question: sanitizedText(200),
  options: z.array(sanitizedText(80)).min(2).max(10),
  closesAt: z.coerce.date().optional(),
});

export const voteSchema = z.object({
  optionId: uuid,
});

export type CreatePollInput = z.infer<typeof createPollSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
