import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from '../database'
import { registerIpcHandlers } from './ipc'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'ورشتي — إدارة محل تصليح الهواتف',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load renderer URL in dev, or local index.html in production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Initialize Database in userData
  const dbPath = is.dev
    ? join(process.cwd(), 'data', 'warshati.db')
    : join(app.getPath('userData'), 'warshati.db')

  try {
    initDatabase(dbPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'فشل ترحيل قاعدة البيانات.'
    dialog.showErrorBox(
      'تم إيقاف تشغيل ورشتي لحماية البيانات',
      `لم يُجرَ أي ترحيل جزئي. راجع البيانات المرجعية ثم أعد تشغيل التطبيق.\n\n${message}`
    )
    app.quit()
    return
  }

  // Register IPC handlers
  registerIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
