const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const db = require('./src/db')
const mcp = require('./mcp-client')

// An uncaught exception/rejection in the main process otherwise crashes the
// whole app for the user with no dialog or log they can see; log and keep running.
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason)
})

let mainWindow
let tray

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'src', 'icons', 'icon-96.png')
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    tray = new Tray(icon)
    tray.setToolTip('SychBoard')
    const showWindow = () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open SychBoard', click: showWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]))
    tray.on('click', showWindow)
  } catch (e) {
    console.error('[tray] Failed to create tray icon:', e.message)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#050508',
      symbolColor: '#e8eaf0',
      height: 32
    },
    backgroundColor: '#050508',
    show: true
  })

  mainWindow.show()
  mainWindow.maximize()

  const indexPath = path.join(__dirname, 'src', 'index.html')
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('[window] Failed to load index.html:', err)
    mainWindow.loadURL(`data:text/html,<h1>Error loading app</h1><p>${err.message}</p>`)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (!app.isPackaged) mainWindow.webContents.openDevTools()
    checkForUpdates()
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[window] Load failed: ${errorCode} - ${errorDescription}`)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function checkForUpdates() {
  if (!app.isPackaged) {
    console.log('[updater] Skipped — app not packaged (dev mode)')
    mainWindow?.webContents.send('updater-debug', 'Dev mode: updates disabled')
    return
  }

  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger = console

    autoUpdater.on('checking-for-update', () => {
      console.log('[updater] Checking for updates...')
      mainWindow?.webContents.send('updater-debug', 'Checking for updates...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available: v' + info.version)
      mainWindow?.webContents.send('updater-debug', `Update available: v${info.version}`)
      mainWindow?.webContents.send('update-available', info.version)
      autoUpdater.downloadUpdate()
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('[updater] Up to date: v' + info.version)
      mainWindow?.webContents.send('updater-debug', `Up to date (v${info.version})`)
    })

    autoUpdater.on('update-downloaded', () => {
      console.log('[updater] Update downloaded, ready to install')
      mainWindow?.webContents.send('update-downloaded')
    })

    autoUpdater.on('error', (err) => {
      console.error('[updater] Error:', err.message)
      mainWindow?.webContents.send('updater-debug', `Error: ${err.message}`)
    })

    autoUpdater.on('download-progress', (progress) => {
      console.log(`[updater] Downloading: ${Math.round(progress.percent)}%`)
      mainWindow?.webContents.send('updater-debug', `Downloading: ${Math.round(progress.percent)}%`)
    })

    console.log('[updater] Starting update check...')
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[updater] Check failed:', err.message)
      mainWindow?.webContents.send('updater-debug', `Check failed: ${err.message}`)
    })
  } catch (e) {
    console.error('[updater] Exception:', e.message)
    mainWindow?.webContents.send('updater-debug', `Exception: ${e.message}`)
  }
}

ipcMain.handle('t212-fetch', (_, endpoint, apiKey) => {
  console.log('[T212] Fetch disabled temporarily per configuration.')
  return { error: 'Trading 212 integration is currently disabled.' }
  /*
  if (!apiKey) return { error: 'Trading 212 API Key not set in Settings' }
  return new Promise(resolve => {
    const options = {
      hostname: 'live.trading212.com',
      path: `/api/v0${endpoint}`,
      headers: { Authorization: apiKey }
    }
    const req = https.get(options, res => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => {
        try {
          const data = JSON.parse(raw)
          resolve({ status: res.statusCode, data })
        } catch (e) {
          console.error(`[T212] Parse error on ${endpoint} (status ${res.statusCode}):`, raw.slice(0, 500))
          resolve({ status: res.statusCode, error: 'API returned invalid data' })
        }
      })
    })
    req.setTimeout(12000, () => { req.destroy(); resolve({ error: 'Request timed out' }) })
    req.on('error', e => {
      console.error(`[T212] Request error on ${endpoint}:`, e.message)
      resolve({ error: 'Connection error' })
    })
  })
  */
})

ipcMain.handle('youtube-fetch', (_, ytPath, apiKey) => {
  if (typeof ytPath !== 'string' || !ytPath) return { error: 'Invalid YouTube API path' }
  if (!apiKey) return { error: 'YouTube API Key not set in Settings' }
  return new Promise(resolve => {
    const sep = ytPath.includes('?') ? '&' : '?'
    const fullPath = `/youtube/v3${ytPath}${sep}key=${encodeURIComponent(apiKey)}`
    const options = { hostname: 'www.googleapis.com', path: fullPath }
    const req = https.get(options, res => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }) }
        catch (e) { resolve({ status: res.statusCode, error: 'Parse error', raw }) }
      })
    })
    req.setTimeout(12000, () => { req.destroy(); resolve({ error: 'Request timed out' }) })
    req.on('error', e => resolve({ error: e.message }))
  })
})

ipcMain.handle('youtube-oauth-start', async (_, clientId, clientSecret) => {
  if (!clientId || !clientSecret) return { error: 'Set YouTube Client ID and Secret in Settings' }
  return new Promise((resolve) => {
    const server = http.createServer()
    const giveUp = setTimeout(() => { server.close(); resolve({ error: 'Auth timed out (2 min)' }) }, 120000)
    // Without this, a listen failure (port/socket error) emits 'error' with no
    // listener attached — Node treats that as an uncaught exception instead of
    // rejecting/resolving this promise, leaving the renderer's await hanging
    // until the unrelated 2-min timeout with no indication of what went wrong.
    server.on('error', (err) => {
      clearTimeout(giveUp)
      console.error('[YT OAuth] Server error:', err.message)
      resolve({ error: 'Could not start local OAuth server: ' + err.message })
    })
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const redirectUri = `http://127.0.0.1:${port}`
      const scope = 'https://www.googleapis.com/auth/yt-analytics.readonly'
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        `client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`
      shell.openExternal(authUrl)
      server.once('request', (req, res) => {
        clearTimeout(giveUp)
        const params = new URL(req.url, `http://127.0.0.1:${port}`).searchParams
        const code = params.get('code'), errParam = params.get('error')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#e8eaf0"><h2 style="color:#3d8ef0">Connected!</h2><p>Return to SychBoard.</p></body></html>')
        server.close()
        if (errParam) {
          console.error('[YT OAuth] Google OAuth rejected:', errParam)
          resolve({ error: 'Google rejected auth — check permissions in Google Cloud Console' })
          return
        }
        if (!code) {
          console.error('[YT OAuth] No auth code received')
          resolve({ error: 'No auth code received' })
          return
        }
        const postData = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString()
        const opts = { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } }
        const r = https.request(opts, res2 => {
          let raw = ''
          res2.on('data', c => { raw += c })
          res2.on('end', () => {
            try {
              const d = JSON.parse(raw)
              if (d.error) {
                console.error('[YT OAuth] Token error:', d.error, d.error_description)
                resolve({ error: 'Token error — re-authenticate in YouTube settings' })
                return
              }
              resolve({ access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in || 3600, error: d.error || null })
            } catch(e) {
              console.error('[YT OAuth] Token parse error:', e.message)
              resolve({ error: 'Token parse error' })
            }
          })
        })
        r.on('error', e => {
          console.error('[YT OAuth] Request error:', e.message)
          resolve({ error: 'Connection error' })
        })
        r.write(postData); r.end()
      })
    })
  })
})

ipcMain.handle('youtube-oauth-refresh', (_, clientId, clientSecret, refreshToken) => {
  if (!clientId || !clientSecret || !refreshToken) return { error: 'OAuth not configured in Settings' }
  return new Promise(resolve => {
    const postData = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString()
    const opts = { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } }
    const r = https.request(opts, res => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => {
        try {
          const d = JSON.parse(raw)
          if (d.error) {
            console.error('[YT Refresh] Token error:', d.error)
            resolve({ error: 'Token refresh failed' })
          } else {
            resolve(d)
          }
        } catch(e) {
          console.error('[YT Refresh] Parse error:', e.message)
          resolve({ error: 'Parse error' })
        }
      })
    })
    r.on('error', e => {
      console.error('[YT Refresh] Request error:', e.message)
      resolve({ error: 'Connection error' })
    })
    r.write(postData); r.end()
  })
})

ipcMain.handle('youtube-analytics-fetch', (_, ytPath, accessToken) => {
  if (typeof ytPath !== 'string' || !ytPath) return { error: 'Invalid YouTube API path' }
  if (!accessToken) return { error: 'No access token' }
  return new Promise(resolve => {
    const options = { hostname: 'youtubeanalytics.googleapis.com', path: ytPath, headers: { Authorization: `Bearer ${accessToken}` } }
    const req = https.get(options, res => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => {
        try {
          const data = JSON.parse(raw)
          if (res.statusCode === 403) {
            console.error('[YT Analytics] Access denied (403) — token may lack permissions or have expired')
            resolve({ status: res.statusCode, error: 'Access denied — try re-authenticating' })
          } else {
            resolve({ status: res.statusCode, data })
          }
        } catch (e) {
          console.error(`[YT Analytics] Parse error on ${ytPath}:`, raw.slice(0, 300))
          resolve({ status: res.statusCode, error: 'API returned invalid data' })
        }
      })
    })
    req.setTimeout(12000, () => { req.destroy(); resolve({ error: 'Request timed out' }) })
    req.on('error', e => {
      console.error('[YT Analytics] Request error:', e.message)
      resolve({ error: 'Connection error' })
    })
  })
})

ipcMain.handle('app:get-login-item-settings', () => {
  try { return { openAtLogin: app.getLoginItemSettings().openAtLogin } }
  catch (e) { console.error('[app]', e.message); return { openAtLogin: false } }
})
ipcMain.handle('app:set-login-item-settings', (_, openAtLogin) => {
  if (typeof openAtLogin !== 'boolean') return { ok: false, error: 'invalid_input' }
  try { app.setLoginItemSettings({ openAtLogin }); return { ok: true } }
  catch (e) { console.error('[app]', e.message); return { ok: false, error: 'failed' } }
})

ipcMain.on('restart-and-install', () => {
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.quitAndInstall()
  } catch (e) {}
})

app.whenReady().then(() => {
  try { db.initDB(app) } catch (e) { console.error('[db] Init failed:', e.message) }
  createWindow()
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ── Gamification IPC ──
// Input validation helpers — IPC args come from the renderer and must not
// reach better-sqlite3 with the wrong type (it throws on undefined/NaN/objects
// bound as params, which would otherwise surface as an opaque native error).
function isPositiveInt(v) { return Number.isInteger(v) && v > 0 }
function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v) }
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0 }

ipcMain.handle('quests:list', () => { try { return db.listQuests() } catch(e) { console.error('[db]',e.message); return [] } })
ipcMain.handle('quests:complete', (_, questId) => {
  if (!isPositiveInt(questId)) throw new Error('Invalid quest id')
  try { return db.completeQuest(questId) } catch(e) { console.error('[db]',e.message); throw e }
})
ipcMain.handle('quests:uncomplete', (_, questId) => {
  if (!isPositiveInt(questId)) return {}
  try { return db.uncompleteQuest(questId) } catch(e) { console.error('[db]',e.message); return {} }
})
ipcMain.handle('profile:get', () => { try { return db.getProfile() } catch(e) { console.error('[db]',e.message); return null } })
ipcMain.handle('streaks:get', () => { try { return db.getStreaks() } catch(e) { console.error('[db]',e.message); return { categories:[], globalStreak:0 } } })
ipcMain.handle('badges:list', () => { try { return db.listBadges() } catch(e) { console.error('[db]',e.message); return [] } })
ipcMain.handle('activity:recent', () => { try { return db.getRecentActivity() } catch(e) { console.error('[db]',e.message); return [] } })
// Developer API keys from .env (dev machine only — .env is not packaged into builds)
function loadEnvKeys() {
  try {
    const fs = require('fs')
    const envPath = path.join(__dirname, '.env')
    if (!fs.existsSync(envPath)) return {}
    const out = {}
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    return out
  } catch (e) { console.error('[env]', e.message); return {} }
}
ipcMain.handle('env:get-keys', () => {
  const e = loadEnvKeys()
  return {
    groq: e.GROQ_API_KEY || '',
    t212: e.TRADING212_API_KEY || '',
    ytApi: e.YOUTUBE_API_KEY || '',
    ytChannelId: e.YOUTUBE_CHANNEL_ID || '',
    ytClientId: e.YOUTUBE_CLIENT_ID || '',
    ytClientSecret: e.YOUTUBE_CLIENT_SECRET || '',
    ytRefreshToken: e.YOUTUBE_REFRESH_TOKEN || ''
  }
})
ipcMain.handle('coins:get', () => { try { return db.getCoins() } catch(e) { console.error('[db]',e.message); return 0 } })
ipcMain.handle('shop:purchase', (_, itemKey, cost) => {
  if (!isNonEmptyString(itemKey) || !isFiniteNumber(cost) || cost < 0) return { ok:false, error:'invalid_input' }
  try { return db.purchaseItem(itemKey, cost) } catch(e) { console.error('[db]',e.message); return { ok:false, error:'db_error' } }
})
ipcMain.handle('shop:purchase-freeze', () => {
  try { return db.purchaseFreeze() } catch(e) { console.error('[db]',e.message); return { ok:false, error:'db_error' } }
})
ipcMain.handle('xp:history', (_, days) => {
  if (days !== undefined && !isFiniteNumber(days)) return []
  try { return db.getXpHistory(days) } catch(e) { console.error('[db]',e.message); return [] }
})
ipcMain.handle('settings:get', (_, key) => {
  if (!isNonEmptyString(key)) return null
  try { return db.getSetting(key) } catch(e) { return null }
})
ipcMain.handle('settings:set', (_, key, value) => {
  if (!isNonEmptyString(key)) return
  try { db.setSetting(key, value) } catch(e) { console.error('[db]',e.message) }
})
ipcMain.handle('data:export-game', () => {
  try { return { ok: true, data: db.exportGameData() } }
  catch(e) { console.error('[db]',e.message); return { ok: false, error: e.message } }
})
ipcMain.handle('data:import-game', (_, data) => {
  try { return db.importGameData(data) }
  catch(e) { console.error('[db]',e.message); return { ok: false, error: 'import_failed' } }
})
// ── sychboard-mcp bridge (Phase 1 AI OS) ──
// The renderer never talks to the MCP server directly; permission modes are
// enforced in mcp-client.js against permissions.json on every call.
ipcMain.handle('mcp:list-tools', async () => {
  try { return { ok: true, tools: await mcp.listTools() } }
  catch (e) { console.error('[mcp]', e.message); return { ok: false, error: e.message, tools: [] } }
})
ipcMain.handle('mcp:call-tool', async (_, name, args, approved) => {
  if (!isNonEmptyString(name)) return { isError: true, text: 'invalid tool name' }
  try { return await mcp.callTool(name, args, approved === true) }
  catch (e) { console.error('[mcp]', e.message); return { isError: true, text: e.message } }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('will-quit', () => {
  try { mcp.stop() } catch (e) {}
  try { tray?.destroy() } catch (e) {}
})
