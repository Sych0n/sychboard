'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const { standaloneMigrations: migrations } = require('./schema')
const { createStore } = require('./store')
const B = require('./backup')
const Frames = require('./framemetrics')

const NOW = '2026-10-20 12:00:00'

function seeded() {
  const db = new DatabaseSync(':memory:')
  for (const m of migrations) db.exec(m.sql)
  const store = createStore(() => db)
  const p = store.saveSensProfile({ name: 'main', game: 'valorant', sens: 0.4, dpi: 800 })
  store.saveSensProfile({ name: 'testing 0.3', game: 'valorant', sens: 0.3, dpi: 1600 })
  store.addSession({ date: '2026-10-19', start_time: '03:30', game: 'Valorant', result: 'loss', score: 120, smoothness: 2, sens_profile_id: p.id, notes: 'tired' })
  store.addSession({ date: '2026-10-20', start_time: '21:00', game: 'Valorant', result: 'win', score: 230, rank_change: 21 })
  store.addAimScore({ date: '2026-10-20', scenario: 'Gridshot', score: 81234.5 })
  const fts = Array.from({ length: 300 }, (_, i) => i % 50 === 0 ? 20 : 3.2)
  store.saveCapture('baseline', { app: 'game.exe', frametimes: fts, metrics: Frames.computeMetrics(fts) })
  return { db, store }
}

const inTx = (db, fn) => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e } }

test('export → clear → import round-trips everything, keeping session → profile links', () => {
  const { db, store } = seeded()
  const dump = JSON.parse(JSON.stringify(B.exportGaming(db))) // as it travels through a JSON file
  const before = { s: store.listSessions(), a: store.listAimScores(), p: store.listSensProfiles(), c: store.getCapture(1) }

  inTx(db, () => B.clearGaming(db))
  assert.equal(store.listSessions().length, 0)
  assert.equal(store.listCaptures().length, 0)

  assert.ok(B.isValidGaming(dump))
  inTx(db, () => B.importGaming(db, dump, NOW))
  assert.deepEqual(store.listSessions(), before.s)
  assert.deepEqual(store.listAimScores(), before.a)
  assert.deepEqual(store.listSensProfiles(), before.p)
  assert.deepEqual(store.getCapture(1), before.c)
  assert.equal(store.listSessions().find(s => s.notes === 'tired').sens_profile_name, 'main')
})

test('import replaces existing gaming data rather than merging', () => {
  const { db, store } = seeded()
  const dump = B.exportGaming(db)
  store.addAimScore({ date: '2026-10-21', scenario: 'Extra', score: 1 })
  inTx(db, () => B.importGaming(db, dump, NOW))
  assert.deepEqual(store.listAimScores().map(a => a.scenario), ['Gridshot'])
})

test('shape validation', () => {
  assert.equal(B.isValidGaming(undefined), false)
  assert.equal(B.isValidGaming({}), false)
  assert.equal(B.isValidGaming({ sens_profiles: [], sessions: [], aim_scores: [] }), false)
  assert.equal(B.isValidGaming({ sens_profiles: [], sessions: [], aim_scores: [], captures: 'x' }), false)
  assert.equal(B.isValidGaming({ sens_profiles: [], sessions: [], aim_scores: [], captures: [] }), true)
})

test('hostile / garbage rows are skipped, good rows still restored', () => {
  const { db, store } = seeded()
  const bad = {
    sens_profiles: [null, 5, { id: 1, name: 'ok', game: 'valorant', sens: 0.4, dpi: 800 }, { id: 2, name: '', game: 'x', sens: 1, dpi: 1 }, { id: 3, name: 'neg', game: 'g', sens: -1, dpi: 800 }, { id: 1, name: 'dupe id', game: 'g', sens: 1, dpi: 800 }],
    sessions: [
      { id: 1, date: '2026-10-20', game: 'Valorant', sens_profile_id: 1, smoothness: 4, result: 'win' },
      { id: 2, date: 'not-a-date', game: 'Valorant' },
      { id: 3, date: '2026-10-20', game: '' },
      { id: 4, date: '2026-10-20', game: 'CS2', sens_profile_id: 999, smoothness: 9, result: 'cheat', start_time: '25:99', score: 'abc' },
      { id: 'x', date: '2026-10-20', game: 'CS2' }, 'junk'
    ],
    aim_scores: [{ id: 1, date: '2026-10-20', scenario: 'ok', score: 5 }, { id: 2, date: '2026-10-20', scenario: 'nope', score: 'abc' }],
    captures: [
      { id: 1, label: 'good', frames: 3, duration_s: 1, avg_fps: 1, low1_fps: 1, low01_fps: 1, median_ms: 1, p99_ms: 1, max_ms: 1, spikes: 0, spike_threshold_ms: 2, frametimes: [1, 2, 'x', -5, 3] },
      { id: 2, label: 'no frametimes', frames: 3, duration_s: 1, avg_fps: 1, low1_fps: 1, low01_fps: 1, median_ms: 1, p99_ms: 1, max_ms: 1, spikes: 0, spike_threshold_ms: 2 },
      { id: 3, label: 'bad metric', frames: 3, duration_s: 1, avg_fps: 'x', low1_fps: 1, low01_fps: 1, median_ms: 1, p99_ms: 1, max_ms: 1, spikes: 0, spike_threshold_ms: 2, frametimes: [1] }
    ]
  }
  inTx(db, () => B.importGaming(db, bad, NOW))
  assert.deepEqual(store.listSensProfiles().map(p => p.name), ['ok'])
  const sessions = store.listSessions()
  assert.deepEqual(sessions.map(s => s.id).sort(), [1, 4])
  const s4 = sessions.find(s => s.id === 4)
  assert.equal(s4.sens_profile_id, null)   // dangling profile id dropped
  assert.equal(s4.smoothness, null)        // out of range
  assert.equal(s4.result, null)            // not win/loss/draw
  assert.equal(s4.start_time, null)
  assert.equal(s4.score, null)
  assert.equal(sessions.find(s => s.id === 1).sens_profile_name, 'ok')
  assert.deepEqual(store.listAimScores().map(a => a.scenario), ['ok'])
  assert.deepEqual(store.listCaptures().map(c => c.label), ['good'])
  assert.deepEqual(store.getCapture(1).frametimes, [1, 2, 3])
})

test('a failure mid-import rolls back (transaction owned by the caller)', () => {
  const { db, store } = seeded()
  const dump = B.exportGaming(db)
  db.exec('DROP TABLE gaming_captures') // make the last step blow up
  assert.throws(() => inTx(db, () => B.importGaming(db, dump, NOW)))
  assert.equal(store.listSessions().length, 2) // untouched
  assert.equal(store.listSensProfiles().length, 2)
})

test('machine-specific settings are never exported or restored', () => {
  assert.deepEqual(B.MACHINE_SETTINGS, ['gaming_presentmon_path', 'obsidian_vault_path'])
})
