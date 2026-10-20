'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite') // better-sqlite3 is built for Electron's ABI, so tests use Node's built-in
const { standaloneMigrations: migrations } = require('./schema')
const { createStore } = require('./store')

function freshStore() {
  const db = new DatabaseSync(':memory:')
  for (const m of migrations) db.exec(m.sql)
  return { db, store: createStore(() => db) }
}

test('save + list sens profiles', () => {
  const { store } = freshStore()
  store.saveSensProfile({ name: 'Valorant main', game: 'valorant', sens: 0.4, dpi: 800 })
  store.saveSensProfile({ name: 'testing 0.3', game: 'valorant', sens: 0.3, dpi: 1600 })
  const list = store.listSensProfiles()
  assert.deepEqual(list.map(p => p.name), ['testing 0.3', 'Valorant main'])
  assert.equal(list[1].sens, 0.4)
  assert.equal(list[1].dpi, 800)
})

test('saving an existing name overwrites it', () => {
  const { store } = freshStore()
  store.saveSensProfile({ name: 'main', game: 'valorant', sens: 0.4, dpi: 800 })
  store.saveSensProfile({ name: ' main ', game: 'cs2', sens: 1.2, dpi: 800 })
  const list = store.listSensProfiles()
  assert.equal(list.length, 1)
  assert.equal(list[0].game, 'cs2')
  assert.equal(list[0].sens, 1.2)
})

test('delete removes only that profile', () => {
  const { store } = freshStore()
  const a = store.saveSensProfile({ name: 'a', game: 'valorant', sens: 0.4, dpi: 800 })
  store.saveSensProfile({ name: 'b', game: 'valorant', sens: 0.5, dpi: 800 })
  assert.equal(store.deleteSensProfile(a.id).deleted, true)
  assert.equal(store.deleteSensProfile(a.id).deleted, false)
  assert.deepEqual(store.listSensProfiles().map(p => p.name), ['b'])
})

test('rejects invalid profiles', () => {
  const { store } = freshStore()
  const ok = { name: 'x', game: 'valorant', sens: 0.4, dpi: 800 }
  assert.throws(() => store.saveSensProfile({ ...ok, name: '  ' }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, game: 'doom' }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, sens: 0 }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, sens: 'abc' }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, dpi: -5 }), RangeError)
  assert.throws(() => store.deleteSensProfile('1'), RangeError)
  assert.equal(store.listSensProfiles().length, 0)
})

// ── Sessions & aim scores ────────────────────────────────────────────────────
function storeWithXp() {
  const db = new DatabaseSync(':memory:')
  for (const m of migrations) db.exec(m.sql)
  const calls = []
  const store = createStore(() => db, a => { calls.push(a); return { awarded: a.amount } })
  return { db, store, calls }
}
const sess = (over = {}) => ({ date: '2026-10-20', start_time: '21:30', end_time: '23:00', game: 'Valorant', mode: 'Competitive', result: 'win', score: 18, rank_change: 21, smoothness: 4, notes: 'ok', ...over })

test('add + list session, newest first, joined with sens profile name', () => {
  const { store } = storeWithXp()
  const p = store.saveSensProfile({ name: 'main', game: 'valorant', sens: 0.4, dpi: 800 })
  store.addSession(sess({ date: '2026-10-19', sens_profile_id: p.id }))
  store.addSession(sess({ date: '2026-10-20' }))
  const list = store.listSessions()
  assert.deepEqual(list.map(s => s.date), ['2026-10-20', '2026-10-19'])
  assert.equal(list[1].sens_profile_name, 'main')
  assert.equal(list[0].rank_change, 21)
})

test('optional session fields may be blank', () => {
  const { store } = storeWithXp()
  store.addSession({ date: '2026-10-20', game: 'CS2', start_time: '', score: '', result: '', smoothness: '' })
  const s = store.listSessions()[0]
  assert.equal(s.start_time, null)
  assert.equal(s.score, null)
  assert.equal(s.result, null)
  assert.equal(s.smoothness, null)
})

test('session validation', () => {
  const { store } = storeWithXp()
  assert.throws(() => store.addSession(sess({ game: ' ' })), RangeError)
  assert.throws(() => store.addSession(sess({ date: '20/10/2026' })), RangeError)
  assert.throws(() => store.addSession(sess({ date: '2026-13-45' })), RangeError)
  assert.throws(() => store.addSession(sess({ start_time: '25:00' })), RangeError)
  assert.throws(() => store.addSession(sess({ result: 'won' })), RangeError)
  assert.throws(() => store.addSession(sess({ smoothness: 6 })), RangeError)
  assert.throws(() => store.addSession(sess({ smoothness: 3.5 })), RangeError)
  assert.throws(() => store.addSession(sess({ score: 'abc' })), RangeError)
  assert.throws(() => store.addSession(sess({ rank_change: 1.5 })), RangeError)
  assert.throws(() => store.addSession(sess({ sens_profile_id: 999 })), RangeError)
  assert.equal(store.listSessions().length, 0)
})

test('deleting a sens profile keeps sessions that used it', () => {
  const { store, db } = storeWithXp()
  db.exec('PRAGMA foreign_keys = ON')
  const p = store.saveSensProfile({ name: 'main', game: 'valorant', sens: 0.4, dpi: 800 })
  store.addSession(sess({ sens_profile_id: p.id }))
  store.deleteSensProfile(p.id)
  const s = store.listSessions()
  assert.equal(s.length, 1)
  assert.equal(s[0].sens_profile_id, null)
})

test('delete session', () => {
  const { store } = storeWithXp()
  const { id } = store.addSession(sess())
  assert.equal(store.deleteSession(id).deleted, true)
  assert.equal(store.listSessions().length, 0)
})

test('aim scores: add, validate, list, delete', () => {
  const { store } = storeWithXp()
  const { id } = store.addAimScore({ date: '2026-10-20', scenario: 'Gridshot', score: '81234.5' })
  store.addAimScore({ date: '2026-10-21', scenario: 'Tracking', score: 77 })
  assert.deepEqual(store.listAimScores().map(a => a.scenario), ['Tracking', 'Gridshot'])
  assert.equal(store.listAimScores()[1].score, 81234.5)
  assert.throws(() => store.addAimScore({ date: '2026-10-20', scenario: '', score: 1 }), RangeError)
  assert.throws(() => store.addAimScore({ date: '2026-10-20', scenario: 'x' }), RangeError)
  assert.throws(() => store.addAimScore({ date: 'bad', scenario: 'x', score: 1 }), RangeError)
  assert.equal(store.deleteAimScore(id).deleted, true)
})

test('logging awards XP via the injected hook with the daily cap passed through', () => {
  const { store, calls } = storeWithXp()
  const s = store.addSession(sess())
  assert.equal(s.xp.awarded, 20)
  store.addAimScore({ date: '2026-10-20', scenario: 'Gridshot', score: 1 })
  assert.deepEqual(calls.map(c => [c.sourceType, c.amount, c.dailyCap]), [['gaming_session', 20, 3], ['gaming_aim_score', 5, 3]])
})

test('an XP failure does not fail the save', () => {
  const db = new DatabaseSync(':memory:')
  for (const m of migrations) db.exec(m.sql)
  const store = createStore(() => db, () => { throw new Error('boom') })
  const r = store.addSession(sess())
  assert.equal(r.xp, null)
  assert.equal(store.listSessions().length, 1)
})

// ── PresentMon path + captures ───────────────────────────────────────────────
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Frames = require('./framemetrics')

function freshWithSettings() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)') // db.js owns this table
  for (const m of migrations) db.exec(m.sql)
  return createStore(() => db)
}
const mkCapture = (fts, app = 'game.exe') => ({ app, seconds: 10, frametimes: fts, metrics: Frames.computeMetrics(fts) })

test('presentmon path: only a real PresentMon exe is accepted and it persists', () => {
  const store = freshWithSettings()
  assert.equal(store.getPresentMonPath(), null)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-store-'))
  const exe = path.join(dir, 'PresentMon-2.3.0-x64.exe'); fs.writeFileSync(exe, 'x')
  const bad = path.join(dir, 'notepad.exe'); fs.writeFileSync(bad, 'x')
  assert.throws(() => store.setPresentMonPath(bad), /PresentMon/)
  assert.equal(store.getPresentMonPath(), null)
  store.setPresentMonPath(exe)
  assert.equal(store.getPresentMonPath(), path.normalize(exe))
})

test('captures: save, list without frametimes, get with frametimes, delete', () => {
  const store = freshWithSettings()
  const fts = [...Array(300).fill(4.123456), 30]
  const saved = store.saveCapture('  baseline ', mkCapture(fts))
  assert.equal(saved.label, 'baseline')
  assert.equal(saved.frames, 301)
  assert.equal(saved.spikes, 1)
  store.saveCapture('polling 2000Hz', mkCapture(Array(100).fill(3)))
  const list = store.listCaptures()
  assert.deepEqual(list.map(c => c.label), ['polling 2000Hz', 'baseline'])
  assert.equal(list[0].frametimes, undefined)
  const full = store.getCapture(saved.id)
  assert.equal(full.frametimes.length, 301)
  assert.equal(full.frametimes[0], 4.12) // rounded to 2 dp
  assert.equal(full.frametimes[300], 30)
  assert.equal(store.deleteCapture(saved.id).deleted, true)
  assert.throws(() => store.getCapture(saved.id), /not found/)
})

test('captures: validation', () => {
  const store = freshWithSettings()
  assert.throws(() => store.saveCapture('', mkCapture([5, 5])), RangeError)
  assert.throws(() => store.saveCapture('x'.repeat(81), mkCapture([5, 5])), RangeError)
  assert.throws(() => store.saveCapture('ok', null), /No capture/)
  assert.throws(() => store.saveCapture('ok', { frametimes: [], metrics: null }), /No capture/)
  assert.throws(() => store.getCapture('1'), RangeError)
  assert.equal(store.listCaptures().length, 0)
})
