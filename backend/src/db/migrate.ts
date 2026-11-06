import { closeDatabase } from '../config/database';
import { logger } from '../config/logger';
import { runMigrations } from './migrator';

async function main(): Promise<void> {
  try {
    const applied = await runMigrations();
    logger.info({ count: applied.length, files: applied }, 'migrations_completed');
  } catch (error) {
    logger.fatal({ err: error }, 'migrations_failed');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main();
