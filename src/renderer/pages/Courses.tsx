import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, ChevronDown, Calendar, Clock, Edit2,
  Trash2, Sparkles, X, BookOpen
} from 'lucide-react'
import type { Course, Group, Teacher } from '@shared/types/index'

interface ScheduleSlot {
  id: number
  groupId: number
  weekday: number // 0=Mon .. 6=Sun
  startTime: string
  endTime: string
  room?: string
  isActive: boolean
}

const WEEKDAYS = [
  { id: 0, ar: 'الإثنين', fr: 'Lundi', en: 'Monday' },
  { id: 1, ar: 'الثلاثاء', fr: 'Mardi', en: 'Tuesday' },
  { id: 2, ar: 'الأربعاء', fr: 'Mercredi', en: 'Wednesday' },
  { id: 3, ar: 'الخميس', fr: 'Jeudi', en: 'Thursday' },
  { id: 4, ar: 'الجمعة', fr: 'Vendredi', en: 'Friday' },
  { id: 5, ar: 'السبت', fr: 'Samedi', en: 'Saturday' },
  { id: 6, ar: 'الأحد', fr: 'Dimanche', en: 'Sunday' },
]

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-[#0F172A]">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  </div>
)

export default function Courses() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'ar' | 'fr' | 'en'

  const getWeekdayLabel = (day: typeof WEEKDAYS[0]) => {
    if (lang === 'ar') return day.ar
    if (lang === 'en') return day.en
    return day.fr
  }

  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([])
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState<number | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState<Group | null>(null)
  const [showExtraSessionModal, setShowExtraSessionModal] = useState<Group | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Forms
  const [courseForm, setCourseForm] = useState({ nameAr: '', nameFr: '', defaultPrice: '' })
  const [groupForm, setGroupForm] = useState({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', room: '' })
  const [slotForm, setSlotForm] = useState({ weekday: 0, startTime: '09:00', endTime: '11:00', room: '' })
  const [extraSessionForm, setExtraSessionForm] = useState({ date: new Date().toISOString().slice(0, 10), startTime: '14:00', endTime: '16:00', room: '' })

  const loadData = useCallback(async () => {
    try {
      const [cr, gr, tr, sc] = await Promise.all([
        window.schoolApp.courses.list(),
        window.schoolApp.groups.list(),
        window.schoolApp.teachers.list(),
        window.schoolApp.schedules.list({ active: true }),
      ])
      if (cr.success && cr.data) setCourses(cr.data)
      if (gr.success && gr.data) {
        setGroups(gr.data)
        if (gr.data.length > 0 && !selectedGroup) setSelectedGroup(gr.data[0])
      }
      if (tr.success && tr.data) setTeachers(tr.data)
      if (sc.success && sc.data) setSchedules(sc.data)
    } finally {
      setLoading(false)
    }
  }, [selectedGroup])

  useEffect(() => { loadData() }, [loadData])

  const handleCreateCourse = async () => {
    if (!courseForm.nameAr.trim() || !courseForm.nameFr.trim()) {
      setError(t('courses.fillCourseNames'))
      return
    }
    setSaving(true)
    try {
      const res = await window.schoolApp.courses.create({
        nameAr: courseForm.nameAr,
        nameFr: courseForm.nameFr,
        defaultPrice: Number(courseForm.defaultPrice) || 0,
      })
      if (res.success) {
        setShowCourseModal(false)
        setCourseForm({ nameAr: '', nameFr: '', defaultPrice: '' })
        setError('')
        await loadData()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleCreateGroup = async (courseId: number) => {
    if (!groupForm.name.trim() || !groupForm.teacherId || !groupForm.startDate) {
      setError(t('courses.fillRequiredFields'))
      return
    }
    setSaving(true)
    try {
      const res = await window.schoolApp.groups.create({
        courseId,
        teacherId: Number(groupForm.teacherId),
        name: groupForm.name,
        capacity: Number(groupForm.capacity) || 30,
        monthlyPrice: Number(groupForm.monthlyPrice) || 0,
        startDate: groupForm.startDate,
        room: groupForm.room || null,
      })
      if (res.success) {
        setShowGroupModal(null)
        setGroupForm({ name: '', teacherId: '', capacity: '30', monthlyPrice: '', startDate: '', room: '' })
        setError('')
        await loadData()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleAddSlot = async (groupId: number) => {
    if (slotForm.startTime >= slotForm.endTime) {
      setError(t('courses.invalidTimeRange'))
      return
    }
    setSaving(true)
    try {
      const res = await window.schoolApp.schedules.create({
        groupId,
        weekday: Number(slotForm.weekday),
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        room: slotForm.room || undefined,
      })
      if (res.success) {
        setSlotForm({ weekday: 0, startTime: '09:00', endTime: '11:00', room: '' })
        setError('')
        await loadData()
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleDeleteSlot = async (slotId: number) => {
    if (!window.confirm(t('courses.deleteSlotConfirm'))) return
    await window.schoolApp.schedules.delete(slotId)
    await loadData()
  }

  const handleGenerateSessions = async (groupId: number) => {
    const startDate = new Date().toISOString().slice(0, 10)
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const endDate = nextMonth.toISOString().slice(0, 10)

    setSaving(true)
    try {
      const res = await window.schoolApp.sessions.generate(groupId, startDate, endDate)
      if (res.success) {
        alert(t('courses.generatedSessionsMsg', { count: res.data.generated }))
      } else {
        alert(res.error)
      }
    } finally { setSaving(false) }
  }

  const handleAddExtraSession = async (groupId: number) => {
    setSaving(true)
    try {
      const res = await window.schoolApp.sessions.createExtra({
        groupId,
        sessionDate: extraSessionForm.date,
        startTime: extraSessionForm.startTime,
        endTime: extraSessionForm.endTime,
        room: extraSessionForm.room || undefined,
      })
      if (res.success) {
        setShowExtraSessionModal(null)
        alert(t('courses.extraSessionSuccess'))
      } else {
        setError(res.error ?? t('common.error'))
      }
    } finally { setSaving(false) }
  }

  const handleDeleteCourse = async (courseId: number, courseName: string) => {
    const msg = lang === 'ar'
      ? `هل أنت متأكد من حذف مادة "${courseName}" وجميع أفواجها وحصصها؟`
      : `Êtes-vous sûr de vouloir supprimer le cours "${courseName}" et tous ses groupes ?`
    if (!window.confirm(msg)) return
    await window.schoolApp.courses.delete(courseId)
    await loadData()
  }

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    const msg = lang === 'ar'
      ? `هل أنت متأكد من حذف فوج "${groupName}"؟`
      : `Êtes-vous sûr de vouloir supprimer le groupe "${groupName}" ?`
    if (!window.confirm(msg)) return
    await window.schoolApp.groups.delete(groupId)
    if (selectedGroup?.id === groupId) setSelectedGroup(null)
    await loadData()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.courses')}</h2>
          <p className="text-xs text-slate-400">{t('courses.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowCourseModal(true); setError('') }}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={15} /> {t('courses.addCourse')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT (7 cols): Course & Group Tree ── */}
        <div className="lg:col-span-7 space-y-3">
          {courses.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-border">
              <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-medium">{t('courses.noCourses')}</p>
            </div>
          ) : (
            courses.map((course) => {
              const courseGroups = groups.filter((g) => g.courseId === course.id)
              const isExpanded = expandedCourse === course.id

              return (
                <div key={course.id} className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  {/* Course Header */}
                  <div
                    onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] font-bold text-base">
                        {course.nameAr.charAt(0)}
                      </div>
                      <div className="text-start">
                        <p className="font-bold text-[#0F172A] text-sm">{course.nameAr} ({course.nameFr})</p>
                        <p className="text-xs text-slate-400">{t('courses.groupsCount', { count: courseGroups.length })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm font-bold text-[#2563EB]">{course.defaultPrice.toLocaleString()} DZD</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id, course.nameAr) }}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                        title={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Groups list */}
                  {isExpanded && (
                    <div className="border-t border-[#F1F5F9] p-4 bg-slate-50/50 space-y-3">
                      {courseGroups.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">{t('courses.noGroups')}</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {courseGroups.map((group) => {
                            const teacher = teachers.find((tch) => tch.id === group.teacherId)
                            const groupSlots = schedules.filter((s) => s.groupId === group.id)
                            const isSelected = selectedGroup?.id === group.id

                            return (
                              <div
                                key={group.id}
                                onClick={() => setSelectedGroup(group)}
                                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-[#2563EB] bg-white shadow-md ring-2 ring-[#2563EB]/10'
                                    : 'border-border bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h4 className="font-bold text-sm text-[#0F172A]">{group.name}</h4>
                                    <p className="text-xs text-slate-500">
                                      {teacher ? `${teacher.lastName} ${teacher.firstName}` : t('courses.noTeacher')}
                                    </p>
                                  </div>
                                  <span className="text-xs font-bold text-[#2563EB]">
                                    {group.monthlyPrice.toLocaleString()} DA
                                  </span>
                                </div>

                                <div className="space-y-1 text-[11px] text-slate-500 mt-2 border-t border-slate-100 pt-2">
                                  <div className="flex justify-between">
                                    <span>{t('courses.capacity')}:</span>
                                    <span className="font-medium text-slate-700">{group.capacity}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>{t('courses.recurringSlots')}:</span>
                                    <span className="font-medium text-[#2563EB]">{t('courses.slotsCount', { count: groupSlots.length })}</span>
                                  </div>
                                </div>

                                {/* Group Actions */}
                                <div className="flex gap-1.5 mt-3 pt-2 border-t border-slate-100 flex-wrap">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowScheduleModal(group)
                                      setError('')
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1"
                                  >
                                    <Clock size={11} /> {t('courses.schedule')}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleGenerateSessions(group.id)
                                    }}
                                    className="px-2 py-1 bg-[#EFF6FF] hover:bg-blue-100 text-[#2563EB] rounded text-[11px] font-medium flex items-center gap-1"
                                    title={t('courses.generateTooltip')}
                                  >
                                    <Sparkles size={11} /> {t('courses.generate')}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowExtraSessionModal(group)
                                      setError('')
                                    }}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-medium flex items-center gap-1"
                                  >
                                    <Plus size={11} /> {t('courses.extraSession')}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteGroup(group.id, group.name)
                                    }}
                                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded text-[11px] font-medium flex items-center gap-1 ms-auto"
                                    title={t('common.delete')}
                                  >
                                    <Trash2 size={11} /> {t('common.delete')}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setShowGroupModal(course.id)
                          setError('')
                        }}
                        className="flex items-center gap-1.5 text-xs text-[#2563EB] font-semibold hover:underline pt-1"
                      >
                        <Plus size={13} /> {t('courses.addGroup')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── RIGHT (5 cols): Timetable Panel for Selected Group ── */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm sticky top-6">
            <div className="flex justify-between items-center pb-3 border-b border-[#F1F5F9] mb-4">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A]">
                  {selectedGroup
                    ? t('courses.groupSchedule', { name: selectedGroup.name })
                    : t('courses.groupTimetable')}
                </h3>
                <p className="text-[11px] text-slate-400">{t('courses.scheduleSubtitle')}</p>
              </div>
              {selectedGroup && (
                <button
                  onClick={() => {
                    setShowScheduleModal(selectedGroup)
                    setError('')
                  }}
                  className="px-2.5 py-1 bg-[#2563EB] text-white rounded text-xs font-semibold hover:bg-[#1D4ED8] flex items-center gap-1"
                >
                  <Plus size={12} /> {t('courses.manage')}
                </button>
              )}
            </div>

            {!selectedGroup ? (
              <div className="text-center py-12 text-slate-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">{t('courses.selectGroupPrompt')}</p>
              </div>
            ) : (() => {
              // Resolve course & teacher for selected group
              const selCourse = courses.find(c => c.id === selectedGroup.courseId)
              const selTeacher = teachers.find(tch => tch.id === selectedGroup.teacherId)
              const courseLabel = selCourse
                ? (lang === 'ar' ? selCourse.nameAr : selCourse.nameFr)
                : ''
              const teacherLabel = selTeacher
                ? `${selTeacher.lastName} ${selTeacher.firstName}`
                : t('courses.noTeacher')

              return (
                <div className="space-y-2">
                  {/* Group info bar */}
                  <div className="flex gap-3 mb-3 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-[#0F172A]">{courseLabel}</span>
                    <span>•</span>
                    <span>{teacherLabel}</span>
                  </div>
                  {WEEKDAYS.map((day) => {
                    const daySlots = schedules.filter(
                      (s) => s.groupId === selectedGroup.id && s.weekday === day.id
                    )

                    return (
                      <div key={day.id} className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between items-center">
                        <span className="font-bold text-slate-700 w-24">
                          {getWeekdayLabel(day)}
                        </span>
                        <div className="flex-1 text-end flex flex-wrap justify-end gap-1">
                          {daySlots.length === 0 ? (
                            <span className="text-slate-400 italic">{t('courses.noClasses')}</span>
                          ) : (
                            daySlots.map((slot) => (
                              <div
                                key={slot.id}
                                className="inline-block bg-white border border-border px-2 py-1 rounded shadow-sm my-0.5"
                              >
                                <div className="font-bold text-[#2563EB]">{slot.startTime} – {slot.endTime}</div>
                                {slot.room && (
                                  <div className="text-[10px] text-slate-500">{slot.room}</div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Modal: Create Course ── */}
      {showCourseModal && (
        <Modal title={t('courses.addCourse')} onClose={() => setShowCourseModal(false)}>
          <div>
            <label className={labelCls}>{t('courses.nameAr')} *</label>
            <input className={inputCls} value={courseForm.nameAr} onChange={(e) => setCourseForm(f => ({ ...f, nameAr: e.target.value }))} dir="rtl" />
          </div>
          <div>
            <label className={labelCls}>{t('courses.nameFr')} *</label>
            <input className={inputCls} value={courseForm.nameFr} onChange={(e) => setCourseForm(f => ({ ...f, nameFr: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>{t('courses.defaultPrice')}</label>
            <input type="number" className={inputCls} value={courseForm.defaultPrice} onChange={(e) => setCourseForm(f => ({ ...f, defaultPrice: e.target.value }))} dir="ltr" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setShowCourseModal(false)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">{t('common.cancel')}</button>
            <button onClick={handleCreateCourse} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8]">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Create Group ── */}
      {showGroupModal !== null && (
        <Modal title={t('courses.addGroup')} onClose={() => setShowGroupModal(null)}>
          <div>
            <label className={labelCls}>{t('common.name')} *</label>
            <input className={inputCls} value={groupForm.name} onChange={(e) => setGroupForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>{t('courses.teacher')} *</label>
            <select className={inputCls} value={groupForm.teacherId} onChange={(e) => setGroupForm(f => ({ ...f, teacherId: e.target.value }))}>
              <option value="">— {t('courses.teacher')} —</option>
              {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.lastName} {tch.firstName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{t('courses.monthlyPrice')}</label>
              <input type="number" className={inputCls} value={groupForm.monthlyPrice} onChange={(e) => setGroupForm(f => ({ ...f, monthlyPrice: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className={labelCls}>{t('courses.capacity')}</label>
              <input type="number" className={inputCls} value={groupForm.capacity} onChange={(e) => setGroupForm(f => ({ ...f, capacity: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('courses.startDate')} *</label>
            <input type="date" className={inputCls} value={groupForm.startDate} onChange={(e) => setGroupForm(f => ({ ...f, startDate: e.target.value }))} dir="ltr" />
          </div>
          <div>
            <label className={labelCls}>{t('courses.roomOptional')}</label>
            <input className={inputCls} value={groupForm.room} onChange={(e) => setGroupForm(f => ({ ...f, room: e.target.value }))} placeholder={t('courses.roomPlaceholder')} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setShowGroupModal(null)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">{t('common.cancel')}</button>
            <button onClick={() => handleCreateGroup(showGroupModal!)} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8]">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Manage Schedule Slots ── */}
      {showScheduleModal && (
        <Modal title={t('courses.manageScheduleFor', { name: showScheduleModal.name })} onClose={() => setShowScheduleModal(null)}>
          <div className="space-y-4">
            {/* Existing slots */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">{t('courses.currentSlots')}</p>
              {schedules.filter(s => s.groupId === showScheduleModal.id).length === 0 ? (
                <p className="text-xs text-slate-400 italic">{t('courses.noSlotsConfigured')}</p>
              ) : (
                schedules.filter(s => s.groupId === showScheduleModal.id).map(slot => {
                  const dayObj = WEEKDAYS.find(w => w.id === slot.weekday)
                  const dayName = dayObj ? getWeekdayLabel(dayObj) : ''
                  return (
                    <div key={slot.id} className="flex justify-between items-center p-2 bg-slate-50 rounded text-xs">
                      <span>
                        <strong>{dayName}:</strong> {slot.startTime} – {slot.endTime}
                        {slot.room ? ` (${slot.room})` : ''}
                      </span>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Add new slot form */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-xs font-bold text-[#2563EB]">{t('courses.addWeeklySlot')}</p>
              <div>
                <label className={labelCls}>{t('courses.dayOfWeek')}</label>
                <select
                  className={inputCls}
                  value={slotForm.weekday}
                  onChange={e => setSlotForm(f => ({ ...f, weekday: Number(e.target.value) }))}
                >
                  {WEEKDAYS.map(w => (
                    <option key={w.id} value={w.id}>{getWeekdayLabel(w)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{t('courses.startTime')}</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={slotForm.startTime}
                    onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('courses.endTime')}</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={slotForm.endTime}
                    onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('courses.roomOptional')}</label>
                <input
                  className={inputCls}
                  value={slotForm.room}
                  onChange={e => setSlotForm(f => ({ ...f, room: e.target.value }))}
                  placeholder={t('courses.roomPlaceholder')}
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={() => handleAddSlot(showScheduleModal.id)}
                disabled={saving}
                className="w-full py-2 bg-[#2563EB] text-white rounded text-xs font-semibold hover:bg-[#1D4ED8]"
              >
                {saving ? t('common.saving') : t('courses.addWeeklySlot')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Extra Session ── */}
      {showExtraSessionModal && (
        <Modal title={t('courses.createExtraSession') + ' — ' + showExtraSessionModal.name} onClose={() => setShowExtraSessionModal(null)}>
          <div>
            <label className={labelCls}>{t('courses.sessionDate')} *</label>
            <input type="date" className={inputCls} value={extraSessionForm.date} onChange={e => setExtraSessionForm(f => ({ ...f, date: e.target.value }))} dir="ltr" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{t('courses.startTime')} *</label>
              <input type="time" className={inputCls} value={extraSessionForm.startTime} onChange={e => setExtraSessionForm(f => ({ ...f, startTime: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label className={labelCls}>{t('courses.endTime')} *</label>
              <input type="time" className={inputCls} value={extraSessionForm.endTime} onChange={e => setExtraSessionForm(f => ({ ...f, endTime: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('courses.roomOptional')}</label>
            <input className={inputCls} value={extraSessionForm.room} onChange={e => setExtraSessionForm(f => ({ ...f, room: e.target.value }))} placeholder={t('courses.roomPlaceholder')} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setShowExtraSessionModal(null)} className="px-4 py-2 border border-border rounded-lg text-xs text-slate-600">{t('common.cancel')}</button>
            <button onClick={() => handleAddExtraSession(showExtraSessionModal.id)} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">
              {saving ? t('common.saving') : t('courses.extraSession')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
