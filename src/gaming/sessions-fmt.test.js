'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Fmt = require('./sessions-fmt')

const session = (overrides = {}) => ({
  id: 1, date: '2026-11-01', start_time: '20:00', end_time: null, game: 'Valorant', mode: 'Competitive',
  result: 'win', score: 250, rank_change: 21, smoothness: 4, notes: '', ...overrides
})
const aimRow = (overrides = {}) => ({ id: 1, date: '2026-11-01', scenario: 'Gridshot', score: 90, ...overrides })

test('scenariosOf: dedupes and sorts scenario names', () => {
  assert.deepEqual(Fmt.scenariosOf([aimRow({ scenario: 'Smoothsync' }), aimRow({ scenario: 'Gridshot' }), aimRow({ scenario: 'Gridshot' })]), ['Gridshot', 'Smoothsync'])
})

test('chartsHtml: marks the current metric selected in the dropdown', () => {
  const html = Fmt.chartsHtml([], [], 'win', '')
  assert.match(html, /<option value="win" selected>Win rate<\/option>/)
  assert.doesNotMatch(html, /value="score" selected/)
})

test('chartsHtml: omits the scenario dropdown and uses an empty series when there are no aim rows', () => {
  const html = Fmt.chartsHtml([], [], 'score', 'anything')
  assert.doesNotMatch(html, /data-gs-scenario/)
})

test('chartsHtml: falls back to the first scenario when the given one no longer exists', () => {
  const html = Fmt.chartsHtml([], [aimRow({ scenario: 'Gridshot' }), aimRow({ scenario: 'Smoothsync' })], 'score', 'Deleted scenario')
  assert.match(html, /<option value="Gridshot" selected>Gridshot<\/option>/)
  assert.doesNotMatch(html, /Smoothsync" selected/)
})

test('chartsHtml: keeps a still-valid scenario selected', () => {
  const html = Fmt.chartsHtml([], [aimRow({ scenario: 'Gridshot' }), aimRow({ scenario: 'Smoothsync' })], 'score', 'Smoothsync')
  assert.match(html, /<option value="Smoothsync" selected>Smoothsync<\/option>/)
})

test('historyHtml: empty states when there is no history yet', () => {
  const html = Fmt.historyHtml([], [])
  assert.match(html, /No sessions logged yet\./)
  assert.match(html, /No aim scores logged yet\./)
})

test('historyHtml: renders a session row, including rank delta sign and a delete button', () => {
  const html = Fmt.historyHtml([session({ rank_change: -5 })], [])
  assert.match(html, /Valorant · Competitive/)
  assert.match(html, /<td>win<\/td>/)
  assert.match(html, /<td>-5<\/td>/)
  assert.match(html, /data-gs-del-session="1"/)
})

test('historyHtml: escapes notes used as the delete button title', () => {
  const html = Fmt.historyHtml([session({ notes: '<b>x</b>' })], [])
  assert.doesNotMatch(html, /title="<b>x<\/b>"/)
  assert.match(html, /title="&lt;b&gt;x&lt;\/b&gt;"/)
})

test('historyHtml: renders an aim score row with a delete button', () => {
  const html = Fmt.historyHtml([], [aimRow({ id: 9, scenario: 'Gridshot', score: 77 })])
  assert.match(html, /<td>Gridshot<\/td><td>77<\/td>/)
  assert.match(html, /data-gs-del-aim="9"/)
})
