const electron = require('electron')
console.log('electron type:', typeof electron)
if (typeof electron === 'object' && electron !== null) {
  console.log('electron keys:', Object.keys(electron).slice(0, 15).join(', '))
} else {
  console.log('electron value:', String(electron).substring(0, 100))
}
const { app, BrowserWindow, shell, ipcMain } = electron
console.log('ipcMain type:', typeof ipcMain)
console.log('app type:', typeof app)
process.exit(0)
