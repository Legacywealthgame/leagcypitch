-- Legacy Wealth waitlist — D1 schema
-- Run once in the Cloudflare dashboard: D1 > your database > Console.

CREATE TABLE IF NOT EXISTS signups (
  email     TEXT PRIMARY KEY,   -- lowercased before insert, so one row per person
  name      TEXT NOT NULL,
  phone     TEXT NOT NULL DEFAULT '',
  joined_at TEXT NOT NULL,      -- ISO 8601 UTC, set by the function
  source    TEXT NOT NULL DEFAULT 'site'
);

-- Signups are read newest-first when checking on the list, and oldest-first
-- when exporting in join order. One index serves both directions.
CREATE INDEX IF NOT EXISTS idx_signups_joined_at ON signups (joined_at);
