import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from '../configs/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
});

export const requestLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    requestId: req.requestId,
  }),
  customLogLevel: (req, res, error) => {
    if (error || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
});
