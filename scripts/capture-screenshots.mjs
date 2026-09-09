import { _electron as electron } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { hashSync } from '@node-rs/argon2'

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
}

const TEMP_PASSWORD = 'TempPass!2026'

async function run() {
  const screenshotsDir = path.resolve('screenshots')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }

  const dbPath = path.join(process.env.APPDATA, 'Edupilot-DZ-Dev', 'school-management.sqlite')
  const db = new Database(dbPath)

  // Backup admin credentials
  const originalAdmin = db.prepare("SELECT * FROM administrators WHERE username = 'khemici'").get()
  if (!originalAdmin) {
    throw new Error('Admin khemici not found in database')
  }

  console.log('✓ Found admin "khemici". Backing up credentials...')
  const originalHash = originalAdmin.password_hash
  const originalAttempts = originalAdmin.failed_login_attempts
  const originalLocked = originalAdmin.locked_until

  // Set temporary password
  const tempHash = hashSync(TEMP_PASSWORD, ARGON2_OPTIONS)
  db.prepare("UPDATE administrators SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE username = 'khemici'").run(tempHash)
  console.log('✓ Temporarily updated password for screenshot session.')

  let app = null

  try {
    console.log('Launching Electron with Playwright...')
    const childEnv = { ...process.env, NODE_ENV: 'development' }
    delete childEnv.ELECTRON_RUN_AS_NODE

    app = await electron.launch({
      args: [path.resolve('.')],
      env: childEnv,
    })

    const window = await app.firstWindow()
    await window.setViewportSize({ width: 1440, height: 900 })
    await window.waitForLoadState('domcontentloaded')
    await window.waitForTimeout(1000)

    async function capture(filename, waitMs = 800) {
      if (waitMs > 0) await window.waitForTimeout(waitMs)
      const targetPath = path.join(screenshotsDir, filename)
      await window.screenshot({ path: targetPath, fullPage: false })
      console.log(`📸 Captured: ${filename}`)
    }

    async function gotoHash(hash, waitSelector = null, waitMs = 1200) {
      await window.evaluate((h) => {
        window.location.hash = h
      }, hash)
      if (waitSelector) {
        try {
          await window.waitForSelector(waitSelector, { timeout: 4000 })
        } catch {}
      }
      await window.waitForTimeout(waitMs)
    }

    // 01. Login Page
    console.log('--- 01-login.png ---')
    await capture('01-login.png')

    // Perform Login via UI
    console.log('Logging in as khemici via UI form...')
    await window.fill('input[autocomplete="username"]', 'khemici')
    await window.fill('input[type="password"]', TEMP_PASSWORD)
    await window.click('button[type="submit"]')

    console.log('Waiting for AppLayout (aside)...')
    await window.waitForSelector('aside', { timeout: 10000 })
    await window.waitForTimeout(1500)

    // 02. Dashboard
    console.log('--- 02-dashboard.png ---')
    await gotoHash('#/dashboard', undefined, 1500)
    await capture('02-dashboard.png')

    // 03. Students List
    console.log('--- 03-students-list.png ---')
    await gotoHash('#/students', 'table', 1200)
    await capture('03-students-list.png')

    // 04. New Student Form
    console.log('--- 04-student-new.png ---')
    await gotoHash('#/students/new', 'form', 1000)
    await capture('04-student-new.png')

    // 05. Student Profile - Overview Tab
    console.log('--- 05-student-profile-overview.png ---')
    await gotoHash('#/students/2', undefined, 1500)
    await capture('05-student-profile-overview.png')

    // 06. Student Profile - Attendance Tab
    console.log('--- 06-student-profile-attendance.png ---')
    const profileTabs = await window.$$('div.border-b button')
    if (profileTabs && profileTabs.length >= 2) {
      await profileTabs[1].click()
      await window.waitForTimeout(800)
      await capture('06-student-profile-attendance.png')
    }

    // 07. Student Profile - Payments Tab
    console.log('--- 07-student-profile-payments.png ---')
    if (profileTabs && profileTabs.length >= 3) {
      await profileTabs[2].click()
      await window.waitForTimeout(800)
      await capture('07-student-profile-payments.png')
    }

    // 08. Student Profile - Enrollments Tab
    console.log('--- 08-student-profile-enrollments.png ---')
    if (profileTabs && profileTabs.length >= 4) {
      await profileTabs[3].click()
      await window.waitForTimeout(800)
      await capture('08-student-profile-enrollments.png')
    }

    // 09. Student Profile - Notes Tab
    console.log('--- 09-student-profile-notes.png ---')
    if (profileTabs && profileTabs.length >= 5) {
      await profileTabs[4].click()
      await window.waitForTimeout(800)
      await capture('09-student-profile-notes.png')
    }

    // 10. Student Card & Thermal Ticket View
    console.log('--- 10-student-card-ticket.png ---')
    await gotoHash('#/students/2/card', undefined, 1500)
    await capture('10-student-card-ticket.png')

    // 11. Student Card 80mm Ticket Preview Modal
    console.log('--- 11-student-card-preview-modal.png ---')
    const previewBtn = await window.$('button:has(svg.lucide-eye)')
    if (previewBtn) {
      await previewBtn.click()
      await window.waitForTimeout(1000)
      await capture('11-student-card-preview-modal.png')
      await window.keyboard.press('Escape')
      await window.waitForTimeout(600)
    }

    // 12. Student Edit Form
    console.log('--- 12-student-edit.png ---')
    await gotoHash('#/students/2/edit', 'form', 1000)
    await capture('12-student-edit.png')

    // 13. Teachers List
    console.log('--- 13-teachers.png ---')
    await gotoHash('#/teachers', undefined, 1200)
    await capture('13-teachers.png')

    // 14. Courses & Groups
    console.log('--- 14-courses-groups.png ---')
    await gotoHash('#/courses', undefined, 1200)
    await capture('14-courses-groups.png')

    // 15. Live Attendance
    console.log('--- 15-attendance-live.png ---')
    await gotoHash('#/attendance', undefined, 1200)
    await capture('15-attendance-live.png')

    // 16. Attendance History
    console.log('--- 16-attendance-history.png ---')
    await gotoHash('#/attendance/history', undefined, 1200)
    await capture('16-attendance-history.png')

    // 17. Payments List
    console.log('--- 17-payments-list.png ---')
    await gotoHash('#/payments', 'table', 1200)
    await capture('17-payments-list.png')

    // 18. New Payment Modal (Recharge Credit)
    console.log('--- 18-payment-form-modal.png ---')
    const addPaymentBtn = await window.$('button:has(svg.lucide-plus), button:has-text("تسجيل دفعة"), button:has-text("شحن رصيد"), button:has-text("Nouveau paiement")')
    if (addPaymentBtn) {
      await addPaymentBtn.click()
      await window.waitForTimeout(800)
      await capture('18-payment-form-modal.png')
      // Close modal using close button
      const closePaymentModalBtn = await window.$('div.fixed button:has(svg.lucide-x)')
      if (closePaymentModalBtn) {
        await closePaymentModalBtn.click()
      } else {
        await window.keyboard.press('Escape')
      }
      await window.waitForTimeout(800)
    }

    // 19. Payment Receipt Modal
    console.log('--- 19-payment-receipt-modal.png ---')
    const receiptActionBtn = await window.$('table tbody tr:first-child td button:has(svg.lucide-printer)')
    if (receiptActionBtn) {
      await receiptActionBtn.click()
      await window.waitForTimeout(1000)
      await capture('19-payment-receipt-modal.png')
      const closeReceiptModalBtn = await window.$('div.fixed button:has(svg.lucide-x)')
      if (closeReceiptModalBtn) {
        await closeReceiptModalBtn.click()
      } else {
        await window.keyboard.press('Escape')
      }
      await window.waitForTimeout(800)
    }

    // 20. Reports & Analytics
    console.log('--- 20-reports-analytics.png ---')
    await gotoHash('#/reports', undefined, 1500)
    await capture('20-reports-analytics.png')

    // 21. Settings - School Info (General)
    console.log('--- 21-settings-school.png ---')
    await gotoHash('#/settings', undefined, 1500)
    await capture('21-settings-school.png')

    // 22. Settings - Appearance / Application Tab
    console.log('--- 22-settings-appearance.png ---')
    let settingNavBtns = await window.$$('.grid div:first-child button')
    if (settingNavBtns && settingNavBtns.length >= 2) {
      await settingNavBtns[1].click()
      await window.waitForTimeout(800)
      await capture('22-settings-appearance.png')
    }

    // 23. Settings - Thermal Printing Tab
    console.log('--- 23-settings-printing.png ---')
    settingNavBtns = await window.$$('.grid div:first-child button')
    if (settingNavBtns && settingNavBtns.length >= 3) {
      await settingNavBtns[2].click()
      await window.waitForTimeout(800)
      await capture('23-settings-printing.png')
    }

    // 24. Settings - Security Tab
    console.log('--- 24-settings-security.png ---')
    settingNavBtns = await window.$$('.grid div:first-child button')
    if (settingNavBtns && settingNavBtns.length >= 5) {
      await settingNavBtns[4].click()
      await window.waitForTimeout(800)
      await capture('24-settings-security.png')
    }

    // 25. Backups Page
    console.log('--- 25-backups.png ---')
    await gotoHash('#/backups', undefined, 1200)
    await capture('25-backups.png')

    console.log('✅ All 25 screenshots captured successfully!')
  } finally {
    if (app) {
      try {
        await app.close()
      } catch (e) {
        console.error('Error closing app:', e)
      }
    }

    // Restore original admin password hash
    console.log('Restoring original admin password hash...')
    db.prepare("UPDATE administrators SET password_hash = ?, failed_login_attempts = ?, locked_until = ? WHERE username = 'khemici'").run(originalHash, originalAttempts, originalLocked)
    console.log('✓ Original credentials fully restored.')
    db.close()
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err)
  process.exit(1)
})
