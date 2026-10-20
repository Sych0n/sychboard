'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const S = require('./stats')

const row = (id, date, start_time, extra = {}) => ({ id, date, start_time, score: null, result: null, smoothness: null, ...extra })

test('score series is chronological and skips rows without a score', () => {
  const rows = [
    row(1, '2026-10-02', '20:00', { score: 10 }),
    row(2, '2026-10-01', '22:00', { score: 5 }),
    row(3, '2026-10-01', '09:00'),
    row(4, '2026-10-01', '23:00', { score: 7 })
  ]
  assert.deepEqual(S.scoreSeries(rows).map(p => p.id), [2, 4, 1])
})

test('smoothness series', () => {
  const rows = [row(1, '2026-10-01', '20:00', { smoothness: 2 }), row(2, '2026-10-02', null, { smoothness: 5 })]
  assert.deepEqual(S.smoothSeries(rows).map(p => p.y), [2, 5])
})

test('time-of-day buckets: 3am lands in 03-06, midnight in 00-03', () => {
  const rows = [
    row(1, '2026-10-01', '03:00', { score: 100, result: 'loss', smoothness: 2 }),
    row(2, '2026-10-01', '05:59', { score: 120, result: 'win', smoothness: 4 }),
    row(3, '2026-10-01', '00:00', { score: 50 }),
    row(4, '2026-10-01', '23:59', { result: 'win' })
  ]
  const b = S.byTimeOfDay(rows)
  assert.equal(b.length, 8)
  assert.equal(b[0].label, '00–03')
  assert.equal(b[0].sessions, 1)
  assert.equal(b[0].avgScore, 50)
  assert.equal(b[1].sessions, 2)
  assert.equal(b[1].avgScore, 110)
  assert.equal(b[1].winRate, 0.5)
  assert.equal(b[1].avgSmooth, 3)
  assert.equal(b[7].winRate, 1)
  assert.equal(b[7].avgScore, null)
  assert.equal(b[3].sessions, 0)
  assert.equal(b[3].winRate, null)
})

test('draws and missing/invalid times do not count toward win rate or buckets', () => {
  const rows = [
    row(1, '2026-10-01', '10:00', { result: 'draw' }),
    row(2, '2026-10-01', null, { result: 'win' }),
    row(3, '2026-10-01', '25:00', { result: 'win' })
  ]
  const b = S.byTimeOfDay(rows)
  assert.equal(b[3].sessions, 1)
  assert.equal(b[3].winRate, null)
  assert.equal(b.reduce((s, x) => s + x.sessions, 0), 1)
})

test('aim series filters by scenario', () => {
  const rows = [
    { id: 1, date: '2026-10-02', scenario: 'Gridshot', score: 90 },
    { id: 2, date: '2026-10-01', scenario: 'Gridshot', score: 80 },
    { id: 3, date: '2026-10-01', scenario: 'Tracking', score: 70 }
  ]
  assert.deepEqual(S.aimSeries(rows, 'Gridshot').map(p => p.y), [80, 90])
})
