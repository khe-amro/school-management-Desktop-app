import { BrowserWindow, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import log from 'electron-log'
import { getSettings } from './settings.service'
import type { PrinterInfo, ReceiptPrintData, SchoolSettings } from '../../shared/types/index'

let cachedAmiriRegularBase64: string | null = null
let cachedAmiriBoldBase64: string | null = null

/**
 * Loads font file from app resources or source and returns as base64 data URL
 */
function loadFontAsBase64(filename: string): string {
  try {
    const candidatePaths = [
      // Packaged extraResources
      path.join(process.resourcesPath, 'fonts', filename),
      // Dev mode: src/renderer/assets/fonts
      path.join(app.getAppPath(), 'src', 'renderer', 'assets', 'fonts', filename),
      // Build output directory
      path.join(app.getAppPath(), 'out', 'renderer', 'assets', filename),
      // Direct relative fallback
      path.join(__dirname, '..', '..', 'src', 'renderer', 'assets', 'fonts', filename),
    ]

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const buffer = fs.readFileSync(p)
        return buffer.toString('base64')
      }
    }
    log.warn(`[PrinterService] Font file ${filename} not found in candidate paths`)
  } catch (err) {
    log.error(`[PrinterService] Error reading font file ${filename}:`, err)
  }
  return ''
}

function getAmiriRegular(): string {
  if (!cachedAmiriRegularBase64) {
    cachedAmiriRegularBase64 = loadFontAsBase64('Amiri-Regular.woff2')
  }
  return cachedAmiriRegularBase64
}

function getAmiriBold(): string {
  if (!cachedAmiriBoldBase64) {
    cachedAmiriBoldBase64 = loadFontAsBase64('Amiri-Bold.woff2')
  }
  return cachedAmiriBoldBase64
}

/**
 * Discovers all installed Windows printers using getPrintersAsync()
 */
export async function getInstalledPrinters(): Promise<PrinterInfo[]> {
  // Use any available webContents or create a temporary dummy window if none open
  let focusedWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  let tempWin: BrowserWindow | null = null

  if (!focusedWin) {
    tempWin = new BrowserWindow({ show: false, width: 100, height: 100 })
    focusedWin = tempWin
  }

  try {
    const printers = await focusedWin.webContents.getPrintersAsync()
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || '',
      status: p.status,
      isDefault: p.isDefault,
    }))
  } finally {
    if (tempWin) {
      try {
        tempWin.destroy()
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Builds printable 80mm/58mm thermal receipt HTML
 */
export function buildReceiptHtml(
  data: ReceiptPrintData,
  settings: SchoolSettings | null,
  options?: { isTest?: boolean; paperWidth?: string }
): string {
  const isTest = Boolean(options?.isTest)
  const paperWidth = options?.paperWidth || settings?.receiptPaperWidth || '80mm'
  const is58mm = paperWidth === '58mm'
  const contentWidth = is58mm ? '50mm' : '72mm'
  const bodyWidth = is58mm ? '58mm' : '80mm'

  const amiriRegBase64 = getAmiriRegular()
  const amiriBoldBase64 = getAmiriBold()

  const fontFaceDeclarations = `
    @font-face {
      font-family: 'Amiri';
      src: url('data:font/woff2;charset=utf-8;base64,${amiriRegBase64}') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Amiri';
      src: url('data:font/woff2;charset=utf-8;base64,${amiriBoldBase64}') format('woff2');
      font-weight: 700;
      font-style: normal;
    }
  `

  const schoolAr = settings?.schoolNameAr || 'إدوبيلوت ديزاد'
  const schoolFr = settings?.schoolNameFr || 'EDUPILOT DZ'
  const phone = settings?.phone ? `الهاتف: ${settings.phone}` : ''
  const address = settings?.address || ''

  const methodLabelAr: Record<string, string> = {
    cash: 'نقداً (Espèces)',
    transfer: 'تحويل بنكي / بريدي (Virement/CCP)',
    check: 'شيك (Chèque)',
  }
  const paymentMethodText = methodLabelAr[data.paymentMethod] || data.paymentMethod || 'نقداً'

  if (isTest) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Printer Test</title>
  <style>
    ${fontFaceDeclarations}
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    @page {
      margin: 0;
      size: ${bodyWidth} auto;
    }
    html, body {
      width: ${bodyWidth};
      background: #ffffff;
      color: #000000;
      font-family: 'Amiri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.4;
    }
    .receipt {
      width: ${contentWidth};
      margin: 0 auto;
      padding: 3mm 1mm;
      text-align: center;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 13px;
      font-weight: 700;
      margin-top: 2px;
    }
    .test-block {
      text-align: right;
      font-size: 12px;
      margin: 6px 0;
      line-height: 1.5;
    }
    .ltr-text {
      direction: ltr;
      unicode-bidi: embed;
      font-family: 'Courier New', monospace;
    }
    .big-amount {
      font-size: 16px;
      font-weight: 700;
      margin: 6px 0;
    }
    .footer-ok {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="divider"></div>
    <div class="title">EDUPILOT DZ</div>
    <div class="subtitle">Printer test</div>
    <div class="divider"></div>

    <div class="test-block">
      <div>Arabic: اختبار الطابعة</div>
      <div dir="ltr" style="text-align: left;">Français: Test imprimante</div>
      <div dir="ltr" style="text-align: left;">English: Printer test</div>
    </div>

    <div class="divider"></div>

    <div class="ltr-text" style="font-size: 14px; font-weight: bold; letter-spacing: 1px;">
      1234567890
    </div>
    <div class="big-amount ltr-text">
      5,000 DZD
    </div>

    <div class="divider"></div>
    <div class="footer-ok">----------------</div>
    <div class="footer-ok">PRINT OK</div>
    <div class="footer-ok">----------------</div>
    <div style="height: 10mm;"></div>
  </div>
</body>
</html>`
  }

  // Real payment receipt
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${data.receiptNumber}</title>
  <style>
    ${fontFaceDeclarations}
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    @page {
      margin: 0;
      size: ${bodyWidth} auto;
    }
    html, body {
      width: ${bodyWidth};
      background: #ffffff;
      color: #000000;
      font-family: 'Amiri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .receipt {
      width: ${contentWidth};
      margin: 0 auto;
      padding: 2mm 1mm;
    }
    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .school-name-ar {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 1px;
    }
    .school-name-fr {
      font-size: 11px;
      font-weight: 600;
      font-family: 'Segoe UI', Arial, sans-serif;
      direction: ltr;
      margin-bottom: 2px;
    }
    .school-info {
      font-size: 9px;
      color: #333;
      margin-top: 1px;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 5px 0;
    }
    .receipt-title {
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      margin: 3px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 11px;
    }
    .info-label {
      color: #333333;
      white-space: nowrap;
    }
    .info-value {
      font-weight: 700;
      text-align: left;
      word-break: break-word;
      max-width: 65%;
    }
    .ltr-val {
      direction: ltr;
      unicode-bidi: embed;
      font-family: 'Courier New', monospace;
    }
    .total-box {
      border-top: 1px dashed #000000;
      border-bottom: 1px dashed #000000;
      padding: 6px 0;
      margin: 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      font-size: 13px;
      font-weight: 700;
    }
    .total-amount {
      font-size: 16px;
      font-weight: 800;
      direction: ltr;
      font-family: 'Courier New', monospace;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 6px;
      line-height: 1.4;
    }
    .cut-margin {
      height: 8mm;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="school-name-ar">✦ ${schoolAr} ✦</div>
      ${schoolFr ? `<div class="school-name-fr">${schoolFr}</div>` : ''}
      ${phone ? `<div class="school-info" dir="ltr">${phone}</div>` : ''}
      ${address ? `<div class="school-info">${address}</div>` : ''}
    </div>

    <div class="divider"></div>

    <div class="receipt-title">
      وصل تسديد / Reçu de Paiement
      <div class="ltr-val" style="font-size: 11px; font-weight: bold; margin-top: 1px;">
        N°: ${data.receiptNumber}
      </div>
    </div>

    <div class="divider"></div>

    <div class="info-row">
      <span class="info-label">التاريخ / Date:</span>
      <span class="info-value ltr-val">${data.paymentDate}</span>
    </div>

    <div class="info-row">
      <span class="info-label">الطالب / Élève:</span>
      <span class="info-value">${data.studentName}</span>
    </div>

    ${data.studentNumber ? `
    <div class="info-row">
      <span class="info-label">رقم التسجيل:</span>
      <span class="info-value ltr-val">#${data.studentNumber}</span>
    </div>` : ''}

    ${data.courseName ? `
    <div class="info-row">
      <span class="info-label">المادة / الدورة:</span>
      <span class="info-value">${data.courseName}</span>
    </div>` : ''}

    ${data.groupName ? `
    <div class="info-row">
      <span class="info-label">الفوج / Groupe:</span>
      <span class="info-value">${data.groupName}</span>
    </div>` : ''}

    ${data.billingPeriod ? `
    <div class="info-row">
      <span class="info-label">الفترة / Période:</span>
      <span class="info-value ltr-val">${data.billingPeriod}</span>
    </div>` : ''}

    <div class="info-row">
      <span class="info-label">المعاملة:</span>
      <span class="info-value">تسديد (Paiement)</span>
    </div>

    <div class="info-row">
      <span class="info-label">طريقة الدفع:</span>
      <span class="info-value">${paymentMethodText}</span>
    </div>

    ${data.reference ? `
    <div class="info-row">
      <span class="info-label">المرجع / Réf:</span>
      <span class="info-value ltr-val">${data.reference}</span>
    </div>` : ''}

    ${data.receivedByName ? `
    <div class="info-row">
      <span class="info-label">المستلم:</span>
      <span class="info-value">${data.receivedByName}</span>
    </div>` : ''}

    <div class="total-box">
      <span class="total-label">المبلغ المدفوع:</span>
      <span class="total-amount">${Number(data.amount).toLocaleString('fr-DZ')} DZD</span>
    </div>

    <div class="footer">
      <div>شكراً لثقتكم بنا</div>
      <div dir="ltr" style="font-size: 9px; color: #444;">Merci pour votre confiance</div>
    </div>

    <div class="cut-margin"></div>
  </div>
</body>
</html>`
}

export interface PrintReceiptResult {
  success: boolean
  error?: string
  failureReason?: string
}

/**
 * Prints a receipt or test ticket through a dedicated hidden Electron BrowserWindow
 * using webContents.print() targeting the configured Windows printer.
 */
export async function printReceipt(
  data: ReceiptPrintData,
  options?: { isTest?: boolean }
): Promise<PrintReceiptResult> {
  const settings = await getSettings()
  const configuredPrinter = settings?.receiptPrinterName?.trim()

  // 1. Verify installed printers and check target printer
  const installedPrinters = await getInstalledPrinters()

  if (!configuredPrinter) {
    log.warn('[PrinterService] No receipt printer configured in Settings')
    return {
      success: false,
      error: 'PRINTER_NOT_CONFIGURED',
      failureReason: 'Receipt printer not configured. Please configure a printer in Settings.',
    }
  }

  // Ensure configured printer actually exists in Windows
  const targetPrinterExists = installedPrinters.some(
    (p) => p.name.toLowerCase() === configuredPrinter.toLowerCase()
  )

  if (!targetPrinterExists) {
    log.warn(`[PrinterService] Configured printer "${configuredPrinter}" was not found among installed Windows printers`)
    return {
      success: false,
      error: 'PRINTER_NOT_FOUND',
      failureReason: `Receipt printer "${configuredPrinter}" is not available or disconnected. Please check Windows Printers or configure another printer in Settings.`,
    }
  }

  // 2. Build receipt HTML
  const html = buildReceiptHtml(data, settings, {
    isTest: options?.isTest,
    paperWidth: settings?.receiptPaperWidth || '80mm',
  })

  // 3. Create dedicated hidden BrowserWindow for receipt rendering
  const is58mm = settings?.receiptPaperWidth === '58mm'
  const windowWidth = is58mm ? 220 : 302 // roughly 58mm / 80mm at 96 DPI

  const printWin = new BrowserWindow({
    show: false,
    width: windowWidth,
    height: 600,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  try {
    // Load HTML via data URL
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // Wait for fonts to be ready
    await printWin.webContents.executeJavaScript('document.fonts.ready.then(() => true)')

    // Short buffer for layout stability
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Determine silent mode based on settings:
    // If showPrintDialog is true (or undefined), silent is false.
    // If showPrintDialog is false, silent is true.
    const showDialog = settings?.showPrintDialog !== false
    const silent = !showDialog

    log.info(
      `[PrinterService] Dispatching print job to "${configuredPrinter}", silent: ${silent}`
    )

    const printOptions = {
      silent,
      deviceName: configuredPrinter,
      printBackground: true,
      color: false,
      margins: {
        marginType: 'none' as const,
      },
      landscape: false,
      copies: 1,
      usePrinterDefaultPageSize: true,
    }

    const printResult = await new Promise<PrintReceiptResult>((resolve) => {
      printWin.webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          log.error(`[PrinterService] webContents.print failed: ${failureReason}`)
          resolve({
            success: false,
            error: 'PRINT_FAILED',
            failureReason: failureReason || 'Print job was cancelled or failed in Windows spooler.',
          })
        } else {
          log.info('[PrinterService] Print job submitted successfully')
          resolve({ success: true })
        }
      })
    })

    return printResult
  } catch (err: any) {
    log.error('[PrinterService] Unexpected error during receipt printing:', err)
    return {
      success: false,
      error: 'PRINT_ERROR',
      failureReason: err?.message || 'An unexpected error occurred during printing.',
    }
  } finally {
    try {
      printWin.destroy()
    } catch {
      // ignore
    }
  }
}
