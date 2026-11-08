-- The Bive registry: one row per reported session. No IP, name, path or text is ever stored.
CREATE TABLE IF NOT EXISTS sessions (
  project TEXT NOT NULL,      -- random id from the project's .bive/registry-id
  day     TEXT NOT NULL,      -- UTC date set by the server (YYYY-MM-DD)
  human   INTEGER NOT NULL,   -- human tokens since the last report (estimated)
  agent   INTEGER NOT NULL,   -- agent tokens since the last report (provider counts)
  violations INTEGER NOT NULL DEFAULT 0,  -- writes the guard refused since the last report
  loc     INTEGER NOT NULL    -- tracked text lines, rounded to two significant figures
);
CREATE INDEX IF NOT EXISTS sessions_project_day ON sessions (project, day);
CREATE INDEX IF NOT EXISTS sessions_day ON sessions (day);
