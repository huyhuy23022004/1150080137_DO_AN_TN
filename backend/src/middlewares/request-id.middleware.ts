import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const header = req.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  const requestId = candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};
