import { app, ipcMain, dialog, BrowserWindow, session } from "electron";
import log from "electron-log";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer, index, uniqueIndex, real } from "drizzle-orm/sqlite-core";
import { sql, eq, or, like, and, desc, count } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { hash, verify } from "@node-rs/argon2";
import crypto from "node:crypto";
import archiver from "archiver";
import extract from "extract-zip";
import { fileURLToPath } from "node:url";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const administrators = sqliteTable("administrators", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["superadmin", "admin"] }).notNull().default("admin"),
  preferredLanguage: text("preferred_language", { enum: ["ar", "fr", "en"] }).notNull().default("ar"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
});
const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentNumber: text("student_number").notNull().unique(),
  firstNameAr: text("first_name_ar").notNull(),
  lastNameAr: text("last_name_ar").notNull(),
  firstNameFr: text("first_name_fr").notNull(),
  lastNameFr: text("last_name_fr").notNull(),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  phone: text("phone"),
  guardianName: text("guardian_name"),
  guardianRelationship: text("guardian_relationship"),
  guardianPhone: text("guardian_phone"),
  secondaryPhone: text("secondary_phone"),
  address: text("address"),
  photoPath: text("photo_path"),
  registrationDate: text("registration_date").notNull().default(sql`(date('now'))`),
  status: text("status", { enum: ["active", "inactive", "archived"] }).notNull().default("active"),
  qrToken: text("qr_token").notNull().unique(),
  qrTokenActive: integer("qr_token_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  archivedAt: text("archived_at")
}, (table) => ({
  studentNumberIdx: uniqueIndex("idx_students_number").on(table.studentNumber),
  qrTokenIdx: uniqueIndex("idx_students_qr").on(table.qrToken),
  nameArIdx: index("idx_students_name_ar").on(table.lastNameAr),
  nameFrIdx: index("idx_students_name_fr").on(table.lastNameFr),
  statusIdx: index("idx_students_status").on(table.status)
}));
const teachers = sqliteTable("teachers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  photoPath: text("photo_path"),
  status: text("status", { enum: ["active", "inactive", "archived"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  archivedAt: text("archived_at")
}, (table) => ({
  nameIdx: index("idx_teachers_name").on(table.lastName),
  statusIdx: index("idx_teachers_status").on(table.status)
}));
const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameAr: text("name_ar").notNull(),
  nameFr: text("name_fr").notNull(),
  nameEn: text("name_en").notNull().default(""),
  descriptionAr: text("description_ar"),
  descriptionFr: text("description_fr"),
  descriptionEn: text("description_en"),
  defaultPrice: real("default_price").notNull().default(0),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
});
const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull().references(() => courses.id),
  teacherId: integer("teacher_id").notNull().references(() => teachers.id),
  name: text("name").notNull(),
  room: text("room"),
  scheduleJson: text("schedule_json"),
  capacity: integer("capacity").notNull().default(30),
  monthlyPrice: real("monthly_price").notNull().default(0),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  status: text("status", { enum: ["active", "inactive", "completed"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
}, (table) => ({
  courseIdx: index("idx_groups_course").on(table.courseId),
  teacherIdx: index("idx_groups_teacher").on(table.teacherId),
  statusIdx: index("idx_groups_status").on(table.status)
}));
const enrollments = sqliteTable("enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  groupId: integer("group_id").notNull().references(() => groups.id),
  agreedPrice: real("agreed_price").notNull(),
  enrollmentDate: text("enrollment_date").notNull().default(sql`(date('now'))`),
  status: text("status", { enum: ["active", "inactive", "completed"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
}, (table) => ({
  studentGroupIdx: uniqueIndex("idx_enrollments_student_group").on(table.studentId, table.groupId),
  studentIdx: index("idx_enrollments_student").on(table.studentId),
  groupIdx: index("idx_enrollments_group").on(table.groupId)
}));
const attendanceSessions = sqliteTable("attendance_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  sessionDate: text("session_date").notNull(),
  plannedStartTime: text("planned_start_time"),
  actualStartTime: text("actual_start_time"),
  endTime: text("end_time"),
  lateThresholdMinutes: integer("late_threshold_minutes").notNull().default(10),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  createdBy: integer("created_by").notNull().references(() => administrators.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
}, (table) => ({
  groupDateIdx: index("idx_sessions_group_date").on(table.groupId, table.sessionDate),
  dateIdx: index("idx_sessions_date").on(table.sessionDate)
}));
const attendanceRecords = sqliteTable("attendance_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => attendanceSessions.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  scannedAt: text("scanned_at"),
  attendanceStatus: text("attendance_status", { enum: ["present", "absent", "late"] }).notNull(),
  source: text("source", { enum: ["qr", "manual"] }).notNull().default("qr"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => administrators.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
}, (table) => ({
  // Critical: prevents duplicate attendance in same session
  uniqueSessionStudent: uniqueIndex("idx_attendance_session_student").on(table.sessionId, table.studentId),
  sessionIdx: index("idx_attendance_session").on(table.sessionId),
  studentIdx: index("idx_attendance_student").on(table.studentId)
}));
const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receiptNumber: text("receipt_number").notNull().unique(),
  studentId: integer("student_id").notNull().references(() => students.id),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id),
  billingPeriod: text("billing_period").notNull(),
  // YYYY-MM
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "transfer", "check"] }).notNull(),
  paymentDate: text("payment_date").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  receivedBy: integer("received_by").notNull().references(() => administrators.id),
  status: text("status", { enum: ["paid", "cancelled"] }).notNull().default("paid"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
}, (table) => ({
  receiptIdx: uniqueIndex("idx_payments_receipt").on(table.receiptNumber),
  studentIdx: index("idx_payments_student").on(table.studentId),
  dateIdx: index("idx_payments_date").on(table.paymentDate),
  periodIdx: index("idx_payments_period").on(table.billingPeriod)
}));
const schoolSettings = sqliteTable("school_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolNameAr: text("school_name_ar").notNull().default(""),
  schoolNameFr: text("school_name_fr").notNull().default(""),
  schoolNameEn: text("school_name_en").notNull().default(""),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  academicYear: text("academic_year").notNull().default("2025-2026"),
  currency: text("currency").notNull().default("DZD"),
  studentNumberPrefix: text("student_number_prefix").notNull().default("ETU"),
  receiptPrefix: text("receipt_prefix").notNull().default("REC"),
  defaultLanguage: text("default_language", { enum: ["ar", "fr", "en"] }).notNull().default("ar"),
  backupDirectory: text("backup_directory"),
  automaticBackupEnabled: integer("automatic_backup_enabled", { mode: "boolean" }).notNull().default(false),
  backupsToRetain: integer("backups_to_retain").notNull().default(30),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
});
const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  administratorId: integer("administrator_id").references(() => administrators.id),
  action: text("action").notNull(),
  // e.g. 'student.archive', 'payment.create'
  entityType: text("entity_type"),
  // e.g. 'student', 'payment'
  entityId: integer("entity_id"),
  sanitizedDetailsJson: text("sanitized_details_json"),
  // NO passwords or sensitive data
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
}, (table) => ({
  adminIdx: index("idx_audit_admin").on(table.administratorId),
  actionIdx: index("idx_audit_action").on(table.action),
  entityIdx: index("idx_audit_entity").on(table.entityType, table.entityId)
}));
const appMetadata = sqliteTable("app_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  administrators,
  appMetadata,
  attendanceRecords,
  attendanceSessions,
  auditLogs,
  courses,
  enrollments,
  groups,
  payments,
  schoolSettings,
  students,
  teachers
}, Symbol.toStringTag, { value: "Module" }));
const DB_FILENAME = "school-management.sqlite";
const STUDENTS_PHOTO_DIR = "media/students";
const TEACHERS_PHOTO_DIR = "media/teachers";
const BACKUP_DIR_DEFAULT = "backups";
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const QR_TOKEN_PREFIX = "STD-";
const QR_TOKEN_BYTES = 24;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const DEFAULT_STUDENT_NUMBER_PREFIX = "ETU";
const DEFAULT_RECEIPT_PREFIX = "REC";
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
let _db = null;
let _sqlite = null;
function getDatabasePath() {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, DB_FILENAME);
}
async function initializeDatabase() {
  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  log.info("Opening database at:", dbPath);
  _sqlite = new Database(dbPath, {
    // verbose: process.env.NODE_ENV === 'development' ? log.debug : undefined,
  });
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("busy_timeout = 5000");
  _sqlite.pragma("synchronous = NORMAL");
  _sqlite.pragma("cache_size = -8000");
  _sqlite.pragma("temp_store = MEMORY");
  _db = drizzle(_sqlite, { schema });
  log.info("Database connection established");
}
function getDb() {
  if (!_db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return _db;
}
function getSqlite() {
  if (!_sqlite) {
    throw new Error("SQLite not initialized. Call initializeDatabase() first.");
  }
  return _sqlite;
}
function closeDatabase() {
  try {
    _sqlite?.close();
    _sqlite = null;
    _db = null;
    log.info("Database connection closed");
  } catch (err) {
    log.error("Error closing database:", err);
  }
}
function getDatabasePath_() {
  return getDatabasePath();
}
const connection = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  closeDatabase,
  getDatabasePath_,
  getDb,
  getSqlite,
  initializeDatabase,
  schema
}, Symbol.toStringTag, { value: "Module" }));
const MIGRATIONS = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS app_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS administrators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('superadmin', 'admin')),
        preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK(preferred_language IN ('ar', 'fr', 'en')),
        is_active INTEGER NOT NULL DEFAULT 1,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS school_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_name_ar TEXT NOT NULL DEFAULT '',
        school_name_fr TEXT NOT NULL DEFAULT '',
        school_name_en TEXT NOT NULL DEFAULT '',
        phone TEXT,
        email TEXT,
        address TEXT,
        academic_year TEXT NOT NULL DEFAULT '2025-2026',
        currency TEXT NOT NULL DEFAULT 'DZD',
        student_number_prefix TEXT NOT NULL DEFAULT 'ETU',
        receipt_prefix TEXT NOT NULL DEFAULT 'REC',
        default_language TEXT NOT NULL DEFAULT 'ar',
        backup_directory TEXT,
        automatic_backup_enabled INTEGER NOT NULL DEFAULT 0,
        backups_to_retain INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_number TEXT NOT NULL UNIQUE,
        first_name_ar TEXT NOT NULL,
        last_name_ar TEXT NOT NULL,
        first_name_fr TEXT NOT NULL,
        last_name_fr TEXT NOT NULL,
        date_of_birth TEXT,
        gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
        phone TEXT,
        guardian_name TEXT,
        guardian_relationship TEXT,
        guardian_phone TEXT,
        secondary_phone TEXT,
        address TEXT,
        photo_path TEXT,
        registration_date TEXT NOT NULL DEFAULT (date('now')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
        qr_token TEXT NOT NULL UNIQUE,
        qr_token_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        archived_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_students_number ON students(student_number);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_students_qr ON students(qr_token);
      CREATE INDEX IF NOT EXISTS idx_students_name_ar ON students(last_name_ar);
      CREATE INDEX IF NOT EXISTS idx_students_name_fr ON students(last_name_fr);
      CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

      CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        photo_path TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        archived_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_teachers_name ON teachers(last_name);
      CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);

      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_fr TEXT NOT NULL,
        name_en TEXT NOT NULL DEFAULT '',
        description_ar TEXT,
        description_fr TEXT,
        description_en TEXT,
        default_price REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL REFERENCES courses(id),
        teacher_id INTEGER NOT NULL REFERENCES teachers(id),
        name TEXT NOT NULL,
        room TEXT,
        schedule_json TEXT,
        capacity INTEGER NOT NULL DEFAULT 30,
        monthly_price REAL NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'completed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_groups_course ON groups(course_id);
      CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);

      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id),
        group_id INTEGER NOT NULL REFERENCES groups(id),
        agreed_price REAL NOT NULL,
        enrollment_date TEXT NOT NULL DEFAULT (date('now')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'completed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(student_id, group_id)
      );

      CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_group ON enrollments(group_id);

      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id),
        session_date TEXT NOT NULL,
        planned_start_time TEXT,
        actual_start_time TEXT,
        end_time TEXT,
        late_threshold_minutes INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
        created_by INTEGER NOT NULL REFERENCES administrators(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_group_date ON attendance_sessions(group_id, session_date);
      CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions(session_date);

      CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES attendance_sessions(id),
        student_id INTEGER NOT NULL REFERENCES students(id),
        scanned_at TEXT,
        attendance_status TEXT NOT NULL CHECK(attendance_status IN ('present', 'absent', 'late')),
        source TEXT NOT NULL DEFAULT 'qr' CHECK(source IN ('qr', 'manual')),
        notes TEXT,
        created_by INTEGER REFERENCES administrators(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(session_id, student_id)
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        student_id INTEGER NOT NULL REFERENCES students(id),
        enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
        billing_period TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount >= 0),
        payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'check')),
        payment_date TEXT NOT NULL,
        reference TEXT,
        notes TEXT,
        received_by INTEGER NOT NULL REFERENCES administrators(id),
        status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid', 'cancelled')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_number);
      CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
      CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(billing_period);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        administrator_id INTEGER REFERENCES administrators(id),
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        sanitized_details_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(administrator_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

      -- Seed: mark schema version
      INSERT OR IGNORE INTO app_metadata(key, value) VALUES('schema_version', '1');
      INSERT OR IGNORE INTO app_metadata(key, value) VALUES('first_run', 'true');
    `
  }
];
async function runMigrations() {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const getVersion = sqlite.prepare(
    `SELECT value FROM app_metadata WHERE key = 'schema_version' LIMIT 1`
  );
  const row = getVersion.get();
  const currentVersion = row ? parseInt(row.value, 10) : 0;
  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pendingMigrations.length === 0) {
    log.info(`Database schema is up to date (version ${currentVersion})`);
    return;
  }
  log.info(`Running ${pendingMigrations.length} migration(s) from version ${currentVersion}`);
  for (const migration of pendingMigrations) {
    log.info(`Applying migration ${migration.version}: ${migration.name}`);
    if (currentVersion > 0) {
      await backupBeforeMigration(migration.version);
    }
    const applyMigration = sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      sqlite.prepare(
        `INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('schema_version', ?, datetime('now'))`
      ).run(String(migration.version));
    });
    try {
      applyMigration();
      log.info(`Migration ${migration.version} applied successfully`);
    } catch (err) {
      log.error(`Migration ${migration.version} failed:`, err);
      throw err;
    }
  }
  log.info(`Migrations complete. Schema now at version ${pendingMigrations[pendingMigrations.length - 1]?.version}`);
}
async function backupBeforeMigration(migrationVersion) {
  try {
    const dbPath = getDatabasePath_();
    const backupDir = path.join(app.getPath("userData"), "backups", "pre-migration");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = path.join(backupDir, `pre-migration-v${migrationVersion}-${timestamp}.sqlite`);
    fs.copyFileSync(dbPath, backupPath);
    log.info("Pre-migration backup created:", backupPath);
  } catch (err) {
    log.warn("Could not create pre-migration backup:", err);
  }
}
function isFirstRun() {
  try {
    const sqlite = getSqlite();
    const adminCount = sqlite.prepare(
      `SELECT COUNT(*) as count FROM administrators WHERE is_active = 1`
    ).get();
    if (!adminCount || adminCount.count === 0) {
      return true;
    }
    const row = sqlite.prepare(
      `SELECT value FROM app_metadata WHERE key = 'first_run' LIMIT 1`
    ).get();
    return row?.value === "true";
  } catch {
    return true;
  }
}
function markSetupComplete() {
  const sqlite = getSqlite();
  sqlite.prepare(
    `INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('first_run', 'false', datetime('now'))`
  ).run();
}
const ErrorCode = {
  // Auth
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  WRONG_PASSWORD: "WRONG_PASSWORD",
  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_REQUIRED: "MISSING_REQUIRED",
  // Students
  STUDENT_NOT_FOUND: "STUDENT_NOT_FOUND",
  STUDENT_NUMBER_EXISTS: "STUDENT_NUMBER_EXISTS",
  QR_TOKEN_EXISTS: "QR_TOKEN_EXISTS",
  STUDENT_ALREADY_ENROLLED: "STUDENT_ALREADY_ENROLLED",
  // Attendance
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_CLOSED: "SESSION_CLOSED",
  ALREADY_SCANNED: "ALREADY_SCANNED",
  UNKNOWN_CARD: "UNKNOWN_CARD",
  DISABLED_CARD: "DISABLED_CARD",
  STUDENT_INACTIVE: "STUDENT_INACTIVE",
  NOT_ENROLLED: "NOT_ENROLLED",
  // Payments
  PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
  PAYMENT_ALREADY_CANCELLED: "PAYMENT_ALREADY_CANCELLED",
  NEGATIVE_AMOUNT: "NEGATIVE_AMOUNT",
  // Backup
  BACKUP_FAILED: "BACKUP_FAILED",
  BACKUP_NOT_FOUND: "BACKUP_NOT_FOUND",
  BACKUP_INVALID: "BACKUP_INVALID",
  BACKUP_CORRUPTED: "BACKUP_CORRUPTED",
  RESTORE_FAILED: "RESTORE_FAILED",
  // Media
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  PATH_TRAVERSAL: "PATH_TRAVERSAL",
  // Database
  DB_ERROR: "DB_ERROR",
  UNIQUE_CONSTRAINT: "UNIQUE_CONSTRAINT",
  FOREIGN_KEY: "FOREIGN_KEY",
  // General
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  FIRST_RUN_REQUIRED: "FIRST_RUN_REQUIRED"
};
class AppError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "AppError";
  }
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      const data = await fn(payload);
      return { success: true, data };
    } catch (err) {
      if (err instanceof AppError) {
        return { success: false, error: err.message, code: err.code };
      }
      log.error(`IPC error on channel [${channel}]:`, err);
      return {
        success: false,
        error: "An internal error occurred. Please try again.",
        code: "INTERNAL_ERROR"
      };
    }
  });
}
const LoginSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(200)
});
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200)
});
const SetupSchema = z.object({
  schoolNameAr: z.string().min(1).max(200).trim(),
  schoolNameFr: z.string().min(1).max(200).trim(),
  schoolNameEn: z.string().min(1).max(200).trim().optional(),
  phone: z.string().max(30).trim().optional(),
  email: z.string().email().max(200).trim().optional().or(z.literal("")),
  address: z.string().max(500).trim().optional(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).default("2025-2026"),
  adminFullName: z.string().min(1).max(200).trim(),
  adminUsername: z.string().min(3).max(50).trim().regex(/^[a-zA-Z0-9_]+$/),
  adminPassword: z.string().min(8).max(200),
  preferredLanguage: z.enum(["ar", "fr", "en"]).default("ar")
});
const CreateStudentSchema = z.object({
  firstNameAr: z.string().min(1).max(100).trim(),
  lastNameAr: z.string().min(1).max(100).trim(),
  firstNameFr: z.string().min(1).max(100).trim(),
  lastNameFr: z.string().min(1).max(100).trim(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  gender: z.enum(["male", "female"]),
  phone: z.string().max(30).trim().optional().nullable(),
  guardianName: z.string().max(200).trim().optional().nullable(),
  guardianRelationship: z.string().max(100).trim().optional().nullable(),
  guardianPhone: z.string().max(30).trim().optional().nullable(),
  secondaryPhone: z.string().max(30).trim().optional().nullable(),
  address: z.string().max(500).trim().optional().nullable(),
  photoPath: z.string().max(500).optional().nullable()
});
const UpdateStudentSchema = CreateStudentSchema.partial().extend({
  id: z.number().int().positive()
});
const StudentIdSchema = z.object({
  id: z.number().int().positive()
});
const StudentListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  search: z.string().max(200).trim().optional(),
  status: z.enum(["active", "inactive", "archived", "all"]).default("active")
});
const CreateTeacherSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().max(30).trim().optional().nullable(),
  email: z.string().email().max(200).trim().optional().nullable().or(z.literal("")),
  address: z.string().max(500).trim().optional().nullable()
});
const UpdateTeacherSchema = CreateTeacherSchema.partial().extend({
  id: z.number().int().positive()
});
const CreateCourseSchema = z.object({
  nameAr: z.string().min(1).max(200).trim(),
  nameFr: z.string().min(1).max(200).trim(),
  nameEn: z.string().max(200).trim().optional().default(""),
  descriptionAr: z.string().max(1e3).trim().optional().nullable(),
  descriptionFr: z.string().max(1e3).trim().optional().nullable(),
  descriptionEn: z.string().max(1e3).trim().optional().nullable(),
  defaultPrice: z.number().min(0).max(1e6)
});
const UpdateCourseSchema = CreateCourseSchema.partial().extend({
  id: z.number().int().positive()
});
const CreateGroupSchema = z.object({
  courseId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
  name: z.string().min(1).max(200).trim(),
  room: z.string().max(100).trim().optional().nullable(),
  scheduleJson: z.string().max(2e3).optional().nullable(),
  capacity: z.number().int().min(1).max(500),
  monthlyPrice: z.number().min(0).max(1e6),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
});
const UpdateGroupSchema = CreateGroupSchema.partial().extend({
  id: z.number().int().positive()
});
const CreateEnrollmentSchema = z.object({
  studentId: z.number().int().positive(),
  groupId: z.number().int().positive(),
  agreedPrice: z.number().min(0).max(1e6),
  enrollmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
const StartSessionSchema = z.object({
  groupId: z.number().int().positive(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  lateThresholdMinutes: z.number().int().min(0).max(120).default(10)
});
const ScanQRSchema = z.object({
  sessionId: z.number().int().positive(),
  token: z.string().min(1).max(200).trim()
});
const ManualAttendanceSchema = z.object({
  sessionId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  attendanceStatus: z.enum(["present", "absent", "late"]),
  notes: z.string().max(500).trim().optional().nullable()
});
z.object({
  sessionId: z.number().int().positive()
});
const CreatePaymentSchema = z.object({
  studentId: z.number().int().positive(),
  enrollmentId: z.number().int().positive(),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0).max(1e7),
  paymentMethod: z.enum(["cash", "transfer", "check"]),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().max(200).trim().optional().nullable(),
  notes: z.string().max(500).trim().optional().nullable()
});
const CancelPaymentSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().max(500).trim().optional().nullable()
});
const UpdateSettingsSchema = z.object({
  schoolNameAr: z.string().min(1).max(200).trim().optional(),
  schoolNameFr: z.string().min(1).max(200).trim().optional(),
  schoolNameEn: z.string().max(200).trim().optional(),
  phone: z.string().max(30).trim().optional().nullable(),
  email: z.string().email().max(200).trim().optional().nullable().or(z.literal("")),
  address: z.string().max(500).trim().optional().nullable(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  currency: z.string().max(10).optional(),
  defaultLanguage: z.enum(["ar", "fr", "en"]).optional(),
  backupDirectory: z.string().max(500).optional().nullable(),
  automaticBackupEnabled: z.boolean().optional(),
  backupsToRetain: z.number().int().min(1).max(365).optional()
});
const UploadPhotoSchema = z.object({
  sourcePath: z.string().min(1).max(1e3),
  entityType: z.enum(["student", "teacher"]),
  entityId: z.number().int().positive()
});
const RestoreBackupSchema = z.object({
  backupPath: z.string().min(1).max(1e3),
  confirmPassword: z.string().min(1).max(200)
});
z.object({
  type: z.enum(["attendance", "payments", "students", "revenue"]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional()
});
const ARGON2_OPTIONS = {
  memoryCost: 65536,
  // 64 MB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32
};
let _currentSession = null;
function getCurrentSession() {
  return _currentSession;
}
function clearSession() {
  _currentSession = null;
}
function requireSession() {
  if (!_currentSession) {
    throw new AppError(ErrorCode.NOT_AUTHENTICATED, "No active session");
  }
  return _currentSession;
}
async function hashPassword(password) {
  return hash(password, ARGON2_OPTIONS);
}
async function verifyPassword(hash_, password) {
  try {
    return await verify(hash_, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
async function login(username, password) {
  const db = getDb();
  const admin = await db.query.administrators.findFirst({
    where: eq(administrators.username, username)
  });
  if (!admin || !admin.isActive) {
    await hashPassword("dummy-to-prevent-timing");
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials");
  }
  if (admin.lockedUntil) {
    const lockedUntil = new Date(admin.lockedUntil);
    if (lockedUntil > /* @__PURE__ */ new Date()) {
      const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 6e4);
      throw new AppError(
        ErrorCode.ACCOUNT_LOCKED,
        `Account locked for ${minutesLeft} more minute(s)`
      );
    }
  }
  const passwordOk = await verifyPassword(admin.passwordHash, password);
  if (!passwordOk) {
    const newAttempts = admin.failedLoginAttempts + 1;
    let lockedUntil = null;
    if (newAttempts >= MAX_FAILED_LOGINS) {
      const lockTime = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1e3);
      lockedUntil = lockTime.toISOString();
      log.warn(`Account '${username}' locked until ${lockedUntil} after ${newAttempts} failed attempts`);
    }
    await db.update(administrators).set({
      failedLoginAttempts: newAttempts,
      lockedUntil,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).where(eq(administrators.id, admin.id));
    await auditLogin(admin.id, false);
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.update(administrators).set({
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: now,
    updatedAt: now
  }).where(eq(administrators.id, admin.id));
  const session2 = {
    adminId: admin.id,
    username: admin.username,
    fullName: admin.fullName,
    role: admin.role,
    preferredLanguage: admin.preferredLanguage,
    loggedInAt: now
  };
  _currentSession = session2;
  await auditLogin(admin.id, true);
  log.info(`Admin '${username}' logged in successfully`);
  return session2;
}
async function logout() {
  if (_currentSession) {
    log.info(`Admin '${_currentSession.username}' logged out`);
    _currentSession = null;
  }
}
async function changePassword(currentPassword, newPassword) {
  const session2 = requireSession();
  const db = getDb();
  const admin = await db.query.administrators.findFirst({
    where: eq(administrators.id, session2.adminId)
  });
  if (!admin) {
    throw new AppError(ErrorCode.NOT_FOUND, "Administrator not found");
  }
  const ok = await verifyPassword(admin.passwordHash, currentPassword);
  if (!ok) {
    throw new AppError(ErrorCode.WRONG_PASSWORD, "Current password is incorrect");
  }
  const newHash = await hashPassword(newPassword);
  await db.update(administrators).set({ passwordHash: newHash, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(administrators.id, session2.adminId));
  log.info(`Admin '${session2.username}' changed password`);
  await writeAudit(session2.adminId, "admin.changePassword", "administrator", session2.adminId, {});
}
async function auditLogin(adminId, success) {
  await writeAudit(adminId, success ? "auth.login" : "auth.failedLogin", "administrator", adminId, {
    success
  });
}
async function writeAudit(adminId, action, entityType, entityId, details) {
  try {
    const db = getDb();
    await db.insert(auditLogs).values({
      administratorId: adminId,
      action,
      entityType,
      entityId,
      sanitizedDetailsJson: JSON.stringify(details)
    });
  } catch (err) {
    log.warn("Failed to write audit log:", err);
  }
}
const auth_service = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  changePassword,
  clearSession,
  getCurrentSession,
  hashPassword,
  login,
  logout,
  requireSession,
  verifyPassword
}, Symbol.toStringTag, { value: "Module" }));
function mapRow$2(r) {
  return {
    id: r.id,
    schoolNameAr: r.schoolNameAr,
    schoolNameFr: r.schoolNameFr,
    schoolNameEn: r.schoolNameEn,
    phone: r.phone ?? null,
    email: r.email ?? null,
    address: r.address ?? null,
    academicYear: r.academicYear,
    currency: r.currency,
    studentNumberPrefix: r.studentNumberPrefix,
    receiptPrefix: r.receiptPrefix,
    defaultLanguage: r.defaultLanguage,
    backupDirectory: r.backupDirectory ?? null,
    automaticBackupEnabled: r.automaticBackupEnabled,
    backupsToRetain: r.backupsToRetain,
    updatedAt: r.updatedAt
  };
}
async function getSettings() {
  const db = getDb();
  const row = await db.query.schoolSettings.findFirst();
  return row ? mapRow$2(row) : null;
}
async function updateSettings(data) {
  requireSession();
  const db = getDb();
  const existing = await db.query.schoolSettings.findFirst();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (existing) {
    const result = await db.update(schoolSettings).set({ ...data, updatedAt: now }).where(eq(schoolSettings.id, existing.id)).returning();
    return mapRow$2(result[0]);
  } else {
    const result = await db.insert(schoolSettings).values({
      schoolNameAr: data.schoolNameAr ?? "",
      schoolNameFr: data.schoolNameFr ?? "",
      schoolNameEn: data.schoolNameEn ?? "",
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      academicYear: data.academicYear ?? "2025-2026",
      currency: data.currency ?? "DZD",
      defaultLanguage: data.defaultLanguage ?? "ar",
      backupDirectory: data.backupDirectory ?? null,
      automaticBackupEnabled: data.automaticBackupEnabled ?? false,
      backupsToRetain: data.backupsToRetain ?? 30,
      updatedAt: now
    }).returning();
    return mapRow$2(result[0]);
  }
}
function registerAuthHandlers() {
  handle(IPC_CHANNELS.AUTH_LOGIN, async (payload) => {
    const { username, password } = LoginSchema.parse(payload);
    return login(username, password);
  });
  handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    await logout();
    return true;
  });
  handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (payload) => {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(payload);
    await changePassword(currentPassword, newPassword);
    return true;
  });
  handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    return getCurrentSession();
  });
  handle(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN, async () => {
    return { firstRun: isFirstRun() };
  });
  handle(IPC_CHANNELS.AUTH_COMPLETE_SETUP, async (payload) => {
    const data = SetupSchema.parse(payload);
    if (!isFirstRun()) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Setup already completed");
    }
    const db = getDb();
    const passwordHash = await hashPassword(data.adminPassword);
    const existingAdmin = await db.query.administrators.findFirst({
      where: eq(administrators.username, data.adminUsername)
    });
    if (existingAdmin) {
      await db.update(administrators).set({
        passwordHash,
        fullName: data.adminFullName,
        role: "superadmin",
        preferredLanguage: data.preferredLanguage,
        isActive: true,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).where(eq(administrators.id, existingAdmin.id));
    } else {
      try {
        await db.insert(administrators).values({
          username: data.adminUsername,
          passwordHash,
          fullName: data.adminFullName,
          role: "superadmin",
          preferredLanguage: data.preferredLanguage,
          isActive: true
        });
      } catch (err) {
        if (err instanceof Database.SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
          const duplicateAdmin = await db.query.administrators.findFirst({
            where: eq(administrators.username, data.adminUsername)
          });
          if (duplicateAdmin) {
            await db.update(administrators).set({
              passwordHash,
              fullName: data.adminFullName,
              role: "superadmin",
              preferredLanguage: data.preferredLanguage,
              isActive: true,
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }).where(eq(administrators.id, duplicateAdmin.id));
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
    const session2 = await login(data.adminUsername, data.adminPassword);
    await updateSettings({
      schoolNameAr: data.schoolNameAr,
      schoolNameFr: data.schoolNameFr,
      schoolNameEn: data.schoolNameEn ?? "",
      phone: data.phone ?? null,
      email: data.email || null,
      address: data.address ?? null,
      academicYear: data.academicYear,
      defaultLanguage: data.preferredLanguage
    });
    markSetupComplete();
    return session2;
  });
}
function generateQRToken() {
  const random = crypto.randomBytes(QR_TOKEN_BYTES).toString("hex");
  return `${QR_TOKEN_PREFIX}${random}`;
}
async function generateStudentNumber(prefix) {
  const db = getDb();
  const result = await db.select({ count: count() }).from(students);
  const total = result[0]?.count ?? 0;
  const num = String(total + 1).padStart(4, "0");
  return `${prefix}-${num}`;
}
function mapRow$1(row) {
  return {
    id: row.id,
    studentNumber: row.studentNumber,
    firstNameAr: row.firstNameAr,
    lastNameAr: row.lastNameAr,
    firstNameFr: row.firstNameFr,
    lastNameFr: row.lastNameFr,
    dateOfBirth: row.dateOfBirth ?? null,
    gender: row.gender,
    phone: row.phone ?? null,
    guardianName: row.guardianName ?? null,
    guardianRelationship: row.guardianRelationship ?? null,
    guardianPhone: row.guardianPhone ?? null,
    secondaryPhone: row.secondaryPhone ?? null,
    address: row.address ?? null,
    photoPath: row.photoPath ?? null,
    registrationDate: row.registrationDate,
    status: row.status,
    qrToken: row.qrToken,
    qrTokenActive: row.qrTokenActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
async function listStudents(opts) {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const conditions = [];
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(students.status, opts.status));
  }
  if (opts.search && opts.search.length > 0) {
    const q = `%${opts.search}%`;
    conditions.push(
      or(
        like(students.firstNameAr, q),
        like(students.lastNameAr, q),
        like(students.firstNameFr, q),
        like(students.lastNameFr, q),
        like(students.studentNumber, q),
        like(students.phone, q)
      )
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : void 0;
  const [rows, totalResult] = await Promise.all([
    db.select().from(students).where(whereClause).orderBy(desc(students.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: count() }).from(students).where(whereClause)
  ]);
  return {
    items: rows.map(mapRow$1),
    total: totalResult[0]?.count ?? 0,
    page,
    pageSize
  };
}
async function getStudentById(id) {
  const db = getDb();
  const row = await db.query.students.findFirst({
    where: eq(students.id, id)
  });
  if (!row) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`);
  return mapRow$1(row);
}
async function createStudent(data) {
  requireSession();
  const db = getDb();
  const settings = await db.query.schoolSettings.findFirst();
  const prefix = settings?.studentNumberPrefix ?? DEFAULT_STUDENT_NUMBER_PREFIX;
  const studentNumber = await generateStudentNumber(prefix);
  const qrToken = generateQRToken();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await db.insert(students).values({
    studentNumber,
    firstNameAr: data.firstNameAr,
    lastNameAr: data.lastNameAr,
    firstNameFr: data.firstNameFr,
    lastNameFr: data.lastNameFr,
    dateOfBirth: data.dateOfBirth ?? null,
    gender: data.gender,
    phone: data.phone ?? null,
    guardianName: data.guardianName ?? null,
    guardianRelationship: data.guardianRelationship ?? null,
    guardianPhone: data.guardianPhone ?? null,
    secondaryPhone: data.secondaryPhone ?? null,
    address: data.address ?? null,
    photoPath: data.photoPath ?? null,
    registrationDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    qrToken,
    updatedAt: now
  }).returning();
  const row = result[0];
  if (!row) throw new AppError(ErrorCode.DB_ERROR, "Failed to create student");
  log.info(`Student created: ${studentNumber}`);
  return mapRow$1(row);
}
async function updateStudent(id, data) {
  requireSession();
  const db = getDb();
  const existing = await db.query.students.findFirst({ where: eq(students.id, id) });
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`);
  const result = await db.update(students).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(students.id, id)).returning();
  return mapRow$1(result[0]);
}
async function archiveStudent(id) {
  const session2 = requireSession();
  const db = getDb();
  const existing = await db.query.students.findFirst({ where: eq(students.id, id) });
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.update(students).set({
    status: "archived",
    qrTokenActive: false,
    archivedAt: now,
    updatedAt: now
  }).where(eq(students.id, id));
  await db.insert(auditLogs).values({
    administratorId: session2.adminId,
    action: "student.archive",
    entityType: "student",
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ studentNumber: existing.studentNumber })
  });
}
async function regenerateQRToken(id) {
  const session2 = requireSession();
  const db = getDb();
  const existing = await db.query.students.findFirst({ where: eq(students.id, id) });
  if (!existing) throw new AppError(ErrorCode.STUDENT_NOT_FOUND, `Student ${id} not found`);
  const newToken = generateQRToken();
  await db.update(students).set({
    qrToken: newToken,
    qrTokenActive: true,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).where(eq(students.id, id));
  await db.insert(auditLogs).values({
    administratorId: session2.adminId,
    action: "student.regenQR",
    entityType: "student",
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ studentNumber: existing.studentNumber })
  });
  log.info(`QR token regenerated for student ${id}`);
  return newToken;
}
function getSafeMediaDir(entityType) {
  const userData = app.getPath("userData");
  const subdir = entityType === "student" ? STUDENTS_PHOTO_DIR : TEACHERS_PHOTO_DIR;
  const dir = path.join(userData, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
async function uploadPhoto(sourcePath, entityType, entityId) {
  requireSession();
  const ext = path.extname(sourcePath).toLowerCase();
  if (!ALLOWED_PHOTO_EXTENSIONS.includes(ext)) {
    throw new AppError(ErrorCode.INVALID_FILE_TYPE, `File type not allowed. Use: ${ALLOWED_PHOTO_EXTENSIONS.join(", ")}`);
  }
  if (!fs.existsSync(sourcePath)) {
    throw new AppError(ErrorCode.FILE_NOT_FOUND, "Source file not found");
  }
  const stat = fs.statSync(sourcePath);
  if (stat.size > MAX_PHOTO_SIZE_BYTES) {
    throw new AppError(ErrorCode.FILE_TOO_LARGE, `File too large. Maximum size is ${MAX_PHOTO_SIZE_BYTES / 1024 / 1024}MB`);
  }
  const safeFilename = `${entityType}-${entityId}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const mediaDir = getSafeMediaDir(entityType);
  const destPath = path.join(mediaDir, safeFilename);
  fs.copyFileSync(sourcePath, destPath);
  log.info(`Photo uploaded: ${safeFilename} for ${entityType} ${entityId}`);
  return safeFilename;
}
function getPhotoLocalPath(filename, entityType) {
  if (!filename) return null;
  const basename = path.basename(filename);
  if (basename !== filename) {
    log.warn("Path traversal attempt in getPhotoLocalPath:", filename);
    return null;
  }
  const mediaDir = getSafeMediaDir(entityType);
  const fullPath = path.join(mediaDir, basename);
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}
function getPhotoAsDataUrl(filename, entityType) {
  const fullPath = getPhotoLocalPath(filename, entityType);
  if (!fullPath) return null;
  try {
    const buf = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
function registerStudentHandlers() {
  handle(IPC_CHANNELS.STUDENTS_LIST, async (payload) => {
    const opts = StudentListSchema.parse(payload ?? {});
    return listStudents(opts);
  });
  handle(IPC_CHANNELS.STUDENTS_GET, async (payload) => {
    const { id } = StudentIdSchema.parse(payload);
    return getStudentById(id);
  });
  handle(IPC_CHANNELS.STUDENTS_CREATE, async (payload) => {
    const data = CreateStudentSchema.parse(payload);
    return createStudent(data);
  });
  handle(IPC_CHANNELS.STUDENTS_UPDATE, async (payload) => {
    const data = UpdateStudentSchema.parse(payload);
    const { id, ...rest } = data;
    return updateStudent(id, rest);
  });
  handle(IPC_CHANNELS.STUDENTS_ARCHIVE, async (payload) => {
    const { id } = StudentIdSchema.parse(payload);
    await archiveStudent(id);
    return true;
  });
  handle(IPC_CHANNELS.STUDENTS_REGEN_QR, async (payload) => {
    const { id } = StudentIdSchema.parse(payload);
    const token = await regenerateQRToken(id);
    return { token };
  });
  handle(IPC_CHANNELS.STUDENTS_GET_PHOTO_URL, async (payload) => {
    const { filename, entityType } = z.object({
      filename: z.string().max(200),
      entityType: z.enum(["student", "teacher"])
    }).parse(payload);
    const dataUrl = getPhotoAsDataUrl(filename, entityType);
    return { dataUrl };
  });
}
async function startAttendanceSession(data) {
  const session2 = requireSession();
  const db = getDb();
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, data.groupId)
  });
  if (!group) throw new AppError(ErrorCode.NOT_FOUND, "Group not found");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await db.insert(attendanceSessions).values({
    groupId: data.groupId,
    sessionDate: data.sessionDate,
    plannedStartTime: data.plannedStartTime ?? null,
    actualStartTime: now.slice(11, 16),
    lateThresholdMinutes: data.lateThresholdMinutes ?? 10,
    status: "open",
    createdBy: session2.adminId,
    updatedAt: now
  }).returning();
  const row = result[0];
  return mapSessionRow(row);
}
async function endAttendanceSession(sessionId) {
  requireSession();
  const db = getDb();
  const existing = await db.query.attendanceSessions.findFirst({
    where: eq(attendanceSessions.id, sessionId)
  });
  if (!existing) throw new AppError(ErrorCode.SESSION_NOT_FOUND, "Session not found");
  await db.update(attendanceSessions).set({
    status: "closed",
    endTime: (/* @__PURE__ */ new Date()).toISOString().slice(11, 16),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).where(eq(attendanceSessions.id, sessionId));
}
async function scanQRToken(sessionId, rawToken) {
  const session2 = requireSession();
  const db = getDb();
  const token = rawToken.trim().toUpperCase();
  if (!token || token.length < 5) {
    return { code: "unknown_card" };
  }
  await db.query.students.findFirst({
    where: eq(students.qrToken, token.toLowerCase() === token ? token : token)
  });
  const students_found = await db.query.students.findMany();
  const matchedStudent = students_found.find(
    (s) => s.qrToken.toUpperCase() === token
  );
  if (!matchedStudent) {
    return { code: "unknown_card" };
  }
  if (!matchedStudent.qrTokenActive) {
    return { code: "disabled_card", studentId: matchedStudent.id };
  }
  if (matchedStudent.status !== "active") {
    return { code: "student_inactive", studentId: matchedStudent.id, studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}` };
  }
  const attendanceSession = await db.query.attendanceSessions.findFirst({
    where: eq(attendanceSessions.id, sessionId)
  });
  if (!attendanceSession) return { code: "session_closed" };
  if (attendanceSession.status !== "open") return { code: "session_closed" };
  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, matchedStudent.id),
      eq(enrollments.groupId, attendanceSession.groupId),
      eq(enrollments.status, "active")
    )
  });
  if (!enrollment) {
    return {
      code: "not_enrolled",
      studentId: matchedStudent.id,
      studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}`
    };
  }
  const existingRecord = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(attendanceRecords.sessionId, sessionId),
      eq(attendanceRecords.studentId, matchedStudent.id)
    )
  });
  if (existingRecord) {
    return {
      code: "already_scanned",
      studentId: matchedStudent.id,
      studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}`,
      scannedAt: existingRecord.scannedAt ?? void 0,
      attendanceStatus: existingRecord.attendanceStatus
    };
  }
  const now = /* @__PURE__ */ new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  let attendanceStatus = "present";
  if (attendanceSession.plannedStartTime) {
    const [ph, pm] = attendanceSession.plannedStartTime.split(":").map(Number);
    const [nh, nm] = nowTime.split(":").map(Number);
    const diffMins = nh * 60 + nm - (ph * 60 + pm);
    if (diffMins > attendanceSession.lateThresholdMinutes) {
      attendanceStatus = "late";
    }
  }
  const result = await db.insert(attendanceRecords).values({
    sessionId,
    studentId: matchedStudent.id,
    scannedAt: now.toISOString(),
    attendanceStatus,
    source: "qr",
    createdBy: session2.adminId,
    updatedAt: now.toISOString()
  }).returning();
  const record = result[0];
  log.info(`Attendance recorded: student ${matchedStudent.studentNumber}, session ${sessionId}, status: ${attendanceStatus}`);
  return {
    code: "recorded",
    studentId: matchedStudent.id,
    studentName: `${matchedStudent.firstNameAr} ${matchedStudent.lastNameAr}`,
    scannedAt: record.scannedAt ?? void 0,
    attendanceStatus
  };
}
async function markManually(data) {
  const session2 = requireSession();
  const db = getDb();
  const attendanceSession = await db.query.attendanceSessions.findFirst({
    where: eq(attendanceSessions.id, data.sessionId)
  });
  if (!attendanceSession || attendanceSession.status !== "open") {
    throw new AppError(ErrorCode.SESSION_CLOSED, "Attendance session is closed");
  }
  const existing = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(attendanceRecords.sessionId, data.sessionId),
      eq(attendanceRecords.studentId, data.studentId)
    )
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (existing) {
    const updated = await db.update(attendanceRecords).set({
      attendanceStatus: data.attendanceStatus,
      source: "manual",
      notes: data.notes ?? null,
      createdBy: session2.adminId,
      updatedAt: now
    }).where(eq(attendanceRecords.id, existing.id)).returning();
    return mapRecordRow(updated[0]);
  }
  const result = await db.insert(attendanceRecords).values({
    sessionId: data.sessionId,
    studentId: data.studentId,
    scannedAt: now,
    attendanceStatus: data.attendanceStatus,
    source: "manual",
    notes: data.notes ?? null,
    createdBy: session2.adminId,
    updatedAt: now
  }).returning();
  await db.insert(auditLogs).values({
    administratorId: session2.adminId,
    action: "attendance.manualMark",
    entityType: "attendance_record",
    entityId: result[0].id,
    sanitizedDetailsJson: JSON.stringify({ sessionId: data.sessionId, studentId: data.studentId, status: data.attendanceStatus })
  });
  return mapRecordRow(result[0]);
}
async function getSession(sessionId) {
  const db = getDb();
  const session2 = await db.query.attendanceSessions.findFirst({
    where: eq(attendanceSessions.id, sessionId)
  });
  if (!session2) throw new AppError(ErrorCode.SESSION_NOT_FOUND, "Session not found");
  const records = await db.query.attendanceRecords.findMany({
    where: eq(attendanceRecords.sessionId, sessionId)
  });
  return {
    ...mapSessionRow(session2),
    records: records.map(mapRecordRow)
  };
}
async function listSessions(opts) {
  const db = getDb();
  const conditions = opts.groupId ? eq(attendanceSessions.groupId, opts.groupId) : void 0;
  const rows = await db.select().from(attendanceSessions).where(conditions).orderBy(desc(attendanceSessions.sessionDate)).limit(opts.limit ?? 50);
  return rows.map(mapSessionRow);
}
function mapSessionRow(row) {
  return {
    id: row.id,
    groupId: row.groupId,
    sessionDate: row.sessionDate,
    plannedStartTime: row.plannedStartTime ?? null,
    actualStartTime: row.actualStartTime ?? null,
    endTime: row.endTime ?? null,
    lateThresholdMinutes: row.lateThresholdMinutes,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
function mapRecordRow(row) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    studentId: row.studentId,
    scannedAt: row.scannedAt ?? null,
    attendanceStatus: row.attendanceStatus,
    source: row.source,
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
function registerAttendanceHandlers() {
  handle(IPC_CHANNELS.ATTENDANCE_START_SESSION, async (payload) => {
    const data = StartSessionSchema.parse(payload);
    return startAttendanceSession(data);
  });
  handle(IPC_CHANNELS.ATTENDANCE_END_SESSION, async (payload) => {
    const { sessionId } = z.object({ sessionId: z.number().int().positive() }).parse(payload);
    await endAttendanceSession(sessionId);
    return true;
  });
  handle(IPC_CHANNELS.ATTENDANCE_SCAN, async (payload) => {
    const { sessionId, token } = ScanQRSchema.parse(payload);
    return scanQRToken(sessionId, token);
  });
  handle(IPC_CHANNELS.ATTENDANCE_MARK_MANUAL, async (payload) => {
    const data = ManualAttendanceSchema.parse(payload);
    return markManually(data);
  });
  handle(IPC_CHANNELS.ATTENDANCE_GET_SESSION, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload);
    return getSession(id);
  });
  handle(IPC_CHANNELS.ATTENDANCE_SESSIONS_LIST, async (payload) => {
    const opts = z.object({
      groupId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(200).optional()
    }).parse(payload ?? {});
    return listSessions(opts);
  });
}
async function listTeachers(opts = {}) {
  const db = getDb();
  const rows = await db.select().from(teachers).orderBy(desc(teachers.createdAt));
  const filtered = opts.status && opts.status !== "all" ? rows.filter((r) => r.status === opts.status) : rows.filter((r) => r.status !== "archived");
  return filtered.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone ?? null,
    email: r.email ?? null,
    address: r.address ?? null,
    photoPath: r.photoPath ?? null,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));
}
async function createTeacher(data) {
  requireSession();
  const db = getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await db.insert(teachers).values({ ...data, phone: data.phone ?? null, email: data.email ?? null, address: data.address ?? null, updatedAt: now }).returning();
  const r = result[0];
  return { id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone ?? null, email: r.email ?? null, address: r.address ?? null, photoPath: r.photoPath ?? null, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function updateTeacher(id, data) {
  requireSession();
  const db = getDb();
  const result = await db.update(teachers).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(teachers.id, id)).returning();
  if (!result[0]) throw new AppError(ErrorCode.NOT_FOUND, "Teacher not found");
  const r = result[0];
  return { id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone ?? null, email: r.email ?? null, address: r.address ?? null, photoPath: r.photoPath ?? null, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function archiveTeacher(id) {
  requireSession();
  const db = getDb();
  await db.update(teachers).set({ status: "archived", archivedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(teachers.id, id));
}
async function listCourses(opts = {}) {
  const db = getDb();
  const rows = await db.select().from(courses).orderBy(desc(courses.createdAt));
  const filtered = opts.status && opts.status !== "all" ? rows.filter((r) => r.status === opts.status) : rows;
  return filtered.map((r) => ({
    id: r.id,
    nameAr: r.nameAr,
    nameFr: r.nameFr,
    nameEn: r.nameEn,
    descriptionAr: r.descriptionAr ?? null,
    descriptionFr: r.descriptionFr ?? null,
    descriptionEn: r.descriptionEn ?? null,
    defaultPrice: r.defaultPrice,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));
}
async function createCourse(data) {
  requireSession();
  const db = getDb();
  const result = await db.insert(courses).values({ ...data, nameEn: data.nameEn ?? "", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).returning();
  const r = result[0];
  return { id: r.id, nameAr: r.nameAr, nameFr: r.nameFr, nameEn: r.nameEn, descriptionAr: r.descriptionAr ?? null, descriptionFr: r.descriptionFr ?? null, descriptionEn: r.descriptionEn ?? null, defaultPrice: r.defaultPrice, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function updateCourse(id, data) {
  requireSession();
  const db = getDb();
  const result = await db.update(courses).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(courses.id, id)).returning();
  if (!result[0]) throw new AppError(ErrorCode.NOT_FOUND, "Course not found");
  const r = result[0];
  return { id: r.id, nameAr: r.nameAr, nameFr: r.nameFr, nameEn: r.nameEn, descriptionAr: r.descriptionAr ?? null, descriptionFr: r.descriptionFr ?? null, descriptionEn: r.descriptionEn ?? null, defaultPrice: r.defaultPrice, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function listGroups(opts = {}) {
  const db = getDb();
  const rows = await db.select().from(groups).orderBy(desc(groups.createdAt));
  let filtered = rows;
  if (opts.courseId) filtered = filtered.filter((r) => r.courseId === opts.courseId);
  if (opts.status && opts.status !== "all") filtered = filtered.filter((r) => r.status === opts.status);
  const enrollmentCounts = await db.select({ groupId: enrollments.groupId, count: count() }).from(enrollments).where(eq(enrollments.status, "active")).groupBy(enrollments.groupId);
  const countMap = new Map(enrollmentCounts.map((e) => [e.groupId, e.count]));
  return filtered.map((r) => ({
    id: r.id,
    courseId: r.courseId,
    teacherId: r.teacherId,
    name: r.name,
    room: r.room ?? null,
    scheduleJson: r.scheduleJson ?? null,
    capacity: r.capacity,
    monthlyPrice: r.monthlyPrice,
    startDate: r.startDate,
    endDate: r.endDate ?? null,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    enrolledCount: countMap.get(r.id) ?? 0
  }));
}
async function createGroup(data) {
  requireSession();
  const db = getDb();
  const result = await db.insert(groups).values({ ...data, room: data.room ?? null, scheduleJson: data.scheduleJson ?? null, endDate: data.endDate ?? null, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).returning();
  const r = result[0];
  return { id: r.id, courseId: r.courseId, teacherId: r.teacherId, name: r.name, room: r.room ?? null, scheduleJson: r.scheduleJson ?? null, capacity: r.capacity, monthlyPrice: r.monthlyPrice, startDate: r.startDate, endDate: r.endDate ?? null, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function updateGroup(id, data) {
  requireSession();
  const db = getDb();
  const result = await db.update(groups).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(groups.id, id)).returning();
  if (!result[0]) throw new AppError(ErrorCode.NOT_FOUND, "Group not found");
  const r = result[0];
  return { id: r.id, courseId: r.courseId, teacherId: r.teacherId, name: r.name, room: r.room ?? null, scheduleJson: r.scheduleJson ?? null, capacity: r.capacity, monthlyPrice: r.monthlyPrice, startDate: r.startDate, endDate: r.endDate ?? null, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function createEnrollment(data) {
  requireSession();
  const db = getDb();
  const existing = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.studentId, data.studentId), eq(enrollments.groupId, data.groupId))
  });
  if (existing && existing.status === "active") {
    throw new AppError(ErrorCode.STUDENT_ALREADY_ENROLLED, "Student is already enrolled in this group");
  }
  const result = await db.insert(enrollments).values({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).returning();
  const r = result[0];
  return { id: r.id, studentId: r.studentId, groupId: r.groupId, agreedPrice: r.agreedPrice, enrollmentDate: r.enrollmentDate, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function listEnrollmentsByStudent(studentId) {
  const db = getDb();
  const rows = await db.select().from(enrollments).where(eq(enrollments.studentId, studentId)).orderBy(desc(enrollments.createdAt));
  return rows.map((r) => ({ id: r.id, studentId: r.studentId, groupId: r.groupId, agreedPrice: r.agreedPrice, enrollmentDate: r.enrollmentDate, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt }));
}
async function listEnrollmentsByGroup(groupId) {
  const db = getDb();
  const rows = await db.select().from(enrollments).where(and(eq(enrollments.groupId, groupId), eq(enrollments.status, "active"))).orderBy(desc(enrollments.createdAt));
  return rows.map((r) => ({ id: r.id, studentId: r.studentId, groupId: r.groupId, agreedPrice: r.agreedPrice, enrollmentDate: r.enrollmentDate, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt }));
}
function registerEntityHandlers() {
  handle(IPC_CHANNELS.TEACHERS_LIST, async (payload) => {
    const opts = z.object({ status: z.string().optional() }).parse(payload ?? {});
    return listTeachers(opts);
  });
  handle(IPC_CHANNELS.TEACHERS_CREATE, async (payload) => {
    const data = CreateTeacherSchema.parse(payload);
    return createTeacher(data);
  });
  handle(IPC_CHANNELS.TEACHERS_UPDATE, async (payload) => {
    const data = UpdateTeacherSchema.parse(payload);
    const { id, ...rest } = data;
    return updateTeacher(id, rest);
  });
  handle(IPC_CHANNELS.TEACHERS_ARCHIVE, async (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload);
    await archiveTeacher(id);
    return true;
  });
  handle(IPC_CHANNELS.COURSES_LIST, async (payload) => {
    const opts = z.object({ status: z.string().optional() }).parse(payload ?? {});
    return listCourses(opts);
  });
  handle(IPC_CHANNELS.COURSES_CREATE, async (payload) => {
    const data = CreateCourseSchema.parse(payload);
    return createCourse(data);
  });
  handle(IPC_CHANNELS.COURSES_UPDATE, async (payload) => {
    const data = UpdateCourseSchema.parse(payload);
    const { id, ...rest } = data;
    return updateCourse(id, rest);
  });
  handle(IPC_CHANNELS.GROUPS_LIST, async (payload) => {
    const opts = z.object({
      courseId: z.number().int().positive().optional(),
      status: z.string().optional()
    }).parse(payload ?? {});
    return listGroups(opts);
  });
  handle(IPC_CHANNELS.GROUPS_BY_COURSE, async (payload) => {
    const { courseId } = z.object({ courseId: z.number().int().positive() }).parse(payload);
    return listGroups({ courseId });
  });
  handle(IPC_CHANNELS.GROUPS_CREATE, async (payload) => {
    const data = CreateGroupSchema.parse(payload);
    return createGroup(data);
  });
  handle(IPC_CHANNELS.GROUPS_UPDATE, async (payload) => {
    const data = UpdateGroupSchema.parse(payload);
    const { id, ...rest } = data;
    return updateGroup(id, rest);
  });
  handle(IPC_CHANNELS.ENROLLMENTS_CREATE, async (payload) => {
    const data = CreateEnrollmentSchema.parse(payload);
    return createEnrollment(data);
  });
  handle(IPC_CHANNELS.ENROLLMENTS_BY_STUDENT, async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload);
    return listEnrollmentsByStudent(studentId);
  });
  handle(IPC_CHANNELS.ENROLLMENTS_BY_GROUP, async (payload) => {
    const { groupId } = z.object({ groupId: z.number().int().positive() }).parse(payload);
    return listEnrollmentsByGroup(groupId);
  });
}
async function generateReceiptNumber() {
  const db = getDb();
  const settings = await db.query.schoolSettings.findFirst();
  const prefix = settings?.receiptPrefix ?? DEFAULT_RECEIPT_PREFIX;
  const result = await db.select({ count: count() }).from(payments);
  const total = (result[0]?.count ?? 0) + 1;
  const ts = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${ts}-${String(total).padStart(4, "0")}`;
}
function mapRow(row) {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    studentId: row.studentId,
    enrollmentId: row.enrollmentId,
    billingPeriod: row.billingPeriod,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    paymentDate: row.paymentDate,
    reference: row.reference ?? null,
    notes: row.notes ?? null,
    receivedBy: row.receivedBy,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
async function listPayments(opts) {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const conditions = [];
  if (opts.studentId) conditions.push(eq(payments.studentId, opts.studentId));
  if (opts.search) {
    const q = `%${opts.search}%`;
    conditions.push(like(payments.receiptNumber, q));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : void 0;
  const [rows, totalResult] = await Promise.all([
    db.select().from(payments).where(whereClause).orderBy(desc(payments.paymentDate)).limit(pageSize).offset(offset),
    db.select({ count: count() }).from(payments).where(whereClause)
  ]);
  return { items: rows.map(mapRow), total: totalResult[0]?.count ?? 0, page, pageSize };
}
async function createPayment(data) {
  const session2 = requireSession();
  const db = getDb();
  if (data.amount < 0) throw new AppError(ErrorCode.NEGATIVE_AMOUNT, "Amount cannot be negative");
  const receiptNumber = await generateReceiptNumber();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await db.insert(payments).values({
    receiptNumber,
    studentId: data.studentId,
    enrollmentId: data.enrollmentId,
    billingPeriod: data.billingPeriod,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    paymentDate: data.paymentDate,
    reference: data.reference ?? null,
    notes: data.notes ?? null,
    receivedBy: session2.adminId,
    status: "paid",
    updatedAt: now
  }).returning();
  const row = result[0];
  log.info(`Payment created: ${receiptNumber}, amount: ${data.amount}`);
  await db.insert(auditLogs).values({
    administratorId: session2.adminId,
    action: "payment.create",
    entityType: "payment",
    entityId: row.id,
    sanitizedDetailsJson: JSON.stringify({ receiptNumber, amount: data.amount, billingPeriod: data.billingPeriod })
  });
  return mapRow(row);
}
async function cancelPayment(id, reason) {
  const session2 = requireSession();
  const db = getDb();
  const existing = await db.query.payments.findFirst({ where: eq(payments.id, id) });
  if (!existing) throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, "Payment not found");
  if (existing.status === "cancelled") throw new AppError(ErrorCode.PAYMENT_ALREADY_CANCELLED, "Already cancelled");
  await db.update(payments).set({
    status: "cancelled",
    notes: reason ? `Cancelled: ${reason}` : existing.notes,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).where(eq(payments.id, id));
  await db.insert(auditLogs).values({
    administratorId: session2.adminId,
    action: "payment.cancel",
    entityType: "payment",
    entityId: id,
    sanitizedDetailsJson: JSON.stringify({ receiptNumber: existing.receiptNumber, reason })
  });
}
async function getPaymentsByStudent(studentId) {
  const db = getDb();
  const rows = await db.select().from(payments).where(eq(payments.studentId, studentId)).orderBy(desc(payments.paymentDate));
  return rows.map(mapRow);
}
function registerPaymentHandlers() {
  handle(IPC_CHANNELS.PAYMENTS_LIST, async (payload) => {
    const opts = z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(200).optional(),
      search: z.string().max(200).optional(),
      studentId: z.number().int().positive().optional()
    }).parse(payload ?? {});
    return listPayments(opts);
  });
  handle(IPC_CHANNELS.PAYMENTS_CREATE, async (payload) => {
    const data = CreatePaymentSchema.parse(payload);
    return createPayment(data);
  });
  handle(IPC_CHANNELS.PAYMENTS_CANCEL, async (payload) => {
    const data = CancelPaymentSchema.parse(payload);
    await cancelPayment(data.id, data.reason);
    return true;
  });
  handle(IPC_CHANNELS.PAYMENTS_BY_STUDENT, async (payload) => {
    const { studentId } = z.object({ studentId: z.number().int().positive() }).parse(payload);
    return getPaymentsByStudent(studentId);
  });
}
function getDefaultBackupDir() {
  return path.join(app.getPath("userData"), BACKUP_DIR_DEFAULT);
}
function generateBackupFilename() {
  const now = /* @__PURE__ */ new Date();
  const ts = now.toISOString().replace(/[:.]/g, "").slice(0, 15);
  return `school-backup-${ts}.zip`;
}
function computeFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}
async function createBackup(destinationDir) {
  requireSession();
  const settings = await getSettings();
  const backupDir = destinationDir ?? settings?.backupDirectory ?? getDefaultBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const filename = generateBackupFilename();
  const backupPath = path.join(backupDir, filename);
  const dbPath = getDatabasePath_();
  const userData = app.getPath("userData");
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(backupPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(dbPath, { name: "data/school-management.sqlite" });
    const studentsPhotoDir = path.join(userData, STUDENTS_PHOTO_DIR);
    if (fs.existsSync(studentsPhotoDir)) {
      archive.directory(studentsPhotoDir, "media/students");
    }
    const teachersPhotoDir = path.join(userData, TEACHERS_PHOTO_DIR);
    if (fs.existsSync(teachersPhotoDir)) {
      archive.directory(teachersPhotoDir, "media/teachers");
    }
    archive.append(
      JSON.stringify({
        version: app.getVersion(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        appName: "edupilot-dz"
      }),
      { name: "manifest.json" }
    );
    archive.finalize();
  });
  const stat = fs.statSync(backupPath);
  const hash2 = computeFileHash(backupPath);
  fs.writeFileSync(`${backupPath}.sha256`, hash2);
  await enforceRetention(backupDir, settings?.backupsToRetain ?? 30);
  log.info(`Backup created: ${filename} (${stat.size} bytes)`);
  return {
    filename,
    path: backupPath,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    sizeBytes: stat.size,
    verified: true
  };
}
async function listBackups() {
  requireSession();
  const settings = await getSettings();
  const backupDir = settings?.backupDirectory ?? getDefaultBackupDir();
  if (!fs.existsSync(backupDir)) return [];
  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".zip")).map((filename) => {
    const filePath = path.join(backupDir, filename);
    const stat = fs.statSync(filePath);
    const checksumPath = `${filePath}.sha256`;
    let verified = false;
    if (fs.existsSync(checksumPath)) {
      try {
        const storedHash = fs.readFileSync(checksumPath, "utf8").trim();
        const actualHash = computeFileHash(filePath);
        verified = storedHash === actualHash;
      } catch {
        verified = false;
      }
    }
    return {
      filename,
      path: filePath,
      createdAt: stat.birthtime.toISOString(),
      sizeBytes: stat.size,
      verified
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return files;
}
async function verifyBackup(backupPath) {
  const settings = await getSettings();
  const backupDir = settings?.backupDirectory ?? getDefaultBackupDir();
  const resolved = path.resolve(backupPath);
  if (!resolved.startsWith(path.resolve(backupDir))) {
    throw new AppError(ErrorCode.PATH_TRAVERSAL, "Invalid backup path");
  }
  if (!fs.existsSync(backupPath)) {
    throw new AppError(ErrorCode.BACKUP_NOT_FOUND, "Backup file not found");
  }
  const checksumPath = `${backupPath}.sha256`;
  if (!fs.existsSync(checksumPath)) return false;
  const storedHash = fs.readFileSync(checksumPath, "utf8").trim();
  const actualHash = computeFileHash(backupPath);
  return storedHash === actualHash;
}
async function restoreBackup(backupPath) {
  const session2 = requireSession();
  const settings = await getSettings();
  const backupDir = settings?.backupDirectory ?? getDefaultBackupDir();
  const resolved = path.resolve(backupPath);
  if (!resolved.startsWith(path.resolve(backupDir))) {
    throw new AppError(ErrorCode.PATH_TRAVERSAL, "Invalid backup path");
  }
  if (!fs.existsSync(backupPath) || !backupPath.endsWith(".zip")) {
    throw new AppError(ErrorCode.BACKUP_NOT_FOUND, "Backup file not found or invalid");
  }
  log.info("Creating pre-restore backup...");
  await createBackup(path.join(app.getPath("userData"), "backups", "pre-restore"));
  const tmpDir = path.join(app.getPath("temp"), `edupilot-restore-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    await extract(backupPath, { dir: tmpDir });
    const manifestPath = path.join(tmpDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new AppError(ErrorCode.BACKUP_INVALID, "Backup is missing manifest.json");
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.appName !== "edupilot-dz") {
      throw new AppError(ErrorCode.BACKUP_INVALID, "Backup is from a different application");
    }
    const dbInBackup = path.join(tmpDir, "data", "school-management.sqlite");
    if (!fs.existsSync(dbInBackup)) {
      throw new AppError(ErrorCode.BACKUP_INVALID, "Backup does not contain a database file");
    }
    const sqlite = getSqlite();
    sqlite.close();
    const dbPath = getDatabasePath_();
    fs.copyFileSync(dbInBackup, dbPath);
    const userData = app.getPath("userData");
    const mediaInBackup = path.join(tmpDir, "media");
    if (fs.existsSync(mediaInBackup)) {
      const targetMedia = path.join(userData, "media");
      if (fs.existsSync(targetMedia)) fs.rmSync(targetMedia, { recursive: true });
      fs.cpSync(mediaInBackup, targetMedia, { recursive: true });
    }
    log.info(`Restore completed by admin ${session2.adminId}. Restarting...`);
    setTimeout(() => {
      const { app: electronApp } = require2("electron");
      electronApp.relaunch();
      electronApp.exit(0);
    }, 1e3);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {
    }
  }
}
async function enforceRetention(backupDir, maxCount) {
  try {
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".zip")).map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
    const toDelete = files.slice(maxCount);
    for (const file of toDelete) {
      const filePath = path.join(backupDir, file.name);
      fs.unlinkSync(filePath);
      const checksumPath = `${filePath}.sha256`;
      if (fs.existsSync(checksumPath)) fs.unlinkSync(checksumPath);
      log.info(`Backup retention: removed old backup ${file.name}`);
    }
  } catch (err) {
    log.warn("Backup retention enforcement failed:", err);
  }
}
function registerUtilityHandlers() {
  handle(IPC_CHANNELS.HEALTH_CHECK, async () => {
    let sqliteOpen = false;
    let migrationsApplied = false;
    try {
      const { getSqlite: getSqlite2 } = await Promise.resolve().then(() => connection);
      const sqlite = getSqlite2();
      const row = sqlite.prepare("SELECT 1 as alive").get();
      sqliteOpen = row?.alive === 1;
      const migRow = sqlite.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get();
      migrationsApplied = (migRow?.cnt ?? 0) > 0;
    } catch {
      sqliteOpen = false;
      migrationsApplied = false;
    }
    return {
      preloadLoaded: true,
      mainReachable: true,
      ipcWorking: true,
      sqliteOpen,
      migrationsApplied
    };
  });
  handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return getSettings();
  });
  handle(IPC_CHANNELS.SETTINGS_UPDATE, async (payload) => {
    const data = UpdateSettingsSchema.parse(payload);
    return updateSettings(data);
  });
  handle(IPC_CHANNELS.BACKUPS_CREATE, async (payload) => {
    const opts = z.object({ destinationDir: z.string().max(500).optional() }).parse(payload ?? {});
    return createBackup(opts.destinationDir);
  });
  handle(IPC_CHANNELS.BACKUPS_LIST, async () => {
    return listBackups();
  });
  handle(IPC_CHANNELS.BACKUPS_VERIFY, async (payload) => {
    const { backupPath } = z.object({ backupPath: z.string().min(1).max(1e3) }).parse(payload);
    const ok = await verifyBackup(backupPath);
    return { verified: ok };
  });
  handle(IPC_CHANNELS.BACKUPS_RESTORE, async (payload) => {
    const data = RestoreBackupSchema.parse(payload);
    const { verifyPassword: verifyPassword2 } = await Promise.resolve().then(() => auth_service);
    const session2 = requireSession();
    const { getDb: getDb2, schema: schema2 } = await Promise.resolve().then(() => connection);
    const { eq: eq2 } = await import("drizzle-orm");
    const db = getDb2();
    const admin = await db.query.administrators.findFirst({
      where: eq2(schema2.administrators.id, session2.adminId)
    });
    if (!admin) throw new Error("Admin not found");
    const ok = await verifyPassword2(admin.passwordHash, data.confirmPassword);
    if (!ok) throw new Error("Password confirmation incorrect");
    await restoreBackup(data.backupPath);
    return true;
  });
  handle(IPC_CHANNELS.MEDIA_UPLOAD_PHOTO, async (payload) => {
    const data = UploadPhotoSchema.parse(payload);
    const filename = await uploadPhoto(data.sourcePath, data.entityType, data.entityId);
    return { filename };
  });
  handle(IPC_CHANNELS.APP_GET_VERSION, async () => {
    return { version: app.getVersion(), name: app.getName() };
  });
  handle(IPC_CHANNELS.APP_GET_PATHS, async () => {
    requireSession();
    return {
      userData: app.getPath("userData"),
      documents: app.getPath("documents")
    };
  });
  handle(IPC_CHANNELS.APP_OPEN_BACKUP_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Backup File",
      filters: [{ name: "Backup Files", extensions: ["zip"] }],
      properties: ["openFile"]
    });
    if (result.canceled) return { canceled: true, path: null };
    return { canceled: false, path: result.filePaths[0] ?? null };
  });
  handle(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Backup Destination Folder",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled) return { canceled: true, path: null };
    return { canceled: false, path: result.filePaths[0] ?? null };
  });
  handle(IPC_CHANNELS.APP_PRINT, async () => {
    const { BrowserWindow: BrowserWindow2 } = await import("electron");
    const win = BrowserWindow2.getFocusedWindow();
    if (win) {
      win.webContents.print({ silent: false, printBackground: true });
    }
    return true;
  });
  handle(IPC_CHANNELS.APP_PRINT_TO_PDF, async (payload) => {
    const { BrowserWindow: BrowserWindow2 } = await import("electron");
    const fs2 = await import("fs/promises");
    const path2 = await import("path");
    const win = BrowserWindow2.getFocusedWindow();
    if (!win) throw new Error("No focused window");
    const opts = payload ?? {};
    const pdfOptions = {
      printBackground: true,
      marginsType: opts.marginsType ?? 0,
      pageSize: opts.pageSize ?? "A4"
    };
    const buffer = await win.webContents.printToPDF(pdfOptions);
    const documentsDir = app.getPath("documents");
    const filename = `EdupilotDZ-report-${Date.now()}.pdf`;
    const outPath = path2.join(documentsDir, filename);
    await fs2.writeFile(outPath, buffer);
    return { path: outPath };
  });
}
function registerAllIpcHandlers() {
  registerAuthHandlers();
  registerStudentHandlers();
  registerEntityHandlers();
  registerAttendanceHandlers();
  registerPaymentHandlers();
  registerUtilityHandlers();
  log.info("All IPC handlers registered");
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
function resolvePreloadPath() {
  const appPath = app.getAppPath();
  const asarPath = path.join(process.resourcesPath || "", "app.asar");
  const possiblePaths = [
    path.join(appPath, "out/preload/preload.js"),
    path.join(appPath, "out/preload/preload.mjs"),
    path.join(asarPath, "out/preload/preload.js"),
    path.join(asarPath, "out/preload/preload.mjs"),
    path.join(__dirname$1, "../preload/preload.js"),
    path.join(__dirname$1, "../preload/preload.mjs"),
    path.join(__dirname$1, "../../out/preload/preload.js")
  ];
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(appPath, "out/preload/preload.js");
}
function resolveIconPath() {
  const appPath = app.getAppPath();
  const asarPath = path.join(process.resourcesPath || "", "app.asar");
  const possibleIcons = [
    path.join(appPath, "src/renderer/assets/icon.png"),
    path.join(appPath, "out/renderer/assets/icon-BiP84iCD.png"),
    path.join(appPath, "build/icons/icon.png"),
    path.join(asarPath, "out/renderer/assets/icon.png")
  ];
  for (const p of possibleIcons) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(appPath, "src/renderer/assets/icon.png");
}
function createMainWindow() {
  const preloadPath = resolvePreloadPath();
  log.info("Preload path:", preloadPath);
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Edupilot DZ",
    icon: resolveIconPath(),
    show: false,
    // show after ready-to-show to avoid visual flash
    backgroundColor: "#F8FAFC",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      // renderer cannot access Node.js
      nodeIntegration: false,
      // never enable
      sandbox: true,
      // OS-level sandboxing
      webSecurity: true,
      // enforce same-origin
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false
      // No remote module — deprecated and insecure
    }
  });
  win.once("ready-to-show", () => {
    win.show();
    if (process.env.NODE_ENV === "development" && process.env.OPEN_DEVTOOLS === "true") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          process.env.NODE_ENV === "development" ? [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            // needed for dev HMR
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: http://localhost:*",
            "font-src 'self' data:",
            "connect-src 'self' ws://localhost:* http://localhost:*",
            "media-src 'self' blob:",
            "object-src 'none'",
            "frame-src 'none'"
          ].join("; ") : [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "media-src 'self' blob:",
            "object-src 'none'",
            "frame-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
          ].join("; ")
        ]
      }
    });
  });
  if (process.env.NODE_ENV === "development" && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname$1, "../renderer/index.html"));
  }
  return win;
}
log.initialize({ preload: true });
log.transports.file.level = "info";
log.transports.console.level = process.env.NODE_ENV === "development" ? "debug" : "warn";
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log.warn("Another instance is already running — quitting");
  app.quit();
}
let mainWindow = null;
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});
app.on("before-quit", () => {
  log.info("App quitting — closing database");
  try {
    const { closeDatabase: closeDatabase2 } = require2("./database/connection");
    closeDatabase2();
  } catch {
  }
});
async function bootstrap() {
  await app.whenReady();
  log.info(`Edupilot DZ v${app.getVersion()} starting...`);
  log.info(`Electron: ${process.versions.electron}, Node: ${process.versions.node}`);
  log.info(`userData: ${app.getPath("userData")}`);
  try {
    await initializeDatabase();
    await runMigrations();
    registerAllIpcHandlers();
    mainWindow = createMainWindow();
    log.info("Bootstrap complete");
  } catch (err) {
    log.error("Bootstrap failed:", err);
    const { dialog: dialog2 } = require2("electron");
    dialog2.showErrorBox(
      "Startup Error",
      `Failed to initialize the application:

${err instanceof Error ? err.message : String(err)}

Please check the logs.`
    );
    app.quit();
  }
}
bootstrap();
