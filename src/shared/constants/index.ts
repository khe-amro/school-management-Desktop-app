export const APP_NAME = 'Edupilot DZ'
export const APP_VERSION = '1.0.0'
export const DB_FILENAME = 'school-management.sqlite'
export const MEDIA_DIR = 'media'
export const STUDENTS_PHOTO_DIR = 'media/students'
export const TEACHERS_PHOTO_DIR = 'media/teachers'
export const LOG_DIR = 'logs'
export const BACKUP_DIR_DEFAULT = 'backups'

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const QR_TOKEN_PREFIX = 'STD-'
export const QR_TOKEN_BYTES = 24 // 24 bytes = 48 hex chars (unpredictable)

export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_DURATION_MINUTES = 15

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

export const DEFAULT_LATE_THRESHOLD_MINUTES = 10
export const DEFAULT_BACKUPS_TO_RETAIN = 30
export const DEFAULT_CURRENCY = 'DZD'
export const DEFAULT_LANGUAGE = 'ar' as const
export const DEFAULT_STUDENT_NUMBER_PREFIX = 'ETU'
export const DEFAULT_RECEIPT_PREFIX = 'REC'

export const IPC_CHANNELS = {
  // Health
  HEALTH_CHECK: 'health:check',

  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_CHANGE_PASSWORD: 'auth:changePassword',
  AUTH_GET_SESSION: 'auth:getSession',
  AUTH_CHECK_FIRST_RUN: 'auth:checkFirstRun',
  AUTH_COMPLETE_SETUP: 'auth:completeSetup',

  // Students
  STUDENTS_LIST: 'students:list',
  STUDENTS_GET: 'students:getById',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_ARCHIVE: 'students:archive',
  STUDENTS_REGEN_QR: 'students:regenQR',
  STUDENTS_GET_PHOTO_URL: 'students:getPhotoUrl',

  // Teachers
  TEACHERS_LIST: 'teachers:list',
  TEACHERS_GET: 'teachers:getById',
  TEACHERS_CREATE: 'teachers:create',
  TEACHERS_UPDATE: 'teachers:update',
  TEACHERS_ARCHIVE: 'teachers:archive',

  // Courses
  COURSES_LIST: 'courses:list',
  COURSES_GET: 'courses:getById',
  COURSES_CREATE: 'courses:create',
  COURSES_UPDATE: 'courses:update',

  // Groups
  GROUPS_LIST: 'groups:list',
  GROUPS_GET: 'groups:getById',
  GROUPS_CREATE: 'groups:create',
  GROUPS_UPDATE: 'groups:update',
  GROUPS_BY_COURSE: 'groups:byCourse',

  // Enrollments
  ENROLLMENTS_LIST: 'enrollments:list',
  ENROLLMENTS_CREATE: 'enrollments:create',
  ENROLLMENTS_UPDATE: 'enrollments:update',
  ENROLLMENTS_BY_STUDENT: 'enrollments:byStudent',
  ENROLLMENTS_BY_GROUP: 'enrollments:byGroup',

  // Attendance
  ATTENDANCE_START_SESSION: 'attendance:startSession',
  ATTENDANCE_SCAN: 'attendance:scan',
  ATTENDANCE_MARK_MANUAL: 'attendance:markManually',
  ATTENDANCE_END_SESSION: 'attendance:endSession',
  ATTENDANCE_GET_SESSION: 'attendance:getSession',
  ATTENDANCE_SESSIONS_LIST: 'attendance:sessionsList',
  ATTENDANCE_RECORDS: 'attendance:records',

  // Payments
  PAYMENTS_LIST: 'payments:list',
  PAYMENTS_CREATE: 'payments:create',
  PAYMENTS_CANCEL: 'payments:cancel',
  PAYMENTS_BY_STUDENT: 'payments:byStudent',
  PAYMENTS_PRINT_RECEIPT: 'payments:printReceipt',

  // Reports
  REPORTS_GENERATE: 'reports:generate',

  // Backups
  BACKUPS_CREATE: 'backups:create',
  BACKUPS_RESTORE: 'backups:restore',
  BACKUPS_LIST: 'backups:list',
  BACKUPS_VERIFY: 'backups:verify',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Media
  MEDIA_UPLOAD_PHOTO: 'media:uploadPhoto',
  MEDIA_GET_URL: 'media:getUrl',

  // App
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PATHS: 'app:getPaths',
  APP_OPEN_BACKUP_DIALOG: 'app:openBackupDialog',
  APP_OPEN_RESTORE_DIALOG: 'app:openRestoreDialog',
  APP_PRINT: 'app:print',
  APP_PRINT_TO_PDF: 'app:printToPdf',
  APP_SHOW_SAVE_DIALOG: 'app:showSaveDialog',
} as const
