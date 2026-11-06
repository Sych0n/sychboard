'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Fmt = require('./capture-fmt')
const Frames = require('./framemetrics')
const Present = require('./presentpath')

const frametimes = () => Array(100).fill(0).map((_, i) => (i % 20 === 0 ? 20 : 3.3))

const result = (overrides = {}) => {
  const ft = frametimes()
  return {
    app: 'VALORANT.exe', apps: [{ app: 'VALORANT.exe', frames: 100 }, { app: 'Discord.exe', frames: 4 }],
    frametimes: ft, metrics: Frames.computeMetrics(ft), present: null, ...overrides
  }
}

test('pathHtml: empty with no presentation data', () => {
  assert.equal(Fmt.pathHtml(null), '')
})

test('pathHtml: direct flip shows the good verdict and the facts line', () => {
  const s = Present.summarize([{ mode: 'Hardware: Independent Flip', tearing: false, syncInterval: 0, displayLatency: 4, clickToPhoton: null, displayed: 3.1 }])
  const html = Fmt.pathHtml(s)
  assert.match(html, /Direct to display/)
  assert.match(html, /tearing not allowed/)
})

test('resultHtml: headline mentions app, frame count and other presenting apps; carries the save-as label', () => {
  const html = Fmt.resultHtml(result(), 'my baseline')
  assert.match(html, /Captured <b>VALORANT\.exe<\/b>/)
  assert.match(html, /also presenting: Discord\.exe/)
  assert.match(html, /value="my baseline"/)
})

test('resultHtml: escapes the save-as label', () => {
  const html = Fmt.resultHtml(result(), '<script>x</script>')
  assert.doesNotMatch(html, /<script>x/)
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/)
})

test('comparisonHtml: rows show delta direction and the presentation path when present on either side', () => {
  const a = { label: 'before', avg_fps: 313.9, low1_fps: 182.7, low01_fps: 150, spikes: 11, median_ms: 3.2, p99_ms: 6.1, max_ms: 20, present_kind: 'direct', present: { kind: 'direct', displayLatency: { median: 4, p95: 5 } }, frametimes: frametimes() }
  const b = { label: 'after', avg_fps: 295, low1_fps: 180, low01_fps: 148, spikes: 3, median_ms: 3.4, p99_ms: 6.5, max_ms: 18, present_kind: 'composed-flip', present: { kind: 'composed-flip', displayLatency: { median: 6, p95: 7 } }, frametimes: frametimes() }
  const html = Fmt.comparisonHtml({ a, b, rows: Frames.compare(a, b) })
  assert.match(html, /A: before/)
  assert.match(html, /B: after/)
  assert.match(html, /different path/)
  assert.match(html, /worse/)
})

test('comparisonHtml: no path rows when neither capture has presentation data', () => {
  const a = { label: 'before', avg_fps: 100, low1_fps: 90, low01_fps: 80, spikes: 1, median_ms: 3, p99_ms: 4, max_ms: 5, present_kind: null, present: null, frametimes: frametimes() }
  const b = { label: 'after', avg_fps: 100, low1_fps: 90, low01_fps: 80, spikes: 1, median_ms: 3, p99_ms: 4, max_ms: 5, present_kind: null, present: null, frametimes: frametimes() }
  const html = Fmt.comparisonHtml({ a, b, rows: Frames.compare(a, b) })
  assert.doesNotMatch(html, /Presentation path/)
})

test('savedHtml: empty state with no saved captures', () => {
  assert.match(Fmt.savedHtml([], [], null), /No saved captures yet/)
})

test('savedHtml: one row per capture, checkbox state from picked, compare button disabled unless exactly 2 picked', () => {
  const saved = [
    { id: 1, label: 'baseline', present_kind: 'direct', created_at: '2026-11-01', app: 'VALORANT.exe', avg_fps: 310, low1_fps: 180, low01_fps: 150, spikes: 5 },
    { id: 2, label: 'after tweak', present_kind: null, created_at: '2026-11-02', app: 'VALORANT.exe', avg_fps: 300, low1_fps: 170, low01_fps: 140, spikes: 8 }
  ]
  const html1 = Fmt.savedHtml(saved, [1], null)
  assert.match(html1, /data-cap-pick="1" checked/)
  assert.doesNotMatch(html1, /data-cap-pick="2" checked/)
  assert.match(html1, /data-cap-compare disabled/)
  assert.match(html1, /pick 2/)

  const html2 = Fmt.savedHtml(saved, [1, 2], null)
  assert.doesNotMatch(html2, /data-cap-compare disabled/)
})

test('savedHtml: renders the comparison block when one is given', () => {
  const saved = [{ id: 1, label: 'baseline', present_kind: null, created_at: '2026-11-01', app: 'VALORANT.exe', avg_fps: 310, low1_fps: 180, low01_fps: 150, spikes: 5 }]
  const a = { label: 'baseline', avg_fps: 310, low1_fps: 180, low01_fps: 150, spikes: 5, median_ms: 3, p99_ms: 4, max_ms: 5, present_kind: null, present: null, frametimes: frametimes() }
  const b = { label: 'after', avg_fps: 300, low1_fps: 170, low01_fps: 140, spikes: 8, median_ms: 3.5, p99_ms: 4.5, max_ms: 6, present_kind: null, present: null, frametimes: frametimes() }
  const html = Fmt.savedHtml(saved, [], { a, b, rows: Frames.compare(a, b) })
  assert.match(html, /Frametime comparison/)
})
