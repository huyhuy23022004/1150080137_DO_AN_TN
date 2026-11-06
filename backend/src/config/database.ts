import mysql, { type Pool } from 'mysql2/promise';
import { logger } from './logger';
import { config } from './env';

export const pool: Pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: config.db.queueLimit,
  charset: 'utf8mb4_unicode_ci',
  timezone: config.db.timezone,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  decimalNumbers: false,
  namedPlaceholders: true,
  multipleStatements: false,
  enableKeepAlive: true,
  connectTimeout: 10_000,
  ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
});

pool.pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) {
      logger.error({ err: error }, 'failed_to_set_mysql_session_timezone');
    }
  });
});

export async function pingDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
