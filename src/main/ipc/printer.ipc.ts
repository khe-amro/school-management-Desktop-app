import { handle } from './_handler'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { getInstalledPrinters, printReceipt } from '../services/printer.service'
import type { PrinterInfo, ReceiptPrintData } from '../../shared/types/index'
import { z } from 'zod'

const ReceiptPrintDataSchema = z.object({
  receiptNumber: z.string().min(1),
  studentName: z.string().min(1),
  studentNumber: z.string().optional(),
  courseName: z.string().optional(),
  groupName: z.string().optional(),
  billingPeriod: z.string(),
  amount: z.number().nonnegative(),
  paymentMethod: z.string(),
  paymentDate: z.string(),
  reference: z.string().nullable().optional(),
  receivedByName: z.string().optional(),
  notes: z.string().nullable().optional(),
})

export function registerPrinterHandlers(): void {
  // Discover installed Windows printers
  handle<PrinterInfo[]>(IPC_CHANNELS.PRINTER_GET_LIST, async () => {
    return getInstalledPrinters()
  })

  // Print real receipt
  handle<{ success: boolean }>(IPC_CHANNELS.PRINTER_PRINT_RECEIPT, async (payload) => {
    const data = ReceiptPrintDataSchema.parse(payload) as ReceiptPrintData
    const result = await printReceipt(data)
    if (!result.success) {
      if (result.error === 'PRINTER_NOT_CONFIGURED') {
        throw new AppError(ErrorCode.PRINTER_NOT_CONFIGURED, result.failureReason || 'Receipt printer not configured')
      }
      if (result.error === 'PRINTER_NOT_FOUND') {
        throw new AppError(ErrorCode.PRINTER_NOT_FOUND, result.failureReason || 'Receipt printer not available')
      }
      throw new AppError(ErrorCode.PRINT_FAILED, result.failureReason || 'Print job failed')
    }
    return { success: true }
  })

  // Print diagnostic test receipt
  handle<{ success: boolean }>(IPC_CHANNELS.PRINTER_PRINT_TEST, async () => {
    const testData: ReceiptPrintData = {
      receiptNumber: 'TEST-0001',
      studentName: 'اختبار الطابعة / Test',
      billingPeriod: '2026-09',
      amount: 5000,
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString().slice(0, 10),
    }
    const result = await printReceipt(testData, { isTest: true })
    if (!result.success) {
      if (result.error === 'PRINTER_NOT_CONFIGURED') {
        throw new AppError(ErrorCode.PRINTER_NOT_CONFIGURED, result.failureReason || 'Receipt printer not configured')
      }
      if (result.error === 'PRINTER_NOT_FOUND') {
        throw new AppError(ErrorCode.PRINTER_NOT_FOUND, result.failureReason || 'Receipt printer not available')
      }
      throw new AppError(ErrorCode.PRINT_FAILED, result.failureReason || 'Print job failed')
    }
    return { success: true }
  })
}
