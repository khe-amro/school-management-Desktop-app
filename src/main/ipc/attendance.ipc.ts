import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  StartSessionSchema, ScanQRSchema, ManualAttendanceSchema, EndSessionSchema
} from '../../shared/schemas/index'
import {
  startAttendanceSession, endAttendanceSession, scanQRToken,
  markManually, getSession, listSessions, lookupStudentByToken,
  getStudentSummary, getRemainingSessionsCount,
  resolveStudentSessions, markStudentInSession, getSessionWithRoster,
} from '../services/attendance.service'
import { z } from 'zod'

export function registerAttendanceHandlers(): void {
  handle(IPC_CHANNELS.ATTENDANCE_START_SESSION, async (payload) => {
    const data = StartSessionSchema.parse(payload)
    return startAttendanceSession(data)
  })

  handle(IPC_CHANNELS.ATTENDANCE_END_SESSION, async (payload) => {
    const { sessionId } = z.object({ sessionId: z.number().int().positive() }).parse(payload)
    await endAttendanceSession(sessionId)
    return true
  })

  handle(IPC_CHANNELS.ATTENDANCE_SCAN, async (payload) => {
    const { sessionId, token } = ScanQRSchema.parse(payload)
    return scanQRToken(sessionId, token)
  })

  handle(IPC_CHANNELS.ATTENDANCE_MARK_MANUAL, async (payload) => {
    const data = ManualAttendanceSchema.parse(payload)
    return markManually(data)
  })

  handle(IPC_CHANNELS.ATTENDANCE_GET_SESSION, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    return getSession(id)
  })

  handle(IPC_CHANNELS.ATTENDANCE_SESSIONS_LIST, async (payload) => {
    const opts = z.object({
      groupId: z.number().int().positive().optional(),
      status: z.enum(['open', 'closed']).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(payload ?? {})
    return listSessions(opts)
  })

  // ─── Student Lookup (QR scan without automatic attendance) ──────────────────

  handle(IPC_CHANNELS.ATTENDANCE_LOOKUP, async (payload) => {
    const { token } = z.object({ token: z.string() }).parse(payload)
    const result = await lookupStudentByToken(token)
    return result || { error: 'Student not found' }
  })

  // ─── Get student summary (comprehensive student info) ──────────────────────

  handle(IPC_CHANNELS.ATTENDANCE_STUDENT_SUMMARY, async (payload) => {
    const { studentId, sessionId } = z.object({
      studentId: z.number().int().positive(),
      sessionId: z.number().int().positive().optional(),
    }).parse(payload)
    const result = await getStudentSummary(studentId, sessionId)
    return result || { error: 'Student not found' }
  })

  // ─── Get remaining sessions count for enrollment ──────────────────────────

  handle(IPC_CHANNELS.ATTENDANCE_REMAINING_SESSIONS, async (payload) => {
    const { enrollmentId } = z.object({ enrollmentId: z.number().int().positive() }).parse(payload)
    const count = await getRemainingSessionsCount(enrollmentId)
    return { count }
  })

  // ─── Smart scan: resolve student + today's sessions ──────────────────────

  handle(IPC_CHANNELS.ATTENDANCE_RESOLVE_STUDENT, async (payload) => {
    const { token, date } = z.object({
      token: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(payload)
    const result = await resolveStudentSessions(token, date)
    if (!result) return { error: 'Student not found' }
    return result
  })

  // ─── Mark student in session (works past dates too) ───────────────────────

  handle(IPC_CHANNELS.ATTENDANCE_MARK_SESSION, async (payload) => {
    const { sessionId, studentId, status } = z.object({
      sessionId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      status: z.enum(['present', 'absent', 'late']),
    }).parse(payload)
    return markStudentInSession(sessionId, studentId, status)
  })

  // ─── Get session with full enrolled roster ────────────────────────────────

  handle(IPC_CHANNELS.SESSIONS_WITH_ROSTER, async (payload) => {
    const { sessionId } = z.object({ sessionId: z.number().int().positive() }).parse(payload)
    return getSessionWithRoster(sessionId)
  })
}

