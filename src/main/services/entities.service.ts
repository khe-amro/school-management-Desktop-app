import { eq, desc, count, and } from 'drizzle-orm'
import { getDb, schema } from '../database/connection'
import { AppError, ErrorCode } from '../../shared/errors/index'
import { requireSession } from './auth.service'
import type { Teacher, Course, Group, Enrollment } from '../../shared/types/index'

// ─── Teachers ────────────────────────────────────────────────────────────────

export async function listTeachers(opts: { status?: string } = {}): Promise<Teacher[]> {
  const db = getDb()
  const rows = await db.select().from(schema.teachers)
    .orderBy(desc(schema.teachers.createdAt))
  const filtered = opts.status === 'all'
    ? rows
    : (opts.status ? rows.filter(r => r.status === opts.status) : rows.filter(r => r.status !== 'archived'))
  return filtered.map(r => ({
    id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone ?? null,
    email: r.email ?? null, address: r.address ?? null, photoPath: r.photoPath ?? null,
    status: r.status as Teacher['status'], createdAt: r.createdAt, updatedAt: r.updatedAt,
  }))
}

export async function createTeacher(data: { firstName: string; lastName: string; phone?: string | null; email?: string | null; address?: string | null }): Promise<Teacher> {
  requireSession()
  const db = getDb()
  const now = new Date().toISOString()
  const result = await db.insert(schema.teachers).values({ ...data, phone: data.phone ?? null, email: data.email ?? null, address: data.address ?? null, updatedAt: now }).returning()
  const r = result[0]!
  return { id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone ?? null, email: r.email ?? null, address: r.address ?? null, photoPath: r.photoPath ?? null, status: r.status as Teacher['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}

export async function updateTeacher(id: number, data: Partial<{ firstName: string; lastName: string; phone: string | null; email: string | null; address: string | null; status: Teacher['status'] }>): Promise<Teacher> {
  requireSession()
  const db = getDb()
  const result = await db.update(schema.teachers).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.teachers.id, id)).returning()
  if (!result[0]) throw new AppError(ErrorCode.NOT_FOUND, 'Teacher not found')
  const r = result[0]
  return { id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone ?? null, email: r.email ?? null, address: r.address ?? null, photoPath: r.photoPath ?? null, status: r.status as Teacher['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}

export async function archiveTeacher(id: number): Promise<void> {
  requireSession()
  const db = getDb()
  await db.update(schema.teachers).set({ status: 'archived', archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(schema.teachers.id, id))
}

// ─── Courses ─────────────────────────────────────────────────────────────────

export async function listCourses(opts: { status?: string } = {}): Promise<Course[]> {
  const db = getDb()
  const rows = await db.select().from(schema.courses).orderBy(desc(schema.courses.createdAt))
  const filtered = opts.status && opts.status !== 'all' ? rows.filter(r => r.status === opts.status) : rows
  return filtered.map(r => ({
    id: r.id, nameAr: r.nameAr, nameFr: r.nameFr, nameEn: r.nameEn,
    descriptionAr: r.descriptionAr ?? null, descriptionFr: r.descriptionFr ?? null, descriptionEn: r.descriptionEn ?? null,
    defaultPrice: r.defaultPrice, status: r.status as Course['status'], createdAt: r.createdAt, updatedAt: r.updatedAt,
  }))
}

export async function createCourse(data: { nameAr: string; nameFr: string; nameEn?: string; descriptionAr?: string | null; descriptionFr?: string | null; descriptionEn?: string | null; defaultPrice: number }): Promise<Course> {
  requireSession()
  const db = getDb()
  const result = await db.insert(schema.courses).values({ ...data, nameEn: data.nameEn ?? '', updatedAt: new Date().toISOString() }).returning()
  const r = result[0]!
  return { id: r.id, nameAr: r.nameAr, nameFr: r.nameFr, nameEn: r.nameEn, descriptionAr: r.descriptionAr ?? null, descriptionFr: r.descriptionFr ?? null, descriptionEn: r.descriptionEn ?? null, defaultPrice: r.defaultPrice, status: r.status as Course['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}

export async function updateCourse(id: number, data: Partial<{ nameAr: string; nameFr: string; nameEn: string; descriptionAr: string | null; descriptionFr: string | null; defaultPrice: number; status: Course['status'] }>): Promise<Course> {
  requireSession()
  const db = getDb()
  const result = await db.update(schema.courses).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.courses.id, id)).returning()
  if (!result[0]) throw new AppError(ErrorCode.NOT_FOUND, 'Course not found')
  const r = result[0]
  return { id: r.id, nameAr: r.nameAr, nameFr: r.nameFr, nameEn: r.nameEn, descriptionAr: r.descriptionAr ?? null, descriptionFr: r.descriptionFr ?? null, descriptionEn: r.descriptionEn ?? null, defaultPrice: r.defaultPrice, status: r.status as Course['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}

export async function deleteCourse(id: number): Promise<boolean> {
  requireSession()
  const db = getDb()
  const courseGroups = await db.query.groups.findMany({ where: eq(schema.groups.courseId, id) })
  for (const g of courseGroups) {
    await deleteGroup(g.id)
  }
  await db.delete(schema.courses).where(eq(schema.courses.id, id))
  return true
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function listGroups(opts: { courseId?: number; status?: string } = {}): Promise<Group[]> {
  const db = getDb()
  const rows = await db.select().from(schema.groups).orderBy(desc(schema.groups.createdAt))
  let filtered = rows
  if (opts.courseId) filtered = filtered.filter(r => r.courseId === opts.courseId)
  if (opts.status && opts.status !== 'all') filtered = filtered.filter(r => r.status === opts.status)

  // Count enrollments per group
  const enrollmentCounts = await db.select({ groupId: schema.enrollments.groupId, count: count() })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.status, 'active'))
    .groupBy(schema.enrollments.groupId)

  const countMap = new Map(enrollmentCounts.map(e => [e.groupId, e.count]))

  return filtered.map(r => ({
    id: r.id, courseId: r.courseId, teacherId: r.teacherId, name: r.name,
    room: r.room ?? null, scheduleJson: r.scheduleJson ?? null, capacity: r.capacity,
    monthlyPrice: r.monthlyPrice, startDate: r.startDate, endDate: r.endDate ?? null,
    status: r.status as Group['status'], createdAt: r.createdAt, updatedAt: r.updatedAt,
    enrolledCount: countMap.get(r.id) ?? 0,
  }))
}

export async function createGroup(data: { courseId: number; teacherId: number; name: string; room?: string | null; scheduleJson?: string | null; capacity: number; monthlyPrice: number; startDate: string; endDate?: string | null }): Promise<Group> {
  requireSession()
  const db = getDb()
  const result = await db.insert(schema.groups).values({ ...data, room: data.room ?? null, scheduleJson: data.scheduleJson ?? null, endDate: data.endDate ?? null, updatedAt: new Date().toISOString() }).returning()
  const r = result[0]!
  return { id: r.id, courseId: r.courseId, teacherId: r.teacherId, name: r.name, room: r.room ?? null, scheduleJson: r.scheduleJson ?? null, capacity: r.capacity, monthlyPrice: r.monthlyPrice, startDate: r.startDate, endDate: r.endDate ?? null, status: r.status as Group['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}

export async function updateGroup(id: number, data: Partial<{ name: string; room: string | null; capacity: number; monthlyPrice: number; status: Group['status']; endDate: string | null }>): Promise<Group> {
  requireSession()
  const db = getDb()
  const result = await db.update(schema.groups).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.groups.id, id)).returning()
  if (!result[0]) throw new AppError(ErrorCode.NOT_FOUND, 'Group not found')
  const r = result[0]
  return { id: r.id, courseId: r.courseId, teacherId: r.teacherId, name: r.name, room: r.room ?? null, scheduleJson: r.scheduleJson ?? null, capacity: r.capacity, monthlyPrice: r.monthlyPrice, startDate: r.startDate, endDate: r.endDate ?? null, status: r.status as Group['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}

export async function deleteGroup(id: number): Promise<boolean> {
  requireSession()
  const db = getDb()

  // 1. Delete attendance records for all sessions in this group
  const sessions = await db.query.attendanceSessions.findMany({ where: eq(schema.attendanceSessions.groupId, id) })
  for (const s of sessions) {
    await db.delete(schema.attendanceRecords).where(eq(schema.attendanceRecords.sessionId, s.id))
  }

  // 2. Delete attendance sessions in this group (breaks foreign key references to groupScheduleSlots and groups)
  await db.delete(schema.attendanceSessions).where(eq(schema.attendanceSessions.groupId, id))

  // 3. Delete group schedule slots (safe now that sessions referencing them are deleted)
  await db.delete(schema.groupScheduleSlots).where(eq(schema.groupScheduleSlots.groupId, id))

  // 4. Find all enrollments in this group and delete their associated payments
  const groupEnrollments = await db.query.enrollments.findMany({ where: eq(schema.enrollments.groupId, id) })
  for (const enr of groupEnrollments) {
    await db.delete(schema.payments).where(eq(schema.payments.enrollmentId, enr.id))
  }

  // 5. Delete enrollments in this group (safe now that payments referencing them are deleted)
  await db.delete(schema.enrollments).where(eq(schema.enrollments.groupId, id))

  // 6. Finally delete the group
  await db.delete(schema.groups).where(eq(schema.groups.id, id))
  return true
}

// ─── Enrollments ──────────────────────────────────────────────────────────────

export async function createEnrollment(data: { studentId: number; groupId: number; agreedPrice: number; enrollmentDate: string }): Promise<Enrollment> {
  requireSession()
  const db = getDb()

  // Check not already enrolled
  const existing = await db.query.enrollments.findFirst({
    where: and(eq(schema.enrollments.studentId, data.studentId), eq(schema.enrollments.groupId, data.groupId)),
  })
  if (existing && existing.status === 'active') {
    throw new AppError(ErrorCode.STUDENT_ALREADY_ENROLLED, 'Student is already enrolled in this group')
  }

  const result = await db.insert(schema.enrollments).values({ ...data, updatedAt: new Date().toISOString() }).returning()
  const r = result[0]!
  return { id: r.id, studentId: r.studentId, groupId: r.groupId, agreedPrice: r.agreedPrice, enrollmentDate: r.enrollmentDate, status: r.status as Enrollment['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}

export async function listEnrollmentsByStudent(studentId: number): Promise<Enrollment[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: schema.enrollments.id,
      studentId: schema.enrollments.studentId,
      groupId: schema.enrollments.groupId,
      agreedPrice: schema.enrollments.agreedPrice,
      enrollmentDate: schema.enrollments.enrollmentDate,
      status: schema.enrollments.status,
      createdAt: schema.enrollments.createdAt,
      updatedAt: schema.enrollments.updatedAt,
      groupName: schema.groups.name,
      courseNameAr: schema.courses.nameAr,
      courseNameFr: schema.courses.nameFr,
    })
    .from(schema.enrollments)
    .leftJoin(schema.groups, eq(schema.enrollments.groupId, schema.groups.id))
    .leftJoin(schema.courses, eq(schema.groups.courseId, schema.courses.id))
    .where(eq(schema.enrollments.studentId, studentId))
    .orderBy(desc(schema.enrollments.createdAt))

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    groupId: r.groupId,
    agreedPrice: r.agreedPrice,
    enrollmentDate: r.enrollmentDate,
    status: r.status as Enrollment['status'],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    groupName: r.groupName ?? undefined,
    courseName: r.courseNameAr ? `${r.courseNameAr} (${r.courseNameFr})` : (r.courseNameFr ?? undefined),
  }))
}

export async function listEnrollmentsByGroup(groupId: number): Promise<any[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: schema.enrollments.id,
      studentId: schema.enrollments.studentId,
      groupId: schema.enrollments.groupId,
      agreedPrice: schema.enrollments.agreedPrice,
      enrollmentDate: schema.enrollments.enrollmentDate,
      status: schema.enrollments.status,
      createdAt: schema.enrollments.createdAt,
      updatedAt: schema.enrollments.updatedAt,
      studentNumber: schema.students.studentNumber,
      firstNameAr: schema.students.firstNameAr,
      lastNameAr: schema.students.lastNameAr,
      firstNameFr: schema.students.firstNameFr,
      lastNameFr: schema.students.lastNameFr,
      phone: schema.students.phone,
      studentStatus: schema.students.status,
    })
    .from(schema.enrollments)
    .leftJoin(schema.students, eq(schema.enrollments.studentId, schema.students.id))
    .where(and(eq(schema.enrollments.groupId, groupId), eq(schema.enrollments.status, 'active')))
    .orderBy(desc(schema.enrollments.createdAt))

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    groupId: r.groupId,
    agreedPrice: r.agreedPrice,
    enrollmentDate: r.enrollmentDate,
    status: r.status as Enrollment['status'],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    studentNumber: r.studentNumber ?? '',
    firstNameAr: r.firstNameAr ?? '',
    lastNameAr: r.lastNameAr ?? '',
    firstNameFr: r.firstNameFr ?? '',
    lastNameFr: r.lastNameFr ?? '',
    phone: r.phone ?? null,
    studentStatus: r.studentStatus ?? 'active',
  }))
}

export async function updateEnrollment(id: number, data: Partial<{ status: Enrollment['status']; agreedPrice: number }>): Promise<Enrollment> {
  requireSession()
  const db = getDb()
  const result = await db.update(schema.enrollments).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.enrollments.id, id)).returning()
  const r = result[0]!
  return { id: r.id, studentId: r.studentId, groupId: r.groupId, agreedPrice: r.agreedPrice, enrollmentDate: r.enrollmentDate, status: r.status as Enrollment['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}
