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
      // Get all recurring schedule slots for this group
      const slots = sqlite.prepare(`
        SELECT * FROM group_schedule_slots
        WHERE group_id = ? AND is_active = 1
        ORDER BY weekday ASC, start_time ASC
      `).all(groupId) as any[]

      if (slots.length === 0) {
        return { generated: 0, message: 'No active schedule slots found for this group' }
      }

      // Get group info for teacher and room defaults
      const group = sqlite.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any
      if (!group) throw new Error('Group not found')

      let generated = 0
      let currentDate = startDate

      while (currentDate <= endDate) {
        const weekday = getWeekdayFromDate(currentDate)

        // Find matching slots for this weekday
        const matchingSlots = slots.filter((s) => s.weekday === weekday)

        for (const slot of matchingSlots) {
          // Check if session already exists (idempotency)
          const existing = sqlite.prepare(`
            SELECT id FROM attendance_sessions
            WHERE group_id = ? AND session_date = ? AND planned_start_time = ?
              AND session_type = 'regular' AND schedule_slot_id = ?
            LIMIT 1
          `).get(groupId, currentDate, slot.start_time, slot.id)

          if (!existing) {
            // Create session instance
            sqlite.prepare(`
              INSERT INTO attendance_sessions (
                group_id, session_date, planned_start_time, end_time,
                room, late_threshold_minutes, status, session_type,
                schedule_slot_id, created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 10, 'open', 'regular', ?, 1, datetime('now'), datetime('now'))
            `).run(
              groupId, currentDate, slot.start_time, slot.end_time,
              slot.room || group.room, slot.id
            )
            generated++
          }
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
      const today = new Date().toISOString().split('T')[0]

      let sql = `
        SELECT * FROM attendance_sessions
        WHERE session_date >= ? AND session_type != 'cancelled'
        ORDER BY session_date ASC, planned_start_time ASC
      `
      const params: any[] = [today]

      if (opts.groupId) {
        sql = sql.replace('WHERE', 'WHERE group_id = ? AND')
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
}
