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

-- Blocks: one row per (blocker → blocked) direction.
CREATE TABLE IF NOT EXISTS blocks (
  blocker TEXT NOT NULL,
  blocked TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker, blocked)
);

-- Reports: safety reports (append-only, resolved flag flips on review).
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  reason TEXT,
  context_room_id TEXT,
  created_at BIGINT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE
);

-- Connection requests: the pending/accepted/declined state machine.
CREATE TABLE IF NOT EXISTS connection_requests (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  status TEXT NOT NULL,
  context_line TEXT,
  context_station TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Direct messages: one row per message, keyed by the sorted-pair thread key.
CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  thread_key TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  ts BIGINT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Read receipts: last-read timestamp per (viewer, peer) chat.
CREATE TABLE IF NOT EXISTS reads (
  user_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  last_read_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, peer_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_data ON profiles USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON direct_messages(thread_key, ts);
CREATE INDEX IF NOT EXISTS idx_requests_users ON connection_requests(from_user, to_user, status);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id, resolved);
