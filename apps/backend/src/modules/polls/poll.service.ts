import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { notifyEventParticipants } from '../notifications/notification.service';
import type { CreatePollInput } from './poll.schemas';

export interface PollOptionDTO {
  id: string;
  text: string;
  votes: number;
}

export interface PollDTO {
  id: string;
  eventId: string;
  question: string;
  closesAt: Date | null;
  createdAt: Date;
  options: PollOptionDTO[];
  totalVotes: number;
  viewerOptionId: string | null;
}

// Poll rows always carry their options with an aggregate vote count.
type PollWithCounts = Prisma.PollGetPayload<{
  include: { options: { include: { _count: { select: { votes: true } } } } };
}>;

function toPollDTO(poll: PollWithCounts, viewerOptionId: string | null): PollDTO {
  const options = poll.options.map((o) => ({ id: o.id, text: o.text, votes: o._count.votes }));
  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);
  return {
    id: poll.id,
    eventId: poll.eventId,
    question: poll.question,
    closesAt: poll.closesAt,
    createdAt: poll.createdAt,
    options,
    totalVotes,
    viewerOptionId,
  };
}

async function assertEventExists(eventId: string): Promise<void> {
  const exists = await prisma.event.count({ where: { id: eventId } });
  if (!exists) throw ApiError.notFound('Event not found');
}

/** Load a single poll (scoped to its event) as a DTO, resolving the viewer's vote. */
async function loadPoll(eventId: string, pollId: string, viewerId?: string): Promise<PollDTO> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { include: { _count: { select: { votes: true } } } } },
  });
  if (!poll || poll.eventId !== eventId) throw ApiError.notFound('Poll not found');

  let viewerOptionId: string | null = null;
  if (viewerId) {
    const vote = await prisma.pollVote.findFirst({ where: { userId: viewerId, option: { pollId } } });
    viewerOptionId = vote?.optionId ?? null;
  }
  return toPollDTO(poll, viewerOptionId);
}

export async function createPoll(
  eventId: string,
  userId: string,
  displayName: string,
  input: CreatePollInput,
): Promise<PollDTO> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, title: true },
  });
  if (!event) throw ApiError.notFound('Event not found');

  const poll = await prisma.poll.create({
    data: {
      eventId,
      question: input.question,
      closesAt: input.closesAt ?? null,
      options: { create: input.options.map((text) => ({ text })) },
    },
    include: { options: { include: { _count: { select: { votes: true } } } } },
  });

  void notifyEventParticipants(eventId, userId, 'poll_created', {
    eventId,
    eventSlug: event.slug,
    eventTitle: event.title,
    question: poll.question,
    displayName,
  }).catch(() => undefined);

  return toPollDTO(poll, null);
}

export async function listPolls(eventId: string, viewerId?: string): Promise<PollDTO[]> {
  await assertEventExists(eventId);
  const polls = await prisma.poll.findMany({
    where: { eventId },
    include: { options: { include: { _count: { select: { votes: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  // Resolve the viewer's votes across all polls in one query (avoid N+1).
  const viewerVotes = new Map<string, string>();
  if (viewerId) {
    const votes = await prisma.pollVote.findMany({
      where: { userId: viewerId, option: { poll: { eventId } } },
      include: { option: { select: { pollId: true } } },
    });
    for (const v of votes) viewerVotes.set(v.option.pollId, v.optionId);
  }

  return polls.map((p) => toPollDTO(p, viewerId ? viewerVotes.get(p.id) ?? null : null));
}

export async function vote(
  eventId: string,
  pollId: string,
  userId: string,
  optionId: string,
): Promise<PollDTO> {
  await assertEventExists(eventId);

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { select: { id: true } } },
  });
  if (!poll || poll.eventId !== eventId) throw ApiError.notFound('Poll not found');
  if (!poll.options.some((o) => o.id === optionId)) {
    throw ApiError.badRequest('Option does not belong to this poll');
  }

  // One vote per user per poll: clear any prior vote on this poll, then record the new one.
  await prisma.$transaction([
    prisma.pollVote.deleteMany({ where: { userId, option: { pollId } } }),
    prisma.pollVote.create({ data: { optionId, userId } }),
  ]);

  return loadPoll(eventId, pollId, userId);
}
