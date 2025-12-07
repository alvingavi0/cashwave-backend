const { Pool } = require('pg');
const fs = require('fs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL not set. Set the Postgres connection string in env.');
  // Do not exit; allow local dev to continue without DB for now
}

const pool = new Pool({ connectionString, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });

async function query(text, params) {
  return pool.query(text, params);
}

async function withClient(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Ensure tables exist (best-effort). This runs at startup.
async function ensureSchema() {
  if (!connectionString) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        wallet_balance NUMERIC DEFAULT 0,
        last_transaction_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        uid TEXT NOT NULL,
        phone TEXT,
        amount NUMERIC,
        type TEXT,
        status TEXT,
        intasend_request_id TEXT,
        intasend_transaction_id TEXT,
        intasend_response JSONB,
        callback_payload JSONB,
        error TEXT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
    `);
    console.log('✓ DB schema checked / ensured');
  } catch (err) {
    console.warn('Could not ensure DB schema:', err.message);
  }
}

// Run schema ensure in background
ensureSchema().catch(() => {});

module.exports = {
  pool,
  query,
  withClient
};
