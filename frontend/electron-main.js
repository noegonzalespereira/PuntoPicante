// electron-main.js (ESM, porque tu package.json tiene "type": "module")
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
    },
  })

  const indexPath = path.join(__dirname, 'dist', 'index.html')
  console.log('Cargando archivo:', indexPath)

  win.loadFile(indexPath)

  // Déjalo ON mientras debugueas
  win.webContents.openDevTools()

  win.webContents.on('did-fail-load', (event, code, desc, url) => {
    console.error('ERROR did-fail-load:', code, desc, url)
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
