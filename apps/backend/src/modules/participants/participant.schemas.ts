import { z } from 'zod';

export const rsvpSchema = z.object({
  status: z.enum(['GOING', 'MAYBE', 'NOT_GOING']),
});

export const attendeePatchSchema = z
  .object({
    paid: z.boolean().optional(),
    checkedIn: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

export const checkinSchema = z.object({
  ticketCode: z.string().min(1).max(200),
});

export type RsvpInput = z.infer<typeof rsvpSchema>;
export type AttendeePatchInput = z.infer<typeof attendeePatchSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
