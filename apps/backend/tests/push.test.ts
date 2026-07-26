/**
 * Prune-on-failure behaviour of sendPushToUser.
 *
 * 403 is the case worth pinning down: it means the subscription was created
 * against a VAPID key this server no longer holds, which is what every existing
 * row looks like after a key rotation. The browser will only ever accept pushes
 * signed by the applicationServerKey it subscribed with, so those rows are
 * permanently undeliverable — without pruning they get retried on every single
 * notification, forever.
 */
import type { sendPushToUser as SendPushToUser } from '../src/modules/notifications/push.service';

jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() },
}));

jest.mock('../src/lib/prisma', () => ({
  prisma: { pushSubscription: { findMany: jest.fn(), delete: jest.fn() } },
}));

jest.mock('../src/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const USER = '11111111-1111-4111-8111-111111111111';
const SUB = { id: 'sub-1', endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' };

let sendPushToUser: typeof SendPushToUser;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webpush: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any;

beforeAll(async () => {
  // Set before the first import: `pushEnabled` is evaluated at module load, and
  // sendPushToUser returns early without it.
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';

  webpush = (await import('web-push')).default;
  ({ prisma } = await import('../src/lib/prisma'));
  ({ sendPushToUser } = await import('../src/modules/notifications/push.service'));
});

/** Make the single stored subscription fail with `statusCode`. */
async function sendFailingWith(statusCode: number | undefined): Promise<void> {
  prisma.pushSubscription.findMany.mockResolvedValue([SUB]);
  prisma.pushSubscription.delete.mockResolvedValue(SUB);
  webpush.sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode }));
  await sendPushToUser(USER, { title: 't', body: 'b' });
}

describe('sendPushToUser subscription pruning', () => {
  it.each([403, 404, 410])('prunes the subscription on %i', async (code) => {
    await sendFailingWith(code);
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: SUB.id } });
  });

  it('keeps the subscription on a transient failure (500)', async () => {
    await sendFailingWith(500);
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('keeps the subscription when the error carries no status code', async () => {
    await sendFailingWith(undefined);
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('never logs the endpoint when pruning a stale-key subscription', async () => {
    const { logger } = await import('../src/lib/logger');
    await sendFailingWith(403);
    const logged = JSON.stringify((logger.warn as jest.Mock).mock.calls);
    expect(logged).not.toContain(SUB.endpoint);
    expect(logged).toContain(USER);
  });

  it('does not delete anything when delivery succeeds', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([SUB]);
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
    await sendPushToUser(USER, { title: 't', body: 'b' });
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });
});
