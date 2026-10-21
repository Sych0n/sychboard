'use strict'
// Gaming-tab data in SychBoard's backup / restore / clear-all flows. These take a
// db handle and do NOT open their own transaction: db.js calls them from inside its
// own export/import/clear transactions so a restore is all-or-nothing.
const Present = require('./presentpath')

// Settings that describe this machine, not the user's data. Never exported, never
// restored from a file (a crafted backup must not be able to point SychBoard at an
// arbitrary executable), and kept across import / clear.
const MACHINE_SETTINGS = ['gaming_presentmon_path', 'obsidian_vault_path']

const TABLES = ['sens_profiles', 'sessions', 'aim_scores', 'captures']

function exportGaming(db) {
  return {
    sens_profiles: db.prepare('SELECT id, name, game, sens, dpi, created_at, updated_at FROM gaming_sens_profiles').all(),
    sessions: db.prepare('SELECT id, date, start_time, end_time, game, mode, result, score, rank_change, notes, smoothness, sens_profile_id, created_at FROM gaming_sessions').all(),
    aim_scores: db.prepare('SELECT id, date, scenario, score, notes, created_at FROM gaming_aim_scores').all(),
    captures: db.prepare('SELECT id, created_at, label, app, duration_s, frames, avg_fps, low1_fps, low01_fps, median_ms, p99_ms, max_ms, spikes, spike_threshold_ms, frametimes, present_json FROM gaming_captures').all()
      .map(c => {
        try {
          const { present_json, ...rest } = c
          let present = null
          try { present = present_json ? JSON.parse(present_json) : null } catch (_) { /* damaged: leave out */ }
          return { ...rest, frametimes: JSON.parse(c.frametimes), present }
        } catch (_) { return null }
      }).filter(Boolean)
  }
}

// Shape check only (every table present as an array) — row-level problems are
// skipped individually by importGaming. Call before touching anything.
function isValidGaming(g) {
  return !!g && typeof g === 'object' && TABLES.every(t => Array.isArray(g[t]))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const TS_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const isObj = v => v && typeof v === 'object'
const str = (v, max) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
const num = v => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const posNum = v => { const n = num(v); return n !== null && n > 0 ? n : null }
const int = v => { const n = num(v); return n !== null && Number.isInteger(n) ? n : null }
const posInt = v => { const n = int(v); return n !== null && n > 0 ? n : null }
const ts = v => (typeof v === 'string' && TS_RE.test(v) ? v : null)
const date = v => (typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) ? v : null)
const time = v => (typeof v === 'string' && TIME_RE.test(v) ? v : null)

// Replaces all gaming data with `g` (already shape-checked). Invalid rows are skipped.
// Row ids are preserved so sessions keep pointing at the right sens profile.
function importGaming(db, g, nowStr) {
  db.prepare('DELETE FROM gaming_sessions').run()
  db.prepare('DELETE FROM gaming_aim_scores').run()
  db.prepare('DELETE FROM gaming_captures').run()
  db.prepare('DELETE FROM gaming_sens_profiles').run()

  const profileIds = new Set()
  const insP = db.prepare('INSERT OR IGNORE INTO gaming_sens_profiles (id,name,game,sens,dpi,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
  for (const p of g.sens_profiles) {
    if (!isObj(p)) continue
    const id = posInt(p.id), name = str(p.name, 60), game = str(p.game, 40), sens = posNum(p.sens), dpi = posNum(p.dpi)
    if (!id || !name || !game || !sens || !dpi) continue
    if (insP.run(id, name, game, sens, Math.round(dpi), ts(p.created_at) || nowStr, ts(p.updated_at) || nowStr).changes) profileIds.add(id)
  }

  const insS = db.prepare(`INSERT OR IGNORE INTO gaming_sessions
    (id,date,start_time,end_time,game,mode,result,score,rank_change,notes,smoothness,sens_profile_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const s of g.sessions) {
    if (!isObj(s)) continue
    const id = posInt(s.id), d = date(s.date), game = str(s.game, 40)
    if (!id || !d || !game) continue
    const sm = int(s.smoothness), pid = posInt(s.sens_profile_id)
    insS.run(id, d, time(s.start_time), time(s.end_time), game, str(s.mode, 40),
      ['win', 'loss', 'draw'].includes(s.result) ? s.result : null, num(s.score), int(s.rank_change),
      str(s.notes, 1000), sm !== null && sm >= 1 && sm <= 5 ? sm : null,
      pid && profileIds.has(pid) ? pid : null, ts(s.created_at) || nowStr)
  }

  const insA = db.prepare('INSERT OR IGNORE INTO gaming_aim_scores (id,date,scenario,score,notes,created_at) VALUES (?,?,?,?,?,?)')
  for (const a of g.aim_scores) {
    if (!isObj(a)) continue
    const id = posInt(a.id), d = date(a.date), sc = str(a.scenario, 80), score = num(a.score)
    if (!id || !d || !sc || score === null) continue
    insA.run(id, d, sc, score, str(a.notes, 500), ts(a.created_at) || nowStr)
  }

  const insC = db.prepare(`INSERT OR IGNORE INTO gaming_captures
    (id,created_at,label,app,duration_s,frames,avg_fps,low1_fps,low01_fps,median_ms,p99_ms,max_ms,spikes,spike_threshold_ms,frametimes,present_kind,present_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const c of g.captures) {
    if (!isObj(c) || !Array.isArray(c.frametimes)) continue
    const id = posInt(c.id), label = str(c.label, 80)
    const [dur, avg, low1, low01, median, p99, max, spikeThr] =
      [c.duration_s, c.avg_fps, c.low1_fps, c.low01_fps, c.median_ms, c.p99_ms, c.max_ms, c.spike_threshold_ms].map(posNum)
    const frames = posInt(c.frames), spikes = int(c.spikes)
    const ft = c.frametimes.map(Number).filter(v => Number.isFinite(v) && v > 0)
    if (!id || !label || [dur, avg, low1, low01, median, p99, max, spikeThr].some(n => n === null) ||
        !frames || spikes === null || spikes < 0 || !ft.length) continue
    const present = Present.sanitize(c.present)
    insC.run(id, ts(c.created_at) || nowStr, label, str(c.app, 120), dur, frames, avg, low1, low01, median, p99, max, spikes, spikeThr,
      JSON.stringify(ft.map(v => Math.round(v * 100) / 100)), present ? present.kind : null, present ? JSON.stringify(present) : null)
  }
}

function clearGaming(db) {
  db.prepare('DELETE FROM gaming_sessions').run()
  db.prepare('DELETE FROM gaming_aim_scores').run()
  db.prepare('DELETE FROM gaming_captures').run()
  db.prepare('DELETE FROM gaming_sens_profiles').run()
}

module.exports = { MACHINE_SETTINGS, exportGaming, isValidGaming, importGaming, clearGaming }
