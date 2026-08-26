import fs from 'node:fs'
import path from 'node:path'
import { getSqlite, getDatabasePath_ } from './connection'
import log from 'electron-log'
import { app } from 'electron'

// ─── Migration definitions ────────────────────────────────────────────────────

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'initial_schema',
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
        room TEXT,
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
    `,
  },
  {
    version: 2,
    name: 'add_schedules_and_admin_photo',
    sql: `
      -- Add photo_path to administrators (nullable)
      ALTER TABLE administrators ADD COLUMN photo_path TEXT;

      -- Create group_schedule_slots for normalized recurring schedules
      CREATE TABLE IF NOT EXISTS group_schedule_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id),
        weekday INTEGER NOT NULL CHECK(weekday >= 0 AND weekday <= 6),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT,
        effective_from TEXT NOT NULL DEFAULT (date('now')),
        effective_until TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES administrators(id),
        UNIQUE(group_id, weekday, start_time)
      );

      CREATE INDEX IF NOT EXISTS idx_schedule_group ON group_schedule_slots(group_id);
      CREATE INDEX IF NOT EXISTS idx_schedule_weekday ON group_schedule_slots(weekday);
      CREATE INDEX IF NOT EXISTS idx_schedule_active ON group_schedule_slots(is_active);

      -- Create student_notes table for administrative notes
      CREATE TABLE IF NOT EXISTS student_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id),
        note_text TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES administrators(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notes_student ON student_notes(student_id);

      -- Extend attendance_sessions with session_type and cancelled_reason
      ALTER TABLE attendance_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'regular' 
        CHECK(session_type IN ('regular', 'extra', 'makeup', 'cancelled'));
      ALTER TABLE attendance_sessions ADD COLUMN schedule_slot_id INTEGER REFERENCES group_schedule_slots(id);
      ALTER TABLE attendance_sessions ADD COLUMN cancelled_reason TEXT;

      CREATE INDEX IF NOT EXISTS idx_sessions_type ON attendance_sessions(session_type);
      CREATE INDEX IF NOT EXISTS idx_sessions_schedule_slot ON attendance_sessions(schedule_slot_id);
    `,
  },
 {
  version: 3,
  name: 'fix_attendance_room_duplicate',
  sql: `
    SELECT 1;
  `,
},
]

// ─── Migration runner ─────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  const sqlite = getSqlite()

  // Ensure app_metadata exists first (bootstrapping)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const getVersion = sqlite.prepare<[], { value: string }>(
    `SELECT value FROM app_metadata WHERE key = 'schema_version' LIMIT 1`
  )

  const row = getVersion.get()
  const currentVersion = row ? parseInt(row.value, 10) : 0

  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion)

  if (pendingMigrations.length === 0) {
    log.info(`Database schema is up to date (version ${currentVersion})`)
    return
  }

  log.info(`Running ${pendingMigrations.length} migration(s) from version ${currentVersion}`)

  for (const migration of pendingMigrations) {
    log.info(`Applying migration ${migration.version}: ${migration.name}`)

    // Back up DB before applying migration (if DB already has data)
    if (currentVersion > 0) {
      await backupBeforeMigration(migration.version)
    }

    const applyMigration = sqlite.transaction(() => {
      sqlite.exec(migration.sql)
      sqlite.prepare(
        `INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('schema_version', ?, datetime('now'))`
      ).run(String(migration.version))
    })

    try {
      applyMigration()
      log.info(`Migration ${migration.version} applied successfully`)
    } catch (err) {
      log.error(`Migration ${migration.version} failed:`, err)
      throw err
    }
  }

  log.info(`Migrations complete. Schema now at version ${pendingMigrations[pendingMigrations.length - 1]?.version}`)
}

async function backupBeforeMigration(migrationVersion: number): Promise<void> {
  try {
    const dbPath = getDatabasePath_()
    const backupDir = path.join(app.getPath('userData'), 'backups', 'pre-migration')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupPath = path.join(backupDir, `pre-migration-v${migrationVersion}-${timestamp}.sqlite`)
    fs.copyFileSync(dbPath, backupPath)
    log.info('Pre-migration backup created:', backupPath)
  } catch (err) {
    log.warn('Could not create pre-migration backup:', err)
    // Non-fatal — migration proceeds
  }
}

export function isFirstRun(): boolean {
  try {
    const sqlite = getSqlite()
    const adminCount = sqlite.prepare<[], { count: number }>(
      `SELECT COUNT(*) as count FROM administrators WHERE is_active = 1`
    ).get()
    const settingsCount = sqlite.prepare<[], { count: number }>(
      `SELECT COUNT(*) as count FROM school_settings`
    ).get()

    if (!adminCount || adminCount.count === 0) {
      return true
    }
    if (!settingsCount || settingsCount.count === 0) {
      return true
    }

    const row = sqlite.prepare<[], { value: string }>(
      `SELECT value FROM app_metadata WHERE key = 'first_run' LIMIT 1`
    ).get()
    return row?.value === 'true'
  } catch {
    return true
  }
}

export function markSetupComplete(): void {
  const sqlite = getSqlite()
  sqlite.prepare(
    `INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('first_run', 'false', datetime('now'))`
  ).run()
}
