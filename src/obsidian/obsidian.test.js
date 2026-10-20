'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { buildFiles, pickState } = require('./export')
const { isVault, ownedBySychboard, syncToVault } = require('./vault')
const { registerObsidianIpc, KEY } = require('./ipc')

const STATE = () => ({
  journals: { '2026-10-20': 'Worked on **PC tuning**.\r\n- measured polling', '2026-10-19': '  ', 'not-a-date': 'x', '../../evil': 'y' },
  goals: [{ text: 'Reach Diamond', category: 'Gaming', done: false }, { text: 'Pass theory', category: 'Uni life', done: true }, { text: '', category: 'x', done: false }, 'junk'],
  setupTodos: [{ text: 'Install stuff', done: true }],
  genTodos: [{ text: 'Buy cable\nDP 1.4', done: false }],
  secTodos: { finance: [{ text: 'Budget', done: false }], uni: [], travel: [{ text: 'Book train', done: true }] },
  devTodos: [{ text: 'Ship gaming tab', done: false }],
  todayFocus: 'PC tuning',
  uniNotes: 'Lecture notes\nline 2',
  fitnessNotes: ''
})
const by = (files, p) => files.find(f => f.relPath === p)

function mkVault() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-'))
  fs.mkdirSync(path.join(d, '.obsidian'))
  return d
}

// ── export ───────────────────────────────────────────────────────────────────
test('exports journal, goals, todos, notes and an index, all marked as SychBoard-owned', () => {
  const files = buildFiles(STATE())
  assert.deepEqual(files.map(f => f.relPath).sort(), [
    'SychBoard/00 SychBoard.md', 'SychBoard/Goals.md', 'SychBoard/Journal/2026-10-20.md', 'SychBoard/Notes.md', 'SychBoard/Todos.md'])
  for (const f of files) {
    assert.ok(f.content.startsWith('---\nsource: sychboard\n'), f.relPath + ' has the ownership marker first')
    assert.ok(!f.content.includes('\r'), 'normalised line endings')
  }
})

test('journal: only valid dates, empty entries skipped, no path trickery', () => {
  const files = buildFiles(STATE()).filter(f => f.relPath.includes('/Journal/'))
  assert.equal(files.length, 1)
  const j = files[0].content
  assert.match(j, /date: 2026-10-20/)
  assert.match(j, /# 2026-10-20\n\nWorked on \*\*PC tuning\*\*\.\n- measured polling\n$/)
})

test('goals and todos become checklists with categories, sections and single-line items', () => {
  const files = buildFiles(STATE())
  const goals = by(files, 'SychBoard/Goals.md').content
  assert.match(goals, /## Active\n\n- \[ \] Reach Diamond #Gaming/)
  assert.match(goals, /## Done\n\n- \[x\] Pass theory #Uni-life/)
  const todos = by(files, 'SychBoard/Todos.md').content
  assert.match(todos, /\*\*Today's focus:\*\* PC tuning/)
  assert.match(todos, /## Setup\n\n- \[x\] Install stuff/)
  assert.match(todos, /## General\n\n- \[ \] Buy cable DP 1\.4/)
  assert.match(todos, /## Finance\n\n- \[ \] Budget/)
  assert.match(todos, /## Travel\n\n- \[x\] Book train/)
  assert.ok(!/## Uni/.test(todos), 'empty sections are omitted')
  assert.match(todos, /## Dev \/ Side Project\n\n- \[ \] Ship gaming tab/)
})

test('notes file only has non-empty sections; empty state exports just the index', () => {
  const notes = by(buildFiles(STATE()), 'SychBoard/Notes.md').content
  assert.match(notes, /## Uni\n\nLecture notes\nline 2/)
  assert.ok(!/## Fitness/.test(notes))
  const empty = buildFiles({})
  assert.deepEqual(empty.map(f => f.relPath), ['SychBoard/00 SychBoard.md'])
  assert.deepEqual(buildFiles(null).map(f => f.relPath), ['SychBoard/00 SychBoard.md'])
})

test('output is deterministic (so unchanged files are not rewritten)', () => {
  assert.deepEqual(buildFiles(STATE()), buildFiles(STATE()))
})

test('pickState drops everything outside the allowlist (finances, keys, chat...)', () => {
  const picked = pickState({ ...STATE(), balances: { bank: 999 }, apiKeys: { groq: 'secret' }, groqKey: 'secret', chatHistory: ['hi'], sleep: {} })
  assert.deepEqual(Object.keys(picked).sort(), ['fitnessNotes', 'genTodos', 'goals', 'journals', 'secTodos', 'setupTodos', 'devTodos', 'todayFocus', 'uniNotes'].sort())
  const all = JSON.stringify(buildFiles(picked))
  assert.ok(!all.includes('secret') && !all.includes('999'))
  assert.deepEqual(pickState('x'), {})
})

// ── vault writer ─────────────────────────────────────────────────────────────
test('isVault requires a directory containing .obsidian', () => {
  const v = mkVault()
  assert.equal(isVault(v), true)
  assert.equal(isVault(os.tmpdir()), false)
  assert.equal(isVault(path.join(v, 'nope')), false)
  assert.equal(isVault(null), false)
})

test('writes files under <vault>/SychBoard, then reports unchanged on the second run', () => {
  const v = mkVault()
  const files = buildFiles(STATE())
  const r1 = syncToVault(v, files)
  assert.equal(r1.written.length, files.length)
  assert.deepEqual(r1.errors, [])
  assert.ok(fs.existsSync(path.join(v, 'SychBoard', 'Journal', '2026-10-20.md')))
  const r2 = syncToVault(v, files)
  assert.equal(r2.written.length, 0)
  assert.equal(r2.unchanged.length, files.length)
  assert.equal(fs.readdirSync(path.join(v, 'SychBoard')).some(n => n.endsWith('.sychboard-tmp')), false, 'no temp files left')
})

test('updates its own file when the content changes', () => {
  const v = mkVault()
  syncToVault(v, buildFiles(STATE()))
  const s = STATE(); s.journals['2026-10-20'] = 'new text'
  const r = syncToVault(v, buildFiles(s))
  assert.deepEqual(r.written, ['SychBoard/Journal/2026-10-20.md'])
  assert.match(fs.readFileSync(path.join(v, 'SychBoard', 'Journal', '2026-10-20.md'), 'utf8'), /new text/)
})

test('NEVER overwrites a hand-written file with the same name', () => {
  const v = mkVault()
  fs.mkdirSync(path.join(v, 'SychBoard'), { recursive: true })
  const mine = path.join(v, 'SychBoard', 'Goals.md')
  fs.writeFileSync(mine, '# My own goals\nwritten by hand\n')
  const r = syncToVault(v, buildFiles(STATE()))
  assert.equal(fs.readFileSync(mine, 'utf8'), '# My own goals\nwritten by hand\n')
  assert.equal(r.skipped.length, 1)
  assert.equal(r.skipped[0].file, 'SychBoard/Goals.md')
  assert.ok(r.written.length >= 3, 'the other files still sync')
})

test('a file that merely mentions the marker in its body is not treated as owned', () => {
  const v = mkVault()
  const f = path.join(v, 'x.md')
  fs.writeFileSync(f, '# Title\n\nsource: sychboard\n')
  assert.equal(ownedBySychboard(f), false)
  fs.writeFileSync(f, '---\ntags: [a]\n---\nsource: sychboard\n')
  assert.equal(ownedBySychboard(f), false)
  fs.writeFileSync(f, '---\nsource: sychboard\n---\nbody\n')
  assert.equal(ownedBySychboard(f), true)
  assert.equal(ownedBySychboard(path.join(v, 'missing.md')), false)
})

test('refuses non-vaults and paths that escape the SychBoard folder', () => {
  assert.throws(() => syncToVault(os.tmpdir(), buildFiles(STATE())), /Not an Obsidian vault/)
  const v = mkVault()
  const r = syncToVault(v, [
    { relPath: '../outside.md', content: 'x' }, { relPath: 'Other/note.md', content: 'x' },
    { relPath: 'SychBoard/../../escape.md', content: 'x' }, { relPath: 'SychBoard', content: 'x' }, { relPath: 'SychBoard/ok.md', content: 'fine' }])
  assert.deepEqual(r.written, ['SychBoard/ok.md'])
  assert.equal(r.errors.length, 4)
  assert.ok(!fs.existsSync(path.join(v, '..', 'outside.md')))
  assert.ok(!fs.existsSync(path.join(v, 'Other')))
})

test('never deletes: entries removed from SychBoard stay in the vault', () => {
  const v = mkVault()
  syncToVault(v, buildFiles(STATE()))
  const s = STATE(); s.journals = {}
  syncToVault(v, buildFiles(s))
  assert.ok(fs.existsSync(path.join(v, 'SychBoard', 'Journal', '2026-10-20.md')))
})

// ── ipc ──────────────────────────────────────────────────────────────────────
function ipcHarness(pickResult) {
  const handlers = {}, settings = {}
  registerObsidianIpc({ handle: (ch, fn) => { handlers[ch] = fn } }, {
    dialog: { showOpenDialog: async () => pickResult },
    getWindow: () => null,
    getSetting: k => settings[k], setSetting: (k, v) => { settings[k] = v }
  })
  return { call: (ch, ...a) => handlers[ch]({}, ...a), settings }
}

test('ipc: pick validates the vault, sync needs a connected vault, disconnect clears it', async () => {
  const v = mkVault()
  const bad = ipcHarness({ canceled: false, filePaths: [os.tmpdir()] })
  const r0 = await bad.call('obsidian:pick')
  assert.equal(r0.ok, false); assert.match(r0.error, /not an Obsidian vault/)
  assert.equal(bad.settings[KEY], undefined)
  assert.equal((await bad.call('obsidian:sync', STATE())).ok, false)

  const good = ipcHarness({ canceled: false, filePaths: [v] })
  assert.deepEqual((await good.call('obsidian:pick')).data, { path: v, valid: true })
  assert.equal((await good.call('obsidian:status')).data.valid, true)
  const s = await good.call('obsidian:sync', { ...STATE(), apiKeys: { groq: 'secret' } })
  assert.equal(s.ok, true); assert.ok(s.data.written.length >= 4)
  assert.ok(!fs.readdirSync(path.join(v, 'SychBoard')).join().includes('secret'))
  assert.deepEqual((await good.call('obsidian:disconnect')).data, { path: null, valid: false })
  assert.equal((await good.call('obsidian:sync', STATE())).ok, false)

  const cancelled = ipcHarness({ canceled: true, filePaths: [] })
  assert.equal((await cancelled.call('obsidian:pick')).data.valid, false)
})
