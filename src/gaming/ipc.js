'use strict'
// IPC surface for the Gaming tab. Called once from main.js.
const { createStore } = require('./store')

function registerGamingIpc(ipcMain, getDb) {
  const store = createStore(getDb)

  // Wrap so a thrown validation error reaches the renderer as { ok:false, error }
  // instead of an opaque "Error invoking remote method".
  const handle = (channel, fn) => ipcMain.handle(channel, (_, ...args) => {
    try { return { ok: true, data: fn(...args) } }
    catch (e) { console.error('[gaming]', channel, e.message); return { ok: false, error: e.message } }
  })

  handle('gaming:sens:list', () => store.listSensProfiles())
  handle('gaming:sens:save', p => store.saveSensProfile(p || {}))
  handle('gaming:sens:delete', id => store.deleteSensProfile(id))

  return store
}

module.exports = { registerGamingIpc }
