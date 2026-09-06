/**
 * reset-sessions-payments.cjs
 * Clears all attendance sessions, attendance records, and session-related
 * payment rows (session_charge / deduction) from the database.
 * Run with:  node scripts/reset-sessions-payments.cjs
 */

const path = require('path')
const os   = require('os')

// Locate the SQLite database file (same logic as the app)
const appDataDir = process.env.APPDATA
  || (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.config'))

const dbPath = path.join(appDataDir, 'edupilot-dz', 'edupilot.db')
console.log('Database path:', dbPath)

let Database
try {
  Database = require('better-sqlite3')
} catch {
  // Try from node_modules inside the project
  Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'))
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const reset = db.transaction(() => {
  // 1. Delete all session-related payment rows (deductions / session charges)
  const p1 = db.prepare(`
    DELETE FROM payments
    WHERE payment_type IN ('deduction', 'session_charge', 'refund', 'session_refund')
  `).run()
  console.log(`Deleted ${p1.changes} session-related payment rows`)

  // 2. Delete all attendance records
  const p2 = db.prepare(`DELETE FROM attendance_records`).run()
  console.log(`Deleted ${p2.changes} attendance records`)

  // 3. Delete all attendance sessions
  const p3 = db.prepare(`DELETE FROM attendance_sessions`).run()
  console.log(`Deleted ${p3.changes} attendance sessions`)

  // 4. Reset SQLite auto-increment sequences for those tables
  db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('attendance_sessions','attendance_records','payments')`).run()

  console.log('\n✅ Done! Sessions, attendance records, and session payments cleared.')
  console.log('   Regular credit top-up payments are kept.')
})

try {
  reset()
} catch (err) {
  console.error('❌ Reset failed:', err.message)
  process.exit(1)
} finally {
  db.close()
}
