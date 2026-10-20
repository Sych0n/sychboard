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
  `}
]

module.exports = { migrations }
