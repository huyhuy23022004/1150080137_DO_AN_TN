import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { isRetryableTransactionError } from '../common/errors/db-errors';
import { sleep } from '../utils/time';

type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

export interface TransactionOptions {
  isolation?: IsolationLevel;
  retries?: number;
}

export async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const connection = await pool.getConnection();

    try {
      if (options.isolation) {
        await connection.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolation}`);
      }

      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error({ err: rollbackError }, 'transaction_rollback_failed');
      }

      if (attempt < retries && isRetryableTransactionError(error)) {
        const delayMs = 25 + Math.floor(Math.random() * 75);
        logger.warn({ err: error, attempt }, 'transaction_retrying_after_deadlock');
        await sleep(delayMs);
        continue;
      }

      throw error;
    } finally {
      connection.release();
    }
  }

  throw new Error('Transaction could not be completed');
}
