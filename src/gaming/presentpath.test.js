'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const P = require('./presentpath')

const row = (mode, extra = {}) => ({ mode, tearing: false, syncInterval: 0, displayLatency: 4, clickToPhoton: null, displayed: 3.1, ...extra })

test('classify: the PresentMon 2.x PresentMode strings seen on this PC and the documented ones', () => {
  assert.equal(P.classify('Hardware Composed: Independent Flip'), 'direct') // Valorant, windowed fullscreen
  assert.equal(P.classify('Hardware: Independent Flip'), 'direct')
  assert.equal(P.classify('Hardware: Legacy Flip'), 'direct')
  assert.equal(P.classify('Composed: Flip'), 'composed-flip')
  assert.equal(P.classify('Composed: Copy with GPU GDI'), 'composed-copy') // Isaac
  assert.equal(P.classify('Composed: Copy with CPU GDI'), 'composed-copy')
  assert.equal(P.classify('Hardware: Legacy Copy to front buffer'), 'copy')
  assert.equal(P.classify('Something new'), 'unknown')
  assert.equal(P.classify(''), 'unknown')
  assert.equal(P.classify(null), 'unknown')
})

test('summarize: dominant path, mode shares, tearing, sync interval', () => {
  const rows = [
    ...Array(97).fill(0).map(() => row('Hardware Composed: Independent Flip', { tearing: true })),
    ...Array(3).fill(0).map(() => row('Composed: Flip', { syncInterval: 1 }))
  ]
  const s = P.summarize(rows)
  assert.equal(s.kind, 'direct')
  assert.equal(s.kindPct, 97)
  assert.equal(s.frames, 100)
  assert.deepEqual(s.modes.map(m => [m.mode, m.kind, m.frames]), [['Hardware Composed: Independent Flip', 'direct', 97], ['Composed: Flip', 'composed-flip', 3]])
  assert.equal(s.tearingPct, 97)
  assert.equal(s.syncInterval, 0)
})

test('summarize: an unknown sync interval (-1, as PresentMon writes for OpenGL) is not reported as a value', () => {
  assert.equal(P.summarize([row('Composed: Copy with GPU GDI', { syncInterval: -1 })]).syncInterval, null)
})

test('summarize: kinds are grouped, so two direct-flip variants outvote one composed mode', () => {
  const rows = [
    ...Array(30).fill(0).map(() => row('Hardware: Independent Flip')),
    ...Array(30).fill(0).map(() => row('Hardware Composed: Independent Flip')),
    ...Array(40).fill(0).map(() => row('Composed: Flip'))
  ]
  const s = P.summarize(rows)
  assert.equal(s.kind, 'direct')
  assert.equal(s.kindPct, 60)
})

test('summarize: latency stats ignore missing values; no PresentMode data gives null', () => {
  const rows = [1, 2, 3, 4, 100].map(v => row('Composed: Flip', { displayLatency: v, clickToPhoton: v === 3 ? 5 : null }))
  rows.push(row('Composed: Flip', { displayLatency: null }))
  const s = P.summarize(rows)
  assert.equal(s.displayLatency.count, 5)
  assert.equal(s.displayLatency.median, 3)
  assert.equal(s.displayLatency.max, 100)
  assert.deepEqual(s.clickToPhoton, { median: 5, p95: 5, max: 5, count: 1 })
  assert.equal(P.summarize([row('')]), null)
  assert.equal(P.summarize([]), null)
})

test('verdict: direct is good, composed and copy are warnings, mixed paths are flagged, null is info', () => {
  const mk = (mode, n = 100) => P.summarize(Array(n).fill(0).map(() => row(mode)))
  assert.equal(P.verdict(mk('Hardware Composed: Independent Flip')).level, 'good')
  assert.equal(P.verdict(mk('Composed: Flip')).level, 'warn')
  assert.match(P.verdict(mk('Composed: Flip')).text, /overlay/i)
  assert.equal(P.verdict(mk('Composed: Copy with GPU GDI')).level, 'warn')
  assert.match(P.verdict(mk('Composed: Copy with GPU GDI')).text, /OpenGL/)
  assert.equal(P.verdict(mk('Brand new mode')).level, 'info')
  const mixed = P.summarize([...Array(70).fill(0).map(() => row('Hardware: Independent Flip')), ...Array(30).fill(0).map(() => row('Composed: Flip'))])
  const v = P.verdict(mixed)
  assert.equal(v.level, 'warn')
  assert.match(v.text, /70%/)
  assert.equal(P.verdict(null).level, 'info')
})

test('sanitize: round-trips a real summary and rejects / cleans hostile ones', () => {
  const s = P.summarize([...Array(50).fill(0).map(() => row('Composed: Flip', { clickToPhoton: 3.3 }))])
  assert.deepEqual(P.sanitize(JSON.parse(JSON.stringify(s))), s)
  assert.equal(P.sanitize(null), null)
  assert.equal(P.sanitize('x'), null)
  assert.equal(P.sanitize({ kind: 'evil', modes: [], frames: 1 }), null)
  assert.equal(P.sanitize({ kind: 'direct', modes: 'nope', frames: 1 }), null)
  assert.equal(P.sanitize({ kind: 'direct', modes: [], frames: 1 }), null)
  const dirty = { ...s, extra: '<script>', tearingPct: 'x', modes: [{ mode: 'A'.repeat(500), frames: 5, pct: 100, kind: 'x', html: '<b>' }, { mode: 7 }] }
  const clean = P.sanitize(dirty)
  assert.equal(clean.extra, undefined)
  assert.equal(clean.tearingPct, 0)
  assert.equal(clean.modes.length, 1)
  assert.equal(clean.modes[0].mode.length, 80)
  assert.equal(clean.modes[0].html, undefined)
})
