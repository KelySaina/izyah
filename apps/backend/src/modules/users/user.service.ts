import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { track, hostTotals, hostDailySeries, type AnalyticsEvent, type DailyPoint } from '../../analytics/track';
import type { CreateUserInput, UpdateUserInput } from './user.schemas';

/** Curated palette for auto-assigned anonymous avatars. */
const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#0891B2', '#059669', '#CA8A04',
  '#DC2626', '#DB2777', '#EA580C', '#4F46E5', '#0D9488',
];

/** Mood word for auto-assigned anonymous display names — paired with an
 *  IDENTITY noun below (e.g. "Happy Voyager"). */
const MOODS = [
  'Happy', 'Cheerful', 'Sunny', 'Merry', 'Jolly', 'Breezy', 'Bright', 'Lively', 'Vivid', 'Playful',
  'Cozy', 'Dreamy', 'Curious', 'Bold', 'Brave', 'Daring', 'Eager', 'Spirited', 'Wandering', 'Roaming',
  'Wild', 'Free', 'Radiant', 'Golden', 'Glowing', 'Sparkling', 'Gentle', 'Kind', 'Warm', 'Friendly',
  'Charming', 'Witty', 'Clever', 'Swift', 'Nimble', 'Zesty', 'Zealous', 'Vibrant', 'Groovy', 'Funky',
  'Chill', 'Cool', 'Epic', 'Mighty', 'Noble', 'Gallant', 'Jovial', 'Blissful', 'Joyful', 'Festive',
] as const;

/** Identity noun for auto-assigned anonymous display names — travel/
 *  companion themed, matching the app's "events, together" framing: you're
 *  a companion on the way to something fun, not just a random "Guest42". */
const IDENTITIES = [
  'Explorer', 'Voyager', 'Wanderer', 'Nomad', 'Traveler', 'Adventurer', 'Pathfinder', 'Rover', 'Rambler', 'Pilgrim',
  'Drifter', 'Roamer', 'Navigator', 'Pioneer', 'Scout', 'Trailblazer', 'Globetrotter', 'Wayfarer', 'Backpacker', 'Vagabond',
  'Sojourner', 'Trekker', 'Companion', 'Friend', 'Guest', 'Visitor', 'Newcomer', 'Regular', 'Local', 'Insider',
  'Partygoer', 'Reveler', 'Celebrant', 'Attendee', 'Mingler', 'Socialite', 'Gatherer', 'Planner', 'Organizer', 'Host',
  'Sidekick', 'Buddy', 'Pal', 'Mate', 'Ally', 'Confidant', 'Cheerleader', 'Supporter', 'Fan', 'Enthusiast',
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomDisplayName(): string {
  return `${pick(MOODS)} ${pick(IDENTITIES)}`;
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
      displayName: input.displayName ?? randomDisplayName(),
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

/** Self-scoped analytics — aggregated across every event `userId` has
 *  created. Never another user's data; there's no cross-account view. */
export async function getMyAnalytics(
  userId: string,
): Promise<{ totals: Record<AnalyticsEvent, number>; daily: DailyPoint[] }> {
  const owned = await prisma.event.findMany({ where: { creatorId: userId }, select: { id: true } });
  const eventIds = owned.map((e) => e.id);
  const [totals, daily] = await Promise.all([
    hostTotals(eventIds),
    hostDailySeries(eventIds, 14),
  ]);
  return { totals, daily };
}
