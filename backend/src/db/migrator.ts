import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { config } from '../config/env';
import { pool } from '../config/database';
import { getMySqlErrorCode } from '../common/errors/db-errors';
import { logger } from '../config/logger';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

interface AppliedMigrationRow extends RowDataPacket {
  ten_file: string;
}

function validateDatabaseName(databaseName: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error('DB_NAME may only contain letters, numbers and underscores');
  }
}

async function ensureDatabaseExists(): Promise<void> {
  validateDatabaseName(config.db.name);

  try {
    const probe = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      connectTimeout: 10_000,
    });
    await probe.end();
    return;
  } catch (error) {
    if (getMySqlErrorCode(error) !== 'ER_BAD_DB_ERROR') {
      throw error;
    }
  }

  const bootstrap = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
    connectTimeout: 10_000,
  });

  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    logger.info({ database: config.db.name }, 'database_created');
  } finally {
    await bootstrap.end();
  }
}

async function createMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`ten_file\` VARCHAR(255) NOT NULL UNIQUE,
      \`thoi_gian_chay\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB COMMENT='Lịch sử migration'
  `);
}

export async function runMigrations(): Promise<string[]> {
  await ensureDatabaseExists();
  await createMigrationsTable();

  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    logger.warn({ directory: MIGRATIONS_DIR }, 'no_migration_files_found');
    return [];
  }

  const runner = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: true,
    connectTimeout: 10_000,
  });

  const applied: string[] = [];

  try {
    for (const file of files) {
      const [rows] = await runner.execute<AppliedMigrationRow[]>(
        `SELECT \`ten_file\` FROM \`${MIGRATIONS_TABLE}\` WHERE \`ten_file\` = ? LIMIT 1`,
        [file],
      );

      if (rows.length > 0) {
        continue;
      }

      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

      try {
        await runner.query(sql);
        await runner.execute(`INSERT INTO \`${MIGRATIONS_TABLE}\` (\`ten_file\`) VALUES (?)`, [
          file,
        ]);
        applied.push(file);
        logger.info({ migration: file }, 'migration_applied');
      } catch (error) {
        logger.error({ err: error, migration: file }, 'migration_failed');
        throw error;
      }
    }
  } finally {
    await runner.end();
  }

  return applied;
}
