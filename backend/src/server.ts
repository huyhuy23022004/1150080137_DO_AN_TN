import http from 'node:http';
import { createApp } from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { closeDatabase, pingDatabase } from './config/database';
import { closeRedis, pingRedis } from './config/redis';
import { seatLockService, tokenService, tripService } from './container';
import { startScheduledJobs, stopScheduledJobs } from './jobs';
import { createRealtimeServer, type RealtimeServer } from './realtime/socket';

const app = createApp();
const server = http.createServer(app);

let shuttingDown = false;
let realtime: RealtimeServer | null = null;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'server_shutting_down');
  stopScheduledJobs();

  const forceExitTimer = setTimeout(() => {
    logger.error('server_forced_shutdown_after_timeout');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (realtime) {
    await realtime.close();
  } else {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }

  await Promise.allSettled([closeDatabase(), closeRedis()]);

  clearTimeout(forceExitTimer);
  logger.info('server_shutdown_completed');
  process.exit(0);
}

async function checkDependencies(): Promise<void> {
  const [database, redis] = await Promise.allSettled([pingDatabase(), pingRedis()]);

  if (database.status === 'rejected') {
    logger.warn({ err: database.reason }, 'mysql_not_available_at_startup');
  } else {
    logger.info('mysql_connected');
  }

  if (redis.status === 'rejected') {
    logger.warn({ err: redis.reason }, 'redis_not_available_at_startup');
  } else {
    logger.info('redis_connected');
  }
}

async function start(): Promise<void> {
  realtime = await createRealtimeServer(server, {
    tokenService,
    seatLockService,
    tripService,
  });

  startScheduledJobs();

  server.listen(config.server.port, () => {
    logger.info(
      {
        port: config.server.port,
        environment: config.env,
        api_prefix: config.server.apiPrefix,
        socket_path: config.socket.path,
      },
      'server_started',
    );

    void checkDependencies();
  });
}

server.on('error', (error) => {
  logger.fatal({ err: error }, 'server_error');
  process.exit(1);
});

void start().catch((error) => {
  logger.fatal({ err: error }, 'server_start_failed');
  process.exit(1);
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled_rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught_exception');
  void shutdown('uncaughtException');
});
