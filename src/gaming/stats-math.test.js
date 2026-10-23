'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const S = require('./stats-math')

test('median: odd and even counts, empty', () => {
  assert.equal(S.median([1, 2, 3]), 2)
  assert.equal(S.median([1, 2, 3, 4]), 2.5)
  assert.equal(S.median([]), null)
  assert.equal(S.median([5]), 5)
})

test('percentile: picks the value at the given fraction, clamped to the last entry', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  assert.equal(S.percentile(v, 0.95), 10)
  assert.equal(S.percentile(v, 0.5), 6)
  assert.equal(S.percentile(v, 0), 1)
  assert.equal(S.percentile([], 0.9), null)
})
