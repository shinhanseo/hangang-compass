CREATE TABLE IF NOT EXISTS transit_route_cache (
  provider TEXT NOT NULL,
  route_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider, route_key)
);

CREATE INDEX IF NOT EXISTS transit_route_cache_expires_at_idx ON transit_route_cache(expires_at);

CREATE TABLE IF NOT EXISTS transit_route_usage (
  usage_day DATE NOT NULL,
  provider TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  quota_exceeded INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usage_day, provider)
);
