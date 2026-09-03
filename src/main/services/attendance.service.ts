import { eq, and, desc } from 'drizzle-orm'
import { getDb, getSqlite, schema } from '../database/connection'
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

  // Fetch enrollment details & balance info
  let creditBalance: number | null = null
  let sessionPrice: number = 0
  let remainingSessions: number = 0
  let wasInDebt = false

  if (enrollment) {
    try {
      const { getEnrollmentBalance } = await import('./payment.service')
      if (attendanceSession.price !== null && attendanceSession.price !== undefined) {
        sessionPrice = attendanceSession.price
      } else {
        const group = await db.query.groups.findFirst({ where: eq(schema.groups.id, attendanceSession.groupId) })
        const price = enrollment.agreedPrice || group?.monthlyPrice || 0
        sessionPrice = Math.round((price / 4) * 100) / 100
      }
      const bal = await getEnrollmentBalance(enrollment.id)
      creditBalance = bal.balance
      wasInDebt = bal.balance < 0
      remainingSessions = sessionPrice > 0 ? Math.floor(bal.balance / sessionPrice) : 0
    } catch (err) {
      log.warn('Failed to fetch balance in scanQRToken:', err)
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
      studentName: `${matchedStudent.lastNameAr ?? ''} ${matchedStudent.firstNameAr ?? ''}`.trim() || matchedStudent.studentNumber,
      studentNumber: matchedStudent.studentNumber,
      phone: matchedStudent.phone,
      scannedAt: existingRecord.scannedAt ?? undefined,
      attendanceStatus: existingRecord.attendanceStatus as 'present' | 'absent' | 'late',
      creditBalance,
      sessionPrice,
      remainingSessions,
      wasInDebt,
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

  // Deduct 1 session from enrollment credit
  if (enrollment) {
    try {
      const { deductSession, getEnrollmentBalance } = await import('./payment.service')
      await deductSession({
        studentId: matchedStudent.id,
        enrollmentId: enrollment.id,
        sessionId,
        sessionDate: attendanceSession.sessionDate,
        sessionPrice,
      })
      const newBal = await getEnrollmentBalance(enrollment.id)
      creditBalance = newBal.balance
      wasInDebt = newBal.balance < 0
      remainingSessions = sessionPrice > 0 ? Math.floor(newBal.balance / sessionPrice) : 0
    } catch (err) {
      log.warn('Session credit deduction failed on QR scan (non-fatal):', err)
    }
  }

  const studentNameAr = `${matchedStudent.lastNameAr ?? ''} ${matchedStudent.firstNameAr ?? ''}`.trim()
  const studentNameFr = `${matchedStudent.lastNameFr ?? ''} ${matchedStudent.firstNameFr ?? ''}`.trim()
  const studentName = studentNameAr || studentNameFr || matchedStudent.studentNumber

  return {
    code: 'recorded',
    studentId: matchedStudent.id,
    studentName,
    studentNumber: matchedStudent.studentNumber,
    phone: matchedStudent.phone,
    scannedAt: record.scannedAt ?? undefined,
    attendanceStatus,
    creditBalance,
    sessionPrice,
    remainingSessions,
    wasInDebt,
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

// ─── Resolve student + their sessions for a given date ─────────────────────

export async function resolveStudentSessions(rawToken: string, date: string): Promise<{
  student: any
  enrollmentsWithBalance?: any[]
  todaySessions: any[]
  paymentsSummary: any
  recentAttendance: any[]
} | null> {
  const db = getDb()
  const sqlite = getSqlite()

  // Parse token / name
  let token = rawToken.trim()
  if (token.startsWith('{') && token.endsWith('}')) {
    try { const p = JSON.parse(token); if (p.token) token = p.token } catch {}
  }
  const stdMatch = token.match(/STD-[a-f0-9A-F]+/i)
  if (stdMatch) token = stdMatch[0]

  // Find student by QR token, student number, numeric ID, or combined name
  let student = await db.query.students.findFirst({ where: eq(schema.students.qrToken, token) })
  if (!student) {
    student = await db.query.students.findFirst({ where: eq(schema.students.studentNumber, token.toUpperCase()) })
  }
  if (!student) {
    const num = Number(token)
    if (!isNaN(num) && num > 0) {
      student = await db.query.students.findFirst({ where: eq(schema.students.id, num) })
    }
  }
  if (!student) {
    // Name search — raw SQL for partial & combined name match
    const rows = sqlite.prepare(`
      SELECT id FROM students
      WHERE status = 'active'
        AND (
          first_name_ar LIKE ? OR last_name_ar LIKE ? OR first_name_fr LIKE ? OR last_name_fr LIKE ?
          OR (last_name_ar || ' ' || first_name_ar) LIKE ? OR (first_name_ar || ' ' || last_name_ar) LIKE ?
          OR (last_name_fr || ' ' || first_name_fr) LIKE ? OR (first_name_fr || ' ' || last_name_fr) LIKE ?
        )
      LIMIT 1
    `).get(`%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`) as any
    if (rows) student = await db.query.students.findFirst({ where: eq(schema.students.id, rows.id) })
  }
  if (!student) return null

  // Get active enrollments
  const enrollments = await db.query.enrollments.findMany({
    where: and(eq(schema.enrollments.studentId, student.id), eq(schema.enrollments.status, 'active')),
  })
  const groupIds = enrollments.map(e => e.groupId)

  // Find sessions on this date for enrolled groups
  const todaySessions: any[] = []
  for (const groupId of groupIds) {
    // Check for existing session instances
    const allExisting = sqlite.prepare(`
      SELECT s.*, g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
      FROM attendance_sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      WHERE s.group_id = ? AND s.session_date = ?
    `).all(groupId, date) as any[]

    const activeExisting = allExisting.filter(r => r.session_type !== 'cancelled')
    const hasCancelled = allExisting.some(r => r.session_type === 'cancelled')

    if (activeExisting.length > 0) {
      todaySessions.push(...activeExisting.map(r => ({
        id: r.id,
        groupId: r.group_id,
        groupName: r.group_name,
        courseNameAr: r.course_name_ar,
        courseNameFr: r.course_name_fr,
        sessionDate: r.session_date,
        plannedStartTime: r.planned_start_time,
        endTime: r.end_time,
        room: r.room,
        status: r.status,
      })))
    } else if (!hasCancelled) {
      // Auto-create from schedule slots if today matches weekday and not cancelled
      const jsDay = new Date(date + 'T00:00:00Z').getUTCDay()
      const weekday = jsDay === 0 ? 6 : jsDay - 1
      const slots = sqlite.prepare(`
        SELECT * FROM group_schedule_slots WHERE group_id = ? AND weekday = ? AND is_active = 1
      `).all(groupId, weekday) as any[]

      for (const slot of slots) {
        sqlite.prepare(`
          INSERT OR IGNORE INTO attendance_sessions (group_id, session_date, planned_start_time, end_time, room, status, session_type, schedule_slot_id, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
        `).run(groupId, date, slot.start_time, slot.end_time, slot.room, slot.id)

        const sessRow = sqlite.prepare(`
          SELECT s.*, g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
          FROM attendance_sessions s
          JOIN groups g ON s.group_id = g.id
          JOIN courses c ON g.course_id = c.id
          WHERE s.group_id = ? AND s.session_date = ? AND s.session_type != 'cancelled' AND (s.schedule_slot_id = ? OR (s.planned_start_time = ? AND s.end_time = ?))
          LIMIT 1
        `).get(groupId, date, slot.id, slot.start_time, slot.end_time) as any

        if (sessRow) {
          todaySessions.push({
            id: sessRow.id,
            groupId,
            groupName: sessRow.group_name,
            courseNameAr: sessRow.course_name_ar,
            courseNameFr: sessRow.course_name_fr,
            sessionDate: date,
            plannedStartTime: sessRow.planned_start_time,
            endTime: sessRow.end_time,
            room: sessRow.room,
            status: sessRow.status || 'open',
          })
        }
      }
    }
  }

  // Calculate balance & remaining sessions for each active enrollment
  const { getEnrollmentBalance } = await import('./payment.service')
  const enrollmentsWithBalance: any[] = []
  for (const en of enrollments) {
    const bal = await getEnrollmentBalance(en.id)
    const grp = sqlite.prepare(`
      SELECT g.name as group_name, g.monthly_price, c.name_ar as course_name_ar, c.name_fr as course_name_fr
      FROM groups g JOIN courses c ON g.course_id = c.id WHERE g.id = ?
    `).get(en.groupId) as any
    const price = en.agreedPrice || grp?.monthly_price || 0
    const sessPrice = Math.round((price / 4) * 100) / 100
    const remSessions = sessPrice > 0 ? Math.floor(bal.balance / sessPrice) : 0
    enrollmentsWithBalance.push({
      enrollmentId: en.id,
      groupId: en.groupId,
      groupName: grp?.group_name,
      courseNameAr: grp?.course_name_ar,
      courseNameFr: grp?.course_name_fr,
      agreedPrice: price,
      sessionPrice: sessPrice,
      balance: bal.balance,
      remainingSessions: remSessions,
      wasInDebt: bal.balance < 0,
    })
  }

  // Payment summary
  const payments = await db.query.payments.findMany({
    where: eq(schema.payments.studentId, student.id),
    orderBy: desc(schema.payments.paymentDate),
  })
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0)

  // Recent attendance (last 5 records)
  const recentRecords = sqlite.prepare(`
    SELECT ar.*, s.session_date, g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    JOIN groups g ON s.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE ar.student_id = ?
    ORDER BY s.session_date DESC, ar.created_at DESC
    LIMIT 5
  `).all(student.id) as any[]

  return {
    student: {
      id: student.id,
      studentNumber: student.studentNumber,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      firstNameFr: student.firstNameFr,
      lastNameFr: student.lastNameFr,
      status: student.status,
      phone: student.phone,
    },
    enrollmentsWithBalance,
    todaySessions,
    paymentsSummary: {
      totalPaid,
      lastPaymentDate: payments[0]?.paymentDate,
      status: payments.some(p => p.status === 'paid') ? 'paid' : 'pending',
    },
    recentAttendance: recentRecords.map(r => ({
      date: r.session_date,
      status: r.attendance_status,
      groupName: r.group_name,
      courseNameAr: r.course_name_ar,
      courseNameFr: r.course_name_fr,
    })),
  }
}

// ─── Mark student in session (works for any date, upserts) ─────────────────

export async function markStudentInSession(
  sessionId: number,
  studentId: number,
  status: 'present' | 'absent' | 'late' | 'not_active',
): Promise<{ success: boolean; studentName: string; status: string; wasEnrolled: boolean; creditBalance: number | null; wasInDebt: boolean }> {
  const authSession = requireSession()
  const db = getDb()
  const sqlite = getSqlite()
  const now = new Date().toISOString()

  const session = await db.query.attendanceSessions.findFirst({
    where: eq(schema.attendanceSessions.id, sessionId),
  })
  if (!session) throw new AppError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')

  const student = await db.query.students.findFirst({ where: eq(schema.students.id, studentId) })
  if (!student) throw new AppError(ErrorCode.NOT_FOUND, 'Student not found')

  // Auto-determine late status if not overridden and session has a start time
  let finalStatus = status
  if (status === 'present' && session.plannedStartTime) {
    const n = new Date()
    const nowTime = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
    const [ph, pm] = session.plannedStartTime.split(':').map(Number)
    const [nh, nm] = nowTime.split(':').map(Number)
    const diff = (nh! * 60 + nm!) - (ph! * 60 + pm!)
    if (diff > (session.lateThresholdMinutes ?? 10)) finalStatus = 'late'
  }

  // Check if student was enrolled by session date
  const enrollment = sqlite.prepare(`
    SELECT e.id, e.enrollment_date, e.agreed_price, e.status as enrollment_status, g.monthly_price
    FROM enrollments e
    JOIN groups g ON e.group_id = g.id
    WHERE e.student_id = ? AND e.group_id = ?
    LIMIT 1
  `).get(studentId, session.groupId) as any

  const wasEnrolled = enrollment ? (session.sessionDate >= enrollment.enrollment_date) : false

  // Upsert attendance record
  sqlite.prepare(`
    INSERT INTO attendance_records (session_id, student_id, attendance_status, source, scanned_at, was_enrolled, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'manual', ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(session_id, student_id) DO UPDATE SET
      attendance_status = excluded.attendance_status,
      source = 'manual',
      was_enrolled = excluded.was_enrolled,
      updated_at = datetime('now')
  `).run(sessionId, studentId, finalStatus, now, wasEnrolled ? 1 : 0, authSession.adminId)

  let creditBalance: number | null = null
  let wasInDebt = false

  if (enrollment) {
    const { getEnrollmentBalance, deductSession } = await import('./payment.service')
    const sessionPrice = Math.round(((enrollment.agreed_price || enrollment.monthly_price) / 4) * 100) / 100

    if (finalStatus === 'not_active') {
      // If student is marked as not_active, cancel any session deduction payment for this session
      sqlite.prepare(`
        UPDATE payments
        SET status = 'cancelled', notes = 'Session status changed to not active (refunded)', updated_at = datetime('now')
        WHERE enrollment_id = ? AND session_id = ? AND payment_type = 'deduction' AND status = 'paid'
      `).run(enrollment.id, sessionId)
    } else if (wasEnrolled && (finalStatus === 'present' || finalStatus === 'absent' || finalStatus === 'late')) {
      // Check if there was a cancelled deduction payment for this session to reactivate
      const cancelledPayment = sqlite.prepare(`
        SELECT id FROM payments
        WHERE enrollment_id = ? AND session_id = ? AND payment_type = 'deduction' AND status = 'cancelled'
        LIMIT 1
      `).get(enrollment.id, sessionId) as any

      if (cancelledPayment) {
        sqlite.prepare(`
          UPDATE payments
          SET status = 'paid', notes = NULL, updated_at = datetime('now')
          WHERE id = ?
        `).run(cancelledPayment.id)
      } else {
        try {
          await deductSession({
            studentId,
            enrollmentId: enrollment.id,
            sessionId,
            sessionDate: session.sessionDate,
            sessionPrice,
          })
        } catch (err) {
          log.warn('Credit deduction failed (non-fatal):', err)
        }
      }
    }

    const bal = await getEnrollmentBalance(enrollment.id)
    creditBalance = bal.balance
    wasInDebt = bal.balance < 0
  }

  return {
    success: true,
    studentName: `${student.lastNameAr ?? ''} ${student.firstNameAr ?? ''}`.trim(),
    status: finalStatus,
    wasEnrolled,
    creditBalance,
    wasInDebt,
  }
}

// ─── Get complete session history for a student across enrolled groups ──────

export async function getStudentSessionHistory(studentId: number): Promise<any[]> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT
      s.id as session_id,
      s.session_date,
      s.planned_start_time,
      s.end_time,
      s.status as session_status,
      s.session_type,
      g.id as group_id,
      g.name as group_name,
      c.name_ar as course_name_ar,
      c.name_fr as course_name_fr,
      t.first_name as teacher_first_name,
      t.last_name as teacher_last_name,
      ar.attendance_status,
      ar.scanned_at,
      ar.source
    FROM enrollments e
    JOIN groups g ON e.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN teachers t ON g.teacher_id = t.id
    JOIN attendance_sessions s ON s.group_id = g.id
    LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = ?
    WHERE e.student_id = ?
    ORDER BY s.session_date DESC, s.planned_start_time DESC
  `).all(studentId, studentId) as any[]

  return rows.map(r => ({
    sessionId: r.session_id,
    sessionDate: r.session_date,
    plannedStartTime: r.planned_start_time,
    endTime: r.end_time,
    sessionStatus: r.session_status,
    sessionType: r.session_type,
    groupId: r.group_id,
    groupName: r.group_name,
    courseNameAr: r.course_name_ar,
    courseNameFr: r.course_name_fr,
    teacherName: r.teacher_first_name ? `${r.teacher_last_name ?? ''} ${r.teacher_first_name}`.trim() : null,
    attendanceStatus: r.attendance_status ?? 'unmarked',
    scannedAt: r.scanned_at,
    source: r.source,
  }))
}

// ─── Get session with full roster (enrolled students + their attendance) ────

export async function getSessionWithRoster(sessionId: number): Promise<{
  session: any
  students: any[]
}> {
  const sqlite = getSqlite()

  const session = sqlite.prepare(`
    SELECT s.*, g.name as group_name, g.course_id,
           c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM attendance_sessions s
    JOIN groups g ON s.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    WHERE s.id = ?
  `).get(sessionId) as any
  if (!session) throw new Error('Session not found')

  const enrolled = sqlite.prepare(`
    SELECT st.id, st.student_number, st.first_name_ar, st.last_name_ar, st.first_name_fr, st.last_name_fr,
           st.status as student_status, e.id as enrollment_id, e.agreed_price, g.monthly_price,
           ar.attendance_status, ar.source, ar.scanned_at, ar.id as record_id
    FROM enrollments e
    JOIN students st ON e.student_id = st.id
    JOIN groups g ON e.group_id = g.id
    LEFT JOIN attendance_records ar ON ar.session_id = ? AND ar.student_id = st.id
    WHERE e.group_id = ? AND e.status = 'active'
    ORDER BY st.last_name_ar, st.first_name_ar
  `).all(sessionId, session.group_id) as any[]

  const presentCount = enrolled.filter(s => s.attendance_status === 'present').length
  const lateCount = enrolled.filter(s => s.attendance_status === 'late').length
  const absentCount = enrolled.filter(s => s.attendance_status === 'absent').length

  const { getEnrollmentBalance } = await import('./payment.service')
  const studentsWithBalance = await Promise.all(enrolled.map(async s => {
    const bal = s.enrollment_id ? await getEnrollmentBalance(s.enrollment_id) : { balance: 0 }
    const price = s.agreed_price || s.monthly_price || 0
    const sessPrice = Math.round((price / 4) * 100) / 100
    const remSessions = sessPrice > 0 ? Math.floor(bal.balance / sessPrice) : 0
    return {
      id: s.id,
      enrollmentId: s.enrollment_id,
      studentNumber: s.student_number,
      firstNameAr: s.first_name_ar,
      lastNameAr: s.last_name_ar,
      firstNameFr: s.first_name_fr,
      lastNameFr: s.last_name_fr,
      status: s.student_status,
      attendanceStatus: s.attendance_status ?? null,
      recordId: s.record_id ?? null,
      source: s.source ?? null,
      scannedAt: s.scanned_at ?? null,
      creditBalance: bal.balance,
      sessionPrice: sessPrice,
      remainingSessions: remSessions,
      wasInDebt: bal.balance < 0,
    }
  }))

  return {
    session: {
      id: session.id,
      groupId: session.group_id,
      groupName: session.group_name,
      courseNameAr: session.course_name_ar,
      courseNameFr: session.course_name_fr,
      sessionDate: session.session_date,
      plannedStartTime: session.planned_start_time,
      endTime: session.end_time,
      room: session.room,
      status: session.status,
      sessionType: session.session_type,
      stats: { present: presentCount, late: lateCount, absent: absentCount, total: enrolled.length },
    },
    students: studentsWithBalance,
  }
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
