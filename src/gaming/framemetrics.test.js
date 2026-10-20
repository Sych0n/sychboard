'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const F = require('./framemetrics')

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`)

test('steady 10ms frames = 100 fps everywhere, no spikes', () => {
  const m = F.computeMetrics(Array(1000).fill(10))
  near(m.avgFps, 100)
  near(m.low1Fps, 100)
  near(m.low01Fps, 100)
  near(m.medianMs, 10)
  assert.equal(m.spikes, 0)
  assert.equal(m.frames, 1000)
  near(m.durationSec, 10)
})

test('1% / 0.1% lows average the slowest frames', () => {
  // 1000 frames: 990 x 10ms, 9 x 30ms, 1 x 100ms
  const ft = [...Array(990).fill(10), ...Array(9).fill(30), 100]
  const m = F.computeMetrics(ft)
  // slowest 1% = 10 frames = 9x30 + 100 -> mean 37 ms
  near(m.low1Fps, 1000 / 37)
  // slowest 0.1% = 1 frame = 100 ms
  near(m.low01Fps, 10)
  near(m.maxMs, 100)
  assert.equal(m.spikes, 10) // > 20 ms
  near(m.spikeThresholdMs, 20)
  near(m.avgFps, 1000 / ((990 * 10 + 9 * 30 + 100) / 1000))
})

test('always uses at least one frame for the lows', () => {
  const m = F.computeMetrics([5, 5, 50])
  near(m.low1Fps, 20)
  near(m.low01Fps, 20)
})

test('median of an even count', () => {
  near(F.computeMetrics([4, 6, 8, 10]).medianMs, 7)
})

test('drops bad samples, null for empty', () => {
  assert.equal(F.computeMetrics([]), null)
  assert.equal(F.computeMetrics([NaN, 0, -3]), null)
  assert.equal(F.computeMetrics([10, NaN, 10]).frames, 2)
})

test('downsampleMax keeps the worst frame in each bucket', () => {
  const v = Array(1000).fill(5)
  v[437] = 90
  const d = F.downsampleMax(v, 100)
  assert.equal(d.length, 100)
  assert.equal(Math.max(...d), 90)
  assert.deepEqual(F.downsampleMax([1, 2, 3], 10), [1, 2, 3])
})

test('compare: direction-aware deltas, 1% noise floor', () => {
  const a = { avg_fps: 300, low1_fps: 200, low01_fps: 100, spikes: 10, median_ms: 3.3, p99_ms: 5, max_ms: 40 }
  const b = { avg_fps: 330, low1_fps: 200.5, low01_fps: 80, spikes: 4, median_ms: 3.0, p99_ms: 5, max_ms: 40 }
  const rows = Object.fromEntries(F.compare(a, b).map(r => [r.key, r]))
  assert.equal(rows.avg_fps.better, 'b')
  near(rows.avg_fps.pct, 10)
  assert.equal(rows.low1_fps.better, 'same')   // +0.25% is noise
  assert.equal(rows.low01_fps.better, 'a')     // lower low = worse
  assert.equal(rows.spikes.better, 'b')        // fewer spikes = better
  assert.equal(rows.median_ms.better, 'b')     // fewer ms = better
  assert.equal(rows.p99_ms.better, 'same')
  assert.equal(F.compare(a, b).length, 7)
})

test('compare: zero baseline has no percentage but still a direction', () => {
  const z = { avg_fps: 100, low1_fps: 100, low01_fps: 100, spikes: 0, median_ms: 1, p99_ms: 1, max_ms: 1 }
  const r = F.compare(z, { ...z, spikes: 3 }).find(x => x.key === 'spikes')
  assert.equal(r.pct, null)
  assert.equal(r.better, 'a')
})
