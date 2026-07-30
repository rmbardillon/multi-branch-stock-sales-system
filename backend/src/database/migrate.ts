import fs from 'fs';
import path from 'path';
import pool from './connection';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Ensures the migrations tracking table exists.
 */
async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Gets list of already-executed migrations.
 */
async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query('SELECT filename FROM _migrations ORDER BY filename');
  return result.rows.map((row: { filename: string }) => row.filename);
}

/**
 * Runs all pending migrations in order.
 */
export async function runMigrations() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pending = files.filter(f => !executed.includes(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`Running migration: ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`  ✓ ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`  ✗ ${file} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log(`Successfully ran ${pending.length} migration(s).`);
}

// Run directly if executed as a script
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
