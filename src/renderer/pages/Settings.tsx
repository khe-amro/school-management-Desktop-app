import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import {
  Save, School, Wrench, Database, Shield,
  Eye, EyeOff, CheckCircle2, AlertCircle, FolderOpen,
  RotateCcw, Plus, Clock, User, KeyRound, AlertTriangle, Check, Camera, Printer
} from 'lucide-react'
import type { SchoolSettings, PrinterInfo } from '@shared/types/index'

type SettingsSection = 'school' | 'application' | 'printing' | 'backup' | 'security'

interface AuditLog {
  id: number
  adminName: string
  action: string
  entityType?: string
  entityId?: number
  createdAt: string
}

export default function Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { logout, refreshSession } = useAuth()
  const [section, setSection] = useState<SettingsSection>('school')
  const [settings, setSettings] = useState<Partial<SchoolSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Admin profile
  const [admin, setAdmin] = useState<{ fullName: string; username: string; preferredLanguage: string; photoPath: string | null } | null>(null)
  const [adminPhotoUrl, setAdminPhotoUrl] = useState<string | null>(null)
  const [adminForm, setAdminForm] = useState({ fullName: '', username: '' })
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminSaveStatus, setAdminSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [adminError, setAdminError] = useState('')

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwStatus, setPwStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [pwError, setPwError] = useState('')

  // Auto-lock
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Printing state
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [printersLoading, setPrintersLoading] = useState(false)
  const [testPrintStatus, setTestPrintStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testPrintError, setTestPrintError] = useState<string | null>(null)

  // Backups
  const [backups, setBackups] = useState<any[]>([])
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<{ path: string; name: string } | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreSuccess, setRestoreSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, adminRes, lockRes] = await Promise.all([
        window.schoolApp.settings.get(),
        window.schoolApp.settings.getAdmin(),
        window.schoolApp.settings.getAutoLock(),
      ])
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data)
      if (adminRes.success && adminRes.data) {
        setAdmin(adminRes.data)
        setAdminForm({
          fullName: adminRes.data.fullName || '',
          username: adminRes.data.username || '',
        })
        if (adminRes.data.photoPath) {
          try {
            const photoRes = await window.schoolApp.media.getImageUrl(adminRes.data.photoPath)
            if (photoRes.success && photoRes.data?.url) setAdminPhotoUrl(photoRes.data.url)
          } catch { /* ignore */ }
        }
      }
      if (lockRes.success && lockRes.data) setAutoLockMinutes(lockRes.data.minutes ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadBackups = useCallback(async () => {
    const res = await window.schoolApp.backups.list()
    if (res.success && res.data) setBackups(res.data)
  }, [])

  const loadPrinters = useCallback(async () => {
    setPrintersLoading(true)
    try {
      const res = await window.schoolApp.printer.getList()
      if (res.success && res.data) {
        setPrinters(res.data)
      }
    } catch {
      // ignore
    } finally {
      setPrintersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (section === 'backup') loadBackups()
    if (section === 'security') loadAuditLogs()
    if (section === 'printing') loadPrinters()
  }, [section, loadBackups, loadPrinters])

  const loadAuditLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await window.schoolApp.settings.listAuditLogs({ limit: 50 })
      if (res.success && res.data) setAuditLogs(res.data)
    } finally {
      setLogsLoading(false)
    }
  }

  const set = (k: keyof SchoolSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSettings((s) => ({ ...s, [k]: e.target.value }))

  const setChecked = (k: keyof SchoolSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((s) => ({ ...s, [k]: e.target.checked }))

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await window.schoolApp.settings.update({
        schoolNameAr: settings.schoolNameAr,
        schoolNameFr: settings.schoolNameFr,
        schoolNameEn: settings.schoolNameEn,
        phone: settings.phone ?? null,
        email: settings.email ?? null,
        address: settings.address ?? null,
        academicYear: settings.academicYear,
        currency: settings.currency,
        defaultLanguage: settings.defaultLanguage as 'ar' | 'fr' | 'en',
        backupDirectory: settings.backupDirectory ?? null,
        automaticBackupEnabled: settings.automaticBackupEnabled,
        backupsToRetain: settings.backupsToRetain,
        receiptPrinterName: settings.receiptPrinterName ?? null,
        receiptPaperWidth: settings.receiptPaperWidth || '80mm',
        autoPrintReceipt: Boolean(settings.autoPrintReceipt),
        showPrintDialog: settings.showPrintDialog !== false,
      })
      if (res.success && res.data) {
        setSettings(res.data)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTestPrint = async () => {
    setTestPrintStatus('loading')
    setTestPrintError(null)
    try {
      const res = await window.schoolApp.printer.printTest()
      if (res.success) {
        setTestPrintStatus('success')
        setTimeout(() => setTestPrintStatus('idle'), 4000)
      } else {
        setTestPrintStatus('error')
        setTestPrintError(res.error || t('settings.testPrintFailed'))
      }
    } catch (err: any) {
      setTestPrintStatus('error')
      setTestPrintError(err?.message || t('settings.testPrintFailed'))
    }
  }

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next) { setPwError(t('auth.fillAllFields')); return }
    if (pwForm.next !== pwForm.confirm) { setPwError(t('setup.errorPasswordMismatch')); return }
    if (pwForm.next.length < 6) { setPwError(t('setup.errorPasswordLength')); return }
    setPwError('')
    try {
      const res = await window.schoolApp.auth.changePassword(pwForm.current, pwForm.next)
      if (res.success) {
        setPwStatus('success')
        setPwForm({ current: '', next: '', confirm: '' })
        setTimeout(() => setPwStatus('idle'), 3000)
      } else {
        setPwError(res.error ?? t('common.error'))
        setPwStatus('error')
      }
    } catch (e: any) {
      setPwError(e.message ?? t('common.error'))
      setPwStatus('error')
    }
  }

  const handleChooseBackupDir = async () => {
    const res = await window.schoolApp.app.openSaveDialog()
    if (res.success && res.data && !res.data.canceled && res.data.path) {
      setSettings((s) => ({ ...s, backupDirectory: res.data!.path! }))
    }
  }

  const handleCreateBackup = async () => {
    setCreating(true)
    setBackupStatus(null)
    try {
      const res = await window.schoolApp.backups.create(settings.backupDirectory ?? undefined)
      if (res.success) {
        setBackupStatus(t('backups.backupCreated'))
        await loadBackups()
      } else {
        setBackupStatus(`${t('common.error')}: ${res.error}`)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleRestoreBackup = async () => {
    const res = await window.schoolApp.app.openBackupDialog()
    if (!res.success || !res.data || res.data.canceled || !res.data.path) return
    const chosenPath = res.data.path
    const fileName = chosenPath.split(/[/\\]/).pop() ?? chosenPath
    setRestoreTarget({ path: chosenPath, name: fileName })
    setRestoreError(null)
    setRestoreSuccess(false)
    setRestoreConfirmOpen(true)
  }

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    setRestoreError(null)
    try {
      const restoreRes = await window.schoolApp.backups.restore(restoreTarget.path)
      if (restoreRes.success) {
        setRestoreSuccess(true)
        setTimeout(async () => {
          try {
            await logout()
          } catch { /* ignore */ }
          navigate('/login', {
            replace: true,
            state: { successMessage: t('backups.restoreComplete') },
          })
        }, 900)
      } else {
        setRestoreError(restoreRes.error ?? t('common.error'))
      }
    } catch (err: any) {
      setRestoreError(err?.message ?? t('common.error'))
    } finally {
      setRestoring(false)
    }
  }

  const handleSaveAutoLock = async () => {
    const res = await window.schoolApp.settings.setAutoLock(autoLockMinutes)
    if (res.success) {
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  const handleAdminPhoto = async () => {
    const usernameForFile = adminForm.username.trim() || String(admin?.username ?? 'admin')
    const res = await window.schoolApp.media.selectImage('admin', usernameForFile)
    if (res.success && res.data?.path) {
      const updateRes = await window.schoolApp.settings.updateAdmin({ photoPath: res.data.path })
      if (updateRes.success) {
        setAdmin((prev) => (prev ? { ...prev, photoPath: res.data!.path } : null))
        const photoRes = await window.schoolApp.media.getImageUrl(res.data.path)
        if (photoRes.success && photoRes.data?.url) setAdminPhotoUrl(photoRes.data.url)
        await refreshSession()
      }
    }
  }

  const handleSaveAdminProfile = async () => {
    const fullName = adminForm.fullName.trim()
    const username = adminForm.username.trim()

    if (!fullName) {
      setAdminError(t('setup.errorAdminFields') || 'يرجى إدخال اسم المسؤول')
      setAdminSaveStatus('error')
      return
    }
    if (!username || username.length < 3) {
      setAdminError('اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل')
      setAdminSaveStatus('error')
      return
    }

    setAdminSaving(true)
    setAdminError('')
    setAdminSaveStatus('idle')

    try {
      const res = await window.schoolApp.settings.updateAdmin({
        fullName,
        username,
      })
      if (res.success) {
        setAdmin((prev) =>
          prev ? { ...prev, fullName: res.data.fullName, username: res.data.username } : null
        )
        setAdminForm({ fullName: res.data.fullName, username: res.data.username })
        setAdminSaveStatus('success')
        await refreshSession()
        setTimeout(() => setAdminSaveStatus('idle'), 3500)
      } else {
        setAdminError(res.error || t('settings.adminSaveError'))
        setAdminSaveStatus('error')
      }
    } catch (err: any) {
      setAdminError(err.message || t('settings.adminSaveError'))
      setAdminSaveStatus('error')
    } finally {
      setAdminSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5'

  const navItems: { key: SettingsSection; label: string; icon: any }[] = [
    { key: 'school', label: t('settings.school'), icon: School },
    { key: 'application', label: t('settings.appearance'), icon: Wrench },
    { key: 'printing', label: t('settings.printing'), icon: Printer },
    { key: 'backup', label: t('settings.backup'), icon: Database },
    { key: 'security', label: t('settings.security'), icon: Shield },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
      {/* Left nav */}
      <div className="bg-white rounded-xl border border-border p-3 h-fit">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 text-start ${
              section === key
                ? 'bg-[#EFF6FF] text-[#2563EB]'
                : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-5">
        {/* Save status banner */}
        {saveStatus !== 'idle' && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm animate-fade-in ${
            saveStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {saveStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {saveStatus === 'success' ? t('settings.saved') : t('common.error')}
          </div>
        )}

        {/* ── School Profile ── */}
        {section === 'school' && (
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">
              {t('settings.school')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.schoolNameAr')}</label>
                <input className={inputCls} value={settings.schoolNameAr ?? ''} onChange={set('schoolNameAr')} dir="rtl" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.schoolNameFr')}</label>
                <input className={inputCls} value={settings.schoolNameFr ?? ''} onChange={set('schoolNameFr')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('settings.schoolNameEn')}</label>
              <input className={inputCls} value={settings.schoolNameEn ?? ''} onChange={set('schoolNameEn')} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.phone')}</label>
                <input className={inputCls} value={settings.phone ?? ''} onChange={set('phone')} dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.email')}</label>
                <input type="email" className={inputCls} value={settings.email ?? ''} onChange={set('email')} dir="ltr" />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('settings.address')}</label>
              <input className={inputCls} value={settings.address ?? ''} onChange={set('address')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.academicYear')}</label>
                <input className={inputCls} value={settings.academicYear ?? ''} onChange={set('academicYear')} placeholder="2025-2026" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.currency')}</label>
                <input className={inputCls} value={settings.currency ?? ''} onChange={set('currency')} placeholder="DZD" dir="ltr" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        )}

        {/* ── Application ── */}
        {section === 'application' && (
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">
              {t('settings.appearance')}
            </h3>
            <div>
              <label className={labelCls}>{t('settings.language')}</label>
              <select className={inputCls} value={settings.defaultLanguage ?? 'ar'} onChange={set('defaultLanguage')}>
                <option value="ar">العربية</option>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.studentPrefix')}</label>
                <input className={inputCls} value={(settings as any).studentNumberPrefix ?? 'ETU'} placeholder="ETU" dir="ltr"
                  onChange={(e) => setSettings(s => ({ ...s, studentNumberPrefix: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>{t('settings.receiptPrefix')}</label>
                <input className={inputCls} value={(settings as any).receiptPrefix ?? 'REC'} placeholder="REC" dir="ltr"
                  onChange={(e) => setSettings(s => ({ ...s, receiptPrefix: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        )}

        {/* ── Printing & Thermal Receipts ── */}
        {section === 'printing' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="font-semibold text-[#0F172A] text-sm">
                    {t('settings.printingTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('settings.printingSubtitle')}
                  </p>
                </div>
                <button
                  onClick={loadPrinters}
                  disabled={printersLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-[#2563EB] bg-slate-50 hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors"
                >
                  <RotateCcw size={12} className={printersLoading ? 'animate-spin' : ''} />
                  <span>{t('settings.refreshPrinters')}</span>
                </button>
              </div>

              {/* Missing printer warning */}
              {settings.receiptPrinterName &&
                !printersLoading &&
                printers.length > 0 &&
                !printers.some((p) => p.name.toLowerCase() === settings.receiptPrinterName?.toLowerCase()) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                    <span>{t('settings.printerNotFoundWarning', { name: settings.receiptPrinterName })}</span>
                  </div>
                )}

              {/* Printer Selection Dropdown */}
              <div>
                <label className={labelCls}>{t('settings.selectPrinter')}</label>
                <select
                  className={inputCls}
                  value={settings.receiptPrinterName ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, receiptPrinterName: e.target.value || null }))}
                >
                  <option value="">-- {t('settings.selectPrinter')} --</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name} {p.isDefault ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
                {printers.length === 0 && !printersLoading && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t('settings.noPrintersFound')}
                  </p>
                )}
                {settings.receiptPrinterName && (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Device Name: <span className="font-semibold text-slate-700">{settings.receiptPrinterName}</span>
                  </p>
                )}
              </div>

              {/* Paper Width */}
              <div>
                <label className={labelCls}>{t('settings.paperWidth')}</label>
                <select
                  className={inputCls}
                  value={settings.receiptPaperWidth ?? '80mm'}
                  onChange={(e) => setSettings((s) => ({ ...s, receiptPaperWidth: e.target.value }))}
                >
                  <option value="80mm">{t('settings.paperWidth80')}</option>
                  <option value="58mm">{t('settings.paperWidth58')}</option>
                </select>
              </div>

              {/* Show Print Dialog Toggle */}
              <div className="pt-2 border-t border-[#F1F5F9] space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                    checked={settings.showPrintDialog !== false}
                    onChange={(e) => setSettings((s) => ({ ...s, showPrintDialog: e.target.checked }))}
                  />
                  <div>
                    <span className="text-sm font-medium text-[#0F172A] block">
                      {t('settings.showPrintDialog')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {t('settings.showPrintDialogDesc')}
                    </span>
                  </div>
                </label>

                {/* Auto Print After Payment Toggle */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                    checked={Boolean(settings.autoPrintReceipt)}
                    onChange={(e) => setSettings((s) => ({ ...s, autoPrintReceipt: e.target.checked }))}
                  />
                  <div>
                    <span className="text-sm font-medium text-[#0F172A] block">
                      {t('settings.autoPrintReceipt')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {t('settings.autoPrintReceiptDesc')}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
                >
                  {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>

            {/* Diagnostic Test Print Card */}
            <div className="bg-white rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] flex items-center gap-2">
                <Printer size={16} className="text-[#2563EB]" />
                {t('settings.testPrintTitle')}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('settings.testPrintDesc')}
              </p>

              {testPrintStatus === 'success' && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{t('settings.testPrintSuccess')}</span>
                </div>
              )}

              {testPrintStatus === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{testPrintError || t('settings.testPrintFailed')}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleTestPrint}
                  disabled={testPrintStatus === 'loading' || !settings.receiptPrinterName}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {testPrintStatus === 'loading' ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Printer size={14} />
                  )}
                  {t('settings.testPrintBtn')}
                </button>
                {!settings.receiptPrinterName && (
                  <span className="text-xs text-slate-400">
                    {t('settings.receiptPrinterNotConfigured')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Backup ── */}
        {section === 'backup' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">
                {t('settings.backup')}
              </h3>
              <div>
                <label className={labelCls}>{t('settings.backupDir')}</label>
                <div className="flex gap-2">
                  <input className={`${inputCls} flex-1`} value={settings.backupDirectory ?? ''} readOnly dir="ltr"
                    placeholder={t('backups.chooseDir')} />
                  <button onClick={handleChooseBackupDir} className="px-3 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50 shrink-0 flex items-center gap-1.5">
                    <FolderOpen size={14} /> {t('backups.chooseDir')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="autoBackup" checked={settings.automaticBackupEnabled ?? false}
                  onChange={setChecked('automaticBackupEnabled')} className="w-4 h-4 text-[#2563EB] rounded" />
                <label htmlFor="autoBackup" className="text-sm font-medium text-[#0F172A]">
                  {t('settings.autoBackup')}
                </label>
              </div>
              {settings.automaticBackupEnabled && (
                <div>
                  <label className={labelCls}>{t('settings.backupsToRetain')}</label>
                  <input type="number" className={inputCls} value={settings.backupsToRetain ?? 30} min={1} max={365} dir="ltr"
                    onChange={(e) => setSettings(s => ({ ...s, backupsToRetain: Number(e.target.value) }))} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">
                  {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={handleCreateBackup} disabled={creating}
                  className="flex items-center gap-2 px-4 py-2.5 border border-border text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors">
                  {creating ? <span className="w-4 h-4 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" /> : <Plus size={14} />}
                  {creating ? t('backups.creating') : t('backups.create')}
                </button>
                <button onClick={handleRestoreBackup} disabled={restoring}
                  className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 disabled:opacity-60 transition-colors">
                  <RotateCcw size={14} /> {restoring ? t('backups.restoring') : t('backups.restore')}
                </button>
              </div>
              {backupStatus && (
                <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{backupStatus}</p>
              )}
            </div>

            {/* Backup list */}
            {backups.length > 0 && (
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] mb-4">
                  {t('backups.list')}
                </h3>
                <div className="space-y-2">
                  {backups.map((b, i) => {
                    const fileName = b.filename ?? b.path?.split(/[/\\]/).pop() ?? 'backup.zip'
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
                        <div>
                          <p className="text-sm font-medium text-[#0F172A]">{fileName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{b.createdAt ?? b.created_at}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {b.sizeBytes ? `${(b.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRestoreTarget({ path: b.path, name: fileName })
                              setRestoreError(null)
                              setRestoreSuccess(false)
                              setRestoreConfirmOpen(true)
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                          >
                            <RotateCcw size={12} />
                            {t('backups.restore')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Security ── */}
        {section === 'security' && (
          <div className="space-y-5">
            {/* Admin profile */}
            {admin && (
              <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] mb-5">
                  <h3 className="font-semibold text-[#0F172A] text-sm flex items-center gap-2">
                    <User size={15} className="text-[#2563EB]" /> {t('settings.adminProfile')}
                  </h3>
                  {adminSaveStatus === 'success' && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 size={13} /> {t('settings.adminProfileSaved')}
                    </span>
                  )}
                </div>

                {adminError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-lg text-xs font-medium mb-4">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{adminError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-5">
                  {/* Photo with hover badge */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div
                      className="relative group cursor-pointer"
                      onClick={handleAdminPhoto}
                      title={t('settings.clickToChangePhoto')}
                    >
                      {adminPhotoUrl ? (
                        <img
                          src={adminPhotoUrl}
                          alt={adminForm.fullName || admin.fullName}
                          className="w-20 h-20 rounded-full object-cover border-2 border-[#2563EB]/30 shadow-sm group-hover:border-[#2563EB] transition-colors"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-2xl shadow-sm">
                          {(adminForm.fullName || admin.fullName || 'A').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                        <Camera size={18} />
                        <span className="text-[10px] font-medium">{t('settings.changePhoto')}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdminPhoto}
                      className="text-xs text-[#2563EB] hover:text-blue-700 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Camera size={12} />
                      {t('settings.changePhoto')}
                    </button>
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>
                        {t('settings.adminFullName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={adminForm.fullName}
                        onChange={(e) => setAdminForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Benammer"
                        className={inputCls}
                      />
                      <p className="text-[11px] text-slate-400 mt-1">الاسم الكامل الذي يظهر في النظام والشريط الجانبي</p>
                    </div>

                    <div>
                      <label className={labelCls}>
                        {t('settings.adminUsername')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={adminForm.username}
                        onChange={(e) => setAdminForm((prev) => ({ ...prev, username: e.target.value }))}
                        placeholder="khemici"
                        className={inputCls}
                        dir="ltr"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">اسم المستخدم المستخدم لتسجيل الدخول</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveAdminProfile}
                    disabled={adminSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    <Save size={14} />
                    {adminSaving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </div>
            )}

            {/* Change Password */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] mb-4 flex items-center gap-2">
                <KeyRound size={14} /> {t('auth.changePassword')}
              </h3>
              {pwStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm mb-3">
                  <CheckCircle2 size={15} /> {t('auth.passwordChanged')}
                </div>
              )}
              {pwError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm mb-3">
                  <AlertCircle size={15} /> {pwError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>{t('auth.currentPassword')}</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className={inputCls}
                      value={pwForm.current}
                      onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                      dir="ltr"
                    />
                    <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('auth.newPassword')}</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={inputCls}
                    value={pwForm.next}
                    onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('auth.confirmPassword')}</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={inputCls}
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  <KeyRound size={14} /> {t('auth.changePassword')}
                </button>
              </div>
            </div>

            {/* Auto-lock */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9] mb-4 flex items-center gap-2">
                <Clock size={14} /> {t('settings.autoLock')}
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                {t('settings.autoLockDesc')}
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  className={`${inputCls} w-28`}
                  value={autoLockMinutes}
                  min={0}
                  max={120}
                  dir="ltr"
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                />
                <span className="text-sm text-slate-600">minutes</span>
                <button onClick={handleSaveAutoLock} className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors">
                  <Save size={14} /> {t('common.save')}
                </button>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="bg-white rounded-xl border border-border p-6">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9] mb-4">
                <h3 className="font-semibold text-[#0F172A] text-sm flex items-center gap-2">
                  <Clock size={14} /> {t('settings.auditLog')}
                </h3>
                <button onClick={loadAuditLogs} className="text-xs text-[#2563EB] hover:underline">{t('common.refresh')}</button>
              </div>
              {logsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">{t('settings.noAuditLogs')}</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0F172A]">
                          <span className="font-medium">{log.adminName}</span>{' '}
                          <span className="text-slate-500">{log.action}</span>
                          {log.entityType && <span className="text-slate-400 text-xs"> · {log.entityType} #{log.entityId}</span>}
                        </p>
                        <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Restore Backup Confirmation Modal */}
      {restoreConfirmOpen && restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-border shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-amber-50/70">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-[#0F172A]">
                  {t('backups.confirmRestore')}
                </h3>
                <p className="text-xs text-slate-500 truncate mt-0.5" dir="ltr">
                  {restoreTarget.name}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {restoreSuccess ? (
                <div className="flex flex-col items-center justify-center py-5 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Check size={24} />
                  </div>
                  <p className="font-semibold text-emerald-800 text-sm">
                    {t('backups.restoreSuccess')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed">
                    <p className="font-medium mb-1.5 flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle size={15} className="shrink-0" />
                      {t('common.warning')}
                    </p>
                    <p className="text-xs text-amber-900/90 leading-normal">
                      {t('backups.confirmRestoreMsg')}
                    </p>
                  </div>

                  <p className="text-sm text-[#0F172A] font-medium">
                    {t('backups.confirmRestorePrompt')}
                  </p>

                  {restoreError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg">
                      {restoreError}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!restoreSuccess && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!restoring) {
                      setRestoreConfirmOpen(false)
                      setRestoreTarget(null)
                    }
                  }}
                  disabled={restoring}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={restoring}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg shadow-xs transition-colors disabled:opacity-60"
                >
                  {restoring ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>{t('backups.restoring')}</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={14} />
                      <span>{t('common.confirm')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
