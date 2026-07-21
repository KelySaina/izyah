// Global teardown: close background connections so Jest can exit cleanly.
afterAll(async () => {
  try {
    const { redis } = await import('../src/lib/redis');
    redis.disconnect();
  } catch {
    /* ignore */
  }
  try {
    const { prisma } = await import('../src/lib/prisma');
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
});
