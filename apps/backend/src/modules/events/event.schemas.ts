import { z } from 'zod';
import { sanitizedText, optionalText } from '../../utils/validation';

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM')
  .optional();

const url = z.string().url().max(1024).optional();
const latitude = z.number().min(-90).max(90).optional();
const longitude = z.number().min(-180).max(180).optional();
// Nullable so a creator can explicitly clear a previously-set capacity.
const capacity = z.coerce.number().int().min(1).max(100000).nullable().optional();
const attendanceMode = z.enum(['NONE', 'MIN_PAF', 'TICKET']);
// Whole-currency-unit amounts — nullable so a mode switch away can clear them.
const minPafAmount = z.coerce.number().int().min(1).max(10_000_000).nullable().optional();
const ticketPrice = z.coerce.number().int().min(1).max(10_000_000).nullable().optional();
// Reminder lead time in minutes before the start (null = no reminder). Capped
// at 7 days. For date-only events the value only toggles the reminder on/off.
const reminderLeadMinutes = z.coerce.number().int().min(0).max(10_080).nullable().optional();

// Enforces that the amount field always travels together with the mode that
// needs it, in the SAME request — callers can't rely on a previously-stored
// amount surviving a mode change without resending it. Keeps this a
// self-contained request-shape check with no need to merge against the
// existing DB row.
function checkAttendanceShape(
  o: { attendanceMode?: 'NONE' | 'MIN_PAF' | 'TICKET'; minPafAmount?: number | null; ticketPrice?: number | null },
  ctx: z.RefinementCtx,
): void {
  const mode = o.attendanceMode ?? 'NONE';
  if (mode === 'MIN_PAF' && o.minPafAmount == null) {
    ctx.addIssue({ code: 'custom', message: 'minPafAmount is required for MIN_PAF events', path: ['minPafAmount'] });
  }
  if (mode === 'TICKET' && o.ticketPrice == null) {
    ctx.addIssue({ code: 'custom', message: 'ticketPrice is required for TICKET events', path: ['ticketPrice'] });
  }
  if (mode !== 'MIN_PAF' && o.minPafAmount != null) {
    ctx.addIssue({ code: 'custom', message: 'minPafAmount only applies to MIN_PAF events', path: ['minPafAmount'] });
  }
  if (mode !== 'TICKET' && o.ticketPrice != null) {
    ctx.addIssue({ code: 'custom', message: 'ticketPrice only applies to TICKET events', path: ['ticketPrice'] });
  }
}

export const createEventSchema = z
  .object({
    title: sanitizedText(120),
    description: optionalText(5000),
    date: z.coerce.date(),
    startTime: time,
    endTime: time,
    // Required — mirrors the frontend: publishing without saying where, or
    // without a conscious public/private choice, isn't allowed.
    location: sanitizedText(200),
    latitude,
    longitude,
    coverImage: url,
    capacity,
    visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']),
    attendanceMode: attendanceMode.default('NONE'),
    minPafAmount,
    ticketPrice,
    reminderLeadMinutes,
  })
  .superRefine(checkAttendanceShape);

export const updateEventSchema = z
  .object({
    title: sanitizedText(120).optional(),
    description: optionalText(5000),
    date: z.coerce.date().optional(),
    startTime: time,
    endTime: time,
    // Omittable (partial update), but can't be cleared to empty if present.
    location: sanitizedText(200).optional(),
    latitude,
    longitude,
    coverImage: url,
    capacity,
    visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
    // Omitted = leave attendance settings untouched. Present = full shape
    // (mode + its amount) validated below, same rule as create.
    attendanceMode: attendanceMode.optional(),
    minPafAmount,
    ticketPrice,
    reminderLeadMinutes,
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' })
  .superRefine((o, ctx) => {
    if (o.attendanceMode !== undefined || o.minPafAmount !== undefined || o.ticketPrice !== undefined) {
      checkAttendanceShape(o, ctx);
    }
  });

export const listEventsQuerySchema = z.object({
  // `public` = discovery feed of upcoming PUBLIC events you're not already in.
  scope: z.enum(['mine', 'upcoming', 'past', 'public']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
