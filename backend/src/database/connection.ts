import { Pool, PoolConfig } from 'pg';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  // Statement timeout to prevent long-running queries
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
};

const pool = new Pool(poolConfig);

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

pool.on('connect', () => {
  console.log('Database client connected');
});

/**
 * Get a client from the pool for transaction use.
 * Remember to release the client after use.
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Execute a single query using a pool client.
 */
export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

/**
 * Execute multiple queries within a transaction.
 * Automatically commits on success or rolls back on error.
 */
export async function withTransaction<T>(
  callback: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gracefully shut down the pool (call on process exit).
 */
export async function closePool() {
  await pool.end();
}

export default pool;
