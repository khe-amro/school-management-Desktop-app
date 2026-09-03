import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Users, ScanLine, CreditCard, UserPlus, BookOpen,
  Calendar, Clock, ChevronRight, Maximize2, Filter, RotateCcw, X, User, Search
} from 'lucide-react'

const WEEKDAY_AR = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
const WEEKDAY_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Returns 0 (Mon)…6 (Sun) for today */
function todayWeekday(): number {
  const d = new Date().getDay() // 0=Sun
  return d === 0 ? 6 : d - 1
}

interface WeeklySlot {
  groupId: number
  groupName: string
  courseNameAr: string
  courseNameFr: string
  teacherId?: number
  teacherNameAr?: string
  teacherNameFr?: string
  weekday: number // 0=Mon...6=Sun
  startTime: string // e.g. "11:00"
  endTime: string   // e.g. "13:00"
  room?: string | null
}

interface TodaySession {
  id: number
  groupId: number
  groupName?: string
  sessionDate: string
  plannedStartTime?: string
  status: string
}

interface Stats {
  totalActiveStudents: number
  todaySessions: number
  todayCollected: number
  outstanding: number
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

const COURSE_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-950 hover:bg-blue-100/90',
  'bg-emerald-50 border-emerald-200 text-emerald-950 hover:bg-emerald-100/90',
  'bg-purple-50 border-purple-200 text-purple-950 hover:bg-purple-100/90',
  'bg-amber-50 border-amber-200 text-amber-950 hover:bg-amber-100/90',
  'bg-indigo-50 border-indigo-200 text-indigo-950 hover:bg-indigo-100/90',
  'bg-rose-50 border-rose-200 text-rose-950 hover:bg-rose-100/90',
  'bg-teal-50 border-teal-200 text-teal-950 hover:bg-teal-100/90',
]

function getCourseStyle(name: string) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash += name.charCodeAt(i)
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length]
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'ar' | 'fr' | 'en'
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats>({ totalActiveStudents: 0, todaySessions: 0, todayCollected: 0, outstanding: 0 })
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([])
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [nowTime, setNowTime] = useState<Date>(new Date())

  // Filter & Modal State
  const [selectedModule, setSelectedModule] = useState<string>('')
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [inspectSlot, setInspectSlot] = useState<WeeklySlot | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10)

      const [studentsRes, summaryRes, upcomingRes, schedulesRes] = await Promise.all([
        window.schoolApp.students.list({ pageSize: 1, status: 'active' }),
        window.schoolApp.payments.summary(),
        window.schoolApp.sessions.upcoming({ todayOnly: true, limit: 50 }),
        window.schoolApp.schedules?.listAll?.() ?? Promise.resolve({ success: true, data: [] }),
      ])

      if (studentsRes.success && studentsRes.data) {
        setStats(s => ({ ...s, totalActiveStudents: studentsRes.data!.total }))
      }
      if (summaryRes.success && summaryRes.data) {
        setStats(s => ({
          ...s,
          todayCollected: summaryRes.data!.todayCollected ?? 0,
          outstanding: summaryRes.data!.outstanding ?? 0,
        }))
      }
      if (upcomingRes.success && upcomingRes.data) {
        const seen = new Set<string>()
        const todayOnlySessions = (upcomingRes.data as TodaySession[]).filter(s => {
          if (s.sessionDate && s.sessionDate !== todayStr) return false
          const key = `${s.groupId}_${s.plannedStartTime || ''}_${s.sessionDate}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setTodaySessions(todayOnlySessions)
        setStats(s => ({ ...s, todaySessions: todayOnlySessions.length }))
      }
      if (schedulesRes.success && schedulesRes.data) {
        setWeeklySlots(schedulesRes.data as WeeklySlot[])
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const statCards = [
    {
      label: t('dashboard.activeStudents'),
      value: stats.totalActiveStudents,
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
      sub: t('dashboard.students'),
    },
    {
      label: t('dashboard.todayClasses'),
      value: stats.todaySessions,
      icon: ScanLine,
      color: 'bg-green-50 text-green-600',
      sub: t('dashboard.plannedSessions'),
    },
    {
      label: lang === 'ar' ? 'المحصّل اليوم' : "Collecté aujourd'hui",
      value: `${stats.todayCollected.toLocaleString()} DA`,
      icon: CreditCard,
      color: 'bg-teal-50 text-teal-600',
      sub: lang === 'ar' ? 'دفعات اليوم' : "Paiements du jour",
    },
  ]

  const quickActions = [
    { label: t('dashboard.addStudent'), icon: UserPlus, to: '/students/new', color: 'bg-[#2563EB] hover:bg-[#1D4ED8]' },
    { label: t('dashboard.startAttendance'), icon: ScanLine, to: '/attendance', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: t('dashboard.recordPayment'), icon: CreditCard, to: '/payments', color: 'bg-[#7C3AED] hover:bg-[#6D28D9]' },
    { label: t('dashboard.createCourse'), icon: BookOpen, to: '/courses', color: 'bg-[#F59E0B] hover:bg-[#D97706]' },
  ]

  const todayWd = todayWeekday()
  const dayLabel = (wd: number) => (lang === 'ar' ? WEEKDAY_AR[wd]! : WEEKDAY_FR[wd]!)

  // Options for filters
  const availableModules = Array.from(
    new Set(weeklySlots.map(s => (lang === 'ar' ? s.courseNameAr || s.courseNameFr : s.courseNameFr || s.courseNameAr)).filter(Boolean))
  ).sort()

  const availableTeachers = Array.from(
    new Set(weeklySlots.map(s => (lang === 'ar' ? s.teacherNameAr || s.teacherNameFr : s.teacherNameFr || s.teacherNameAr)).filter(Boolean))
  ).sort()

  const availableGroups = Array.from(
    new Set(weeklySlots.map(s => s.groupName).filter(Boolean))
  ).sort()

  // Filtered Slots
  const filteredSlots = weeklySlots.filter(s => {
    const courseName = (lang === 'ar' ? s.courseNameAr || s.courseNameFr : s.courseNameFr || s.courseNameAr) || ''
    const teacherName = (lang === 'ar' ? s.teacherNameAr || s.teacherNameFr : s.teacherNameFr || s.teacherNameAr) || ''
    const groupName = s.groupName || ''

    if (selectedModule && courseName !== selectedModule) return false
    if (selectedTeacher && teacherName !== selectedTeacher) return false
    if (selectedGroup && groupName !== selectedGroup) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const match = courseName.toLowerCase().includes(q) ||
                    teacherName.toLowerCase().includes(q) ||
                    groupName.toLowerCase().includes(q) ||
                    (s.room && s.room.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  // Grid Mapping by weekday and start hour
  const gridData: Record<number, Record<number, WeeklySlot[]>> = {}
  for (const wd of WEEKDAYS) {
    gridData[wd] = {}
    for (const hr of HOURS) gridData[wd][hr] = []
  }

  for (const slot of filteredSlots) {
    if (!slot.startTime) continue
    const startHour = parseInt(slot.startTime.split(':')[0], 10)
    if (!isNaN(startHour) && gridData[slot.weekday]) {
      if (!gridData[slot.weekday][startHour]) gridData[slot.weekday][startHour] = []
      gridData[slot.weekday][startHour].push(slot)
    }
  }

  const resetFilters = () => {
    setSelectedModule('')
    setSelectedTeacher('')
    setSelectedGroup('')
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-[#0F172A]">{card.value}</p>
                {card.sub && <p className="text-xs text-slate-400 mt-1">{card.sub}</p>}
              </div>
              <div className={`p-2.5 rounded-lg ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions + weekly schedule + today's sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-[#0F172A] text-sm mb-4">{t('dashboard.quickActions')}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className={`${action.color} text-white rounded-xl p-3.5 flex flex-col items-center gap-2 transition-colors text-center shadow-xs`}
              >
                <action.icon size={20} />
                <span className="text-xs font-medium leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Schedule Preview Card */}
        <div className="bg-white rounded-xl border border-border p-5 col-span-1 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                <Calendar size={16} className="text-[#2563EB]" />
                {lang === 'ar' ? 'الجدول الأسبوعي' : 'Planning hebdomadaire'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1 text-xs text-[#2563EB] bg-blue-50 border border-blue-100 font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Maximize2 size={13} />
                  <span>{lang === 'ar' ? 'توسيع الجدول' : 'Agrandir'}</span>
                </button>
                <button onClick={() => navigate('/courses')} className="text-xs text-slate-500 hover:text-[#2563EB]">
                  {lang === 'ar' ? 'إدارة' : 'Gérer'}
                </button>
              </div>
            </div>

            {weeklySlots.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">{lang === 'ar' ? 'لا توجد جداول مسجّلة' : 'Aucun planning enregistré'}</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {[0, 1, 2, 3, 4, 5, 6].map(wd => {
                  const daySlots = weeklySlots.filter(s => s.weekday === wd)
                  if (daySlots.length === 0) return null
                  return (
                    <div key={wd} className={`rounded-xl ${wd === todayWd ? 'bg-blue-50/80 border border-blue-200' : 'bg-slate-50 border border-slate-100'} p-2.5`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-bold ${wd === todayWd ? 'text-[#2563EB]' : 'text-slate-700'}`}>
                          {dayLabel(wd)} {wd === todayWd && (lang === 'ar' ? '← اليوم' : '← Aujourd\'hui')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{daySlots.length} {lang === 'ar' ? 'حصص' : 'séances'}</span>
                      </div>
                      <div className="space-y-1">
                        {daySlots.map((s, i) => {
                          const courseName = (lang === 'ar' ? s.courseNameAr || s.courseNameFr : s.courseNameFr || s.courseNameAr) || ''
                          const teacherName = (lang === 'ar' ? s.teacherNameAr || s.teacherNameFr : s.teacherNameFr || s.teacherNameAr) || ''
                          const styleCls = getCourseStyle(courseName)

                          return (
                            <div
                              key={i}
                              onClick={() => { setInspectSlot(s); setIsModalOpen(true); }}
                              className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${styleCls}`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span>{courseName} — {s.groupName}</span>
                                <span className="font-mono text-[10px] opacity-80">{s.startTime}</span>
                              </div>
                              {teacherName && (
                                <div className="text-[10px] opacity-75 mt-0.5 flex items-center gap-1">
                                  <User size={10} /> {teacherName}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-3 text-xs text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Filter size={13} />
            <span>{lang === 'ar' ? 'عرض الجدول المفصّل مع الفلاتر' : 'Voir le planning complet avec filtres'}</span>
          </button>
        </div>

        {/* Today's sessions */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                <Clock size={16} className="text-[#2563EB] animate-pulse" />
                {lang === 'ar' ? 'حصص اليوم' : "Séances d'aujourd'hui"}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px] font-bold">
                <span className="bg-blue-50 text-[#2563EB] px-2.5 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                  📅 {nowTime.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200 tracking-wider flex items-center gap-1">
                  ⏱ {nowTime.toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
            <button onClick={() => navigate('/attendance')} className="text-xs font-semibold text-[#2563EB] hover:underline bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-colors hover:bg-blue-100">
              {lang === 'ar' ? 'متابعة الحضور' : 'Présence'}
            </button>
          </div>

          {todaySessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">{t('dashboard.noClassesToday')}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {todaySessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => navigate('/attendance')}
                  className="group p-3 bg-slate-50 hover:bg-slate-100/80 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-bold text-[#0F172A]">{sess.groupName ?? `Groupe #${sess.groupId}`}</p>
                    <p className="text-slate-400 text-[11px]">{sess.plannedStartTime ?? '--:--'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      sess.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {sess.status}
                    </span>
                    <ChevronRight size={12} className="text-slate-300 group-hover:text-[#2563EB] transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* EXTENDED FULL-SCREEN SPREADSHEET TABLE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Calendar size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold">
                    {lang === 'ar' ? 'الجدول الأسبوعي المفصّل (جدول البيانات)' : 'Planning hebdomadaire interactif'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? 'جدول كامل مع تحديد سريعات للحصص حسب ساعة البداية والفلاتر' : 'Vue détaillée des séances par heure de début'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Filter size={15} className="text-[#2563EB]" />
                <span>{lang === 'ar' ? 'تصفية وحصر الحصص:' : 'Filtrer les séances:'}</span>
              </div>

              {/* Module Filter */}
              <div className="relative min-w-[160px]">
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option value="">{lang === 'ar' ? 'جميع المواد (Modules)' : 'Tous les modules'}</option>
                  {availableModules.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Teacher Filter */}
              <div className="relative min-w-[160px]">
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option value="">{lang === 'ar' ? 'جميع الأساتذة (Enseignants)' : 'Tous les enseignants'}</option>
                  {availableTeachers.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Group Filter */}
              <div className="relative min-w-[150px]">
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option value="">{lang === 'ar' ? 'جميع الأفواج (Groupes)' : 'Tous les groupes'}</option>
                  {availableGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Live Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none ms-1" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'ar' ? 'اكتب للبحث بالتسمية أو القاعة...' : 'Recherche par nom, salle...'}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg ps-8 pe-3 py-2 focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>

              {/* Reset Filters Button */}
              {(selectedModule || selectedTeacher || selectedGroup || searchQuery) && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>{lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Réinitialiser'}</span>
                </button>
              )}
            </div>

            {/* Extended Spreadsheet Table */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100">
              <div className="min-w-[950px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-left dir-auto">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs">
                      <th className="p-3 border-b border-r border-slate-800 text-center w-24 sticky top-0 bg-slate-900 z-10 font-bold">
                        ⏱ {lang === 'ar' ? 'التوقيت' : 'Heure'}
                      </th>
                      {WEEKDAYS.map(wd => (
                        <th
                          key={wd}
                          className={`p-3 border-b border-r border-slate-800 text-center sticky top-0 z-10 font-bold ${
                            wd === todayWd ? 'bg-[#2563EB] text-white' : 'bg-slate-900'
                          }`}
                        >
                          {dayLabel(wd)} {wd === todayWd && ' (اليوم)'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {HOURS.map(hr => {
                      const hrStr = `${String(hr).padStart(2, '0')}:00`
                      return (
                        <tr key={hr} className="hover:bg-slate-50/50 transition-colors">
                          {/* Hour Header Cell */}
                          <td className="p-3 border-r border-slate-200 font-mono font-bold text-slate-600 bg-slate-50 text-center align-top whitespace-nowrap">
                            {hrStr}
                          </td>

                          {/* Days Cells */}
                          {WEEKDAYS.map(wd => {
                            const slotsInCell = gridData[wd]?.[hr] || []
                            return (
                              <td
                                key={wd}
                                className={`p-2 border-r border-slate-200 align-top min-w-[130px] h-20 ${
                                  wd === todayWd ? 'bg-blue-50/20' : ''
                                }`}
                              >
                                {slotsInCell.length === 0 ? (
                                  <div className="h-full w-full border border-dashed border-slate-200/50 rounded-lg" />
                                ) : (
                                  <div className="space-y-1.5">
                                    {slotsInCell.map((slot, i) => {
                                      const courseName = (lang === 'ar' ? slot.courseNameAr || slot.courseNameFr : slot.courseNameFr || slot.courseNameAr) || ''
                                      const teacherName = (lang === 'ar' ? slot.teacherNameAr || slot.teacherNameFr : slot.teacherNameFr || slot.teacherNameAr) || ''
                                      const styleCls = getCourseStyle(courseName)

                                      return (
                                        <div
                                          key={i}
                                          onClick={() => setInspectSlot(slot)}
                                          className={`p-2 rounded-xl border shadow-xs transition-all cursor-pointer ${styleCls}`}
                                        >
                                          <div className="font-bold text-slate-950 text-xs leading-tight">
                                            {courseName}
                                          </div>
                                          <div className="text-[11px] font-semibold text-blue-700 mt-0.5">
                                            👥 {slot.groupName}
                                          </div>
                                          {teacherName && (
                                            <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1 font-medium">
                                              👤 {teacherName}
                                            </div>
                                          )}
                                          <div className="mt-1 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
                                            <span>⏱ {slot.startTime}–{slot.endTime}</span>
                                            {slot.room && <span className="bg-white/80 px-1 rounded border">🏛 {slot.room}</span>}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                <span>{lang === 'ar' ? `عدد الحصص المعروضة: ${filteredSlots.length} من أصل ${weeklySlots.length}` : `Séances affichées: ${filteredSlots.length} / ${weeklySlots.length}`}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                {lang === 'ar' ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT SLOT DIALOG */}
      {inspectSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#2563EB] font-mono">
                  {dayLabel(inspectSlot.weekday)} · {inspectSlot.startTime} – {inspectSlot.endTime}
                </span>
                <h3 className="font-bold text-lg text-[#0F172A] mt-1">
                  {(lang === 'ar' ? inspectSlot.courseNameAr || inspectSlot.courseNameFr : inspectSlot.courseNameFr || inspectSlot.courseNameAr) || 'Cours'}
                </h3>
              </div>
              <button onClick={() => setInspectSlot(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-medium text-slate-500">{lang === 'ar' ? 'الفوج:' : 'Groupe:'}</span>
                <span className="font-bold text-[#0F172A]">{inspectSlot.groupName}</span>
              </div>

              {(inspectSlot.teacherNameAr || inspectSlot.teacherNameFr) && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-medium text-slate-500">{lang === 'ar' ? 'الأستاذ:' : 'Enseignant:'}</span>
                  <span className="font-bold text-[#0F172A]">
                    {(lang === 'ar' ? inspectSlot.teacherNameAr || inspectSlot.teacherNameFr : inspectSlot.teacherNameFr || inspectSlot.teacherNameAr)}
                  </span>
                </div>
              )}

              {inspectSlot.room && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-medium text-slate-500">{lang === 'ar' ? 'القاعة:' : 'Salle:'}</span>
                  <span className="font-bold text-[#0F172A]">{inspectSlot.room}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => { setInspectSlot(null); setIsModalOpen(false); navigate('/attendance'); }}
                className="flex-1 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors text-center"
              >
                {lang === 'ar' ? 'فتح كشف الحضور' : 'Ouvrir la présence'}
              </button>
              <button
                onClick={() => setInspectSlot(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                {lang === 'ar' ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
