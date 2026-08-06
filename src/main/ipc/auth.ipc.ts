import Database from 'better-sqlite3'
import { handle } from './_handler'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { LoginSchema, ChangePasswordSchema, SetupSchema } from '../../shared/schemas/index'
import {
  login, logout, changePassword, getCurrentSession,
  hashPassword
} from '../services/auth.service'
import { getDb, schema } from '../database/connection'
import { isFirstRun, markSetupComplete } from '../database/migrator'
import { updateSettings } from '../services/settings.service'
import { AppError, ErrorCode } from '../../shared/errors/index'

export function registerAuthHandlers(): void {
  handle(IPC_CHANNELS.AUTH_LOGIN, async (payload) => {
    const { username, password } = LoginSchema.parse(payload)
    return login(username, password)
  })

  handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    await logout()
    return true
  })

  handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (payload) => {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(payload)
    await changePassword(currentPassword, newPassword)
    return true
  })

  handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    return getCurrentSession()
  })

  handle(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN, async () => {
    return { firstRun: isFirstRun() }
  })

  handle(IPC_CHANNELS.AUTH_COMPLETE_SETUP, async (payload) => {
    const data = SetupSchema.parse(payload)

    if (!isFirstRun()) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Setup already completed')
    }

    const db = getDb()

    // Create or update admin with Argon2id hash
    const passwordHash = await hashPassword(data.adminPassword)
    const existingAdmin = await db.query.administrators.findFirst({
      where: eq(schema.administrators.username, data.adminUsername),
    })

    if (existingAdmin) {
      await db
        .update(schema.administrators)
        .set({
          passwordHash,
          fullName: data.adminFullName,
          role: 'superadmin',
          preferredLanguage: data.preferredLanguage,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.administrators.id, existingAdmin.id))
    } else {
      try {
        await db.insert(schema.administrators).values({
          username: data.adminUsername,
          passwordHash,
          fullName: data.adminFullName,
          role: 'superadmin',
          preferredLanguage: data.preferredLanguage,
          isActive: true,
        })
      } catch (err) {
        if (
          err instanceof Database.SqliteError &&
          err.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
          const duplicateAdmin = await db.query.administrators.findFirst({
            where: eq(schema.administrators.username, data.adminUsername),
          })
          if (duplicateAdmin) {
            await db
              .update(schema.administrators)
              .set({
                passwordHash,
                fullName: data.adminFullName,
                role: 'superadmin',
                preferredLanguage: data.preferredLanguage,
                isActive: true,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(schema.administrators.id, duplicateAdmin.id))
          } else {
            throw err
          }
        } else {
          throw err
        }
      }
    }

    // Log in automatically so setup can update settings safely
    const session = await login(data.adminUsername, data.adminPassword)

    // Create school settings
    await updateSettings({
      schoolNameAr: data.schoolNameAr,
      schoolNameFr: data.schoolNameFr,
      schoolNameEn: data.schoolNameEn ?? '',
      phone: data.phone ?? null,
      email: data.email || null,
      address: data.address ?? null,
      academicYear: data.academicYear,
      defaultLanguage: data.preferredLanguage,
    })

    // Mark setup done after successful settings update
    markSetupComplete()

    return session
  })
}
