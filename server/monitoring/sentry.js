import * as Sentry from '@sentry/node';
import { env } from '../configs/env.js';
import { logger } from '../services/logger.js';

export const initializeSentry = () => {
  if (!env.SENTRY_DSN) {
    logger.warn('SENTRY_DSN not set. Error monitoring is disabled.');
    return false;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    environment: env.NODE_ENV,
  });

  logger.info('Sentry initialized');
  return true;
};

export const captureError = (error, context = {}) => {
  if (!env.SENTRY_DSN) {
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
};
