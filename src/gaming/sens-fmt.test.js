'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Fmt = require('./sens-fmt')

test('gameOptionsHtml: marks the selected game and lists every known game', () => {
  const html = Fmt.gameOptionsHtml('cs2')
  assert.match(html, /<option value="cs2" selected>CS2<\/option>/)
  assert.match(html, /<option value="valorant">Valorant<\/option>/)
  assert.doesNotMatch(html, /value="valorant" selected/)
})

test('resultsHtml: shows the error for an unknown game or a non-positive number', () => {
  assert.match(Fmt.resultsHtml('not-a-game', '0.4', '800'), /^<div class="gm-err">Unknown game: not-a-game<\/div>$/)
  assert.match(Fmt.resultsHtml('valorant', '0', '800'), /gm-err">Sensitivity must be a positive number/)
})

test('resultsHtml: renders the metrics and one row per known game, flagging the source row', () => {
  const html = Fmt.resultsHtml('valorant', '0.4', '800')
  assert.match(html, /cm \/ 360°/)
  assert.match(html, /eDPI/)
  assert.match(html, /<tr class="gm-src"><td>Valorant<\/td>/)
  assert.match(html, /<tr class=""><td>CS2<\/td>/)
})

test('profilesTableHtml: empty state when there are no saved profiles', () => {
  assert.equal(Fmt.profilesTableHtml([]), '<div class="gm-note">No saved profiles yet. Name the current values and hit Save.</div>')
})

test('profilesTableHtml: one row per profile with name, cm/360 and load/delete buttons', () => {
  const html = Fmt.profilesTableHtml([{ id: 7, name: 'Main', game: 'valorant', sens: 0.4, dpi: 800 }])
  assert.match(html, /<b>Main<\/b>/)
  assert.match(html, /Valorant · 0\.4 @ 800 DPI · \d+\.\d+ cm\/360/)
  assert.match(html, /data-gm-load="7"/)
  assert.match(html, /data-gm-del="7"/)
})

test('profilesTableHtml: escapes the profile name and tolerates an unknown/removed game', () => {
  const html = Fmt.profilesTableHtml([{ id: 1, name: '<script>', game: 'old-removed-game', sens: 0.4, dpi: 800 }])
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /old-removed-game · 0\.4 @ 800 DPI · <\/div>/)
})
