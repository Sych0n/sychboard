'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Fmt = require('./health-fmt')

const check = (overrides = {}) => ({ title: 'VRR / G-Sync', value: 'On', why: 'Checked via registry.', status: 'ok', needsAdmin: false, ...overrides })

test('resultsHtml: shows the error, if any, over anything else', () => {
  assert.match(Fmt.resultsHtml(null, 'boom'), /^<div class="gm-err">boom<\/div>$/)
  assert.match(Fmt.resultsHtml({ checks: [], isAdmin: true, ranAt: Date.now() }, 'boom'), /gm-err">boom/)
})

test('resultsHtml: not-run-yet state when there is no result and no error', () => {
  assert.equal(Fmt.resultsHtml(null, ''), '<div class="gm-note">Not run yet.</div>')
})

test('resultsHtml: counts ok vs warning checks and renders one row per check', () => {
  const last = { checks: [check(), check({ title: 'Mouse polling', status: 'warn', why: 'Could not read.' })], isAdmin: true, ranAt: Date.now() }
  const html = Fmt.resultsHtml(last, '')
  assert.match(html, /1 ✅ · 1 ⚠️/)
  assert.match(html, /VRR \/ G-Sync/)
  assert.match(html, /Mouse polling/)
  assert.match(html, /Could not read\./)
})

test('resultsHtml: admin banner only shows when not admin and a check needed admin', () => {
  const needsAdmin = check({ needsAdmin: true })
  const admin = Fmt.resultsHtml({ checks: [needsAdmin], isAdmin: true, ranAt: Date.now() }, '')
  assert.doesNotMatch(admin, /Not running as administrator/)
  const notAdmin = Fmt.resultsHtml({ checks: [needsAdmin], isAdmin: false, ranAt: Date.now() }, '')
  assert.match(notAdmin, /Not running as administrator — 1 check could not be read in full/)
  assert.match(notAdmin, /needs admin/)
})

test('resultsHtml: pluralises the admin-needed count and escapes check text', () => {
  const html = Fmt.resultsHtml({
    checks: [check({ needsAdmin: true }), check({ title: '<script>', needsAdmin: true })],
    isAdmin: false, ranAt: Date.now()
  }, '')
  assert.match(html, /2 checks could not be read in full/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})
