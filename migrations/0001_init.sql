CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password TEXT NOT NULL,
  invited_by TEXT,
  date_created INTEGER,
  last_updated INTEGER
);

CREATE TABLE IF NOT EXISTS access_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT,
  date_created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS access_tokens_user ON access_tokens (user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  previous_access_token TEXT NOT NULL,
  date_created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user ON refresh_tokens (user_id);

-- Blogs and media keep the original MongoDB document shape as JSON.
CREATE TABLE IF NOT EXISTS blogs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS blogs_state_created ON blogs (json_extract(data, '$.state'), json_extract(data, '$.date_created'));
CREATE INDEX IF NOT EXISTS blogs_created ON blogs (json_extract(data, '$.date_created'));

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS media_created ON media (json_extract(data, '$.date_created'));
