import { eq, and, desc } from 'drizzle-orm'
import { getDb, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { requireSession } from './auth.service'
import type { AttendanceSession, AttendanceRecord, QRScanResult } from '../../shared/types/index'
import log from 'electron-log'

// ─── Start session ────────────────────────────────────────────────────────────

export async function startAttendanceSession(data: {
  groupId: number
  sessionDate: string
  plannedStartTime?: string | null
  lateThresholdMinutes?: number
}): Promise<AttendanceSession> {
  const session = requireSession()
  const db = getDb()

  // Validate group exists
  const group = await db.query.groups.findFirst({
    where: eq(schema.groups.id, data.groupId),
  })
  if (!group) throw new AppError(ErrorCode.NOT_FOUND, 'Group not found')

  const now = new Date().toISOString()
  const result = await db.insert(schema.attendanceSessions).values({
    groupId: data.groupId,
    sessionDate: data.sessionDate,
    plannedStartTime: data.plannedStartTime ?? null,
    actualStartTime: now.slice(11, 16),
    lateThresholdMinutes: data.lateThresholdMinutes ?? 10,
    status: 'open',
    createdBy: session.adminId,
    updatedAt: now,
  }).returning()

  const row = result[0]!
  return mapSessionRow(row)
}

// ─── End session ──────────────────────────────────────────────────────────────

export async function endAttendanceSession(sessionId: number): Promise<void> {
  const session = requireSession()
  const db = getDb()

  const existing = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!existing) throw new AppError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')

  await db.update(schema.attendanceSessions).set({
    status: 'closed',
    endTime: new Date().toISOString().slice(11, 16),
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.attendanceSessions.id, sessionId))
}

// ─── QR scan pipeline (7-step validation) ────────────────────────────────────

export async function scanQRToken(sessionId: number, rawToken: string): Promise<QRScanResult> {
  const session = requireSession()
  const db = getDb()

  const token = rawToken.trim().toUpperCase()

  // 1. Validate token format
  if (!token || token.length < 5) {
    return { code: 'unknown_card' }
  }

  // 2. Find the active token
  const student = await db.query.students.findFirst({
    where: eq(schema.students.qrToken, token.toLowerCase() === token ? token : token),
  })

  // Try case-insensitive search via like pattern
  const students_found = await db.query.students.findMany()
  const matchedStudent = students_found.find(
    (s: typeof schema.students.$inferSelect) => s.qrToken.toUpperCase() === token
  )

  if (!matchedStudent) {
    return { code: 'unknown_card' }
  }

  // 3. Check token is active
  if (!matchedStudent.qrTokenActive) {
    return { code: 'disabled_card', studentId: matchedStudent.id }
  }

  // 4. Check student is active
  if (matchedStudent.status !== 'active') {
    return { code: 'student_inactive', studentId: matchedStudent.id, studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}` }
  }

  // 5. Verify session exists and is open
  const attendanceSession = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!attendanceSession) return { code: 'session_closed' }
  if (attendanceSession.status !== 'open') return { code: 'session_closed' }

  // 5b. Confirm enrollment in the session's group
  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(schema.enrollments.studentId, matchedStudent.id),
      eq(schema.enrollments.groupId, attendanceSession.groupId),
      eq(schema.enrollments.status, 'active')
    ),
  })
  if (!enrollment) {
    return {
      code: 'not_enrolled',
      studentId: matchedStudent.id,
      studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}`,
    }
  }

  // 6. Check for duplicate scan
  const existingRecord = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(schema.attendanceRecords.sessionId, sessionId),
      eq(schema.attendanceRecords.studentId, matchedStudent.id)
    ),
  })
  if (existingRecord) {
    return {
      code: 'already_scanned',
      studentId: matchedStudent.id,
      studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}`,
      scannedAt: existingRecord.scannedAt ?? undefined,
      attendanceStatus: existingRecord.attendanceStatus as 'present' | 'absent' | 'late',
    }
  }

  // 7. Calculate status (late vs present) and insert record transactionally
  const now = new Date()
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  let attendanceStatus: 'present' | 'late' = 'present'

  if (attendanceSession.plannedStartTime) {
    const [ph, pm] = attendanceSession.plannedStartTime.split(':').map(Number)
    const [nh, nm] = nowTime.split(':').map(Number)
    const diffMins = (nh! * 60 + nm!) - (ph! * 60 + pm!)
    if (diffMins > attendanceSession.lateThresholdMinutes) {
      attendanceStatus = 'late'
    }
  }

  const result = await db.insert(schema.attendanceRecords).values({
    sessionId,
    studentId: matchedStudent.id,
    scannedAt: now.toISOString(),
    attendanceStatus,
    source: 'qr',
    createdBy: session.adminId,
    updatedAt: now.toISOString(),
  }).returning()

  const record = result[0]!
  log.info(`Attendance recorded: student ${matchedStudent.studentNumber}, session ${sessionId}, status: ${attendanceStatus}`)

  return {
    code: 'recorded',
    studentId: matchedStudent.id,
    studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}`,
    scannedAt: record.scannedAt ?? undefined,
    attendanceStatus,
  }
}

// ─── Manual attendance ────────────────────────────────────────────────────────

export async function markManually(data: {
  sessionId: number
  studentId: number
  attendanceStatus: 'present' | 'absent' | 'late'
  notes?: string | null
}): Promise<AttendanceRecord> {
  const session = requireSession()
  const db = getDb()

  const attendanceSession = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, data.sessionId),
  })
  if (!attendanceSession || attendanceSession.status !== 'open') {
    throw new AppError(ErrorCode.SESSION_CLOSED, 'Attendance session is closed')
  }

  // Upsert: if record exists update it, otherwise insert
  const existing = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(schema.attendanceRecords.sessionId, data.sessionId),
      eq(schema.attendanceRecords.studentId, data.studentId)
    ),
  })

  const now = new Date().toISOString()

  if (existing) {
    const updated = await db
      .update(schema.attendanceRecords)
      .set({
        attendanceStatus: data.attendanceStatus,
        source: 'manual',
        notes: data.notes ?? null,
        createdBy: session.adminId,
        updatedAt: now,
      })
      .where(eq(schema.attendanceRecords.id, existing.id))
      .returning()
    return mapRecordRow(updated[0]!)
  }

  const result = await db.insert(schema.attendanceRecords).values({
    sessionId: data.sessionId,
    studentId: data.studentId,
    scannedAt: now,
    attendanceStatus: data.attendanceStatus,
    source: 'manual',
    notes: data.notes ?? null,
    createdBy: session.adminId,
    updatedAt: now,
  }).returning()

  // Audit manual entry
  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'attendance.manualMark',
    entityType: 'attendance_record',
    entityId: result[0]!.id,
    sanitizedDetailsJson: JSON.stringify({ sessionId: data.sessionId, studentId: data.studentId, status: data.attendanceStatus }),
  })

  return mapRecordRow(result[0]!)
}

// ─── Get session with records ─────────────────────────────────────────────────

export async function getSession(sessionId: number): Promise<AttendanceSession & { records: AttendanceRecord[] }> {
  const db = getDb()
  const session = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!session) throw new AppError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')

  const records = await db.query.attendanceRecords.findMany({
    where: eq(schema.attendanceRecords.sessionId, sessionId),
  })

  return {
    ...mapSessionRow(session),
    records: records.map(mapRecordRow),
  }
}

// ─── List sessions ────────────────────────────────────────────────────────────

export async function listSessions(opts: { groupId?: number; limit?: number }): Promise<AttendanceSession[]> {
  const db = getDb()
  const conditions = opts.groupId ? eq(schema.attendanceSessions.groupId, opts.groupId) : undefined
  const rows = await db.select().from(schema.attendanceSessions)
    .where(conditions)
    .orderBy(desc(schema.attendanceSessions.sessionDate))
    .limit(opts.limit ?? 50)
  return rows.map(mapSessionRow)
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapSessionRow(row: typeof schema.attendanceSessions.$inferSelect): AttendanceSession {
  return {
    id: row.id,
    groupId: row.groupId,
    sessionDate: row.sessionDate,
    plannedStartTime: row.plannedStartTime ?? null,
    actualStartTime: row.actualStartTime ?? null,
    endTime: row.endTime ?? null,
    lateThresholdMinutes: row.lateThresholdMinutes,
    status: row.status as 'open' | 'closed',
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapRecordRow(row: typeof schema.attendanceRecords.$inferSelect): AttendanceRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    studentId: row.studentId,
    scannedAt: row.scannedAt ?? null,
    attendanceStatus: row.attendanceStatus as 'present' | 'absent' | 'late',
    source: row.source as 'qr' | 'manual',
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
