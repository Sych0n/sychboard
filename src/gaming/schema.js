'use strict'
// Gaming-tab migrations. db.js appends these to its own list, so versions must
// stay above the highest one in db.js (7 at time of writing) and never be edited
// once shipped — add a new version instead.
const migrations = [
  { version: 8, sql: `
    CREATE TABLE IF NOT EXISTS gaming_sens_profiles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      game TEXT NOT NULL,
      sens REAL NOT NULL,
      dpi INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `},
  { version: 9, sql: `
    CREATE TABLE IF NOT EXISTS gaming_sessions (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,            -- YYYY-MM-DD, local
      start_time TEXT,               -- HH:MM, local
      end_time TEXT,                 -- HH:MM, local (may be earlier than start_time: crossed midnight)
      game TEXT NOT NULL,
      mode TEXT,
      result TEXT CHECK (result IN ('win','loss','draw')),
      score REAL,
      rank_change INTEGER,           -- e.g. RR gained/lost
      notes TEXT,
      smoothness INTEGER CHECK (smoothness BETWEEN 1 AND 5),
      sens_profile_id INTEGER REFERENCES gaming_sens_profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_gaming_sessions_date ON gaming_sessions(date);
    CREATE TABLE IF NOT EXISTS gaming_aim_scores (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      scenario TEXT NOT NULL,
      score REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_gaming_aim_scores_date ON gaming_aim_scores(date);
  `},
  { version: 10, sql: `
    CREATE TABLE IF NOT EXISTS gaming_captures (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      label TEXT NOT NULL,
      app TEXT,
      duration_s REAL NOT NULL,
      frames INTEGER NOT NULL,
      avg_fps REAL NOT NULL,
      low1_fps REAL NOT NULL,
      low01_fps REAL NOT NULL,
      median_ms REAL NOT NULL,
      p99_ms REAL NOT NULL,
      max_ms REAL NOT NULL,
      spikes INTEGER NOT NULL,
      spike_threshold_ms REAL NOT NULL,
      frametimes TEXT NOT NULL      -- JSON array of ms, 2 dp
    );
  `}
]

module.exports = { migrations }
