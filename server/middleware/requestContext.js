import { randomUUID } from 'node:crypto';

export const attachRequestContext = (req, res, next) => {
  const headerRequestId = req.headers['x-request-id'];
  const requestId =
    typeof headerRequestId === 'string' && headerRequestId.trim().length > 0
      ? headerRequestId
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};
