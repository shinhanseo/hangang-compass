CREATE TABLE IF NOT EXISTS recommendation_views (
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  revision TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (meeting_id, revision)
);
