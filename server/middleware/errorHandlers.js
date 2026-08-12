import { captureError } from '../monitoring/sentry.js';
import { logger } from '../services/logger.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId: req.requestId,
  });
};

export const globalErrorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    logger.error({
      requestId: req.requestId,
      message: error.message,
      stack: error.stack,
    }, 'Unhandled error');
    captureError(error, { requestId: req.requestId });
  }

  res.status(statusCode).json({
    success: false,
    message: isServerError ? 'Internal server error' : error.message,
    requestId: req.requestId,
  });
};
