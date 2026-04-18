const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.1',
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  restartAndInstall: () => ipcRenderer.send('restart-and-install')
})

contextBridge.exposeInMainWorld('GROQ_API_KEY', process.env.GROQ_API_KEY || '')
