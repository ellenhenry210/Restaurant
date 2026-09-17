import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from '../src/db.js';

// db.js already calls dotenv.config() itself, so importing it above is
// enough to have DB_* env vars available here too.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Tracks which migrations have already been applied, so re-running this
 * script is safe and only applies what's new. Created if it doesn't
 * already exist — this is itself the very first thing any fresh database
 * needs, before any of our own tables.
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT name FROM schema_migrations');
  return new Set(result.rows.map((row) => row.name));
}

/**
 * Runs every .sql file in ./migrations that hasn't been applied yet, in
 * filename order (hence the zero-padded numeric prefixes like 001_, 002_).
 * Each migration runs inside its own transaction: if any statement in a
 * file fails, that whole file rolls back and the script stops — it does
 * NOT continue on to later migrations, since they may assume the failed
 * one succeeded.
 */
async function runMigrations() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found in', MIGRATIONS_DIR);
    return;
  }

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    let ranCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭  Already applied: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`▶  Applying: ${file}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Applied: ${file}`);
        ranCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed, rolled back: ${file}`);
        console.error(`   ${err.message}`);
        throw err;
      }
    }

    console.log(
      ranCount === 0
        ? '✅ Database already up to date — nothing to apply.'
        : `✅ Applied ${ranCount} migration(s) successfully.`
    );
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('Migration run aborted:', err.message);
    await pool.end();
    process.exitCode = 1;
  });
