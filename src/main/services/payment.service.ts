import { eq, desc, and, like, count, sql } from 'drizzle-orm'
import { getDb, getSqlite, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { DEFAULT_RECEIPT_PREFIX } from '../../shared/constants/index'
import { requireSession } from './auth.service'
import type { Payment, PaginatedResult } from '../../shared/types/index'
import log from 'electron-log'

// ─── Receipt number generator ─────────────────────────────────────────────────

async function generateReceiptNumber(): Promise<string> {
  const db = getDb()
  const settings = await db.query.schoolSettings.findFirst()
  const prefix = settings?.receiptPrefix ?? DEFAULT_RECEIPT_PREFIX
  const result = await db.select({ count: count() }).from(schema.payments)
  const total = (result[0]?.count ?? 0) + 1
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${prefix}-${ts}-${String(total).padStart(4, '0')}`
}

// ─── Session price = monthlyPrice / 4 ────────────────────────────────────────

export function getSessionPrice(monthlyPrice: number): number {
  return Math.round((monthlyPrice / 4) * 100) / 100
}

// ─── Get credit balance for an enrollment ────────────────────────────────────

export async function getEnrollmentBalance(enrollmentId: number): Promise<{
  balance: number
  totalCharged: number
  totalDeducted: number
  sessionsUsed: number
}> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT payment_type, SUM(amount) as total
    FROM payments
    WHERE enrollment_id = ? AND status = 'paid'
    GROUP BY payment_type
  `).all(enrollmentId) as { payment_type: string; total: number }[]

  const byType: Record<string, number> = {}
  for (const r of rows) byType[r.payment_type] = r.total ?? 0

  const totalCharged = (byType['credit'] ?? 0) + (byType['transfer_in'] ?? 0)
  const totalDeducted = (byType['deduction'] ?? 0) + (byType['transfer_out'] ?? 0) + (byType['refund'] ?? 0)
  const balance = totalCharged - totalDeducted

  const sessionCount = sqlite.prepare(`
    SELECT COUNT(*) as cnt FROM payments
    WHERE enrollment_id = ? AND payment_type = 'deduction' AND status = 'paid'
  `).get(enrollmentId) as { cnt: number }

  return {
    balance: Math.round(balance * 100) / 100,
    totalCharged: Math.round(totalCharged * 100) / 100,
    totalDeducted: Math.round(totalDeducted * 100) / 100,
    sessionsUsed: sessionCount?.cnt ?? 0,
  }
}

// ─── Top up student credit (recharge) ────────────────────────────────────────

export async function topUpCredit(data: {
  studentId: number
  enrollmentId: number
  amount: number
  paymentMethod: 'cash' | 'transfer' | 'check'
  paymentDate: string
  reference?: string | null
  notes?: string | null
}): Promise<Payment> {
  const session = requireSession()
  const db = getDb()

  if (data.amount <= 0) throw new AppError(ErrorCode.NEGATIVE_AMOUNT, 'Amount must be positive')

  const receiptNumber = await generateReceiptNumber()
  const now = new Date().toISOString()

  const result = await db.insert(schema.payments).values({
    receiptNumber,
    studentId: data.studentId,
    enrollmentId: data.enrollmentId,
    billingPeriod: data.paymentDate.slice(0, 7),
    amount: data.amount,
    paymentType: 'credit',
    paymentMethod: data.paymentMethod,
    paymentDate: data.paymentDate,
    reference: data.reference ?? null,
    notes: data.notes ?? null,
    receivedBy: session.adminId,
    status: 'paid',
    updatedAt: now,
  }).returning()

  const row = result[0]!
  log.info(`Credit top-up: ${receiptNumber}, amount: ${data.amount}, enrollment: ${data.enrollmentId}`)

  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'payment.topup',
    entityType: 'payment',
    entityId: row.id,
    sanitizedDetailsJson: JSON.stringify({ receiptNumber, amount: data.amount }),
  })

  return mapPaymentRow(row)
}

// ─── Deduct one session from enrollment credit ────────────────────────────────

export async function deductSession(data: {
  studentId: number
  enrollmentId: number
  sessionId: number
  sessionDate: string
  sessionPrice: number
}): Promise<{ deducted: boolean; newBalance: number; wasInDebt: boolean }> {
  const session = requireSession()
  const sqlite = getSqlite()

  // Idempotency: don't deduct twice for same session+enrollment
  const existing = sqlite.prepare(`
    SELECT id FROM payments
    WHERE enrollment_id = ? AND session_id = ? AND payment_type = 'deduction'
    LIMIT 1
  `).get(data.enrollmentId, data.sessionId)

  if (existing) {
    const bal = await getEnrollmentBalance(data.enrollmentId)
    return { deducted: false, newBalance: bal.balance, wasInDebt: bal.balance < 0 }
  }

  const bal = await getEnrollmentBalance(data.enrollmentId)
  const wasInDebt = bal.balance < data.sessionPrice

  const receiptNumber = await generateReceiptNumber()
  const now = new Date().toISOString()

  sqlite.prepare(`
    INSERT INTO payments (
      receipt_number, student_id, enrollment_id, billing_period, amount,
      payment_type, session_id, payment_method, payment_date, notes,
      received_by, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'deduction', ?, '', ?, ?, ?, 'paid', datetime('now'), datetime('now'))
  `).run(
    receiptNumber, data.studentId, data.enrollmentId,
    data.sessionDate.slice(0, 7), data.sessionPrice,
    data.sessionId, data.sessionDate,
    wasInDebt ? 'DEBT: insufficient credit' : null,
    session.adminId
  )

  const newBal = await getEnrollmentBalance(data.enrollmentId)
  log.info(`Session deduction: ${receiptNumber}, session: ${data.sessionId}, price: ${data.sessionPrice}`)
  return { deducted: true, newBalance: newBal.balance, wasInDebt }
}

// ─── Transfer remaining balance between enrollments ───────────────────────────

export async function transferBalance(data: {
  fromEnrollmentId: number
  toEnrollmentId: number
  studentId: number
  amount?: number // if not set, transfer ALL remaining
}): Promise<{ transferred: number; newFromBalance: number; newToBalance: number }> {
  const session = requireSession()
  const sqlite = getSqlite()

  const fromBal = await getEnrollmentBalance(data.fromEnrollmentId)
  const transferAmount = data.amount !== undefined ? Math.min(data.amount, fromBal.balance) : fromBal.balance

  if (transferAmount <= 0) throw new AppError(ErrorCode.NEGATIVE_AMOUNT, 'No balance to transfer')

  const now = new Date().toISOString().slice(0, 10)
  const receiptOut = await generateReceiptNumber()
  const receiptIn = await generateReceiptNumber()

  sqlite.prepare(`
    INSERT INTO payments (receipt_number, student_id, enrollment_id, billing_period, amount,
      payment_type, payment_method, payment_date, notes, received_by, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'transfer_out', '', ?, 'Transfer to enrollment ${data.toEnrollmentId}', ?, 'paid', datetime('now'), datetime('now'))
  `).run(receiptOut, data.studentId, data.fromEnrollmentId, now.slice(0,7), transferAmount, now, session.adminId)

  sqlite.prepare(`
    INSERT INTO payments (receipt_number, student_id, enrollment_id, billing_period, amount,
      payment_type, payment_method, payment_date, notes, received_by, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'transfer_in', '', ?, 'Transfer from enrollment ${data.fromEnrollmentId}', ?, 'paid', datetime('now'), datetime('now'))
  `).run(receiptIn, data.studentId, data.toEnrollmentId, now.slice(0,7), transferAmount, now, session.adminId)

  const newFrom = await getEnrollmentBalance(data.fromEnrollmentId)
  const newTo = await getEnrollmentBalance(data.toEnrollmentId)

  log.info(`Balance transfer: ${transferAmount} DA from enrollment ${data.fromEnrollmentId} to ${data.toEnrollmentId}`)
  return { transferred: transferAmount, newFromBalance: newFrom.balance, newToBalance: newTo.balance }
}

// ─── Refund remaining balance (cancel enrollment) ────────────────────────────

export async function refundEnrollment(data: {
  enrollmentId: number
  studentId: number
  notes?: string
}): Promise<{ refunded: number }> {
  const session = requireSession()
  const sqlite = getSqlite()

  const bal = await getEnrollmentBalance(data.enrollmentId)
  if (bal.balance <= 0) return { refunded: 0 }

  const receiptNumber = await generateReceiptNumber()
  const now = new Date().toISOString().slice(0, 10)

  sqlite.prepare(`
    INSERT INTO payments (receipt_number, student_id, enrollment_id, billing_period, amount,
      payment_type, payment_method, payment_date, notes, received_by, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'refund', '', ?, ?, ?, 'paid', datetime('now'), datetime('now'))
  `).run(receiptNumber, data.studentId, data.enrollmentId, now.slice(0,7), bal.balance, now,
    data.notes ?? 'Enrollment cancelled — balance refunded', session.adminId)

  log.info(`Refund: ${bal.balance} DA for enrollment ${data.enrollmentId}`)
  return { refunded: bal.balance }
}

// ─── List payments (top-ups only for receipt listing) ─────────────────────────

export async function listPayments(opts: {
  page?: number
  pageSize?: number
  search?: string
  studentId?: number
  type?: string
}): Promise<PaginatedResult<any>> {
  const sqlite = getSqlite()
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50))
  const offset = (page - 1) * pageSize

  let where = "WHERE 1=1"
  const params: any[] = []

  if (opts.studentId) { where += " AND p.student_id = ?"; params.push(opts.studentId) }
  if (opts.search) { where += " AND (p.receipt_number LIKE ? OR s.last_name_ar LIKE ? OR s.first_name_ar LIKE ?)"; const q = `%${opts.search}%`; params.push(q,q,q) }
  if (opts.type) { where += " AND p.payment_type = ?"; params.push(opts.type) }
  else { where += " AND p.payment_type = 'credit'" } // Default: only show top-ups in main list

  const rows = sqlite.prepare(`
    SELECT p.*, s.last_name_ar, s.first_name_ar, s.student_number,
           g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN enrollments e ON p.enrollment_id = e.id
    LEFT JOIN groups g ON e.group_id = g.id
    LEFT JOIN courses c ON g.course_id = c.id
    ${where}
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[]

  const total = (sqlite.prepare(`
    SELECT COUNT(*) as cnt FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    ${where}
  `).get(...params) as any)?.cnt ?? 0

  return {
    items: rows.map(mapRawRow),
    total,
    page,
    pageSize,
  }
}

// ─── Legacy createPayment → now maps to topUpCredit ──────────────────────────

export async function createPayment(data: {
  studentId: number
  enrollmentId: number
  billingPeriod: string
  amount: number
  paymentMethod: 'cash' | 'transfer' | 'check'
  paymentDate: string
  reference?: string | null
  notes?: string | null
}): Promise<Payment> {
  return topUpCredit({
    studentId: data.studentId,
    enrollmentId: data.enrollmentId,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    paymentDate: data.paymentDate,
    reference: data.reference,
    notes: data.notes,
  }) as any
}

// ─── Cancel a credit top-up ───────────────────────────────────────────────────

export async function cancelPayment(id: number, reason?: string | null): Promise<void> {
  const session = requireSession()
  const db = getDb()

  const existing = await db.query.payments.findFirst({ where: eq(schema.payments.id, id) })
  if (!existing) throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found')
  if (existing.status === 'cancelled') throw new AppError(ErrorCode.PAYMENT_ALREADY_CANCELLED, 'Already cancelled')

  await db.update(schema.payments).set({
    status: 'cancelled',
    notes: reason ? `Cancelled: ${reason}` : existing.notes,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.payments.id, id))

  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'payment.cancel',
    entityType: 'payment',
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ receiptNumber: existing.receiptNumber, reason }),
  })
}

// ─── Get all payments for a student ──────────────────────────────────────────

export async function getPaymentsByStudent(studentId: number): Promise<any[]> {
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT p.*, g.name as group_name, c.name_ar as course_name_ar, c.name_fr as course_name_fr
    FROM payments p
    LEFT JOIN enrollments e ON p.enrollment_id = e.id
    LEFT JOIN groups g ON e.group_id = g.id
    LEFT JOIN courses c ON g.course_id = c.id
    WHERE p.student_id = ?
    ORDER BY p.payment_date DESC, p.created_at DESC
  `).all(studentId) as any[]
  return rows.map(mapRawRow)
}

// ─── Payment summary for dashboard ───────────────────────────────────────────

export async function getPaymentsSummary(): Promise<{
  monthRevenue: number
  todayCollected: number
  outstanding: number
  overdue: number
}> {
  const sqlite = getSqlite()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const monthCredit = (sqlite.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments
    WHERE payment_type='credit' AND status='paid' AND payment_date >= ?
  `).get(monthStart) as any)?.total ?? 0

  const todayCredit = (sqlite.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments
    WHERE payment_type='credit' AND status='paid' AND payment_date = ?
  `).get(today) as any)?.total ?? 0

  // "Outstanding" = sum of negative balances across all enrollments
  const outstanding = (sqlite.prepare(`
    SELECT COALESCE(SUM(CASE WHEN net < 0 THEN ABS(net) ELSE 0 END), 0) as total
    FROM (
      SELECT enrollment_id,
        SUM(CASE WHEN payment_type IN ('credit','transfer_in') THEN amount
                 WHEN payment_type IN ('deduction','transfer_out','refund') THEN -amount
                 ELSE 0 END) as net
      FROM payments WHERE status='paid'
      GROUP BY enrollment_id
    )
  `).get() as any)?.total ?? 0

  return {
    monthRevenue: monthCredit,
    todayCollected: todayCredit,
    outstanding,
    overdue: outstanding,
  }
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapPaymentRow(r: any): any {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber ?? r.receipt_number,
    studentId: r.studentId ?? r.student_id,
    enrollmentId: r.enrollmentId ?? r.enrollment_id,
    billingPeriod: r.billingPeriod ?? r.billing_period ?? '',
    amount: r.amount,
    paymentType: r.paymentType ?? r.payment_type ?? 'credit',
    paymentMethod: r.paymentMethod ?? r.payment_method ?? '',
    paymentDate: r.paymentDate ?? r.payment_date,
    reference: r.reference ?? null,
    notes: r.notes ?? null,
    receivedBy: r.receivedBy ?? r.received_by,
    status: r.status,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  }
}

function mapRawRow(r: any): any {
  return {
    ...mapPaymentRow(r),
    studentName: r.last_name_ar ? `${r.last_name_ar} ${r.first_name_ar}` : undefined,
    studentNumber: r.student_number,
    groupName: r.group_name,
    courseNameAr: r.course_name_ar,
    courseNameFr: r.course_name_fr,
    courseName: r.course_name_ar ? `${r.course_name_ar} (${r.course_name_fr})` : r.course_name_fr,
  }
}
