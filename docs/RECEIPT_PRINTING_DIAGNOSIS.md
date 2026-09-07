# Diagnosis: Thermal Receipt Printing Issue (Xprinter) — EDUPILOT DZ

**Date:** 2026-09-07  
**Status:** Under Investigation / Resolution Planned  
**Target Printer:** Xprinter 80mm Thermal Receipt Printer (USB)

---

## 1. Audit of the Current Print Pipeline

We performed a comprehensive audit of all print, receipt, ticket, and PDF implementations across the entire codebase.

### Current Pipeline Tracing:
1. **Trigger in UI (`src/renderer/pages/Payments.tsx` / `StudentCard.tsx` / `Reports.tsx`)**:
   - In `Payments.tsx`, when a payment is validated, the receipt modal opens with a "Print Receipt" ("طباعة الإيصال") button.
   - The button executes:
     ```ts
     const handlePrintReceipt = async () => {
       await window.schoolApp.app.print()
     }
     ```
2. **Preload Layer (`src/preload/preload.ts`)**:
   - The preload script defines:
     ```ts
     print: () => invoke<boolean>(IPC_CHANNELS.APP_PRINT)
     ```
3. **IPC Registration (`src/main/ipc/utility.ipc.ts`)**:
   - The IPC handler in the Electron main process is defined as:
     ```ts
     handle(IPC_CHANNELS.APP_PRINT, async () => {
       const { BrowserWindow } = await import('electron')
       const win = BrowserWindow.getFocusedWindow()
       if (win) {
         win.webContents.print({ silent: false, printBackground: true })
       }
       return true
     })
     ```
4. **Windows Spooler & Printer**:
   - Electron invokes Chromium's native Windows print pipeline on the **entire main application window** (`BrowserWindow.getFocusedWindow()`).
   - The Windows print dialog appears (`silent: false`).
   - The document is dispatched to the selected printer through the Windows print spooler.

---

## 2. Classification of the Current Implementation

The current implementation is:
**A. Prints rendered HTML through Electron/Windows**

Specifically:
- It **does NOT** send raw ESC/POS bytes over USB/serial (`printer.write(...)`).
- It **does NOT** stream raw PDF bytes directly into the printer.
- However, it calls `win.webContents.print()` directly on the **main application window** with zero printer configuration, zero paper dimension constraints, and zero driver targeting.

---

## 3. Root Cause of the Random / Gibberish Output

The client's physical Xprinter outputs several centimeters of Chinese/gibberish characters (`陹`, `陹j`, etc.) and control characters. Here is exactly why this occurs:

1. **Printing the Full Interactive Desktop Window**:
   - Instead of printing a dedicated 80mm receipt document, `win.webContents.print()` is called on the focused main app window (containing the entire dashboard, navigation, modals, and desktop CSS).
   - Chromium rasterizes this enormous desktop-sized document and sends complex EMF/GDI/XPS raster data intended for standard A4 desktop printers to the printer queue.

2. **Missing Printer Target and Page Constraints**:
   - `win.webContents.print({ silent: false, printBackground: true })` does not specify:
     - `deviceName`: No target printer is set; it defaults to whatever Windows printer was last used (in screenshot 3, Canon MF3010 / Canon D1520 was selected).
     - `usePrinterDefaultPageSize: true`: Not configured, so Chromium attempts to force default page sizes (Letter/A4) onto an 80mm continuous roll.
     - `margins`: Not set to `{ marginType: 'none' }`.
     - `color: false`: Not set to monochrome.

3. **Driver & Data Stream Misinterpretation**:
   - When a thermal printer (like Xprinter) receives print data from Windows:
     - If the printer is installed with a **Generic / Text Only** driver or if binary graphic raster data is sent across an improperly configured port/driver, the printer's firmware cannot parse the graphic commands and falls back to text mode.
     - In text mode, every 2-byte sequence of binary raster data is interpreted as a 16-bit double-byte character in the printer's native code page (typically GBK / Big5 / Chinese), producing yards of meaningless Chinese characters and binary control characters.
   - Furthermore, in Screenshot 3, the Windows print dialog shows the Xprinter is **not selected** or not properly configured as the designated receipt printer.

---

## 4. Planned Architectural Solution

To resolve this issue completely and deliver reliable 80mm thermal receipt printing:

1. **Dedicated Hidden Receipt BrowserWindow**:
   - When a receipt is printed, Electron main process creates a dedicated hidden `BrowserWindow` specifically sized for receipts (80mm width).
   - Loads a standalone, clean, lightweight HTML/CSS receipt template (no sidebars, no modals, pure black-and-white 80mm thermal layout).
   - Awaits `did-finish-load`, `await document.fonts.ready` (ensuring bundled Amiri Arabic font is loaded), and image readiness before printing.

2. **Real Windows Printer Discovery (`webContents.getPrintersAsync()`)**:
   - Implement `settings.getPrinters()` IPC using Electron's `webContents.getPrintersAsync()`.
   - Add a **Settings > Printing** section in the UI where the administrator can view all installed Windows printers and select their receipt printer (persisting the exact `deviceName` in SQLite).

3. **Missing Printer Guard**:
   - Before any print job, check if the configured printer exists in `getPrintersAsync()`.
   - If not found, abort immediately and return a localized error: `"Receipt printer not available. Please configure a printer in Settings."`
   - Never silently fall back to Canon, PDF, or unrelated printers.

4. **Targeted Windows Print Options**:
   - Call `receiptWindow.webContents.print()` with:
     ```js
     {
       silent: configuredSilentPrinting,
       deviceName: configuredPrinterDeviceName,
       printBackground: true,
       color: false,
       margins: { marginType: 'none' },
       landscape: false,
       copies: 1,
       usePrinterDefaultPageSize: true
     }
     ```
   - Default `silent: false` initially so the user can verify printer selection and settings, with an option to toggle silent printing.

5. **Diagnostic Test Print**:
   - In Settings > Printing, provide a **[Test Print]** button that prints a diagnostic ticket with English, French, and properly shaped RTL Arabic text using the exact same pipeline.

6. **Comprehensive Driver & Setup Documentation**:
   - Create `docs/XPRINTER_SETUP.md` detailing the required Xprinter manufacturer Windows driver setup (never Generic/Text Only) and 80mm paper size configuration.
