import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { track } from '../../analytics/track';
import type { CreateUserInput, UpdateUserInput } from './user.schemas';

/** Curated palette for auto-assigned anonymous avatars. */
const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#0891B2', '#059669', '#CA8A04',
  '#DC2626', '#DB2777', '#EA580C', '#4F46E5', '#0D9488',
];

const FRIENDLY_NAMES = [
  'Guest', 'Explorer', 'Voyager', 'Companion', 'Friend',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** Public-safe projection of a user. Exposed in creator/attendee lists — must
 *  NEVER include email or other private fields. */
export type UserDTO = Pick<User, 'id' | 'displayName' | 'avatar' | 'createdAt' | 'lastSeenAt'>;

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    displayName: user.displayName,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
  };
}

/** Private projection returned ONLY to the user themselves (GET /auth/me,
 *  /users/me). Carries account-linking state on top of the public fields. */
export type MeDTO = UserDTO & {
  email: string | null;
  isClaimed: boolean;
};

export function toMeDTO(user: User): MeDTO {
  return {
    ...toUserDTO(user),
    email: user.email,
    isClaimed: user.isClaimed,
  };
}

export async function createUser(input: CreateUserInput): Promise<UserDTO> {
  return toUserDTO(await createUserEntity(input));
}

/** Create a user row and return the full entity (needed to mint a session token). */
export async function createUserEntity(input: CreateUserInput = {}): Promise<User> {
  const user = await prisma.user.create({
    data: {
      displayName: input.displayName ?? pick(FRIENDLY_NAMES),
      avatar: input.avatar ?? pick(AVATAR_COLORS),
    },
  });
  await track('user_created');
  return user;
}

export async function getUserById(id: string): Promise<UserDTO> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User not found');
  return toUserDTO(user);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<MeDTO> {
  const user = await prisma.user.update({ where: { id }, data: input });
  return toMeDTO(user);
}
