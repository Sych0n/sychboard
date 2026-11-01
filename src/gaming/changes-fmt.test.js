'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Fmt = require('./changes-fmt')

const cap = (overrides = {}) => ({
  avg_fps: 313.9, low1_fps: 182.7, low01_fps: 150, spikes: 11,
  median_ms: 3.2, p99_ms: 6.1, max_ms: 20, present_kind: 'direct', ...overrides
})

test('capRow: reads the b_/a_ prefixed columns off a change row, or null if that side was never set', () => {
  const change = { b_label: 'before', b_avg_fps: 313.9, b_low1_fps: 182.7, b_low01_fps: 150, b_spikes: 11, b_median_ms: 3.2, b_p99_ms: 6.1, b_max_ms: 20, b_present_kind: 'direct' }
  assert.deepEqual(Fmt.capRow(change, 'b'), { avg_fps: 313.9, low1_fps: 182.7, low01_fps: 150, spikes: 11, median_ms: 3.2, p99_ms: 6.1, max_ms: 20, present_kind: 'direct' })
  assert.equal(Fmt.capRow(change, 'a'), null)
})

test('deltaHtml: empty without both sides; colours the delta by which side is better; shows a present-kind change', () => {
  assert.equal(Fmt.deltaHtml(null, cap()), '')
  assert.equal(Fmt.deltaHtml(cap(), null), '')
  const html = Fmt.deltaHtml(cap({ avg_fps: 313.9, low1_fps: 182.7, spikes: 11, present_kind: 'direct' }), cap({ avg_fps: 295, low1_fps: 180, spikes: 3, present_kind: 'composed-flip' }))
  assert.match(html, /avg 313\.9 → <span style="color:var\(--red\)">295\.0<\/span>/)
  assert.match(html, /spikes 11 → <span style="color:var\(--green\)">3<\/span>/)
  assert.match(html, /Direct flip → <b>Composed flip<\/b>/)
})

test('deltaHtml: same present kind on both sides is shown plain, not as an arrow', () => {
  const html = Fmt.deltaHtml(cap({ present_kind: 'direct' }), cap({ present_kind: 'direct' }))
  assert.match(html, /· Direct flip$/)
  assert.doesNotMatch(html, /→ <b>/)
})

test('deltaHtml: escapes capture data that reaches it (present_kind is DB-controlled, but label text is not)', () => {
  const html = Fmt.deltaHtml(cap(), cap())
  assert.doesNotMatch(html, /<script>/)
})

test('capLabel: formats a capture dropdown entry with fps and present kind, omitting the kind when absent', () => {
  assert.equal(Fmt.capLabel({ label: 'Before OC off', avg_fps: 313.86, present_kind: 'direct' }), 'Before OC off · 313.9 fps · Direct flip')
  assert.equal(Fmt.capLabel({ label: 'Baseline', avg_fps: 100, present_kind: null }), 'Baseline · 100.0 fps')
})

test('listHtml: empty state when there are no changes yet', () => {
  assert.match(Fmt.listHtml([]), /No changes logged yet/)
})

test('listHtml: one row per change, with before/after links, delta and notes, HTML-escaped', () => {
  const html = Fmt.listHtml([{
    id: 7, date: '2026-11-01', what: '<script>DP overclock off</script>', felt: 4, verdict: 'keep', notes: 'felt smoother',
    b_label: 'before', b_avg_fps: 313.9, b_low1_fps: 182.7, b_low01_fps: 150, b_spikes: 11, b_median_ms: 3.2, b_p99_ms: 6.1, b_max_ms: 20, b_present_kind: 'direct',
    a_label: 'after', a_avg_fps: 295, a_low1_fps: 180, a_low01_fps: 148, a_spikes: 3, a_median_ms: 3.4, a_p99_ms: 6.5, a_max_ms: 18, a_present_kind: 'direct'
  }])
  assert.match(html, /data-ch-verdict="7"/)
  assert.match(html, /data-ch-del="7"/)
  assert.match(html, /before: before/)
  assert.match(html, /after: after/)
  assert.match(html, /4\/5/)
  assert.match(html, /felt smoother/)
  assert.doesNotMatch(html, /<script>DP/)
  assert.match(html, /&lt;script&gt;DP overclock off&lt;\/script&gt;/)
})

test('listHtml: missing felt score and no before/after links render without breaking', () => {
  const html = Fmt.listHtml([{ id: 1, date: '2026-11-01', what: 'tweak', felt: null, verdict: 'testing', notes: '', b_label: null, a_label: null }])
  assert.match(html, /–<\/td>/)
  assert.doesNotMatch(html, /before:/)
})
