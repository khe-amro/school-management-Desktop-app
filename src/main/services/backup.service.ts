import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'
import archiver from 'archiver'
import extract from 'extract-zip'
import { getSqlite, getDatabasePath_ } from '../database/connection'
import { requireSession } from './auth.service'
import { getSettings } from './settings.service'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { BACKUP_DIR_DEFAULT, STUDENTS_PHOTO_DIR, TEACHERS_PHOTO_DIR } from '../../shared/constants/index'
import type { BackupInfo } from '../../shared/types/index'
import log from 'electron-log'

function getDefaultBackupDir(): string {
  return path.join(app.getPath('userData'), BACKUP_DIR_DEFAULT)
}

function generateBackupFilename(): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, '').slice(0, 15)
  return `school-backup-${ts}.zip`
}

function computeFileHash(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

export async function createBackup(destinationDir?: string): Promise<BackupInfo> {
  requireSession()

  const settings = await getSettings()
  const backupDir = destinationDir ?? settings?.backupDirectory ?? getDefaultBackupDir()

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const filename = generateBackupFilename()
  const backupPath = path.join(backupDir, filename)
  const dbPath = getDatabasePath_()
  const userData = app.getPath('userData')

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(backupPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)

    // Include database
    archive.file(dbPath, { name: 'data/school-management.sqlite' })

    // Include student photos
    const studentsPhotoDir = path.join(userData, STUDENTS_PHOTO_DIR)
    if (fs.existsSync(studentsPhotoDir)) {
      archive.directory(studentsPhotoDir, 'media/students')
    }

    // Include teacher photos
    const teachersPhotoDir = path.join(userData, TEACHERS_PHOTO_DIR)
    if (fs.existsSync(teachersPhotoDir)) {
      archive.directory(teachersPhotoDir, 'media/teachers')
    }

    // Manifest
    archive.append(
      JSON.stringify({
        version: app.getVersion(),
        createdAt: new Date().toISOString(),
        appName: 'edupilot-dz',
      }),
      { name: 'manifest.json' }
    )

    archive.finalize()
  })

  const stat = fs.statSync(backupPath)
  const hash = computeFileHash(backupPath)

  // Write checksum file
  fs.writeFileSync(`${backupPath}.sha256`, hash)

  // Enforce retention
  await enforceRetention(backupDir, settings?.backupsToRetain ?? 30)

  log.info(`Backup created: ${filename} (${stat.size} bytes)`)

  return {
    filename,
    path: backupPath,
    createdAt: new Date().toISOString(),
    sizeBytes: stat.size,
    verified: true,
  }
}

export async function listBackups(): Promise<BackupInfo[]> {
  requireSession()
  const settings = await getSettings()
  const backupDir = settings?.backupDirectory ?? getDefaultBackupDir()

  if (!fs.existsSync(backupDir)) return []

  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.zip'))
    .map(filename => {
      const filePath = path.join(backupDir, filename)
      const stat = fs.statSync(filePath)
      const checksumPath = `${filePath}.sha256`
      let verified = false

      if (fs.existsSync(checksumPath)) {
        try {
          const storedHash = fs.readFileSync(checksumPath, 'utf8').trim()
          const actualHash = computeFileHash(filePath)
          verified = storedHash === actualHash
        } catch {
          verified = false
        }
      }

      return {
        filename,
        path: filePath,
        createdAt: stat.birthtime.toISOString(),
        sizeBytes: stat.size,
        verified,
      } satisfies BackupInfo
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return files
}

export async function verifyBackup(backupPath: string): Promise<boolean> {
  // Prevent path traversal
  const settings = await getSettings()
  const backupDir = settings?.backupDirectory ?? getDefaultBackupDir()
  const resolved = path.resolve(backupPath)
  if (!resolved.startsWith(path.resolve(backupDir))) {
    throw new AppError(ErrorCode.PATH_TRAVERSAL, 'Invalid backup path')
  }

  if (!fs.existsSync(backupPath)) {
    throw new AppError(ErrorCode.BACKUP_NOT_FOUND, 'Backup file not found')
  }

  const checksumPath = `${backupPath}.sha256`
  if (!fs.existsSync(checksumPath)) return false

  const storedHash = fs.readFileSync(checksumPath, 'utf8').trim()
  const actualHash = computeFileHash(backupPath)
  return storedHash === actualHash
}

export async function restoreBackup(backupPath: string): Promise<void> {
  const session = requireSession()

  // Validate path
  const settings = await getSettings()
  const backupDir = settings?.backupDirectory ?? getDefaultBackupDir()
  const resolved = path.resolve(backupPath)
  if (!resolved.startsWith(path.resolve(backupDir))) {
    throw new AppError(ErrorCode.PATH_TRAVERSAL, 'Invalid backup path')
  }

  if (!fs.existsSync(backupPath) || !backupPath.endsWith('.zip')) {
    throw new AppError(ErrorCode.BACKUP_NOT_FOUND, 'Backup file not found or invalid')
  }

  // 1. Back up current data first
  log.info('Creating pre-restore backup...')
  await createBackup(path.join(app.getPath('userData'), 'backups', 'pre-restore'))

  // 2. Extract to temp dir and validate structure
  const tmpDir = path.join(app.getPath('temp'), `edupilot-restore-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    await extract(backupPath, { dir: tmpDir })

    // Validate manifest
    const manifestPath = path.join(tmpDir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      throw new AppError(ErrorCode.BACKUP_INVALID, 'Backup is missing manifest.json')
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    if (manifest.appName !== 'edupilot-dz') {
      throw new AppError(ErrorCode.BACKUP_INVALID, 'Backup is from a different application')
    }

    // Validate DB is present
    const dbInBackup = path.join(tmpDir, 'data', 'school-management.sqlite')
    if (!fs.existsSync(dbInBackup)) {
      throw new AppError(ErrorCode.BACKUP_INVALID, 'Backup does not contain a database file')
    }

    // 3. Close DB connection
    const sqlite = getSqlite()
    sqlite.close()

    // 4. Replace database
    const dbPath = getDatabasePath_()
    fs.copyFileSync(dbInBackup, dbPath)

    // 5. Restore media
    const userData = app.getPath('userData')
    const mediaInBackup = path.join(tmpDir, 'media')
    if (fs.existsSync(mediaInBackup)) {
      const targetMedia = path.join(userData, 'media')
      if (fs.existsSync(targetMedia)) fs.rmSync(targetMedia, { recursive: true })
      fs.cpSync(mediaInBackup, targetMedia, { recursive: true })
    }

    log.info(`Restore completed by admin ${session.adminId}. Restarting...`)

    // 6. Restart app to re-initialize DB
    setTimeout(() => {
      const { app: electronApp } = require('electron')
      electronApp.relaunch()
      electronApp.exit(0)
    }, 1000)

  } finally {
    // Clean up temp dir
    try { fs.rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
  }
}

async function enforceRetention(backupDir: string, maxCount: number): Promise<void> {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.zip'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)

    const toDelete = files.slice(maxCount)
    for (const file of toDelete) {
      const filePath = path.join(backupDir, file.name)
      fs.unlinkSync(filePath)
      const checksumPath = `${filePath}.sha256`
      if (fs.existsSync(checksumPath)) fs.unlinkSync(checksumPath)
      log.info(`Backup retention: removed old backup ${file.name}`)
    }
  } catch (err) {
    log.warn('Backup retention enforcement failed:', err)
  }
}
