import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

/**
 * Hand-authored OpenAPI 3 document. Kept intentionally lightweight (no build
 * step) and mounted at /docs. Extend as new endpoints ship.
 */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: "Izy'Ah API",
    version: '0.1.0',
    description:
      "Attendee-first event platform. Passwordless anonymous identity via the `X-User-ID` header.",
  },
  servers: [{ url: '/api', description: 'API root' }],
  components: {
    securitySchemes: {
      AnonId: { type: 'apiKey', in: 'header', name: 'X-User-ID' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          displayName: { type: 'string' },
          avatar: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          lastSeenAt: { type: 'string', format: 'date-time' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          date: { type: 'string', format: 'date-time' },
          startTime: { type: 'string', nullable: true },
          endTime: { type: 'string', nullable: true },
          location: { type: 'string', nullable: true },
          coverImage: { type: 'string', nullable: true },
          slug: { type: 'string' },
          creatorId: { type: 'string', format: 'uuid' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'object', properties: { message: { type: 'string' } } } },
      },
    },
  },
  security: [{ AnonId: [] }],
  paths: {
    '/users': {
      post: {
        tags: ['Users'],
        summary: 'Bootstrap an anonymous identity',
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { displayName: { type: 'string' }, avatar: { type: 'string' } },
              },
            },
          },
        },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } },
      },
    },
    '/users/me': {
      get: { tags: ['Users'], summary: 'Current identity', responses: { '200': { description: 'OK' } } },
      patch: { tags: ['Users'], summary: 'Update profile', responses: { '200': { description: 'OK' } } },
    },
    '/events': {
      get: { tags: ['Events'], summary: 'List events (mine / upcoming)', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Events'], summary: 'Create an event', responses: { '201': { description: 'Created' } } },
    },
    '/events/{idOrSlug}': {
      get: { tags: ['Events'], summary: 'Get event by id or public slug', security: [], responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Events'], summary: 'Update event (creator only)', responses: { '200': { description: 'OK' } } },
      delete: { tags: ['Events'], summary: 'Delete event (creator only)', responses: { '204': { description: 'Deleted' } } },
    },
    '/events/{eventId}/rsvp': {
      put: { tags: ['RSVP'], summary: 'Set RSVP status', responses: { '200': { description: 'OK' } } },
    },
    '/events/{eventId}/participants': {
      get: { tags: ['RSVP'], summary: 'List attendees + counts', security: [], responses: { '200': { description: 'OK' } } },
    },
    '/events/{eventId}/messages': {
      get: { tags: ['Chat'], summary: 'Message history', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Chat'], summary: 'Post a message (also broadcast via WS)', responses: { '201': { description: 'Created' } } },
    },
    '/events/{eventId}/media': {
      get: { tags: ['Media'], summary: 'List event media', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Media'], summary: 'Upload media (multipart)', responses: { '201': { description: 'Created' } } },
    },
    '/events/{eventId}/tasks': {
      get: { tags: ['Tasks'], summary: 'List tasks', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Tasks'], summary: 'Create a task', responses: { '201': { description: 'Created' } } },
    },
    '/events/{eventId}/polls': {
      get: { tags: ['Polls'], summary: 'List polls', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Polls'], summary: 'Create a poll', responses: { '201': { description: 'Created' } } },
    },
    '/notifications': {
      get: { tags: ['Notifications'], summary: 'List my notifications', responses: { '200': { description: 'OK' } } },
    },
  },
} as const;

export function mountDocs(app: Express): void {
  app.get('/docs.json', (_req, res) => res.json(openapiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: "Izy'Ah API" }));
}
