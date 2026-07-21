import pino from 'pino';
import { env, isProd } from '../config/env';

/** Structured logger. Pretty in dev, JSON in prod. */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
});
