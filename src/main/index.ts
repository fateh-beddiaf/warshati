import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from '../database'
import { registerIpcHandlers } from './ipc'
import { applySecurityPolicy } from './security'
import { applyThemePreference, loadThemePreference, registerThemeHandlers } from './theme'
import {
  THEME_ARG_PREFERENCE,
  THEME_ARG_RESOLVED,
  THEME_BACKGROUND,
  type ResolvedTheme,
  type ThemePreference
} from '../shared/theme'

// WARSHATI_DATA_DIR isolates the database and userData (backups etc.) in a scratch
// folder so tests and experiments never touch real shop data.
const dataDirOverride = process.env['WARSHATI_DATA_DIR']
if (dataDirOverride) {
  app.setPath('userData', join(dataDirOverride, 'userData'))
}

// Dev only: the renderer console is not printed to the terminal by default,
// so forward warnings/errors and process-level failures to stdout.
function attachDevDiagnostics(win: BrowserWindow): void {
  win.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    if (level === 'warning' || level === 'error') {
      console.log(`[renderer:${level === 'error' ? 'error' : 'warn'}] ${message} (${sourceId}:${lineNumber})`)
    }
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[main] render-process-gone: ${details.reason} (exit ${details.exitCode})`)
  })
  win.on('unresponsive', () => {
    console.error('[main] window unresponsive')
  })
}

function createWindow(preference: ThemePreference, resolved: ResolvedTheme): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    // Same colour as the theme's --background so the window never flashes white in dark mode
    backgroundColor: THEME_BACKGROUND[resolved],
    autoHideMenuBar: true,
    title: 'ورشتي — إدارة محل تصليح الهواتف',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The preload only uses contextBridge/ipcRenderer and process.argv, all available in the sandbox
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Read synchronously by the preload to set <html class="dark"> before the first paint
      additionalArguments: [`${THEME_ARG_PREFERENCE}${preference}`, `${THEME_ARG_RESOLVED}${resolved}`]
    }
  })

  if (is.dev) attachDevDiagnostics(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Load renderer URL in dev, or local index.html in production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (is.dev) {
  process.on('uncaughtException', (err) => {
    console.error('[main] uncaughtException:', err)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[main] unhandledRejection:', reason)
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Initialize Database: override dir > dev (cwd/data) > userData
  const dbPath = dataDirOverride
    ? join(dataDirOverride, 'data', 'warshati.db')
    : is.dev
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

  // Navigation lock, no new windows, no permissions (every window, see security.ts)
  applySecurityPolicy()

  // Register IPC handlers
  registerIpcHandlers()
  registerThemeHandlers()

  const themePreference = loadThemePreference()
  const resolvedTheme = applyThemePreference(themePreference)
  createWindow(themePreference, resolvedTheme)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      const preference = loadThemePreference()
      createWindow(preference, applyThemePreference(preference))
    }
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
