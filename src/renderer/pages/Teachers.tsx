import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Archive, Camera } from 'lucide-react'
import type { Teacher } from '@shared/types/index'

export default function Teachers() {
  const { t } = useTranslation()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await window.schoolApp.teachers.list()
    if (res.success && res.data) setTeachers(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ firstName: '', lastName: '', phone: '', email: '', address: '' }); setError(''); setShowForm(true) }
  const openEdit = (t: Teacher) => { setEditing(t); setForm({ firstName: t.firstName, lastName: t.lastName, phone: t.phone ?? '', email: t.email ?? '', address: t.address ?? '' }); setError(''); setShowForm(true) }

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError(t('teachers.fillNames')); return }
    setSaving(true)
    try {
      const payload = { firstName: form.firstName, lastName: form.lastName, phone: form.phone || null, email: form.email || null, address: form.address || null }
      const res = editing
        ? await window.schoolApp.teachers.update(editing.id, payload)
        : await window.schoolApp.teachers.create(payload)
      if (res.success) { setShowForm(false); await load() }
      else setError(res.error ?? t('common.error'))
    } finally { setSaving(false) }
  }

  const handleArchive = async (id: number) => {
    if (!window.confirm(t('teachers.archiveConfirm'))) return
    await window.schoolApp.teachers.archive(id)
    await load()
  }

  const handleUploadPhoto = async (teacherId: number) => {
    const res = await window.schoolApp.media.selectImage('teacher', String(teacherId))
    if (res.success && res.data?.path) {
      await window.schoolApp.teachers.update(teacherId, { photoPath: res.data.path } as any)
      await load()
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white'

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.teachers')}</h2>
          <p className="text-xs text-slate-400">{t('teachers.subtitle')}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
          <Plus size={15} /> {t('teachers.add')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-border">
          <p className="font-medium">{t('teachers.noTeachers')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => handleUploadPhoto(teacher.id)}
                    className="relative group cursor-pointer w-11 h-11 rounded-full bg-[#F0FDF4] flex items-center justify-center text-green-700 font-bold text-base border-2 border-emerald-200 shrink-0"
                    title={t('teachers.changePhoto')}
                  >
                    {teacher.firstName.charAt(0)}
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={14} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A] text-sm">{teacher.lastName} {teacher.firstName}</p>
                    <p className="text-xs text-slate-400">{teacher.phone ?? teacher.email ?? '—'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teacher.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {teacher.status === 'active' ? t('teachers.active') : t('teachers.inactive')}
                </span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => openEdit(teacher)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#2563EB] transition-colors">
                  <Pencil size={11} /> {t('common.edit')}
                </button>
                <button onClick={() => handleArchive(teacher.id)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors ms-auto">
                  <Archive size={11} /> {t('teachers.archive')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h3 className="font-bold text-[#0F172A] mb-5">{editing ? t('teachers.edit') : t('teachers.add')}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.lastName')} *</label>
                  <input className={inputCls} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.firstName')} *</label>
                  <input className={inputCls} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.phone')}</label>
                <input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('teachers.email')}</label>
                <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} dir="ltr" />
              </div>
            </div>
            {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
