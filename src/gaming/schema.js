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
  `},
  { version: 11, core: true, sql: `
    -- "Gaming" quest category. Kept to 2 dailies on purpose: a category's sweep bonus
    -- needs ALL its dailies done, and gaming isn't a daily thing for everyone.
    INSERT OR IGNORE INTO categories VALUES (5,'gaming','Gaming','#22d3ee','🎯');
    INSERT OR IGNORE INTO streaks (category_id) VALUES (5);
    INSERT OR IGNORE INTO quests (category_id,key,name,tier,base_xp,frequency,repeatable,sort_order) VALUES
      (5,'g_aim_warmup','Aim trainer warm-up (10+ min)','easy',10,'daily',1,1),
      (5,'g_review','Review your last session (notes, one thing to fix)','easy',10,'daily',1,2),
      (5,'g_sessions_4x','Log 4+ gaming sessions this week','medium',25,'weekly',1,3),
      (5,'g_capture_test','Test one setting change with a PresentMon capture','medium',25,'weekly',1,4),
      (5,'g_aim_pb','Beat an aim-trainer personal best','hard',50,'weekly',1,5),
      (5,'g_peak_rank','Reach a new peak rank','epic',150,'epic',0,6),
      (5,'g_stutter_checklist','Work through the whole stutter checklist','epic',100,'epic',0,7);
    INSERT OR IGNORE INTO badges (key,name,description,icon,category_id) VALUES
      ('spark_gaming','3-Day Spark','3-day Gaming streak','🌟',5),
      ('week_gaming','Week Warrior','7-day Gaming streak','🔥',5),
      ('fortnight_gaming','Fortnight Flame','14-day Gaming streak','⚡',5),
      ('monthly_gaming','Monthly Master','30-day Gaming streak','🏆',5),
      ('centurion_gaming','Centurion','100-day Gaming streak','👑',5);
  `},
  { version: 12, sql: `
    -- How frames reached the screen (presentpath.js summary as JSON) and its dominant kind,
    -- so the capture list can show a badge without parsing every row. NULL for captures
    -- saved before this version.
    ALTER TABLE gaming_captures ADD COLUMN present_kind TEXT;
    ALTER TABLE gaming_captures ADD COLUMN present_json TEXT;
  `}
]

// Migrations that only touch gaming_* tables. Ones flagged `core: true` also write to
// db.js-owned tables (categories, quests, ...), so unit tests with a bare in-memory
// DB use this subset; the full list is exercised against the real DB under Electron.
const standaloneMigrations = migrations.filter(m => !m.core)

module.exports = { migrations, standaloneMigrations }
