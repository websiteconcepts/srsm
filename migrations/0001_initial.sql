-- Users who can sign in to the admin.
CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,           -- pbkdf2$<iter>$<salt_b64>$<hash_b64>
  role           TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','owner')),
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Active login sessions. We store a SHA-256 hash of the cookie token.
CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at   INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Events shown on the portal.
CREATE TABLE events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',   -- plain text / simple markdown
  start_at        INTEGER NOT NULL,           -- unix seconds
  end_at          INTEGER,
  location_name   TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  map_query       TEXT NOT NULL DEFAULT '',   -- overrides address for map embed if set
  hero_r2_key     TEXT,                       -- key in R2 bucket
  published       INTEGER NOT NULL DEFAULT 0, -- 0/1
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_events_start ON events(start_at);
CREATE INDEX idx_events_published ON events(published, start_at);

-- Gallery photos attached to an event (post-event uploads live here too).
CREATE TABLE event_photos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  r2_key       TEXT NOT NULL,
  caption      TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_photos_event ON event_photos(event_id, sort_order);
