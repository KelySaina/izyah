import { z } from 'zod';
import { sanitizedText } from '../../utils/validation';

// A display name is optional at bootstrap (defaults to "Guest") but bounded.
const displayName = sanitizedText(40);

// avatar is either a hex color token (#RRGGBB) or an object URL.
const avatar = z
  .string()
  .max(512)
  .refine((v) => /^#[0-9a-fA-F]{6}$/.test(v) || /^https?:\/\//.test(v), {
    message: 'avatar must be a #hex color or a URL',
  });

export const createUserSchema = z.object({
  displayName: displayName.optional(),
  avatar: avatar.optional(),
});

export const updateUserSchema = z
  .object({
    displayName: displayName.optional(),
    avatar: avatar.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
