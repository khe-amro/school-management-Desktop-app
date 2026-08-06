import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import { initializeDatabase } from './database/connection'
import { runMigrations } from './database/migrator'
import { registerAllIpcHandlers } from './ipc/index'
import { createMainWindow } from './windows/mainWindow'

log.initialize({ preload: true })
log.transports.file.level = 'info'
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  log.warn('Another instance is already running — quitting')
  app.quit()
}

let mainWindow: BrowserWindow | null = null

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow()
  }
})

app.on('before-quit', () => {
  log.info('App quitting — closing database')
  try {
    const { closeDatabase } = require('./database/connection')
    closeDatabase()
  } catch { /* ignore */ }
})

async function bootstrap(): Promise<void> {
  await app.whenReady()

  log.info(`Edupilot DZ v${app.getVersion()} starting...`)
  log.info(`Electron: ${process.versions.electron}, Node: ${process.versions.node}`)
  log.info(`userData: ${app.getPath('userData')}`)

  try {
    // 1. Initialize database connection
    await initializeDatabase()

    // 2. Apply any pending migrations
    await runMigrations()

    // 3. Register all IPC handlers
    registerAllIpcHandlers()

    // 4. Create main window
    mainWindow = createMainWindow()

    log.info('Bootstrap complete')
  } catch (err) {
    log.error('Bootstrap failed:', err)
    // Show error dialog before quitting
    const { dialog } = require('electron')
    dialog.showErrorBox(
      'Startup Error',
      `Failed to initialize the application:\n\n${err instanceof Error ? err.message : String(err)}\n\nPlease check the logs.`
    )
    app.quit()
  }
}

bootstrap()
