import { z } from 'zod';

export const linkSchema = z.object({
  // Raw OIDC ID token (JWT) obtained by the frontend after a Logto login.
  idToken: z.string().min(10).max(8192),
});

export type LinkInput = z.infer<typeof linkSchema>;
