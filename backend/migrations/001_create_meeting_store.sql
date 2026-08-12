CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_capabilities (
  token_hash TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS meetings_expires_at_idx ON meetings(expires_at);
