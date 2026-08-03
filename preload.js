const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sychboard', {
  quests: {
    list: () => ipcRenderer.invoke('quests:list'),
    complete: (id) => ipcRenderer.invoke('quests:complete', id),
    uncomplete: (id) => ipcRenderer.invoke('quests:uncomplete', id)
  },
  profile: {
    get: () => ipcRenderer.invoke('profile:get')
  },
  streaks: {
    get: () => ipcRenderer.invoke('streaks:get')
  },
  badges: { list: () => ipcRenderer.invoke('badges:list') },
  activity: { recent: () => ipcRenderer.invoke('activity:recent') },
  coins: {
    get: () => ipcRenderer.invoke('coins:get')
  },
  shop: {
    purchase: (itemKey, cost) => ipcRenderer.invoke('shop:purchase', itemKey, cost),
    purchaseFreeze: () => ipcRenderer.invoke('shop:purchase-freeze')
  },
  xp: { history: (days) => ipcRenderer.invoke('xp:history', days) },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, val) => ipcRenderer.invoke('settings:set', key, val)
  },
  mcp: {
    listTools: () => ipcRenderer.invoke('mcp:list-tools'),
    callTool: (name, args, approved) => ipcRenderer.invoke('mcp:call-tool', name, args, approved)
  },
  data: {
    exportGame: () => ipcRenderer.invoke('data:export-game'),
    importGame: (data) => ipcRenderer.invoke('data:import-game', data),
    clearGame: () => ipcRenderer.invoke('data:clear-game')
  }
})

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  onUpdaterDebug: (cb) => ipcRenderer.on('updater-debug', (_, msg) => cb(msg)),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
  getEnvKeys: () => ipcRenderer.invoke('env:get-keys'),
  fetchT212: (endpoint, apiKey) => ipcRenderer.invoke('t212-fetch', endpoint, apiKey),
  fetchYouTube: (ytPath, apiKey) => ipcRenderer.invoke('youtube-fetch', ytPath, apiKey),
  startYouTubeOAuth: (clientId, clientSecret) => ipcRenderer.invoke('youtube-oauth-start', clientId, clientSecret),
  refreshYouTubeToken: (clientId, clientSecret, refreshToken) => ipcRenderer.invoke('youtube-oauth-refresh', clientId, clientSecret, refreshToken),
  fetchYouTubeAnalytics: (ytPath, token) => ipcRenderer.invoke('youtube-analytics-fetch', ytPath, token),
  getLoginItemSettings: () => ipcRenderer.invoke('app:get-login-item-settings'),
  setLoginItemSettings: (openAtLogin) => ipcRenderer.invoke('app:set-login-item-settings', openAtLogin)
})
