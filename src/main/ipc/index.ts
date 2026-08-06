import { registerAuthHandlers } from './auth.ipc'
import { registerStudentHandlers } from './students.ipc'
import { registerAttendanceHandlers } from './attendance.ipc'
import { registerEntityHandlers } from './entities.ipc'
import { registerPaymentHandlers } from './payments.ipc'
import { registerUtilityHandlers } from './utility.ipc'
import log from 'electron-log'

export function registerAllIpcHandlers(): void {
  registerAuthHandlers()
  registerStudentHandlers()
  registerEntityHandlers()
  registerAttendanceHandlers()
  registerPaymentHandlers()
  registerUtilityHandlers()
  log.info('All IPC handlers registered')
}
