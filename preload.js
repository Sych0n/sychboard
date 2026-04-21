const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.11',
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  onUpdaterDebug: (cb) => ipcRenderer.on('updater-debug', (_, msg) => cb(msg)),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
  fetchT212: (endpoint, apiKey) => ipcRenderer.invoke('t212-fetch', endpoint, apiKey),
  fetchYouTube: (ytPath, apiKey) => ipcRenderer.invoke('youtube-fetch', ytPath, apiKey),
  startYouTubeOAuth: (clientId, clientSecret) => ipcRenderer.invoke('youtube-oauth-start', clientId, clientSecret),
  refreshYouTubeToken: (clientId, clientSecret, refreshToken) => ipcRenderer.invoke('youtube-oauth-refresh', clientId, clientSecret, refreshToken),
  fetchYouTubeAnalytics: (ytPath, token) => ipcRenderer.invoke('youtube-analytics-fetch', ytPath, token)
})
