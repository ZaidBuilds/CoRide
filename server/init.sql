-- CoRide Postgres init (MVP4 → prod)
-- Replace store.json with real tables when DATABASE_URL is set

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS commute_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  t BIGINT NOT NULL,
  event TEXT NOT NULL,
  user_id TEXT,
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_profiles_data ON profiles USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
