import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  CreateStudentSchema, UpdateStudentSchema,
  StudentIdSchema, StudentListSchema
} from '../../shared/schemas/index'
import {
  listStudents, getStudentById, createStudent,
  updateStudent, archiveStudent, regenerateQRToken
} from '../services/student.service'
import { getPhotoAsDataUrl } from '../services/media.service'
import { z } from 'zod'

export function registerStudentHandlers(): void {
  handle(IPC_CHANNELS.STUDENTS_LIST, async (payload) => {
    const opts = StudentListSchema.parse(payload ?? {})
    return listStudents(opts)
  })

  handle(IPC_CHANNELS.STUDENTS_GET, async (payload) => {
    const { id } = StudentIdSchema.parse(payload)
    return getStudentById(id)
  })

  handle(IPC_CHANNELS.STUDENTS_CREATE, async (payload) => {
    const data = CreateStudentSchema.parse(payload)
    return createStudent(data)
  })

  handle(IPC_CHANNELS.STUDENTS_UPDATE, async (payload) => {
    const data = UpdateStudentSchema.parse(payload)
    const { id, ...rest } = data
    return updateStudent(id, rest)
  })

  handle(IPC_CHANNELS.STUDENTS_ARCHIVE, async (payload) => {
    const { id } = StudentIdSchema.parse(payload)
    await archiveStudent(id)
    return true
  })

  handle(IPC_CHANNELS.STUDENTS_REGEN_QR, async (payload) => {
    const { id } = StudentIdSchema.parse(payload)
    const token = await regenerateQRToken(id)
    return { token }
  })

  handle(IPC_CHANNELS.STUDENTS_GET_PHOTO_URL, async (payload) => {
    const { filename, entityType } = z.object({
      filename: z.string().max(200),
      entityType: z.enum(['student', 'teacher']),
    }).parse(payload)
    const dataUrl = getPhotoAsDataUrl(filename, entityType)
    return { dataUrl }
  })
}
