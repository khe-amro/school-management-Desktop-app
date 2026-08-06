import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  StartSessionSchema, ScanQRSchema, ManualAttendanceSchema, EndSessionSchema
} from '../../shared/schemas/index'
import {
  startAttendanceSession, endAttendanceSession, scanQRToken,
  markManually, getSession, listSessions
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
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(payload ?? {})
    return listSessions(opts)
  })
}
