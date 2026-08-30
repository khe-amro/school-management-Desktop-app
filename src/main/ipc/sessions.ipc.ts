import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { getSqlite } from '../database/connection'
import { z } from 'zod'
import log from 'electron-log'

const CreateExtraSessionSchema = z.object({
  groupId: z.number().int().positive(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().optional(),
  teacherId: z.number().int().positive().optional(),
})

const GenerateSessionsSchema = z.object({
  groupId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const CancelSessionSchema = z.object({
  sessionId: z.number().int().positive(),
  reason: z.string().optional(),
})

function getWeekdayFromDate(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = date.getUTCDay()
  // Convert JS (0=Sunday) to our format (0=Monday)
  return day === 0 ? 6 : day - 1
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

function formatDateDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = date.getUTCDay()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[day]
}

export function registerSessionsHandlers(): void {
  handle(IPC_CHANNELS.SESSIONS_GENERATE, async (payload) => {
    const { groupId, startDate, endDate } = GenerateSessionsSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      const slots = sqlite.prepare(`
        SELECT * FROM group_schedule_slots
        WHERE group_id = ? AND is_active = 1
        ORDER BY weekday ASC, start_time ASC
      `).all(groupId) as any[]

      if (slots.length === 0) {
        return { generated: 0, message: 'No active schedule slots found for this group' }
      }

      const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any
      if (!group) throw new Error('Group not found')

      let generated = 0
      let currentDate = startDate

      while (currentDate <= endDate) {
        const weekday = getWeekdayFromDate(currentDate)
        const matchingSlots = slots.filter((s) => s.weekday === weekday)

        for (const slot of matchingSlots) {
          // Use INSERT OR IGNORE to prevent duplicates (unique index on group+date+slotId)
          const result = sqlite.prepare(`
            INSERT OR IGNORE INTO attendance_sessions (
              group_id, session_date, planned_start_time, end_time,
              room, late_threshold_minutes, status, session_type,
              schedule_slot_id, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 10, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
          `).run(
            groupId, currentDate, slot.start_time, slot.end_time,
            slot.room || group.room, slot.id
          )
          if (result.changes > 0) generated++
        }

        currentDate = addDays(currentDate, 1)
      }

      log.info(`Generated ${generated} sessions for group ${groupId}`)
      return { generated, message: `Generated ${generated} session instances` }
    } catch (err) {
      log.error('Failed to generate sessions:', err)
      throw new Error(`Unable to generate sessions: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── Auto-generate sessions for full year when group+slots are created ────

  handle('sessions:generateForGroup', async (payload) => {
    const { groupId } = z.object({ groupId: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any
      if (!group) throw new Error('Group not found')

      const slots = sqlite.prepare(`
        SELECT * FROM group_schedule_slots WHERE group_id = ? AND is_active = 1
      `).all(groupId) as any[]

      if (slots.length === 0) return { generated: 0, message: 'No slots yet' }

      // Start from group's startDate, end at group's endDate or 1 year from now
      const startDate = group.start_date
      let endDate = group.end_date
      if (!endDate) {
        const d = new Date()
        d.setFullYear(d.getFullYear() + 1)
        endDate = d.toISOString().slice(0, 10)
      }

      let generated = 0
      let currentDate = startDate

      while (currentDate <= endDate) {
        const weekday = getWeekdayFromDate(currentDate)
        const matchingSlots = slots.filter((s: any) => s.weekday === weekday)

        for (const slot of matchingSlots) {
          const result = sqlite.prepare(`
            INSERT OR IGNORE INTO attendance_sessions (
              group_id, session_date, planned_start_time, end_time,
              room, late_threshold_minutes, status, session_type,
              schedule_slot_id, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 10, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
          `).run(groupId, currentDate, slot.start_time, slot.end_time, slot.room || group.room, slot.id)
          if (result.changes > 0) generated++
        }

        currentDate = addDays(currentDate, 1)
      }

      log.info(`Auto-generated ${generated} sessions for group ${groupId} (${startDate} → ${endDate})`)
      return { generated, message: `Generated ${generated} sessions through ${endDate}` }
    } catch (err) {
      log.error('Failed to auto-generate sessions for group:', err)
      throw new Error(`Auto-generate failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── Trim sessions after a new end date (when endDate is shortened) ────────

  handle('sessions:trimAfterDate', async (payload) => {
    const { groupId, afterDate } = z.object({
      groupId: z.number().int().positive(),
      afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(payload)
    const sqlite = getSqlite()

    // Only remove sessions with no attendance records yet
    const result = sqlite.prepare(`
      DELETE FROM attendance_sessions
      WHERE group_id = ? AND session_date > ?
        AND session_type = 'regular'
        AND id NOT IN (SELECT DISTINCT session_id FROM attendance_records)
    `).run(groupId, afterDate)

    log.info(`Trimmed ${result.changes} future sessions for group ${groupId} after ${afterDate}`)
    return { removed: result.changes }
  })


  handle(IPC_CHANNELS.SESSIONS_CREATE_EXTRA, async (payload) => {
    const data = CreateExtraSessionSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      if (data.startTime >= data.endTime) {
        throw new Error('Start time must be before end time')
      }

      // Get group for defaults
      const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(data.groupId) as any
      if (!group) throw new Error('Group not found')

      const stmt = sqlite.prepare(`
        INSERT INTO attendance_sessions (
          group_id, session_date, planned_start_time, end_time,
          room, status, session_type, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'open', 'extra', 1, datetime('now'), datetime('now'))
      `)

      const result = stmt.run(
        data.groupId,
        data.sessionDate,
        data.startTime,
        data.endTime,
        data.room || group.room
      )

      const session = sqlite.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(result.lastInsertRowid) as any

      return {
        id: session.id,
        groupId: session.group_id,
        sessionDate: session.session_date,
        plannedStartTime: session.planned_start_time,
        endTime: session.end_time,
        room: session.room,
        sessionType: session.session_type,
        status: session.status,
        createdAt: session.created_at,
      }
    } catch (err) {
      log.error('Failed to create extra session:', err)
      throw new Error(`Unable to create extra session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_CANCEL, async (payload) => {
    const { sessionId, reason } = CancelSessionSchema.parse(payload)
    const sqlite = getSqlite()

    try {
      sqlite.prepare(`
        UPDATE attendance_sessions
        SET session_type = 'cancelled', cancelled_reason = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(reason || null, sessionId)

      return true
    } catch (err) {
      log.error('Failed to cancel session:', err)
      throw new Error(`Unable to cancel session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_COMPLETE, async (payload) => {
    const { sessionId } = z.object({ sessionId: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      sqlite.prepare(`
        UPDATE attendance_sessions
        SET status = 'closed', updated_at = datetime('now')
        WHERE id = ?
      `).run(sessionId)

      return true
    } catch (err) {
      log.error('Failed to complete session:', err)
      throw new Error(`Unable to complete session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_DELETE, async (payload) => {
    const { sessionId } = z.object({ sessionId: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      sqlite.prepare(`DELETE FROM attendance_records WHERE session_id = ?`).run(sessionId)
      sqlite.prepare(`DELETE FROM attendance_sessions WHERE id = ?`).run(sessionId)
      return true
    } catch (err) {
      log.error('Failed to delete session:', err)
      throw new Error(`Unable to delete session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_LIST, async (payload) => {
    const opts = z.object({
      groupId: z.number().int().positive().optional(),
      status: z.enum(['open', 'closed']).optional(),
      sessionType: z.enum(['regular', 'extra', 'makeup', 'cancelled']).optional(),
    }).parse(payload ?? {})

    const sqlite = getSqlite()

    try {
      let sql = 'SELECT * FROM attendance_sessions WHERE 1=1'
      const params: any[] = []

      if (opts.groupId) {
        sql += ' AND group_id = ?'
        params.push(opts.groupId)
      }

      if (opts.status) {
        sql += ' AND status = ?'
        params.push(opts.status)
      }

      if (opts.sessionType) {
        sql += ' AND session_type = ?'
        params.push(opts.sessionType)
      }

      sql += ' ORDER BY session_date DESC, planned_start_time DESC'

      const stmt = sqlite.prepare(sql)
      const rows = stmt.all(...params) as any[]

      return rows.map((row) => ({
        id: row.id,
        groupId: row.group_id,
        sessionDate: row.session_date,
        plannedStartTime: row.planned_start_time,
        actualStartTime: row.actual_start_time,
        endTime: row.end_time,
        room: row.room,
        sessionType: row.session_type,
        status: row.status,
        lateThresholdMinutes: row.late_threshold_minutes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    } catch (err) {
      log.error('Failed to list sessions:', err)
      throw new Error(`Unable to list sessions: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_GET, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    const sqlite = getSqlite()

    try {
      const session = sqlite.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(id) as any
      if (!session) throw new Error('Session not found')

      return {
        id: session.id,
        groupId: session.group_id,
        sessionDate: session.session_date,
        plannedStartTime: session.planned_start_time,
        actualStartTime: session.actual_start_time,
        endTime: session.end_time,
        room: session.room,
        sessionType: session.session_type,
        status: session.status,
        lateThresholdMinutes: session.late_threshold_minutes,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }
    } catch (err) {
      log.error('Failed to get session:', err)
      throw new Error(`Unable to get session: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  handle(IPC_CHANNELS.SESSIONS_UPCOMING, async (payload) => {
    const opts = z.object({
      groupId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }).parse(payload ?? {})

    const sqlite = getSqlite()

    try {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      // Automatic cleanup: if a day has completely passed (session_date < today)
      // 1. Delete expired open sessions that have no attendance records recorded
      sqlite.prepare(`
        DELETE FROM attendance_sessions
        WHERE session_date < ?
          AND status = 'open'
          AND id NOT IN (SELECT DISTINCT session_id FROM attendance_records WHERE attendance_status IN ('present', 'late'))
      `).run(today)

      // 2. Automatically mark remaining past open sessions as closed
      sqlite.prepare(`
        UPDATE attendance_sessions
        SET status = 'closed', updated_at = datetime('now')
        WHERE session_date < ? AND status = 'open'
      `).run(today)

      let sql = `
        SELECT s.*, g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
        FROM attendance_sessions s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN courses c ON g.course_id = c.id
        WHERE s.session_date >= ? AND s.session_type != 'cancelled'
        ORDER BY s.session_date ASC, s.planned_start_time ASC
      `
      const params: any[] = [today]

      if (opts.groupId) {
        sql = sql.replace('WHERE', 'WHERE s.group_id = ? AND')
        params.unshift(opts.groupId)
      }

      if (opts.limit) {
        sql += ` LIMIT ${Math.min(opts.limit, 100)}`
      } else {
        sql += ' LIMIT 50'
      }

      const stmt = sqlite.prepare(sql)
      const rows = stmt.all(...params) as any[]

      return rows.map((row) => ({
        id: row.id,
        groupId: row.group_id,
        groupName: row.group_name || (row.course_name_fr || row.course_name_ar ? `${row.course_name_fr || row.course_name_ar}` : undefined),
        courseName: row.course_name_fr || row.course_name_ar,
        sessionDate: row.session_date,
        plannedStartTime: row.planned_start_time,
        endTime: row.end_time,
        room: row.room,
        sessionType: row.session_type,
        status: row.status,
      }))
    } catch (err) {
      log.error('Failed to get upcoming sessions:', err)
      throw new Error(`Unable to get upcoming sessions: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── Get all sessions for a date range (calendar view) ───────────────────

  handle(IPC_CHANNELS.SESSIONS_BY_DATE, async (payload) => {
    const { startDate, endDate } = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(payload)

    const sqlite = getSqlite()

    try {
      const rows = sqlite.prepare(`
        SELECT s.id, s.group_id, s.session_date, s.planned_start_time, s.end_time,
               s.room, s.status, s.session_type,
               g.name as group_name,
               c.name_ar as course_name_ar, c.name_fr as course_name_fr,
               (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.attendance_status IN ('present','late')) as present_count,
               (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = s.group_id AND e.status = 'active') as enrolled_count
        FROM attendance_sessions s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN courses c ON g.course_id = c.id
        WHERE s.session_date >= ? AND s.session_date <= ?
          AND s.session_type != 'cancelled'
        ORDER BY s.session_date ASC, s.planned_start_time ASC
      `).all(startDate, endDate) as any[]

      return rows.map(row => ({
        id: row.id,
        groupId: row.group_id,
        groupName: row.group_name,
        courseNameAr: row.course_name_ar,
        courseNameFr: row.course_name_fr,
        sessionDate: row.session_date,
        plannedStartTime: row.planned_start_time,
        endTime: row.end_time,
        room: row.room,
        status: row.status,
        sessionType: row.session_type,
        presentCount: row.present_count ?? 0,
        enrolledCount: row.enrolled_count ?? 0,
      }))
    } catch (err) {
      log.error('Failed to get sessions by date:', err)
      throw new Error(`Unable to get sessions by date: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
}
