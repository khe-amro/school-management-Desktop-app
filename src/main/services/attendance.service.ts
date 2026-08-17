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

  // If there is already an open attendance session for this group, reuse it instead of duplicating
  const existingOpen = await db.query.attendanceSessions.findFirst({
    where: and(
      eq(schema.attendanceSessions.groupId, data.groupId),
      eq(schema.attendanceSessions.status, 'open')
    ),
    orderBy: desc(schema.attendanceSessions.createdAt),
  })
  if (existingOpen) {
    return mapSessionRow(existingOpen)
  }

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

  let token = rawToken.trim()
  // 1. If QR code is a JSON payload
  if (token.startsWith('{') && token.endsWith('}')) {
    try {
      const parsed = JSON.parse(token)
      if (parsed.token) token = String(parsed.token).trim()
      else if (parsed.id || parsed.matricule) {
        const studentNum = String(parsed.id || parsed.matricule).trim()
        const found = await db.query.students.findFirst({
          where: eq(schema.students.studentNumber, studentNum),
        })
        if (found) token = found.qrToken
      }
    } catch {}
  }

  // 2. If multiline plain text (contains STD-... or ETU-...)
  const stdMatch = token.match(/STD-[a-f0-9A-F]+/i)
  if (stdMatch) {
    token = stdMatch[0]
  } else {
    const etuMatch = token.match(/ETU-\d+/i)
    if (etuMatch) {
      const found = await db.query.students.findFirst({
        where: eq(schema.students.studentNumber, etuMatch[0].toUpperCase()),
      })
      if (found) token = found.qrToken
    }
  }

  const upperToken = token.toUpperCase()

  // 3. Validate token format
  if (!token || token.length < 5) {
    return { code: 'unknown_card' }
  }

  // 2. Find the active token
  const student = await db.query.students.findFirst({
    where: eq(schema.students.qrToken, token),
  })

  // Try case-insensitive search via like pattern
  const students_found = await db.query.students.findMany()
  const matchedStudent = student ?? students_found.find(
    (s: typeof schema.students.$inferSelect) => s.qrToken.toUpperCase() === upperToken
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

export async function listSessions(opts: { groupId?: number; status?: 'open' | 'closed'; limit?: number }): Promise<AttendanceSession[]> {
  const db = getDb()
  const conditions = []
  if (opts.groupId) conditions.push(eq(schema.attendanceSessions.groupId, opts.groupId))
  if (opts.status) conditions.push(eq(schema.attendanceSessions.status, opts.status))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const rows = await db.select().from(schema.attendanceSessions)
    .where(whereClause)
    .orderBy(desc(schema.attendanceSessions.createdAt))
    .limit(opts.limit ?? 50)
  return rows.map(mapSessionRow)
}

// ─── Student Lookup (for QR scanning without attendance) ──────────────────────

export async function lookupStudentByToken(rawToken: string): Promise<{
  student: any
  enrollments: any[]
  nextSession?: any
  attendanceSummary?: any
  paymentsSummary?: any
  error?: string
} | null> {
  const db = getDb()

  let token = rawToken.trim()
  if (token.startsWith('{') && token.endsWith('}')) {
    try {
      const parsed = JSON.parse(token)
      if (parsed.token) token = String(parsed.token).trim()
      else if (parsed.id || parsed.matricule) {
        const found = await db.query.students.findFirst({
          where: eq(schema.students.studentNumber, String(parsed.id || parsed.matricule).trim()),
        })
        if (found) token = found.qrToken
      }
    } catch {}
  }

  // Remove spaces or linebreaks in token
  const compactToken = token.replace(/\s+/g, '')

  let cleanToken = token
  const stdMatch = compactToken.match(/STD-[a-f0-9A-F]+/i) || token.match(/STD-[a-f0-9A-F]+/i)
  if (stdMatch) {
    cleanToken = stdMatch[0]
  } else {
    const etuMatch = compactToken.match(/ETU-\d+/i) || token.match(/ETU-\d+/i)
    if (etuMatch) {
      const found = await db.query.students.findFirst({
        where: eq(schema.students.studentNumber, etuMatch[0].toUpperCase()),
      })
      if (found) cleanToken = found.qrToken
    }
  }

  // Find student by token or studentNumber
  let student = await db.query.students.findFirst({
    where: eq(schema.students.qrToken, cleanToken),
  })

  if (!student) {
    student = await db.query.students.findFirst({
      where: eq(schema.students.studentNumber, cleanToken.toUpperCase()),
    })
  }

  if (!student) {
    return null
  }

  // Get enrollments
  const enrollments = await db.query.enrollments.findMany({
    where: eq(schema.enrollments.studentId, student.id),
  })

  // Get attendance stats
  const records = await db.query.attendanceRecords.findMany({
    where: eq(schema.attendanceRecords.studentId, student.id),
  })
  const present = records.filter((r) => r.attendanceStatus === 'present').length
  const absent = records.filter((r) => r.attendanceStatus === 'absent').length
  const late = records.filter((r) => r.attendanceStatus === 'late').length
  const totalSessions = records.length
  const attendanceRate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 100

  // Get payment summary
  const payments = await db.query.payments.findMany({
    where: eq(schema.payments.studentId, student.id),
    orderBy: desc(schema.payments.paymentDate),
  })
  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0)
  const lastPayment = payments[0]

  return {
    student: {
      id: student.id,
      studentNumber: student.studentNumber,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      firstNameFr: student.firstNameFr,
      lastNameFr: student.lastNameFr,
      fullNameAr: `${student.lastNameAr} ${student.firstNameAr}`,
      fullNameFr: `${student.lastNameFr} ${student.firstNameFr}`,
      phone: student.phone,
      photoPath: student.photoPath,
      status: student.status,
      gender: student.gender,
    },
    enrollments: enrollments.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      status: e.status,
      enrollmentDate: e.enrollmentDate,
      agreedPrice: e.agreedPrice,
    })),
    attendanceSummary: {
      totalSessions,
      present,
      absent,
      late,
      attendanceRate,
    },
    paymentsSummary: {
      totalPaid,
      lastPaymentDate: lastPayment?.paymentDate,
      status: payments.some((p) => p.status === 'paid') ? 'paid' : 'pending',
    },
  }
}

// ─── Get comprehensive student summary ──────────────────────────────────────

export async function getStudentSummary(studentId: number, sessionId?: number): Promise<{
  student: any
  enrollments: any[]
  upcomingSessions: any[]
  attendanceStats: {
    totalSessions: number
    presentCount: number
    absentCount: number
    lateCount: number
    attendanceRate: number
  }
} | null> {
  const db = getDb()

  // Get student
  const student = await db.query.students.findFirst({
    where: eq(schema.students.id, studentId),
  })

  if (!student) return null

  // Get enrollments
  const enrollments = await db.query.enrollments.findMany({
    where: eq(schema.enrollments.studentId, studentId),
  })

  // Get upcoming sessions
  const upcomingSessions = await db.select().from(schema.attendanceSessions)
    .where(eq(schema.attendanceSessions.status, 'open'))
    .orderBy(desc(schema.attendanceSessions.sessionDate))
    .limit(5)

  // Get attendance statistics
  const records = await db.query.attendanceRecords.findMany({
    where: eq(schema.attendanceRecords.studentId, studentId),
  })

  const presentCount = records.filter((r) => r.attendanceStatus === 'present').length
  const absentCount = records.filter((r) => r.attendanceStatus === 'absent').length
  const lateCount = records.filter((r) => r.attendanceStatus === 'late').length
  const totalSessions = records.length
  const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0

  return {
    student: {
      id: student.id,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      firstNameFr: student.firstNameFr,
      lastNameFr: student.lastNameFr,
      studentNumber: student.studentNumber,
      photoPath: student.photoPath,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
    },
    enrollments: enrollments.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      status: e.status,
      enrollmentDate: e.enrollmentDate,
      agreedPrice: e.agreedPrice,
    })),
    upcomingSessions: upcomingSessions.map(mapSessionRow),
    attendanceStats: {
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
    },
  }
}

// ─── Get remaining sessions count ──────────────────────────────────────────

export async function getRemainingSessionsCount(enrollmentId: number): Promise<number> {
  const db = getDb()

  // Get enrollment
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, enrollmentId),
  })

  if (!enrollment) return 0

  // Count total sessions for the group
  const totalSessions = await db.query.attendanceSessions.findMany({
    where: eq(schema.attendanceSessions.groupId, enrollment.groupId),
  })

  // Count attended sessions
  const attendedRecords = await db.query.attendanceRecords.findMany({
    where: and(
      eq(schema.attendanceRecords.studentId, enrollment.studentId),
      eq(schema.attendanceRecords.attendanceStatus, 'present'),
    ),
  })

  const remaining = Math.max(0, totalSessions.length - attendedRecords.length)
  return remaining
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
