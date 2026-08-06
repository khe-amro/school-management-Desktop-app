import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronDown, Users } from 'lucide-react'
import type { Course, Group, Teacher } from '@shared/types/index'

export default function Courses() {
  const { t } = useTranslation()
  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [courseForm, setCourseForm] = useState({ nameAr: '', nameFr: '', defaultPrice: '' })
  const [groupForm, setGroupForm] = useState({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', room: '' })

  const load = async () => {
    const [cr, gr, tr] = await Promise.all([
      window.schoolApp.courses.list(),
      window.schoolApp.groups.list(),
      window.schoolApp.teachers.list(),
    ])
    if (cr.success && cr.data) setCourses(cr.data)
    if (gr.success && gr.data) setGroups(gr.data)
    if (tr.success && tr.data) setTeachers(tr.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreateCourse = async () => {
    if (!courseForm.nameAr.trim() || !courseForm.nameFr.trim()) { setError('يرجى إدخال اسم المادة'); return }
    setSaving(true)
    try {
      const res = await window.schoolApp.courses.create({ nameAr: courseForm.nameAr, nameFr: courseForm.nameFr, defaultPrice: Number(courseForm.defaultPrice) || 0 })
      if (res.success) { setShowCourseForm(false); setCourseForm({ nameAr: '', nameFr: '', defaultPrice: '' }); await load() }
      else setError(res.error ?? '')
    } finally { setSaving(false) }
  }

  const handleCreateGroup = async (courseId: number) => {
    if (!groupForm.name.trim() || !groupForm.teacherId || !groupForm.startDate) { setError('يرجى ملء الحقول الإلزامية'); return }
    setSaving(true)
    try {
      const res = await window.schoolApp.groups.create({ courseId, teacherId: Number(groupForm.teacherId), name: groupForm.name, capacity: Number(groupForm.capacity) || 30, monthlyPrice: Number(groupForm.monthlyPrice) || 0, startDate: groupForm.startDate, room: groupForm.room || null })
      if (res.success) { setShowGroupForm(null); setGroupForm({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', room: '' }); await load() }
      else setError(res.error ?? '')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  const Modal = ({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
        <h3 className="font-bold text-[#0F172A] mb-5">{title}</h3>
        <div className="space-y-3">{children}</div>
        {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 flex items-center gap-2">
            {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="flex justify-end mb-5">
        <button onClick={() => { setShowCourseForm(true); setError('') }} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
          <Plus size={15} /> {t('courses.addCourse')}
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-border">
          <p className="font-medium">{t('courses.noCourses')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const courseGroups = groups.filter((g) => g.courseId === course.id)
            const isExpanded = expandedCourse === course.id
            return (
              <div key={course.id} className="bg-white rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] font-bold text-sm">
                      {course.nameAr.charAt(0)}
                    </div>
                    <div className="text-start">
                      <p className="font-semibold text-[#0F172A] text-sm">{course.nameAr}</p>
                      <p className="text-xs text-slate-400">{course.nameFr} · {courseGroups.length} {t('courses.groups')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#2563EB]">{course.defaultPrice.toLocaleString()} دج</span>
                    <ChevronDown size={15} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#F1F5F9] p-4">
                    {courseGroups.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">{t('courses.noGroups')}</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        {courseGroups.map((group) => {
                          const teacher = teachers.find((te) => te.id === group.teacherId)
                          return (
                            <div key={group.id} className="bg-slate-50 rounded-lg p-3 border border-border">
                              <p className="font-medium text-[#0F172A] text-sm">{group.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{teacher ? `${teacher.lastName} ${teacher.firstName}` : '—'}</p>
                              <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                                <span className="flex items-center gap-1"><Users size={10} /> {(group as Group & { enrolledCount?: number }).enrolledCount ?? 0}/{group.capacity}</span>
                                <span className="font-semibold text-[#2563EB]">{group.monthlyPrice.toLocaleString()} دج</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <button onClick={() => { setShowGroupForm(course.id); setError('') }} className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:underline transition-colors">
                      <Plus size={12} /> {t('courses.addGroup')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Course form modal */}
      {showCourseForm && (
        <Modal title={t('courses.addCourse')} onClose={() => setShowCourseForm(false)} onSave={handleCreateCourse}>
          <div><label className={labelCls}>{t('courses.nameAr')} *</label><input className={inputCls} value={courseForm.nameAr} onChange={(e) => setCourseForm((f) => ({ ...f, nameAr: e.target.value }))} dir="rtl" /></div>
          <div><label className={labelCls}>{t('courses.nameFr')} *</label><input className={inputCls} value={courseForm.nameFr} onChange={(e) => setCourseForm((f) => ({ ...f, nameFr: e.target.value }))} /></div>
          <div><label className={labelCls}>{t('courses.defaultPrice')}</label><input type="number" className={inputCls} value={courseForm.defaultPrice} onChange={(e) => setCourseForm((f) => ({ ...f, defaultPrice: e.target.value }))} dir="ltr" /></div>
        </Modal>
      )}

      {/* Group form modal */}
      {showGroupForm !== null && (
        <Modal title={t('courses.addGroup')} onClose={() => setShowGroupForm(null)} onSave={() => handleCreateGroup(showGroupForm!)}>
          <div><label className={labelCls}>{t('courses.groups')} *</label><input className={inputCls} value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><label className={labelCls}>{t('courses.teacher')} *</label>
            <select className={inputCls} value={groupForm.teacherId} onChange={(e) => setGroupForm((f) => ({ ...f, teacherId: e.target.value }))}>
              <option value="">— {t('courses.teacher')} —</option>
              {teachers.map((te) => <option key={te.id} value={te.id}>{te.lastName} {te.firstName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>{t('courses.monthlyPrice')}</label><input type="number" className={inputCls} value={groupForm.monthlyPrice} onChange={(e) => setGroupForm((f) => ({ ...f, monthlyPrice: e.target.value }))} dir="ltr" /></div>
            <div><label className={labelCls}>{t('courses.capacity')}</label><input type="number" className={inputCls} value={groupForm.capacity} onChange={(e) => setGroupForm((f) => ({ ...f, capacity: e.target.value }))} dir="ltr" /></div>
          </div>
          <div><label className={labelCls}>{t('courses.startDate')} *</label><input type="date" className={inputCls} value={groupForm.startDate} onChange={(e) => setGroupForm((f) => ({ ...f, startDate: e.target.value }))} dir="ltr" /></div>
          <div><label className={labelCls}>{t('courses.room')}</label><input className={inputCls} value={groupForm.room} onChange={(e) => setGroupForm((f) => ({ ...f, room: e.target.value }))} /></div>
        </Modal>
      )}
    </div>
  )
}
