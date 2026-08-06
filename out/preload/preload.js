"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  // Health
  HEALTH_CHECK: "health:check",
  // Auth
  AUTH_LOGIN: "auth:login",
  AUTH_LOGOUT: "auth:logout",
  AUTH_CHANGE_PASSWORD: "auth:changePassword",
  AUTH_GET_SESSION: "auth:getSession",
  AUTH_CHECK_FIRST_RUN: "auth:checkFirstRun",
  AUTH_COMPLETE_SETUP: "auth:completeSetup",
  // Students
  STUDENTS_LIST: "students:list",
  STUDENTS_GET: "students:getById",
  STUDENTS_CREATE: "students:create",
  STUDENTS_UPDATE: "students:update",
  STUDENTS_ARCHIVE: "students:archive",
  STUDENTS_REGEN_QR: "students:regenQR",
  STUDENTS_GET_PHOTO_URL: "students:getPhotoUrl",
  // Teachers
  TEACHERS_LIST: "teachers:list",
  TEACHERS_CREATE: "teachers:create",
  TEACHERS_UPDATE: "teachers:update",
  TEACHERS_ARCHIVE: "teachers:archive",
  // Courses
  COURSES_LIST: "courses:list",
  COURSES_CREATE: "courses:create",
  COURSES_UPDATE: "courses:update",
  // Groups
  GROUPS_LIST: "groups:list",
  GROUPS_CREATE: "groups:create",
  GROUPS_UPDATE: "groups:update",
  GROUPS_BY_COURSE: "groups:byCourse",
  ENROLLMENTS_CREATE: "enrollments:create",
  ENROLLMENTS_BY_STUDENT: "enrollments:byStudent",
  ENROLLMENTS_BY_GROUP: "enrollments:byGroup",
  // Attendance
  ATTENDANCE_START_SESSION: "attendance:startSession",
  ATTENDANCE_SCAN: "attendance:scan",
  ATTENDANCE_MARK_MANUAL: "attendance:markManually",
  ATTENDANCE_END_SESSION: "attendance:endSession",
  ATTENDANCE_GET_SESSION: "attendance:getSession",
  ATTENDANCE_SESSIONS_LIST: "attendance:sessionsList",
  // Payments
  PAYMENTS_LIST: "payments:list",
  PAYMENTS_CREATE: "payments:create",
  PAYMENTS_CANCEL: "payments:cancel",
  PAYMENTS_BY_STUDENT: "payments:byStudent",
  // Backups
  BACKUPS_CREATE: "backups:create",
  BACKUPS_RESTORE: "backups:restore",
  BACKUPS_LIST: "backups:list",
  BACKUPS_VERIFY: "backups:verify",
  // Settings
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",
  // Media
  MEDIA_UPLOAD_PHOTO: "media:uploadPhoto",
  // App
  APP_GET_VERSION: "app:getVersion",
  APP_GET_PATHS: "app:getPaths",
  APP_OPEN_BACKUP_DIALOG: "app:openBackupDialog",
  APP_PRINT: "app:print",
  APP_PRINT_TO_PDF: "app:printToPdf",
  APP_SHOW_SAVE_DIALOG: "app:showSaveDialog"
};
async function invoke(channel, payload) {
  return electron.ipcRenderer.invoke(channel, payload);
}
const api = {
  health: {
    check: () => invoke(IPC_CHANNELS.HEALTH_CHECK)
  },
  auth: {
    login: (username, password) => invoke(IPC_CHANNELS.AUTH_LOGIN, { username, password }),
    logout: () => invoke(IPC_CHANNELS.AUTH_LOGOUT),
    changePassword: (currentPassword, newPassword) => invoke(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, { currentPassword, newPassword }),
    getSession: () => invoke(IPC_CHANNELS.AUTH_GET_SESSION),
    checkFirstRun: () => invoke(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN),
    completeSetup: (data) => invoke(IPC_CHANNELS.AUTH_COMPLETE_SETUP, data)
  },
  setup: {
    getStatus: () => invoke(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN),
    complete: (data) => invoke(IPC_CHANNELS.AUTH_COMPLETE_SETUP, data)
  },
  students: {
    list: (opts) => invoke(IPC_CHANNELS.STUDENTS_LIST, opts),
    getById: (id) => invoke(IPC_CHANNELS.STUDENTS_GET, { id }),
    create: (data) => invoke(IPC_CHANNELS.STUDENTS_CREATE, data),
    update: (id, data) => invoke(IPC_CHANNELS.STUDENTS_UPDATE, { id, ...data }),
    archive: (id) => invoke(IPC_CHANNELS.STUDENTS_ARCHIVE, { id }),
    regenQR: (id) => invoke(IPC_CHANNELS.STUDENTS_REGEN_QR, { id }),
    getPhotoUrl: (filename, entityType) => invoke(IPC_CHANNELS.STUDENTS_GET_PHOTO_URL, { filename, entityType })
  },
  teachers: {
    list: (opts) => invoke(IPC_CHANNELS.TEACHERS_LIST, opts),
    create: (data) => invoke(IPC_CHANNELS.TEACHERS_CREATE, data),
    update: (id, data) => invoke(IPC_CHANNELS.TEACHERS_UPDATE, { id, ...data }),
    archive: (id) => invoke(IPC_CHANNELS.TEACHERS_ARCHIVE, { id })
  },
  courses: {
    list: (opts) => invoke(IPC_CHANNELS.COURSES_LIST, opts),
    create: (data) => invoke(IPC_CHANNELS.COURSES_CREATE, data),
    update: (id, data) => invoke(IPC_CHANNELS.COURSES_UPDATE, { id, ...data })
  },
  groups: {
    list: (opts) => invoke(IPC_CHANNELS.GROUPS_LIST, opts),
    byCourse: (courseId) => invoke(IPC_CHANNELS.GROUPS_BY_COURSE, { courseId }),
    create: (data) => invoke(IPC_CHANNELS.GROUPS_CREATE, data),
    update: (id, data) => invoke(IPC_CHANNELS.GROUPS_UPDATE, { id, ...data })
  },
  enrollments: {
    create: (data) => invoke(IPC_CHANNELS.ENROLLMENTS_CREATE, data),
    byStudent: (studentId) => invoke(IPC_CHANNELS.ENROLLMENTS_BY_STUDENT, { studentId }),
    byGroup: (groupId) => invoke(IPC_CHANNELS.ENROLLMENTS_BY_GROUP, { groupId })
  },
  attendance: {
    startSession: (data) => invoke(IPC_CHANNELS.ATTENDANCE_START_SESSION, data),
    scan: (sessionId, token) => invoke(IPC_CHANNELS.ATTENDANCE_SCAN, { sessionId, token }),
    markManually: (data) => invoke(IPC_CHANNELS.ATTENDANCE_MARK_MANUAL, data),
    endSession: (sessionId) => invoke(IPC_CHANNELS.ATTENDANCE_END_SESSION, { sessionId }),
    getSession: (id) => invoke(IPC_CHANNELS.ATTENDANCE_GET_SESSION, { id }),
    listSessions: (opts) => invoke(IPC_CHANNELS.ATTENDANCE_SESSIONS_LIST, opts)
  },
  payments: {
    list: (opts) => invoke(IPC_CHANNELS.PAYMENTS_LIST, opts),
    create: (data) => invoke(IPC_CHANNELS.PAYMENTS_CREATE, data),
    cancel: (id, reason) => invoke(IPC_CHANNELS.PAYMENTS_CANCEL, { id, reason }),
    byStudent: (studentId) => invoke(IPC_CHANNELS.PAYMENTS_BY_STUDENT, { studentId })
  },
  settings: {
    get: () => invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (data) => invoke(IPC_CHANNELS.SETTINGS_UPDATE, data)
  },
  backups: {
    create: (destinationDir) => invoke(IPC_CHANNELS.BACKUPS_CREATE, { destinationDir }),
    list: () => invoke(IPC_CHANNELS.BACKUPS_LIST),
    verify: (backupPath) => invoke(IPC_CHANNELS.BACKUPS_VERIFY, { backupPath }),
    restore: (backupPath, confirmPassword) => invoke(IPC_CHANNELS.BACKUPS_RESTORE, { backupPath, confirmPassword })
  },
  media: {
    uploadPhoto: (sourcePath, entityType, entityId) => invoke(IPC_CHANNELS.MEDIA_UPLOAD_PHOTO, { sourcePath, entityType, entityId })
  },
  app: {
    getVersion: () => invoke(IPC_CHANNELS.APP_GET_VERSION),
    getPaths: () => invoke(IPC_CHANNELS.APP_GET_PATHS),
    openBackupDialog: () => invoke(IPC_CHANNELS.APP_OPEN_BACKUP_DIALOG),
    openSaveDialog: () => invoke(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG),
    print: () => invoke(IPC_CHANNELS.APP_PRINT),
    printToPdf: (opts) => invoke(IPC_CHANNELS.APP_PRINT_TO_PDF, opts)
  }
};
electron.contextBridge.exposeInMainWorld("schoolApp", api);
