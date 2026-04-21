 require('dotenv').config()
const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const fs = require('fs')

let mainWindow

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
      color: '#0a0a0f',
      symbolColor: '#3d8ef0',
      height: 32
    },
    backgroundColor: '#0a0a0f',
    show: false
  })

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (!app.isPackaged) mainWindow.webContents.openDevTools()
    checkForUpdates()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function checkForUpdates() {
  if (!app.isPackaged) {
    console.log('[updater] skipping — app not packaged')
    mainWindow?.webContents.send('updater-debug', 'Skipped: app not packaged (dev mode)')
    return
  }
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = console

    autoUpdater.on('checking-for-update', () => {
      console.log('[updater] checking for update...')
      mainWindow?.webContents.send('updater-debug', 'Checking for update...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] update available:', info.version)
      mainWindow?.webContents.send('updater-debug', `Update available: v${info.version}`)
      mainWindow?.webContents.send('update-available', info.version)
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('[updater] up to date:', info.version)
      mainWindow?.webContents.send('updater-debug', `Up to date (v${info.version})`)
    })

    autoUpdater.on('update-downloaded', () => {
      console.log('[updater] update downloaded')
      mainWindow?.webContents.send('update-downloaded')
    })

    autoUpdater.on('error', (err) => {
      console.error('[updater] error:', err.message)
      mainWindow?.webContents.send('updater-debug', `Error: ${err.message}`)
    })

    console.log('[updater] calling checkForUpdates()')
    mainWindow?.webContents.send('updater-debug', 'Calling checkForUpdates()...')
    autoUpdater.checkForUpdates().then(result => {
      console.log('[updater] checkForUpdates resolved:', JSON.stringify(result?.updateInfo?.version))
    }).catch(err => {
      console.error('[updater] checkForUpdates rejected:', err.message)
      mainWindow?.webContents.send('updater-debug', `checkForUpdates failed: ${err.message}`)
    })
  } catch (e) {
    console.error('[updater] exception:', e.message)
    mainWindow?.webContents.send('updater-debug', `Exception: ${e.message}`)
  }
}

ipcMain.handle('t212-fetch', (_, endpoint) => {
  console.log('[T212] Fetch disabled temporarily per configuration.')
  return { error: 'Trading 212 integration is currently disabled.' }
  /*
  const apiKey = process.env.TRADING212_API_KEY
  if (!apiKey) return { error: 'TRADING212_API_KEY not set in .env' }
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

ipcMain.handle('youtube-fetch', (_, ytPath) => {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { error: 'YOUTUBE_API_KEY not set in .env' }
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

ipcMain.handle('youtube-oauth-start', async () => {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return { error: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env' }
  return new Promise((resolve) => {
    const server = http.createServer()
    const giveUp = setTimeout(() => { server.close(); resolve({ error: 'Auth timed out (2 min)' }) }, 120000)
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
              if (d.refresh_token) {
                const envPath = path.join(__dirname, '.env')
                let envTxt = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
                envTxt = envTxt.includes('YOUTUBE_REFRESH_TOKEN=')
                  ? envTxt.replace(/YOUTUBE_REFRESH_TOKEN=.*/, `YOUTUBE_REFRESH_TOKEN=${d.refresh_token}`)
                  : envTxt.trimEnd() + `\nYOUTUBE_REFRESH_TOKEN=${d.refresh_token}\n`
                fs.writeFileSync(envPath, envTxt.trim() + '\n')
                process.env.YOUTUBE_REFRESH_TOKEN = d.refresh_token
                console.log('[YT OAuth] Token saved successfully')
              }
              resolve({ access_token: d.access_token, expires_in: d.expires_in || 3600, error: d.access_token ? null : 'No token' })
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

ipcMain.handle('youtube-oauth-refresh', () => {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return { error: 'OAuth not configured' }
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

ipcMain.on('restart-and-install', () => {
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.quitAndInstall()
  } catch (e) {}
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
