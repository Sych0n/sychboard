'use strict'
// IPC for the Obsidian export. The vault path is chosen only through a native folder dialog and
// stored by the main process — the renderer can never supply a path to write to.
const { buildFiles, pickState } = require('./export')
const { isVault, syncToVault } = require('./vault')

const KEY = 'obsidian_vault_path'

// deps: { dialog, getWindow, getSetting, setSetting }
function registerObsidianIpc(ipcMain, deps) {
  const handle = (channel, fn) => ipcMain.handle(channel, async (_, ...args) => {
    try { return { ok: true, data: await fn(...args) } }
    catch (e) { console.error('[obsidian]', channel, e.message); return { ok: false, error: e.message } }
  })
  const current = () => { const p = deps.getSetting(KEY); return p && isVault(p) ? p : null }

  handle('obsidian:status', () => { const p = deps.getSetting(KEY) || null; return { path: p, valid: !!(p && isVault(p)) } })

  handle('obsidian:pick', async () => {
    const res = await deps.dialog.showOpenDialog(deps.getWindow && deps.getWindow(), {
      title: 'Choose your Obsidian vault folder', properties: ['openDirectory']
    })
    if (res.canceled || !res.filePaths.length) return { path: deps.getSetting(KEY) || null, valid: !!current() }
    const p = res.filePaths[0]
    if (!isVault(p)) throw new Error('That folder is not an Obsidian vault (it has no .obsidian folder). Pick the folder you open in Obsidian.')
    deps.setSetting(KEY, p)
    return { path: p, valid: true }
  })

  handle('obsidian:sync', state => {
    const vault = current()
    if (!vault) throw new Error('No Obsidian vault connected')
    return syncToVault(vault, buildFiles(pickState(state)))
  })

  handle('obsidian:disconnect', () => { deps.setSetting(KEY, ''); return { path: null, valid: false } })
}

module.exports = { registerObsidianIpc, KEY }
