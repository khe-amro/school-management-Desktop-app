import { handle } from './_handler'
import { ipcMain, dialog, app, shell } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { UpdateSettingsSchema, RestoreBackupSchema, UploadPhotoSchema } from '../../shared/schemas/index'
import { getSettings, updateSettings } from '../services/settings.service'
import { createBackup, listBackups, verifyBackup, restoreBackup } from '../services/backup.service'
import { uploadPhoto } from '../services/media.service'
import { requireSession } from '../services/auth.service'
import { z } from 'zod'

export function registerUtilityHandlers(): void {
  // Health check
  handle(IPC_CHANNELS.HEALTH_CHECK, async () => {
    let sqliteOpen = false
    let migrationsApplied = false
    try {
      const { getSqlite } = await import('../database/connection')
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT 1 as alive').get() as { alive: number } | undefined
      sqliteOpen = row?.alive === 1

      const migRow = sqlite.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get() as { cnt: number } | undefined
      migrationsApplied = (migRow?.cnt ?? 0) > 0
    } catch {
      sqliteOpen = false
      migrationsApplied = false
    }

    return {
      preloadLoaded: true,
      mainReachable: true,
      ipcWorking: true,
      sqliteOpen,
      migrationsApplied,
    }
  })

  // Settings
  handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return getSettings()
  })
  handle(IPC_CHANNELS.SETTINGS_UPDATE, async (payload) => {
    const data = UpdateSettingsSchema.parse(payload)
    return updateSettings(data)
  })

  // Backups
  handle(IPC_CHANNELS.BACKUPS_CREATE, async (payload) => {
    const opts = z.object({ destinationDir: z.string().max(500).optional() }).parse(payload ?? {})
    return createBackup(opts.destinationDir)
  })
  handle(IPC_CHANNELS.BACKUPS_LIST, async () => {
    return listBackups()
  })
  handle(IPC_CHANNELS.BACKUPS_VERIFY, async (payload) => {
    const { backupPath } = z.object({ backupPath: z.string().min(1).max(1000) }).parse(payload)
    const ok = await verifyBackup(backupPath)
    return { verified: ok }
  })
  handle(IPC_CHANNELS.BACKUPS_RESTORE, async (payload) => {
    const data = RestoreBackupSchema.parse(payload)
    // Verify admin password before restore
    const { verifyPassword } = await import('../services/auth.service')
    const session = requireSession()
    const { getDb, schema } = await import('../database/connection')
    const { eq } = await import('drizzle-orm')
    const db = getDb()
    const admin = await db.query.administrators.findFirst({
      where: eq(schema.administrators.id, session.adminId),
    })
    if (!admin) throw new Error('Admin not found')
    const ok = await verifyPassword(admin.passwordHash, data.confirmPassword)
    if (!ok) throw new Error('Password confirmation incorrect')
    await restoreBackup(data.backupPath)
    return true
  })

  // Media
  handle(IPC_CHANNELS.MEDIA_UPLOAD_PHOTO, async (payload) => {
    const data = UploadPhotoSchema.parse(payload)
    const filename = await uploadPhoto(data.sourcePath, data.entityType, data.entityId)
    return { filename }
  })

  // App info
  handle(IPC_CHANNELS.APP_GET_VERSION, async () => {
    return { version: app.getVersion(), name: app.getName() }
  })

  handle(IPC_CHANNELS.APP_GET_PATHS, async () => {
    requireSession()
    return {
      userData: app.getPath('userData'),
      documents: app.getPath('documents'),
    }
  })

  // File dialogs (main process only — never let renderer specify arbitrary paths)
  handle(IPC_CHANNELS.APP_OPEN_BACKUP_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Backup File',
      filters: [{ name: 'Backup Files', extensions: ['zip'] }],
      properties: ['openFile'],
    })
    if (result.canceled) return { canceled: true, path: null }
    return { canceled: false, path: result.filePaths[0] ?? null }
  })

  handle(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Backup Destination Folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled) return { canceled: true, path: null }
    return { canceled: false, path: result.filePaths[0] ?? null }
  })

  // Print
  handle(IPC_CHANNELS.APP_PRINT, async () => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.print({ silent: false, printBackground: true })
    }
    return true
  })

  // Print to PDF
  handle(IPC_CHANNELS.APP_PRINT_TO_PDF, async (payload) => {
    const { BrowserWindow } = await import('electron')
    const fs = await import('fs/promises')
    const path = await import('path')
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No focused window')

    const opts = (payload ?? {}) as { pageSize?: 'A4' | 'Letter'; marginsType?: 0 | 1 | 2 }
    const pdfOptions = {
      printBackground: true,
      marginsType: opts.marginsType ?? 0,
      pageSize: opts.pageSize ?? 'A4',
    } as Electron.PrintToPDFOptions

    const buffer = await win.webContents.printToPDF(pdfOptions)
    const documentsDir = app.getPath('documents')
    const filename = `EdupilotDZ-report-${Date.now()}.pdf`
    const outPath = path.join(documentsDir, filename)
    await fs.writeFile(outPath, buffer)
    return { path: outPath }
  })
}

