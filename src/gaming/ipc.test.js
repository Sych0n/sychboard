'use strict'
// Covers the ipcMain.handle wrapper in ipc.js itself: a thrown validation error (bad id, bad
// patch) must reach the caller as { ok:false, error } rather than an unhandled rejection, and a
// good call must come back as { ok:true, data }. Store-level validation is already covered in
// store.test.js; this file is about the wrapping, not the validation rules.
const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const { standaloneMigrations: migrations } = require('./schema')
const { registerGamingIpc } = require('./ipc')

// Minimal ipcMain stand-in: registerGamingIpc only calls .handle(channel, fn).
function fakeIpcMain() {
  const handlers = new Map()
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, ...args) => {
      if (!handlers.has(channel)) throw new Error(`no handler registered for ${channel}`)
      return handlers.get(channel)(null, ...args)
    }
  }
}

function freshIpc() {
  const db = new DatabaseSync(':memory:')
  for (const m of migrations) db.exec(m.sql)
  const ipcMain = fakeIpcMain()
  registerGamingIpc(ipcMain, { getDb: () => db, awardXp: null, dialog: {}, getWindow: () => null, tempDir: () => '/tmp' })
  return ipcMain
}

test('bad ids come back as { ok:false }, not a thrown error', async () => {
  const ipc = freshIpc()
  for (const [channel, arg] of [
    ['gaming:sens:delete', '1'],
    ['gaming:session:delete', '1'],
    ['gaming:aim:delete', '1'],
    ['gaming:change:delete', '1'],
    ['gaming:capture:get', '1'],
    ['gaming:capture:delete', '1']
  ]) {
    const res = await ipc.invoke(channel, arg)
    assert.equal(res.ok, false, channel)
    assert.match(res.error, /invalid/i, channel)
  }
})

test('a capture id that is well-formed but does not exist still comes back as { ok:false }', async () => {
  const ipc = freshIpc()
  const res = await ipc.invoke('gaming:capture:get', 999)
  assert.equal(res.ok, false)
  assert.match(res.error, /not found/i)
})

test('bad patches come back as { ok:false }', async () => {
  const ipc = freshIpc()
  const add = await ipc.invoke('gaming:change:add', { date: '2026-10-31', what: 'test change' })
  assert.equal(add.ok, true)
  const id = add.data.id

  const badVerdict = await ipc.invoke('gaming:change:update', id, { verdict: 'nope' })
  assert.equal(badVerdict.ok, false)
  assert.match(badVerdict.error, /testing, keep or revert/)

  const emptyWhat = await ipc.invoke('gaming:change:update', id, { what: '' })
  assert.equal(emptyWhat.ok, false)
  assert.match(emptyWhat.error, /describe the change/i)

  const badId = await ipc.invoke('gaming:change:update', '1', { verdict: 'keep' })
  assert.equal(badId.ok, false)
  assert.match(badId.error, /invalid change id/i)

  const missingId = await ipc.invoke('gaming:change:update', 999, { verdict: 'keep' })
  assert.equal(missingId.ok, false)
  assert.match(missingId.error, /not found/i)
})

test('a good call still comes back as { ok:true, data }', async () => {
  const ipc = freshIpc()
  const saved = await ipc.invoke('gaming:sens:save', { name: 'main', game: 'valorant', sens: 0.4, dpi: 800 })
  assert.equal(saved.ok, true)
  assert.equal(saved.data.name, 'main')

  const deleted = await ipc.invoke('gaming:sens:delete', saved.data.id)
  assert.deepEqual(deleted, { ok: true, data: { deleted: true } })
})
