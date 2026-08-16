import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import {
  CreatePaymentSchema, CancelPaymentSchema,
} from '../../shared/schemas/index'
import { listPayments, createPayment, cancelPayment, getPaymentsByStudent } from '../services/payment.service'
import { z } from 'zod'

export function registerPaymentHandlers(): void {
  handle(IPC_CHANNELS.PAYMENTS_LIST, async (payload) => {
    const opts = z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(1000).optional(),
      search: z.string().max(200).optional(),
      studentId: z.number().int().positive().optional(),
    }).parse(payload ?? {})
    return listPayments(opts)
  })

  handle(IPC_CHANNELS.PAYMENTS_CREATE, async (payload) => {
    const data = CreatePaymentSchema.parse(payload)
    return createPayment(data)
  })

  handle(IPC_CHANNELS.PAYMENTS_CANCEL, async (payload) => {
    const data = CancelPaymentSchema.parse(payload)
    await cancelPayment(data.id, data.reason)
    return true
  })

  handle(IPC_CHANNELS.PAYMENTS_BY_STUDENT, async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload)
    return getPaymentsByStudent(studentId)
  })
}
