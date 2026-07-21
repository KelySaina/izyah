import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { env } from './config/env';
import { identity } from './middleware/identity';
import { apiLimiter } from './middleware/rateLimit';
import { notFound, errorHandler } from './middleware/error';
import { mountDocs } from './docs/openapi';

// Feature routers — each declares full `/...` paths and is mounted under /api.
import { healthRouter } from './modules/health/health.routes';
import { usersRouter } from './modules/users/user.routes';
import { eventsRouter } from './modules/events/event.routes';
import { participantsRouter } from './modules/participants/participant.routes';
import { messagesRouter } from './modules/messages/message.routes';
import { mediaRouter } from './modules/media/media.routes';
import { uploadsRouter } from './modules/uploads/upload.routes';
import { tasksRouter } from './modules/tasks/task.routes';
import { pollsRouter } from './modules/polls/poll.routes';
import { notificationsRouter } from './modules/notifications/notification.routes';

/** Build the Express application (no listening — see server.ts). */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1); // behind Traefik
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-User-ID', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Resolve anonymous identity from X-User-ID on every request.
  app.use(identity);

  // Health check is unauthenticated and un-throttled.
  app.use('/', healthRouter);

  // API docs (Swagger UI).
  mountDocs(app);

  // Rate-limited API surface.
  app.use('/api', apiLimiter);
  app.use('/api', usersRouter);
  app.use('/api', eventsRouter);
  app.use('/api', participantsRouter);
  app.use('/api', messagesRouter);
  app.use('/api', mediaRouter);
  app.use('/api', uploadsRouter);
  app.use('/api', tasksRouter);
  app.use('/api', pollsRouter);
  app.use('/api', notificationsRouter);

  // 404 + centralised error handling.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
