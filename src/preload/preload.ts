import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/index'
import type {
  ApiResult, AuthSession, Student, Teacher, Course, Group,
  Enrollment, AttendanceSession, AttendanceRecord, Payment,
  SchoolSettings, BackupInfo, QRScanResult, PaginatedResult
} from '../shared/types/index'

// ─── Safe invoke helper — wraps every call ───────────────────────────────────
async function invoke<T>(channel: string, payload?: unknown): Promise<ApiResult<T>> {
  return ipcRenderer.invoke(channel, payload)
}

// ─── The narrow, typed API exposed to the renderer ──────────────────────────
const api = {
  health: {
    check: () =>
      invoke<{
        preloadLoaded: boolean
        mainReachable: boolean
        ipcWorking: boolean
        sqliteOpen: boolean
        migrationsApplied: boolean
      }>(IPC_CHANNELS.HEALTH_CHECK),
  },

  auth: {
    login: (username: string, password: string) =>
      invoke<AuthSession>(IPC_CHANNELS.AUTH_LOGIN, { username, password }),
    logout: () => invoke<boolean>(IPC_CHANNELS.AUTH_LOGOUT),
    changePassword: (currentPassword: string, newPassword: string) =>
      invoke<boolean>(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, { currentPassword, newPassword }),
    getSession: () => invoke<AuthSession | null>(IPC_CHANNELS.AUTH_GET_SESSION),
    checkFirstRun: () => invoke<{ firstRun: boolean }>(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN),
    completeSetup: (data: {
      schoolNameAr: string; schoolNameFr: string; schoolNameEn?: string
      phone?: string; email?: string; address?: string; academicYear: string
      adminFullName: string; adminUsername: string; adminPassword: string
      preferredLanguage: 'ar' | 'fr' | 'en'
    }) => invoke<AuthSession>(IPC_CHANNELS.AUTH_COMPLETE_SETUP, data),
  },

  setup: {
    getStatus: () => invoke<{ firstRun: boolean }>(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN),
    complete: (data: {
      schoolNameAr: string; schoolNameFr: string; schoolNameEn?: string
      phone?: string; email?: string; address?: string; academicYear: string
      adminFullName: string; adminUsername: string; adminPassword: string
      preferredLanguage: 'ar' | 'fr' | 'en'
    }) => invoke<AuthSession>(IPC_CHANNELS.AUTH_COMPLETE_SETUP, data),
  },

  students: {
    list: (opts?: { page?: number; pageSize?: number; search?: string; status?: string }) =>
      invoke<PaginatedResult<Student>>(IPC_CHANNELS.STUDENTS_LIST, opts),
    getById: (id: number) =>
      invoke<Student>(IPC_CHANNELS.STUDENTS_GET, { id }),
    create: (data: {
      firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string
      gender: 'male' | 'female'; dateOfBirth?: string | null; phone?: string | null
      guardianName?: string | null; guardianRelationship?: string | null
      guardianPhone?: string | null; secondaryPhone?: string | null; address?: string | null
    }) => invoke<Student>(IPC_CHANNELS.STUDENTS_CREATE, data),
    update: (id: number, data: Partial<{
      firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string
      gender: 'male' | 'female'; dateOfBirth: string | null; phone: string | null
      guardianName: string | null; status: string
    }>) => invoke<Student>(IPC_CHANNELS.STUDENTS_UPDATE, { id, ...data }),
    archive: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.STUDENTS_ARCHIVE, { id }),
    regenQR: (id: number) =>
      invoke<{ token: string }>(IPC_CHANNELS.STUDENTS_REGEN_QR, { id }),
    getPhotoUrl: (filename: string, entityType: 'student' | 'teacher') =>
      invoke<{ dataUrl: string | null }>(IPC_CHANNELS.STUDENTS_GET_PHOTO_URL, { filename, entityType }),
  },

  teachers: {
    list: (opts?: { status?: string }) =>
      invoke<Teacher[]>(IPC_CHANNELS.TEACHERS_LIST, opts),
    create: (data: { firstName: string; lastName: string; phone?: string | null; email?: string | null; address?: string | null }) =>
      invoke<Teacher>(IPC_CHANNELS.TEACHERS_CREATE, data),
    update: (id: number, data: Partial<{ firstName: string; lastName: string; phone: string | null; email: string | null; status: string }>) =>
      invoke<Teacher>(IPC_CHANNELS.TEACHERS_UPDATE, { id, ...data }),
    archive: (id: number) =>
      invoke<boolean>(IPC_CHANNELS.TEACHERS_ARCHIVE, { id }),
  },

  courses: {
    list: (opts?: { status?: string }) =>
      invoke<Course[]>(IPC_CHANNELS.COURSES_LIST, opts),
    create: (data: { nameAr: string; nameFr: string; nameEn?: string; defaultPrice: number; descriptionAr?: string | null; descriptionFr?: string | null }) =>
      invoke<Course>(IPC_CHANNELS.COURSES_CREATE, data),
    update: (id: number, data: Partial<{ nameAr: string; nameFr: string; defaultPrice: number; status: string }>) =>
      invoke<Course>(IPC_CHANNELS.COURSES_UPDATE, { id, ...data }),
  },

  groups: {
    list: (opts?: { courseId?: number; status?: string }) =>
      invoke<Group[]>(IPC_CHANNELS.GROUPS_LIST, opts),
    byCourse: (courseId: number) =>
      invoke<Group[]>(IPC_CHANNELS.GROUPS_BY_COURSE, { courseId }),
    create: (data: { courseId: number; teacherId: number; name: string; capacity: number; monthlyPrice: number; startDate: string; room?: string | null; scheduleJson?: string | null }) =>
      invoke<Group>(IPC_CHANNELS.GROUPS_CREATE, data),
    update: (id: number, data: Partial<{ name: string; room: string | null; capacity: number; monthlyPrice: number; status: string }>) =>
      invoke<Group>(IPC_CHANNELS.GROUPS_UPDATE, { id, ...data }),
  },

  enrollments: {
    create: (data: { studentId: number; groupId: number; agreedPrice: number; enrollmentDate: string }) =>
      invoke<Enrollment>(IPC_CHANNELS.ENROLLMENTS_CREATE, data),
    byStudent: (studentId: number) =>
      invoke<Enrollment[]>(IPC_CHANNELS.ENROLLMENTS_BY_STUDENT, { studentId }),
    byGroup: (groupId: number) =>
      invoke<Enrollment[]>(IPC_CHANNELS.ENROLLMENTS_BY_GROUP, { groupId }),
  },

  attendance: {
    startSession: (data: { groupId: number; sessionDate: string; plannedStartTime?: string | null; lateThresholdMinutes?: number }) =>
      invoke<AttendanceSession>(IPC_CHANNELS.ATTENDANCE_START_SESSION, data),
    scan: (sessionId: number, token: string) =>
      invoke<QRScanResult>(IPC_CHANNELS.ATTENDANCE_SCAN, { sessionId, token }),
    markManually: (data: { sessionId: number; studentId: number; attendanceStatus: 'present' | 'absent' | 'late'; notes?: string | null }) =>
      invoke<AttendanceRecord>(IPC_CHANNELS.ATTENDANCE_MARK_MANUAL, data),
    endSession: (sessionId: number) =>
      invoke<boolean>(IPC_CHANNELS.ATTENDANCE_END_SESSION, { sessionId }),
    getSession: (id: number) =>
      invoke<AttendanceSession & { records: AttendanceRecord[] }>(IPC_CHANNELS.ATTENDANCE_GET_SESSION, { id }),
    listSessions: (opts?: { groupId?: number; limit?: number }) =>
      invoke<AttendanceSession[]>(IPC_CHANNELS.ATTENDANCE_SESSIONS_LIST, opts),
  },

  payments: {
    list: (opts?: { page?: number; pageSize?: number; search?: string; studentId?: number }) =>
      invoke<PaginatedResult<Payment>>(IPC_CHANNELS.PAYMENTS_LIST, opts),
    create: (data: { studentId: number; enrollmentId: number; billingPeriod: string; amount: number; paymentMethod: 'cash' | 'transfer' | 'check'; paymentDate: string; reference?: string | null; notes?: string | null }) =>
      invoke<Payment>(IPC_CHANNELS.PAYMENTS_CREATE, data),
    cancel: (id: number, reason?: string | null) =>
      invoke<boolean>(IPC_CHANNELS.PAYMENTS_CANCEL, { id, reason }),
    byStudent: (studentId: number) =>
      invoke<Payment[]>(IPC_CHANNELS.PAYMENTS_BY_STUDENT, { studentId }),
  },

  settings: {
    get: () => invoke<SchoolSettings | null>(IPC_CHANNELS.SETTINGS_GET),
    update: (data: Partial<{
      schoolNameAr: string; schoolNameFr: string; schoolNameEn: string
      phone: string | null; email: string | null; address: string | null
      academicYear: string; currency: string; defaultLanguage: 'ar' | 'fr' | 'en'
      backupDirectory: string | null; automaticBackupEnabled: boolean; backupsToRetain: number
    }>) => invoke<SchoolSettings>(IPC_CHANNELS.SETTINGS_UPDATE, data),
  },

  backups: {
    create: (destinationDir?: string) =>
      invoke<BackupInfo>(IPC_CHANNELS.BACKUPS_CREATE, { destinationDir }),
    list: () => invoke<BackupInfo[]>(IPC_CHANNELS.BACKUPS_LIST),
    verify: (backupPath: string) =>
      invoke<{ verified: boolean }>(IPC_CHANNELS.BACKUPS_VERIFY, { backupPath }),
    restore: (backupPath: string, confirmPassword: string) =>
      invoke<boolean>(IPC_CHANNELS.BACKUPS_RESTORE, { backupPath, confirmPassword }),
  },

  media: {
    uploadPhoto: (sourcePath: string, entityType: 'student' | 'teacher', entityId: number) =>
      invoke<{ filename: string }>(IPC_CHANNELS.MEDIA_UPLOAD_PHOTO, { sourcePath, entityType, entityId }),
  },

  app: {
    getVersion: () => invoke<{ version: string; name: string }>(IPC_CHANNELS.APP_GET_VERSION),
    getPaths: () => invoke<{ userData: string; documents: string }>(IPC_CHANNELS.APP_GET_PATHS),
    openBackupDialog: () => invoke<{ canceled: boolean; path: string | null }>(IPC_CHANNELS.APP_OPEN_BACKUP_DIALOG),
    openSaveDialog: () => invoke<{ canceled: boolean; path: string | null }>(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG),
    print: () => invoke<boolean>(IPC_CHANNELS.APP_PRINT),
    printToPdf: (opts?: { pageSize?: 'A4' | 'Letter'; marginsType?: 0 | 1 | 2 }) => invoke<{ path: string }>(IPC_CHANNELS.APP_PRINT_TO_PDF, opts),
  },
} as const

// ─── Expose via contextBridge (the ONLY bridge to Node.js) ───────────────────
contextBridge.exposeInMainWorld('schoolApp', api)

// ─── TypeScript declaration for renderer ─────────────────────────────────────
export type SchoolAppAPI = typeof api
