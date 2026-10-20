'use strict'
// IPC surface for the Gaming tab. Called once from main.js.
const { createStore } = require('./store')
const { runHealthCheck } = require('./healthcheck')
const PresentMon = require('./presentmon')

// deps: { getDb, awardXp, dialog, getWindow, tempDir }
function registerGamingIpc(ipcMain, deps) {
  const store = createStore(deps.getDb, deps.awardXp)

  // Wrap so a thrown validation error reaches the renderer as { ok:false, error }
  // instead of an opaque "Error invoking remote method".
  const handle = (channel, fn) => ipcMain.handle(channel, async (_, ...args) => {
    try { return { ok: true, data: await fn(...args) } }
    catch (e) { console.error('[gaming]', channel, e.message); return { ok: false, error: e.message } }
  })

  handle('gaming:sens:list', () => store.listSensProfiles())
  handle('gaming:sens:save', p => store.saveSensProfile(p || {}))
  handle('gaming:sens:delete', id => store.deleteSensProfile(id))
  handle('gaming:session:add', p => store.addSession(p || {}))
  handle('gaming:session:list', () => store.listSessions())
  handle('gaming:session:delete', id => store.deleteSession(id))
  handle('gaming:aim:add', p => store.addAimScore(p || {}))
  handle('gaming:aim:list', () => store.listAimScores())
  handle('gaming:aim:delete', id => store.deleteAimScore(id))

  // Read-only system checks (see healthcheck.ps1). Never changes a setting.
  handle('gaming:health:run', () => runHealthCheck())

  // ── PresentMon ──────────────────────────────────────────────────────────────
  const pmStatus = () => {
    const p = store.getPresentMonPath()
    if (!p) return { path: null, ok: false }
    try { PresentMon.validateExePath(p); return { path: p, ok: true } }
    catch (e) { return { path: p, ok: false, error: e.message } }
  }
  handle('gaming:pm:status', pmStatus)

  // The exe is chosen by the user in a native dialog — SychBoard never downloads
  // PresentMon, and the renderer cannot supply a path to run.
  handle('gaming:pm:pick', async () => {
    const res = await deps.dialog.showOpenDialog(deps.getWindow && deps.getWindow(), {
      title: 'Select PresentMon executable (downloaded from Intel\'s official GitHub)',
      properties: ['openFile'],
      filters: [{ name: 'PresentMon', extensions: ['exe'] }]
    })
    if (res.canceled || !res.filePaths.length) return pmStatus()
    store.setPresentMonPath(res.filePaths[0])
    return pmStatus()
  })

  let active = null     // running capture { cancel }
  let lastCapture = null // last finished capture, kept here so saving doesn't round-trip big arrays

  handle('gaming:pm:capture', async ({ seconds, processName } = {}) => {
    if (active) throw new Error('A capture is already running')
    const st = pmStatus()
    if (!st.ok) throw new Error(st.path ? (st.error || 'PresentMon path is invalid') : 'Choose your PresentMon executable first')
    active = PresentMon.startCapture({ exe: st.path, seconds, processName, tempDir: deps.tempDir() })
    try {
      lastCapture = await active.promise
      return lastCapture
    } finally { active = null }
  })
  handle('gaming:pm:cancel', () => { if (active) active.cancel(); return { cancelling: !!active } })

  handle('gaming:capture:save', label => store.saveCapture(label, lastCapture))
  handle('gaming:capture:list', () => store.listCaptures())
  handle('gaming:capture:get', id => store.getCapture(id))
  handle('gaming:capture:delete', id => store.deleteCapture(id))

  return store
}

module.exports = { registerGamingIpc }
