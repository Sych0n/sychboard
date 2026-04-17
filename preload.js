const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0'
})

contextBridge.exposeInMainWorld('GROQ_API_KEY', process.env.GROQ_API_KEY || '')
