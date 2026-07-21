import request from 'supertest';
import { createApp } from '../src/app';

// Liveness needs no infrastructure — it must answer even if DB/Redis are down.
describe('GET /health', () => {
  const app = createApp();

  it('returns { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('404s unknown routes with an error envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
