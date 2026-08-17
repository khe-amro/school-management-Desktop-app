import { eq, desc, and, like, count } from 'drizzle-orm'
import { getDb, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { DEFAULT_RECEIPT_PREFIX } from '../../shared/constants/index'
import { requireSession } from './auth.service'
import type { Payment, PaginatedResult } from '../../shared/types/index'
import log from 'electron-log'

async function generateReceiptNumber(): Promise<string> {
  const db = getDb()
  const settings = await db.query.schoolSettings.findFirst()
  const prefix = settings?.receiptPrefix ?? DEFAULT_RECEIPT_PREFIX
  const result = await db.select({ count: count() }).from(schema.payments)
  const total = (result[0]?.count ?? 0) + 1
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${prefix}-${ts}-${String(total).padStart(4, '0')}`
}

export async function listPayments(opts: {
  page?: number
  pageSize?: number
  search?: string
  studentId?: number
}): Promise<PaginatedResult<Payment>> {
  const db = getDb()
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50))
  const offset = (page - 1) * pageSize

  const conditions = []
  if (opts.studentId) conditions.push(eq(schema.payments.studentId, opts.studentId))
  if (opts.search) {
    const q = `%${opts.search}%`
    conditions.push(like(schema.payments.receiptNumber, q))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: schema.payments.id,
        receiptNumber: schema.payments.receiptNumber,
        studentId: schema.payments.studentId,
        enrollmentId: schema.payments.enrollmentId,
        billingPeriod: schema.payments.billingPeriod,
        amount: schema.payments.amount,
        paymentMethod: schema.payments.paymentMethod,
        paymentDate: schema.payments.paymentDate,
        reference: schema.payments.reference,
        notes: schema.payments.notes,
        receivedBy: schema.payments.receivedBy,
        status: schema.payments.status,
        createdAt: schema.payments.createdAt,
        updatedAt: schema.payments.updatedAt,
        studentLastNameAr: schema.students.lastNameAr,
        studentFirstNameAr: schema.students.firstNameAr,
        studentNumber: schema.students.studentNumber,
        groupName: schema.groups.name,
        courseNameAr: schema.courses.nameAr,
        courseNameFr: schema.courses.nameFr,
      })
      .from(schema.payments)
      .leftJoin(schema.students, eq(schema.payments.studentId, schema.students.id))
      .leftJoin(schema.enrollments, eq(schema.payments.enrollmentId, schema.enrollments.id))
      .leftJoin(schema.groups, eq(schema.enrollments.groupId, schema.groups.id))
      .leftJoin(schema.courses, eq(schema.groups.courseId, schema.courses.id))
      .where(whereClause)
      .orderBy(desc(schema.payments.paymentDate))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(schema.payments).where(whereClause),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      studentId: r.studentId,
      enrollmentId: r.enrollmentId,
      billingPeriod: r.billingPeriod,
      amount: r.amount,
      paymentMethod: r.paymentMethod as Payment['paymentMethod'],
      paymentDate: r.paymentDate,
      reference: r.reference ?? null,
      notes: r.notes ?? null,
      receivedBy: r.receivedBy,
      status: r.status as 'paid' | 'cancelled',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      studentName: r.studentLastNameAr && r.studentFirstNameAr ? `${r.studentLastNameAr} ${r.studentFirstNameAr}` : undefined,
      studentNumber: r.studentNumber ?? undefined,
      groupName: r.groupName ?? undefined,
      courseName: r.courseNameAr ? `${r.courseNameAr} (${r.courseNameFr})` : (r.courseNameFr ?? undefined),
    })),
    total: totalResult[0]?.count ?? 0,
    page,
    pageSize,
  }
}

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
  const session = requireSession()
  const db = getDb()

  if (data.amount < 0) throw new AppError(ErrorCode.NEGATIVE_AMOUNT, 'Amount cannot be negative')

  const receiptNumber = await generateReceiptNumber()
  const now = new Date().toISOString()

  const result = await db.insert(schema.payments).values({
    receiptNumber,
    studentId: data.studentId,
    enrollmentId: data.enrollmentId,
    billingPeriod: data.billingPeriod,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    paymentDate: data.paymentDate,
    reference: data.reference ?? null,
    notes: data.notes ?? null,
    receivedBy: session.adminId,
    status: 'paid',
    updatedAt: now,
  }).returning()

  const row = result[0]!
  log.info(`Payment created: ${receiptNumber}, amount: ${data.amount}`)

  await db.insert(schema.auditLogs).values({
    administratorId: session.adminId,
    action: 'payment.create',
    entityType: 'payment',
    entityId: row.id,
    sanitizedDetailsJson: JSON.stringify({ receiptNumber, amount: data.amount, billingPeriod: data.billingPeriod }),
  })

  // Fetch with joined details for instant display in receipt ticket
  const joined = await db
    .select({
      id: schema.payments.id,
      receiptNumber: schema.payments.receiptNumber,
      studentId: schema.payments.studentId,
      enrollmentId: schema.payments.enrollmentId,
      billingPeriod: schema.payments.billingPeriod,
      amount: schema.payments.amount,
      paymentMethod: schema.payments.paymentMethod,
      paymentDate: schema.payments.paymentDate,
      reference: schema.payments.reference,
      notes: schema.payments.notes,
      receivedBy: schema.payments.receivedBy,
      status: schema.payments.status,
      createdAt: schema.payments.createdAt,
      updatedAt: schema.payments.updatedAt,
      studentLastNameAr: schema.students.lastNameAr,
      studentFirstNameAr: schema.students.firstNameAr,
      studentNumber: schema.students.studentNumber,
      groupName: schema.groups.name,
      courseNameAr: schema.courses.nameAr,
      courseNameFr: schema.courses.nameFr,
    })
    .from(schema.payments)
    .leftJoin(schema.students, eq(schema.payments.studentId, schema.students.id))
    .leftJoin(schema.enrollments, eq(schema.payments.enrollmentId, schema.enrollments.id))
    .leftJoin(schema.groups, eq(schema.enrollments.groupId, schema.groups.id))
    .leftJoin(schema.courses, eq(schema.groups.courseId, schema.courses.id))
    .where(eq(schema.payments.id, row.id))

  const r = joined[0] ?? row
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    studentId: r.studentId,
    enrollmentId: r.enrollmentId,
    billingPeriod: r.billingPeriod,
    amount: r.amount,
    paymentMethod: r.paymentMethod as Payment['paymentMethod'],
    paymentDate: r.paymentDate,
    reference: r.reference ?? null,
    notes: r.notes ?? null,
    receivedBy: r.receivedBy,
    status: r.status as 'paid' | 'cancelled',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    studentName: 'studentLastNameAr' in r && r.studentLastNameAr ? `${r.studentLastNameAr} ${r.studentFirstNameAr}` : undefined,
    studentNumber: 'studentNumber' in r ? r.studentNumber ?? undefined : undefined,
    groupName: 'groupName' in r ? r.groupName ?? undefined : undefined,
    courseName: 'courseNameAr' in r && r.courseNameAr ? `${r.courseNameAr} (${r.courseNameFr})` : ('courseNameFr' in r ? (r.courseNameFr ?? undefined) : undefined),
  }
}

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

export async function getPaymentsByStudent(studentId: number): Promise<Payment[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: schema.payments.id,
      receiptNumber: schema.payments.receiptNumber,
      studentId: schema.payments.studentId,
      enrollmentId: schema.payments.enrollmentId,
      billingPeriod: schema.payments.billingPeriod,
      amount: schema.payments.amount,
      paymentMethod: schema.payments.paymentMethod,
      paymentDate: schema.payments.paymentDate,
      reference: schema.payments.reference,
      notes: schema.payments.notes,
      receivedBy: schema.payments.receivedBy,
      status: schema.payments.status,
      createdAt: schema.payments.createdAt,
      updatedAt: schema.payments.updatedAt,
      groupName: schema.groups.name,
      courseNameAr: schema.courses.nameAr,
      courseNameFr: schema.courses.nameFr,
    })
    .from(schema.payments)
    .leftJoin(schema.enrollments, eq(schema.payments.enrollmentId, schema.enrollments.id))
    .leftJoin(schema.groups, eq(schema.enrollments.groupId, schema.groups.id))
    .leftJoin(schema.courses, eq(schema.groups.courseId, schema.courses.id))
    .where(eq(schema.payments.studentId, studentId))
    .orderBy(desc(schema.payments.paymentDate))

  return rows.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    studentId: r.studentId,
    enrollmentId: r.enrollmentId,
    billingPeriod: r.billingPeriod,
    amount: r.amount,
    paymentMethod: r.paymentMethod as Payment['paymentMethod'],
    paymentDate: r.paymentDate,
    reference: r.reference ?? null,
    notes: r.notes ?? null,
    receivedBy: r.receivedBy,
    status: r.status as 'paid' | 'cancelled',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    groupName: r.groupName ?? undefined,
    courseName: r.courseNameAr ? `${r.courseNameAr} (${r.courseNameFr})` : (r.courseNameFr ?? undefined),
  }))
}
