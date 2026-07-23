import { z } from 'zod';
import { sanitizedText, optionalText } from '../../utils/validation';

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM')
  .optional();

const url = z.string().url().max(1024).optional();
const latitude = z.number().min(-90).max(90).optional();
const longitude = z.number().min(-180).max(180).optional();

export const createEventSchema = z.object({
  title: sanitizedText(120),
  description: optionalText(5000),
  date: z.coerce.date(),
  startTime: time,
  endTime: time,
  location: optionalText(200),
  latitude,
  longitude,
  coverImage: url,
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
});

export const updateEventSchema = z
  .object({
    title: sanitizedText(120).optional(),
    description: optionalText(5000),
    date: z.coerce.date().optional(),
    startTime: time,
    endTime: time,
    location: optionalText(200),
    latitude,
    longitude,
    coverImage: url,
    visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

export const listEventsQuerySchema = z.object({
  // `public` = discovery feed of upcoming PUBLIC events you're not already in.
  scope: z.enum(['mine', 'upcoming', 'past', 'public']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
