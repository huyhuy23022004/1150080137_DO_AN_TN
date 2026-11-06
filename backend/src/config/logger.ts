import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from './env';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.mat_khau',
  'req.body.mat_khau_cu',
  'req.body.mat_khau_moi',
  'req.body.xac_nhan_mat_khau',
  'mat_khau',
  'mat_khau_ma_hoa',
  'password',
  'token',
  'refresh_token',
  'access_token',
];

export const logger = pino({
  level: config.log.level,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  ...(config.log.pretty && !config.isProduction
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

type RequestWithId = IncomingMessage & { requestId?: string };

export const httpLogger = pinoHttp<IncomingMessage, ServerResponse, never>({
  logger,
  genReqId: (req) => {
    const request = req as RequestWithId;
    return request.requestId ?? randomUUID();
  },
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
  autoLogging: {
    ignore: (req) => req.url === '/livez' || req.url === '/healthz',
  },
});
