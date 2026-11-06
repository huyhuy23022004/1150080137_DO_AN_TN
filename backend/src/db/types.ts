import type { Pool, PoolConnection } from 'mysql2/promise';

export type DbExecutor = Pool | PoolConnection;
