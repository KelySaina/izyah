import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fixed IDs make the seed idempotent (safe to run on every boot).
const IDS = {
  alice: '11111111-1111-1111-1111-111111111111',
  bob: '22222222-2222-2222-2222-222222222222',
  carol: '33333333-3333-3333-3333-333333333333',
  event: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  poll: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
};

async function main() {
  const alice = await prisma.user.upsert({
    where: { id: IDS.alice },
    update: {},
    create: { id: IDS.alice, displayName: 'Alice', avatar: '#7C3AED' },
  });
  const bob = await prisma.user.upsert({
    where: { id: IDS.bob },
    update: {},
    create: { id: IDS.bob, displayName: 'Bob', avatar: '#2563EB' },
  });
  const carol = await prisma.user.upsert({
    where: { id: IDS.carol },
    update: {},
    create: { id: IDS.carol, displayName: 'Carol', avatar: '#059669' },
  });

  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

  const event = await prisma.event.upsert({
    where: { id: IDS.event },
    update: {},
    create: {
      id: IDS.event,
      title: 'Rooftop Summer Kickoff 🌇',
      description: 'Music, food and good vibes to start the season. Bring a friend!',
      date: inTwoWeeks,
      startTime: '18:30',
      endTime: '23:00',
      location: 'Skyline Terrace, 12 Rue des Étoiles',
      slug: 'summer-kickoff',
      visibility: 'PUBLIC',
      creatorId: alice.id,
    },
  });

  // RSVPs (creator is HOST/GOING).
  for (const [userId, status, role] of [
    [alice.id, 'GOING', 'HOST'],
    [bob.id, 'GOING', 'GUEST'],
    [carol.id, 'MAYBE', 'GUEST'],
  ] as const) {
    await prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      update: { status, role },
      create: { eventId: event.id, userId, status, role },
    });
  }

  // A couple of chat messages.
  const count = await prisma.message.count({ where: { eventId: event.id } });
  if (count === 0) {
    await prisma.message.createMany({
      data: [
        { eventId: event.id, userId: alice.id, content: 'So excited for this! 🎉' },
        { eventId: event.id, userId: bob.id, content: 'Should I bring drinks?' },
      ],
    });
  }

  // Tasks.
  const taskCount = await prisma.task.count({ where: { eventId: event.id } });
  if (taskCount === 0) {
    await prisma.task.createMany({
      data: [
        { eventId: event.id, title: 'Bring drinks 🥤', assignedUserId: bob.id, status: 'CLAIMED' },
        { eventId: event.id, title: 'Bring decorations 🎈', status: 'OPEN' },
        { eventId: event.id, title: 'Speaker setup 🔊', status: 'OPEN' },
      ],
    });
  }

  // A poll with options.
  await prisma.poll.upsert({
    where: { id: IDS.poll },
    update: {},
    create: {
      id: IDS.poll,
      eventId: event.id,
      question: 'What music should we play first?',
      options: {
        create: [{ text: 'House 🎧' }, { text: 'Afrobeat 🥁' }, { text: 'Pop ✨' }],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete: 3 users, 1 event, RSVPs, messages, tasks, poll');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
