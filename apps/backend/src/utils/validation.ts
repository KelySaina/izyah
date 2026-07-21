import { z } from 'zod';

/** Reusable primitives shared across module schemas. */
export const uuid = z.string().uuid();

export const isUuid = (value: unknown): value is string => uuid.safeParse(value).success;

/** Trim + collapse whitespace and cap length — used for user-supplied text. */
export const sanitizedText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(1).max(max));

export const optionalText = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(max))
    .optional();
