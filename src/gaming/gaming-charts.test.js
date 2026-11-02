'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Charts = require('./gaming-charts')

test('line: empty state when there are no points', () => {
  assert.match(Charts.line([]), /No data yet/)
  assert.match(Charts.line([], { empty: 'Nothing logged' }), /Nothing logged/)
})

test('line: draws a single point centred, with no connecting path', () => {
  const svg = Charts.line([{ x: '2026-11-01', y: 10 }])
  assert.match(svg, /<circle/)
  assert.doesNotMatch(svg, /<path/)
  assert.match(svg, /2026-11-01/)
})

test('line: multiple points draw a path and label the first/last x values', () => {
  const svg = Charts.line([{ x: 'a', y: 1 }, { x: 'b', y: 5 }, { x: 'c', y: 3 }])
  assert.match(svg, /<path d="M/)
  assert.match(svg, />a</)
  assert.match(svg, />c</)
  assert.equal((svg.match(/<circle/g) || []).length, 3)
})

test('line: forced min/max widen the axis even past the data range', () => {
  const svg = Charts.line([{ x: 'a', y: 2 }, { x: 'b', y: 3 }], { min: 1, max: 5 })
  assert.match(svg, />5</)
  assert.match(svg, />1</)
})

test('line: escapes label text', () => {
  const svg = Charts.line([{ x: '<script>', y: 1 }])
  assert.doesNotMatch(svg, /<script>/)
  assert.match(svg, /&lt;script&gt;/)
})

test('bars: empty state when every bucket has no data', () => {
  assert.match(Charts.bars([{ label: 'morning', value: null, n: 0 }]), /No data yet/)
})

test('bars: draws a rect per bucket with data, skips rects for null buckets, still labels them', () => {
  const svg = Charts.bars([{ label: 'morning', value: 10, n: 2 }, { label: 'night', value: null, n: 0 }])
  assert.equal((svg.match(/<rect/g) || []).length, 1)
  assert.match(svg, />morning</)
  assert.match(svg, />night</)
  assert.match(svg, /no data/)
})

test('bars: respects an explicit max instead of the tallest bar', () => {
  const svg = Charts.bars([{ label: 'a', value: 50, n: 1 }], { max: 100 })
  assert.match(svg, /<rect/)
})

test('multi: empty state when every series is empty', () => {
  assert.match(Charts.multi([{ label: 's', color: '#fff', values: [] }]), /No data yet/)
})

test('multi: draws one path per series and a legend only with more than one series', () => {
  const one = Charts.multi([{ label: 'A', color: '#22d3ee', values: [1, 2, 3] }])
  assert.equal((one.match(/<path/g) || []).length, 1)
  assert.doesNotMatch(one, /●/)

  const two = Charts.multi([
    { label: 'A', color: '#22d3ee', values: [1, 2, 3] },
    { label: 'B', color: '#f472b6', values: [3, 2, 1] }
  ])
  assert.equal((two.match(/<path/g) || []).length, 2)
  assert.match(two, /●.*A/)
  assert.match(two, /●.*B/)
})

test('multi: draws a dashed reference line and label when hline is given', () => {
  const svg = Charts.multi([{ label: 'A', color: '#fff', values: [1, 2, 3] }], { hline: { y: 5, label: 'spike > 5 ms' } })
  assert.match(svg, /stroke-dasharray="4 4"/)
  assert.match(svg, /spike &gt; 5 ms/)
})
