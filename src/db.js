'use strict';

const path = require('path');
const { URL } = require('url');
const { Pool } = require('pg');

// Local development convenience: .env is read if present, but values already
// in the environment (Railway injects DATABASE_URL/PORT/etc.) always win.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reviews (
  id           SERIAL PRIMARY KEY,
  identifier   TEXT        NOT NULL,
  display_name TEXT        NOT NULL,
  username     TEXT        NOT NULL,
  discord_id   TEXT        NOT NULL,
  user_link    TEXT        NOT NULL,
  banner_url   TEXT        NOT NULL,
  service      TEXT        NOT NULL,
  experience   TEXT        NOT NULL,
  rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_identifier_key
  ON reviews (lower(identifier));
`;

function isLocalHost(host) {
  return (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]'
  );
}

/**
 * Reads the Postgres connection info.
 * Priority: DATABASE_URL (Railway) -> individual PG* vars -> local default.
 * Any non-local host gets TLS; Railway's proxy endpoint requires it.
 */
function buildConfig() {
  let raw = process.env.DATABASE_URL;

  if (!raw) {
    if (process.env.PGHOST) {
      const user = encodeURIComponent(process.env.PGUSER || 'postgres');
      const pass = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : '';
      raw = `postgres://${user}${pass}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'postgres'}`;
    } else {
      raw = 'postgres://postgres@localhost:5432/freelancer_reviews';
    }
  }

  const url = new URL(raw);
  const sslmode = url.searchParams.get('sslmode');

  const config = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username) || 'postgres',
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: url.pathname.replace(/^\//, '') || 'postgres',
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  };

  if (!isLocalHost(url.hostname) && sslmode !== 'disable') {
    // rejectUnauthorized stays on for verify-full, off otherwise so Railway's
    // proxy certificates work without extra CA bundle setup.
    config.ssl = { rejectUnauthorized: sslmode === 'verify-full' };
  }

  return config;
}

const pool = new Pool(buildConfig());

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

/** Creates the tables if they don't exist yet, retrying while Postgres boots. */
async function ensureSchema(retries = 6, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(SCHEMA);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.error(`[db] schema setup failed (attempt ${attempt}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function init() {
  await ensureSchema();
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM reviews');
  console.log(`[db] connected to ${pool.options.host}/${pool.options.database} — ${rows[0].n} review(s) present`);
}

module.exports = { pool, query, init, ensureSchema };

// `npm run db:push` creates/updates the schema without starting the server.
if (require.main === module && process.argv.includes('--push')) {
  ensureSchema()
    .then(() => {
      console.log('[db] schema is up to date');
      return pool.end();
    })
    .catch((err) => {
      console.error('[db] failed:', err.message);
      process.exit(1);
    });
}
