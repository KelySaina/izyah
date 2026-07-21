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

/** Public-safe projection of a user. */
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

export async function createUser(input: CreateUserInput): Promise<UserDTO> {
  const user = await prisma.user.create({
    data: {
      displayName: input.displayName ?? pick(FRIENDLY_NAMES),
      avatar: input.avatar ?? pick(AVATAR_COLORS),
    },
  });
  await track('user_created');
  return toUserDTO(user);
}

export async function getUserById(id: string): Promise<UserDTO> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User not found');
  return toUserDTO(user);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserDTO> {
  const user = await prisma.user.update({ where: { id }, data: input });
  return toUserDTO(user);
}
