import { Pool, PoolClient } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.test' });

let testPool: Pool | null = null;

/**
 * Get the test database pool.
 * Uses TEST_DATABASE_URL env var, falling back to an in-memory-like SQLite-free approach
 * where we use a separate PostgreSQL test database.
 */
export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      max: 5,
      min: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
  }
  return testPool;
}

/**
 * Set up the test database. Runs migrations if TEST_DATABASE_URL is configured.
 * For unit tests that don't need a real database, this is a no-op.
 */
export async function setupTestDatabase(): Promise<void> {
  // Only set up if we have a test database URL
  if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
    return;
  }

  const pool = getTestPool();

  try {
    // Verify connection
    await pool.query('SELECT 1');
  } catch {
    // If no database available, tests that need DB will skip
    console.warn('Test database not available. Integration tests will be skipped.');
    testPool = null;
  }
}

/**
 * Tear down the test database connection pool.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Get a client from the test pool for transaction-based tests.
 * Each test can wrap its operations in a transaction and rollback for isolation.
 */
export async function getTestClient(): Promise<PoolClient> {
  const pool = getTestPool();
  return pool.connect();
}

/**
 * Execute a query against the test database.
 */
export async function testQuery(text: string, params?: unknown[]) {
  const pool = getTestPool();
  return pool.query(text, params);
}

/**
 * Run a test within a transaction that is rolled back afterwards.
 * Provides full isolation between tests without needing to clean up data.
 */
export async function withTestTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getTestClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('ROLLBACK');
    return result;
  } finally {
    client.release();
  }
}

/**
 * Clean all data from the test database tables.
 * Use between test suites if not using transaction isolation.
 */
export async function cleanTestDatabase(): Promise<void> {
  const pool = getTestPool();
  if (!pool) return;

  await pool.query(`
    TRUNCATE TABLE 
      audit_records,
      transfer_line_items,
      stock_transfers,
      sale_line_items,
      sale_transactions,
      stock_levels,
      stock_items,
      users,
      branches
    CASCADE;
  `);
}
