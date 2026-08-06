import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import type { SchoolSettings } from '@shared/types/index'

export default function Settings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Partial<SchoolSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.schoolApp.settings.get().then((res) => {
      if (res.success && res.data) setSettings(res.data)
      setLoading(false)
    })
  }, [])

  const set = (k: keyof SchoolSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSettings((s: Partial<SchoolSettings>) => ({ ...s, [k]: e.target.value }))

  const setChecked = (k: keyof SchoolSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((s: Partial<SchoolSettings>) => ({ ...s, [k]: e.target.checked }))

  const handleSave = async () => {
    setSaving(true)
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
    })
    setSaving(false)
    if (res.success && res.data) { setSettings(res.data); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const handleChooseBackupDir = async () => {
    const res = await window.schoolApp.app.openSaveDialog()
    if (res.success && res.data && !res.data.canceled && res.data.path) {
      setSettings((s: Partial<SchoolSettings>) => ({ ...s, backupDirectory: res.data!.path! }))
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white'
  const labelCls = 'block text-sm font-medium text-[#0F172A] mb-1.5'

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl animate-fade-in space-y-5">
      {/* School info */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">{t('settings.school')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>{t('settings.schoolNameAr')}</label><input className={inputCls} value={settings.schoolNameAr ?? ''} onChange={set('schoolNameAr')} dir="rtl" /></div>
          <div><label className={labelCls}>{t('settings.schoolNameFr')}</label><input className={inputCls} value={settings.schoolNameFr ?? ''} onChange={set('schoolNameFr')} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>{t('settings.phone')}</label><input className={inputCls} value={settings.phone ?? ''} onChange={set('phone')} dir="ltr" /></div>
          <div><label className={labelCls}>{t('settings.email')}</label><input type="email" className={inputCls} value={settings.email ?? ''} onChange={set('email')} dir="ltr" /></div>
        </div>
        <div><label className={labelCls}>{t('settings.address')}</label><input className={inputCls} value={settings.address ?? ''} onChange={set('address')} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>{t('settings.academicYear')}</label><input className={inputCls} value={settings.academicYear ?? ''} onChange={set('academicYear')} dir="ltr" /></div>
          <div><label className={labelCls}>{t('settings.currency')}</label><input className={inputCls} value={settings.currency ?? ''} onChange={set('currency')} dir="ltr" /></div>
        </div>
        <div>
          <label className={labelCls}>{t('settings.language')}</label>
          <select className={inputCls} value={settings.defaultLanguage ?? 'ar'} onChange={set('defaultLanguage')}>
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-[#0F172A] text-sm pb-2 border-b border-[#F1F5F9]">{t('settings.backup')}</h3>
        <div>
          <label className={labelCls}>{t('settings.backupDir')}</label>
          <div className="flex gap-2">
            <input className={`${inputCls} flex-1`} value={settings.backupDirectory ?? ''} onChange={set('backupDirectory')} dir="ltr" readOnly />
            <button onClick={handleChooseBackupDir} className="px-3 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50 shrink-0">{t('backups.chooseDir')}</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="autoBackup" checked={settings.automaticBackupEnabled ?? false} onChange={setChecked('automaticBackupEnabled')} className="w-4 h-4 text-[#2563EB]" />
          <label htmlFor="autoBackup" className="text-sm font-medium text-[#0F172A]">{t('settings.autoBackup')}</label>
        </div>
        <div>
          <label className={labelCls}>{t('settings.backupsToRetain')}</label>
          <input type="number" className={inputCls} value={settings.backupsToRetain ?? 30} onChange={set('backupsToRetain')} dir="ltr" min={1} max={365} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-60">
          {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
          {saved ? '✓ ' + t('settings.saved') : t('settings.save')}
        </button>
      </div>
    </div>
  )
}
