import { eq, like, and, or, desc, asc, sql, count } from 'drizzle-orm'
import crypto from 'node:crypto'
import { getDb, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { QR_TOKEN_PREFIX, QR_TOKEN_BYTES, DEFAULT_STUDENT_NUMBER_PREFIX } from '../../shared/constants/index'
import { requireSession } from './auth.service'
import type { Student, PaginatedResult } from '../../shared/types/index'
import log from 'electron-log'

// ─── QR token generation ──────────────────────────────────────────────────────

function generateQRToken(): string {
  const random = crypto.randomBytes(QR_TOKEN_BYTES).toString('hex')
  return `${QR_TOKEN_PREFIX}${random}`
}

// ─── Student number generation ────────────────────────────────────────────────

async function generateStudentNumber(prefix: string): Promise<string> {
  const db = getDb()
  const result = await db
    .select({ count: count() })
    .from(schema.students)
  const total = result[0]?.count ?? 0
  const num = String(total + 1).padStart(4, '0')
  return `${prefix}-${num}`
}

function mapRow(row: typeof schema.students.$inferSelect): Student {
  return {
    id: row.id,
    studentNumber: row.studentNumber,
    firstNameAr: row.firstNameAr,
    lastNameAr: row.lastNameAr,
    firstNameFr: row.firstNameFr,
    lastNameFr: row.lastNameFr,
    dateOfBirth: row.dateOfBirth ?? null,
    gender: row.gender as 'male' | 'female',
    phone: row.phone ?? null,
    guardianName: row.guardianName ?? null,
    guardianRelationship: row.guardianRelationship ?? null,
    guardianPhone: row.guardianPhone ?? null,
    secondaryPhone: row.secondaryPhone ?? null,
    address: row.address ?? null,
    photoPath: row.photoPath ?? null,
    registrationDate: row.registrationDate,
    status: row.status as Student['status'],
    qrToken: row.qrToken,
    qrTokenActive: row.qrTokenActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ─── List students ────────────────────────────────────────────────────────────

export async function listStudents(opts: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
}): Promise<PaginatedResult<Student>> {
  const db = getDb()
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50))
  const offset = (page - 1) * pageSize

  const conditions = []

  if (opts.status && opts.status !== 'all') {
    conditions.push(eq(schema.students.status, opts.status as 'active' | 'inactive' | 'archived'))
  }

  if (opts.search && opts.search.length > 0) {
    const q = `%${opts.search}%`
    conditions.push(
      or(
        like(schema.students.firstNameAr, q),
        like(schema.students.lastNameAr, q),
        like(schema.students.firstNameFr, q),
        like(schema.students.lastNameFr, q),
        like(schema.students.studentNumber, q),
        like(schema.students.phone, q),
        like(schema.students.qrToken, q)
      )
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(schema.students)
      .where(whereClause)
      .orderBy(desc(schema.students.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(schema.students).where(whereClause),
  ])

  return {
    items: rows.map(mapRow),
    total: totalResult[0]?.count ?? 0,
    page,
    pageSize,
  }
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getStudentById(id: number): Promise<Student> {
  const db = getDb()
  const row = await db.query.students.findFirst({
    where: eq(schema.students.id, id),
  })
  if (!row) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)
  return mapRow(row)
}

// ─── Create student ───────────────────────────────────────────────────────────

export async function createStudent(data: {
  firstNameAr: string
  lastNameAr: string
  firstNameFr: string
  lastNameFr: string
  dateOfBirth?: string | null
  gender: 'male' | 'female'
  phone?: string | null
  guardianName?: string | null
  guardianRelationship?: string | null
  guardianPhone?: string | null
  secondaryPhone?: string | null
  address?: string | null
  photoPath?: string | null
}): Promise<Student> {
  requireSession()
  const db = getDb()

  // Get prefix from settings
  const settings = await db.query.schoolSettings.findFirst()
  const prefix = settings?.studentNumberPrefix ?? DEFAULT_STUDENT_NUMBER_PREFIX
  const studentNumber = await generateStudentNumber(prefix)
  const qrToken = generateQRToken()

  const now = new Date().toISOString()
  const result = await db.insert(schema.students).values({
    studentNumber,
    firstNameAr: data.firstNameAr,
    lastNameAr: data.lastNameAr,
    firstNameFr: data.firstNameFr,
    lastNameFr: data.lastNameFr,
    dateOfBirth: data.dateOfBirth ?? null,
    gender: data.gender,
    phone: data.phone ?? null,
    guardianName: data.guardianName ?? null,
    guardianRelationship: data.guardianRelationship ?? null,
    guardianPhone: data.guardianPhone ?? null,
    secondaryPhone: data.secondaryPhone ?? null,
    address: data.address ?? null,
    photoPath: data.photoPath ?? null,
    registrationDate: new Date().toISOString().slice(0, 10),
    qrToken,
    updatedAt: now,
  }).returning()

  const row = result[0]
  if (!row) throw new AppError(ErrorCode.DB_ERROR, 'Failed to create student')
  log.info(`Student created: ${studentNumber}`)
  return mapRow(row)
}

// ─── Update student ───────────────────────────────────────────────────────────

export async function updateStudent(
  id: number,
  data: Partial<{
    firstNameAr: string
    lastNameAr: string
    firstNameFr: string
    lastNameFr: string
    dateOfBirth: string | null
    gender: 'male' | 'female'
    phone: string | null
    guardianName: string | null
    guardianRelationship: string | null
    guardianPhone: string | null
    secondaryPhone: string | null
    address: string | null
    photoPath: string | null
    status: 'active' | 'inactive' | 'archived'
  }>
): Promise<Student> {
  requireSession()
  const db = getDb()

  const existing = await db.query.students.findFirst({ where: eq(schema.students.id, id) })
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)

  const result = await db
    .update(schema.students)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.students.id, id))
    .returning()

  return mapRow(result[0]!)
}

// ─── Archive student ──────────────────────────────────────────────────────────

export async function archiveStudent(id: number): Promise<void> {
  const session = requireSession()
  const db = getDb()

  const existing = await db.query.students.findFirst({ where: eq(schema.students.id, id) })
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)

  const now = new Date().toISOString()
  await db.update(schema.students).set({
    status: 'archived',
    qrTokenActive: false,
    archivedAt: now,
    updatedAt: now,
  }).where(eq(schema.students.id, id))

  // Audit
  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'student.archive',
    entityType: 'student',
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ studentNumber: existing.studentNumber }),
  })
}

// ─── Regenerate QR token ──────────────────────────────────────────────────────

export async function regenerateQRToken(id: number): Promise<string> {
  const session = requireSession()
  const db = getDb()

  const existing = await db.query.students.findFirst({ where: eq(schema.students.id, id) })
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`)

  const newToken = generateQRToken()
  await db.update(schema.students).set({
    qrToken: newToken,
    qrTokenActive: true,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.students.id, id))

  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'student.regenQR',
    entityType: 'student',
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ studentNumber: existing.studentNumber }),
  })

  log.info(`QR token regenerated for student ${id}`)
  return newToken
}
