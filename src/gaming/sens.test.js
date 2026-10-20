'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const S = require('./sens')

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`)

test('yaw table matches the plan', () => {
  assert.equal(S.GAMES.valorant.yaw, 0.07)
  assert.equal(S.GAMES.cs2.yaw, 0.022)
  assert.equal(S.GAMES.apex.yaw, 0.022)
  assert.equal(S.GAMES.ow2.yaw, 0.0066)
})

test('inches/360 = 360 / (yaw * sens * dpi)', () => {
  // Valorant 0.4 @ 800 DPI: 360 / (0.07 * 0.4 * 800) = 16.0714...
  near(S.inchesPer360('valorant', 0.4, 800), 360 / (0.07 * 0.4 * 800))
  near(S.inchesPer360('valorant', 0.4, 800), 16.071428571428573)
})

test('cm/360 = inches/360 * 2.54', () => {
  near(S.cmPer360('valorant', 0.4, 800), 16.071428571428573 * 2.54)
  // CS2 1.0 @ 400 DPI -> 360/(0.022*400) = 40.909 in = 103.9 cm
  near(S.cmPer360('cs2', 1, 400), 360 / (0.022 * 400) * 2.54)
})

test('eDPI = dpi * sens', () => {
  near(S.eDpi(0.4, 800), 320)
  near(S.eDpi(1.25, 1600), 2000)
})

test('Valorant -> CS2 uses the 0.07/0.022 ratio', () => {
  near(S.convertSens('valorant', 0.4, 'cs2'), 0.4 * 0.07 / 0.022)
  near(S.convertSens('valorant', 0.4, 'apex'), S.convertSens('valorant', 0.4, 'cs2'))
})

test('converted sens gives identical cm/360 in every game', () => {
  const dpi = 800
  for (const from of Object.keys(S.GAMES)) {
    const base = S.cmPer360(from, 0.77, dpi)
    for (const to of Object.keys(S.GAMES)) {
      const s = S.convertSens(from, 0.77, to)
      near(S.cmPer360(to, s, dpi), base, 1e-7)
    }
  }
})

test('round trip returns the original sens', () => {
  const there = S.convertSens('valorant', 0.35, 'ow2')
  near(S.convertSens('ow2', there, 'valorant'), 0.35)
})

test('convertAll returns every game plus cm/360 and eDPI', () => {
  const r = S.convertAll('valorant', 0.4, 800)
  assert.equal(r.games.length, Object.keys(S.GAMES).length)
  near(r.eDpi, 320)
  near(r.cmPer360, S.cmPer360('valorant', 0.4, 800))
  const src = r.games.find(g => g.key === 'valorant')
  near(src.sens, 0.4)
  const cs2 = r.games.find(g => g.key === 'cs2')
  near(cs2.eDpi, cs2.sens * 800)
})

test('rejects bad input', () => {
  assert.throws(() => S.inchesPer360('valorant', 0, 800), RangeError)
  assert.throws(() => S.inchesPer360('valorant', -1, 800), RangeError)
  assert.throws(() => S.inchesPer360('valorant', 0.4, 0), RangeError)
  assert.throws(() => S.inchesPer360('valorant', 'abc', 800), RangeError)
  assert.throws(() => S.inchesPer360('valorant', NaN, 800), RangeError)
  assert.throws(() => S.inchesPer360('valorant', Infinity, 800), RangeError)
  assert.throws(() => S.cmPer360('doom', 1, 800), RangeError)
  assert.throws(() => S.convertSens('valorant', 1, 'toString'), RangeError)
})

test('accepts numeric strings (form input)', () => {
  near(S.cmPer360('valorant', '0.4', '800'), S.cmPer360('valorant', 0.4, 800))
})
