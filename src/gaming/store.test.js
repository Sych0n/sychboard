'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite') // better-sqlite3 is built for Electron's ABI, so tests use Node's built-in
const { migrations } = require('./schema')
const { createStore } = require('./store')

function freshStore() {
  const db = new DatabaseSync(':memory:')
  for (const m of migrations) db.exec(m.sql)
  return { db, store: createStore(() => db) }
}

test('save + list sens profiles', () => {
  const { store } = freshStore()
  store.saveSensProfile({ name: 'Valorant main', game: 'valorant', sens: 0.4, dpi: 800 })
  store.saveSensProfile({ name: 'testing 0.3', game: 'valorant', sens: 0.3, dpi: 1600 })
  const list = store.listSensProfiles()
  assert.deepEqual(list.map(p => p.name), ['testing 0.3', 'Valorant main'])
  assert.equal(list[1].sens, 0.4)
  assert.equal(list[1].dpi, 800)
})

test('saving an existing name overwrites it', () => {
  const { store } = freshStore()
  store.saveSensProfile({ name: 'main', game: 'valorant', sens: 0.4, dpi: 800 })
  store.saveSensProfile({ name: ' main ', game: 'cs2', sens: 1.2, dpi: 800 })
  const list = store.listSensProfiles()
  assert.equal(list.length, 1)
  assert.equal(list[0].game, 'cs2')
  assert.equal(list[0].sens, 1.2)
})

test('delete removes only that profile', () => {
  const { store } = freshStore()
  const a = store.saveSensProfile({ name: 'a', game: 'valorant', sens: 0.4, dpi: 800 })
  store.saveSensProfile({ name: 'b', game: 'valorant', sens: 0.5, dpi: 800 })
  assert.equal(store.deleteSensProfile(a.id).deleted, true)
  assert.equal(store.deleteSensProfile(a.id).deleted, false)
  assert.deepEqual(store.listSensProfiles().map(p => p.name), ['b'])
})

test('rejects invalid profiles', () => {
  const { store } = freshStore()
  const ok = { name: 'x', game: 'valorant', sens: 0.4, dpi: 800 }
  assert.throws(() => store.saveSensProfile({ ...ok, name: '  ' }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, game: 'doom' }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, sens: 0 }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, sens: 'abc' }), RangeError)
  assert.throws(() => store.saveSensProfile({ ...ok, dpi: -5 }), RangeError)
  assert.throws(() => store.deleteSensProfile('1'), RangeError)
  assert.equal(store.listSensProfiles().length, 0)
})
