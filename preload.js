const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.2',
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  onUpdaterDebug: (cb) => ipcRenderer.on('updater-debug', (_, msg) => cb(msg)),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
  fetchT212: (endpoint) => ipcRenderer.invoke('t212-fetch', endpoint),
  fetchYouTube: (ytPath) => ipcRenderer.invoke('youtube-fetch', ytPath),
  youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || '',
  startYouTubeOAuth: () => ipcRenderer.invoke('youtube-oauth-start'),
  refreshYouTubeToken: () => ipcRenderer.invoke('youtube-oauth-refresh'),
  fetchYouTubeAnalytics: (ytPath, token) => ipcRenderer.invoke('youtube-analytics-fetch', ytPath, token),
  hasYouTubeOAuth: () => Boolean(process.env.YOUTUBE_REFRESH_TOKEN)
})

contextBridge.exposeInMainWorld('GROQ_API_KEY', process.env.GROQ_API_KEY || '')
