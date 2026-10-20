'use strict'
// Main-process data layer for the Gaming tab. `getDb` is injected (see main.js)
// so this file has no dependency on db.js and can be tested with an in-memory DB.
const Sens = require('./sens')

function createStore(getDb) {
  const db = () => {
    const d = getDb()
    if (!d) throw new Error('Database not initialised')
    return d
  }

  // ── Sens profiles ──────────────────────────────────────────────────────────
  function listSensProfiles() {
    return db().prepare('SELECT id, name, game, sens, dpi, updated_at FROM gaming_sens_profiles ORDER BY name COLLATE NOCASE').all()
  }

  // Saving an existing name overwrites it, so "testing 0.3" can be re-saved as it changes.
  function saveSensProfile({ name, game, sens, dpi }) {
    const n = typeof name === 'string' ? name.trim() : ''
    if (!n || n.length > 60) throw new RangeError('Profile name must be 1-60 characters')
    Sens.yawFor(game) // throws on unknown game
    const s = Number(sens), d = Number(dpi)
    if (!Number.isFinite(s) || s <= 0) throw new RangeError('Sensitivity must be a positive number')
    if (!Number.isFinite(d) || d <= 0) throw new RangeError('DPI must be a positive number')
    db().prepare(`
      INSERT INTO gaming_sens_profiles (name, game, sens, dpi) VALUES (?,?,?,?)
      ON CONFLICT(name) DO UPDATE SET game=excluded.game, sens=excluded.sens, dpi=excluded.dpi, updated_at=datetime('now')
    `).run(n, game, s, Math.round(d))
    return db().prepare('SELECT id, name, game, sens, dpi, updated_at FROM gaming_sens_profiles WHERE name=?').get(n)
  }

  function deleteSensProfile(id) {
    if (!Number.isInteger(id) || id <= 0) throw new RangeError('Invalid profile id')
    return { deleted: db().prepare('DELETE FROM gaming_sens_profiles WHERE id=?').run(id).changes > 0 }
  }

  return { listSensProfiles, saveSensProfile, deleteSensProfile }
}

module.exports = { createStore }
