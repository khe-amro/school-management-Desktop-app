import { ipcMain, app, dialog, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import log from 'electron-log'
import { IPC_CHANNELS } from '@shared/constants'
import { getSqlite } from '../database/connection'

// Validation schemas
const SelectProfileImageSchema = z.object({
  type: z.enum(['admin', 'student', 'teacher']),
  recordId: z.string(),
})

type SelectProfileImageInput = z.infer<typeof SelectProfileImageSchema>

/**
 * Ensure media folders exist
 */
function ensureMediaFolders(): string {
  const mediaDir = path.join(app.getPath('userData'), 'media')
  const types = ['administrators', 'students', 'teachers']

  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true })
  }

  for (const type of types) {
    const typeDir = path.join(mediaDir, type)
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true })
    }
  }

  return mediaDir
}

/**
 * Validate image file
 * Allowed formats: JPEG, PNG, WebP
 * Max size: 5MB
 */
function validateImage(filePath: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File does not exist' }
  }

  const stat = fs.statSync(filePath)
  const maxSize = 5 * 1024 * 1024 // 5MB

  if (stat.size > maxSize) {
    return { valid: false, error: `Image exceeds 5MB limit (${Math.round(stat.size / 1024 / 1024)}MB)` }
  }

  const ext = path.extname(filePath).toLowerCase()
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp']

  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid image format. Allowed: JPEG, PNG, WebP (got ${ext})`,
    }
  }

  return { valid: true }
}

/**
 * Generate unique filename
 */
function generateImageFilename(ext: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}${ext}`
}

/**
 * IPC Handler: Select and upload profile image
 * Opens native file picker, validates, stores in managed media folder, returns relative path
 */
export function registerMediaHandlers() {
  ipcMain.handle(IPC_CHANNELS.MEDIA_SELECT_IMAGE, async (_, input: unknown) => {
    try {
      const { type, recordId } = SelectProfileImageSchema.parse(input)
      const parentWindow = require('electron').BrowserWindow.getFocusedWindow()

      // Open file picker
      const result = await dialog.showOpenDialog(parentWindow, {
        title: 'Select Profile Image',
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'webp'],
          },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, path: null, error: 'Selection cancelled' }
      }

      const selectedFile = result.filePaths[0]

      // Validate image
      const validation = validateImage(selectedFile)
      if (!validation.valid) {
        return { success: false, path: null, error: validation.error }
      }

      // Ensure media folders exist
      const mediaDir = ensureMediaFolders()
      const typeDir = path.join(mediaDir, `${type}s`) // administrators, students, teachers
      const ext = path.extname(selectedFile)
      const filename = generateImageFilename(ext)
      const destPath = path.join(typeDir, filename)

      // Process and store image using Electron nativeImage (no external binary dependency)
      try {
        const image = nativeImage.createFromPath(selectedFile)
        if (!image.isEmpty()) {
          const size = image.getSize()
          const maxDim = 1024
          let resized = image
          if (size.width > maxDim || size.height > maxDim) {
            const aspect = size.width / size.height
            const newWidth = size.width >= size.height ? maxDim : Math.round(maxDim * aspect)
            const newHeight = size.width >= size.height ? Math.round(maxDim / aspect) : maxDim
            resized = image.resize({ width: newWidth, height: newHeight, quality: 'better' })
          }
          const jpegBuffer = resized.toJPEG(85)
          await fs.promises.writeFile(destPath, jpegBuffer)
        } else {
          await fs.promises.copyFile(selectedFile, destPath)
        }
      } catch {
        await fs.promises.copyFile(selectedFile, destPath)
      }

      // Return relative path for storage in DB
      // Format: media/administrators/filename.jpg
      const relativePath = path.join('media', `${type}s`, filename).replace(/\\/g, '/')

      log.info(`[MEDIA] Profile image stored: ${relativePath}`)

      return { success: true, path: relativePath, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('[MEDIA] Error in MEDIA_SELECT_IMAGE:', errorMessage)
      return { success: false, path: null, error: errorMessage }
    }
  })

  /**
   * IPC Handler: Delete profile image
   */
  ipcMain.handle(IPC_CHANNELS.MEDIA_DELETE_IMAGE, async (_, input: unknown) => {
    try {
      const schema = z.object({
        relativePath: z.string(),
      })
      const { relativePath } = schema.parse(input)

      const userData = app.getPath('userData')
      const imagePath = path.isAbsolute(relativePath)
        ? relativePath
        : relativePath.startsWith('media')
          ? path.join(userData, relativePath)
          : path.join(userData, 'media', relativePath)

      // Security check: ensure file is within userData directory
      const resolvedPath = path.resolve(imagePath)
      const resolvedUserData = path.resolve(userData)

      if (!resolvedPath.startsWith(resolvedUserData)) {
        return { success: false, error: 'Invalid path' }
      }

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
        log.info(`[MEDIA] Profile image deleted: ${relativePath}`)
      }

      return { success: true, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('[MEDIA] Error in MEDIA_DELETE_IMAGE:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  /**
   * IPC Handler: Get image URL (for displaying stored images)
   * Returns base64 Data URL for universal display without Chromium file:// security blocks
   */
  ipcMain.handle(IPC_CHANNELS.MEDIA_GET_IMAGE_URL, async (_, input: unknown) => {
    try {
      const schema = z.object({
        relativePath: z.string().optional().nullable(),
      })
      const { relativePath } = schema.parse(input)

      if (!relativePath) {
        return { url: null }
      }

      const userData = app.getPath('userData')
      const imagePath = path.isAbsolute(relativePath)
        ? relativePath
        : relativePath.startsWith('media')
          ? path.join(userData, relativePath)
          : path.join(userData, 'media', relativePath)

      if (!fs.existsSync(imagePath)) {
        return { url: null, error: 'File not found' }
      }

      const buf = fs.readFileSync(imagePath)
      const ext = path.extname(imagePath).slice(1).toLowerCase()
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`

      return { url: dataUrl, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('[MEDIA] Error in MEDIA_GET_IMAGE_URL:', errorMessage)
      return { url: null, error: errorMessage }
    }
  })
}
