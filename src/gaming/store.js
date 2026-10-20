'use strict'
// Main-process data layer for the Gaming tab. `getDb` is injected (see main.js)
// so this file has no dependency on db.js and can be tested with an in-memory DB.
const Sens = require('./sens')

// `awardXp` is db.awardXp (optional: tests pass a stub).
function createStore(getDb, awardXp) {
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

  // ── Sessions & aim scores ──────────────────────────────────────────────────
  // XP: small flat awards, capped per app-day so logging stays a habit, not a farm.
  const XP = {
    session: { amount: 20, dailyCap: 3, type: 'gaming_session' },
    aim: { amount: 5, dailyCap: 3, type: 'gaming_aim_score' }
  }

  function award(kind, sourceId, reason) {
    if (!awardXp) return null
    const x = XP[kind]
    // The row is already saved; an XP hiccup must not make the log look like it failed.
    try { return awardXp({ amount: x.amount, sourceType: x.type, sourceId, reason, dailyCap: x.dailyCap }) }
    catch (e) { console.error('[gaming] XP award failed:', e.message); return null }
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

  function reqDate(v) {
    if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(Date.parse(v + 'T00:00:00Z'))) throw new RangeError('Date must be YYYY-MM-DD')
    return v
  }
  function optTime(v, label) {
    if (v == null || v === '') return null
    if (typeof v !== 'string' || !TIME_RE.test(v)) throw new RangeError(`${label} must be HH:MM`)
    return v
  }
  function optNum(v, label) {
    if (v == null || v === '') return null
    const n = Number(v)
    if (!Number.isFinite(n)) throw new RangeError(`${label} must be a number`)
    return n
  }
  function optText(v, max, label) {
    if (v == null) return null
    const t = String(v).trim()
    if (t.length > max) throw new RangeError(`${label} is too long (max ${max})`)
    return t || null
  }

  function addSession(p) {
    const game = optText(p.game, 40, 'Game')
    if (!game) throw new RangeError('Game is required')
    const result = p.result == null || p.result === '' ? null : p.result
    if (result !== null && !['win', 'loss', 'draw'].includes(result)) throw new RangeError('Result must be win, loss or draw')
    const smoothness = optNum(p.smoothness, 'Smoothness')
    if (smoothness !== null && (!Number.isInteger(smoothness) || smoothness < 1 || smoothness > 5)) throw new RangeError('Smoothness must be 1-5')
    const rank = optNum(p.rank_change, 'Rank change')
    if (rank !== null && !Number.isInteger(rank)) throw new RangeError('Rank change must be a whole number')
    let profileId = p.sens_profile_id == null || p.sens_profile_id === '' ? null : Number(p.sens_profile_id)
    if (profileId !== null) {
      if (!Number.isInteger(profileId) || !db().prepare('SELECT 1 FROM gaming_sens_profiles WHERE id=?').get(profileId)) throw new RangeError('Unknown sens profile')
    }
    const row = [
      reqDate(p.date), optTime(p.start_time, 'Start time'), optTime(p.end_time, 'End time'),
      game, optText(p.mode, 40, 'Mode'), result, optNum(p.score, 'Score'), rank,
      optText(p.notes, 1000, 'Notes'), smoothness, profileId
    ]
    const info = db().prepare(`INSERT INTO gaming_sessions
      (date,start_time,end_time,game,mode,result,score,rank_change,notes,smoothness,sens_profile_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(...row)
    const id = Number(info.lastInsertRowid)
    return { id, xp: award('session', id, 'Logged gaming session: ' + game) }
  }

  function listSessions(limit = 500) {
    return db().prepare(`SELECT s.*, p.name AS sens_profile_name FROM gaming_sessions s
      LEFT JOIN gaming_sens_profiles p ON p.id = s.sens_profile_id
      ORDER BY s.date DESC, COALESCE(s.start_time,'') DESC, s.id DESC LIMIT ?`).all(Math.min(Math.max(1, limit | 0), 5000))
  }

  function deleteSession(id) {
    if (!Number.isInteger(id) || id <= 0) throw new RangeError('Invalid session id')
    return { deleted: db().prepare('DELETE FROM gaming_sessions WHERE id=?').run(id).changes > 0 }
  }

  function addAimScore(p) {
    const scenario = optText(p.scenario, 80, 'Scenario')
    if (!scenario) throw new RangeError('Scenario is required')
    const score = optNum(p.score, 'Score')
    if (score === null) throw new RangeError('Score is required')
    const info = db().prepare('INSERT INTO gaming_aim_scores (date,scenario,score,notes) VALUES (?,?,?,?)')
      .run(reqDate(p.date), scenario, score, optText(p.notes, 500, 'Notes'))
    const id = Number(info.lastInsertRowid)
    return { id, xp: award('aim', id, 'Logged aim score: ' + scenario) }
  }

  function listAimScores(limit = 1000) {
    return db().prepare('SELECT * FROM gaming_aim_scores ORDER BY date DESC, id DESC LIMIT ?').all(Math.min(Math.max(1, limit | 0), 5000))
  }

  function deleteAimScore(id) {
    if (!Number.isInteger(id) || id <= 0) throw new RangeError('Invalid score id')
    return { deleted: db().prepare('DELETE FROM gaming_aim_scores WHERE id=?').run(id).changes > 0 }
  }

  // ── PresentMon path + saved frametime captures ─────────────────────────────
  const PM_KEY = 'gaming_presentmon_path'

  function getPresentMonPath() {
    const r = db().prepare('SELECT value FROM settings WHERE key=?').get(PM_KEY)
    return r && r.value ? r.value : null
  }

  // Only ever called with a path from the native file dialog (see ipc.js); the
  // renderer cannot set an arbitrary executable to run.
  function setPresentMonPath(p) {
    const valid = require('./presentmon').validateExePath(p)
    db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(PM_KEY, valid)
    return valid
  }

  const CAPTURE_COLS = 'id, created_at, label, app, duration_s, frames, avg_fps, low1_fps, low01_fps, median_ms, p99_ms, max_ms, spikes, spike_threshold_ms'

  // `capture` = the result of a PresentMon run ({app, seconds, frametimes, metrics}).
  function saveCapture(label, capture) {
    const l = typeof label === 'string' ? label.trim() : ''
    if (!l || l.length > 80) throw new RangeError('Label must be 1-80 characters (e.g. "baseline", "polling 2000Hz")')
    if (!capture || !capture.metrics || !Array.isArray(capture.frametimes) || !capture.frametimes.length) throw new Error('No capture to save — run one first')
    const m = capture.metrics
    const ft = JSON.stringify(capture.frametimes.map(v => Math.round(v * 100) / 100))
    const info = db().prepare(`INSERT INTO gaming_captures
      (label,app,duration_s,frames,avg_fps,low1_fps,low01_fps,median_ms,p99_ms,max_ms,spikes,spike_threshold_ms,frametimes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(l, capture.app || null, m.durationSec, m.frames, m.avgFps, m.low1Fps, m.low01Fps, m.medianMs, m.p99Ms, m.maxMs, m.spikes, m.spikeThresholdMs, ft)
    return db().prepare(`SELECT ${CAPTURE_COLS} FROM gaming_captures WHERE id=?`).get(Number(info.lastInsertRowid))
  }

  function listCaptures() {
    return db().prepare(`SELECT ${CAPTURE_COLS} FROM gaming_captures ORDER BY id DESC LIMIT 200`).all()
  }

  function getCapture(id) {
    if (!Number.isInteger(id) || id <= 0) throw new RangeError('Invalid capture id')
    const r = db().prepare(`SELECT ${CAPTURE_COLS}, frametimes FROM gaming_captures WHERE id=?`).get(id)
    if (!r) throw new Error('Capture not found')
    return { ...r, frametimes: JSON.parse(r.frametimes) }
  }

  function deleteCapture(id) {
    if (!Number.isInteger(id) || id <= 0) throw new RangeError('Invalid capture id')
    return { deleted: db().prepare('DELETE FROM gaming_captures WHERE id=?').run(id).changes > 0 }
  }

  return {
    listSensProfiles, saveSensProfile, deleteSensProfile,
    addSession, listSessions, deleteSession, addAimScore, listAimScores, deleteAimScore,
    getPresentMonPath, setPresentMonPath, saveCapture, listCaptures, getCapture, deleteCapture
  }
}

module.exports = { createStore }
