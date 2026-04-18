require('dotenv').config()
const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')

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
    checkForUpdates()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function checkForUpdates() {
  if (!app.isPackaged) return
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update-available', info.version)
    })

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('update-downloaded')
    })

    autoUpdater.checkForUpdates().catch(() => {})
  } catch (e) {}
}

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
