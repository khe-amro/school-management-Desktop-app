import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Users, ScanLine, CreditCard, UserPlus, BookOpen,
  Calendar, Clock, ChevronRight,
} from 'lucide-react'

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const WEEKDAY_AR  = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
const WEEKDAY_FR  = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

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
  weekday: number
  startTime: string
  endTime: string
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

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'ar' | 'fr' | 'en'
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats>({ totalActiveStudents: 0, todaySessions: 0, todayCollected: 0, outstanding: 0 })
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([])
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)

      const [studentsRes, summaryRes, upcomingRes, schedulesRes] = await Promise.all([
        window.schoolApp.students.list({ pageSize: 1, status: 'active' }),
        window.schoolApp.payments.summary(),
        window.schoolApp.sessions.upcoming({ limit: 50 }),
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
        // Deduplicate by sessionId — prevent duplicates appearing
        const seen = new Set<number>()
        const deduped = (upcomingRes.data as TodaySession[]).filter(s => {
          if (seen.has(s.id)) return false
          seen.add(s.id)
          return true
        })
        setTodaySessions(deduped)
        setStats(s => ({ ...s, todaySessions: deduped.length }))
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

  // Group weekly slots by weekday
  const slotsByDay: Record<number, WeeklySlot[]> = {}
  for (const slot of weeklySlots) {
    if (!slotsByDay[slot.weekday]) slotsByDay[slot.weekday] = []
    slotsByDay[slot.weekday].push(slot)
  }

  const dayLabel = (wd: number) => lang === 'ar' ? WEEKDAY_AR[wd]! : WEEKDAY_FR[wd]!

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
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

        {/* Weekly Schedule */}
        <div className="bg-white rounded-xl border border-border p-5 col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0F172A] text-sm flex items-center gap-2">
              <Calendar size={14} />
              {lang === 'ar' ? 'الجدول الأسبوعي' : 'Planning hebdomadaire'}
            </h3>
            <button onClick={() => navigate('/courses')} className="text-xs text-[#2563EB] hover:underline">
              {lang === 'ar' ? 'إدارة' : 'Gérer'}
            </button>
          </div>

          {weeklySlots.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">{lang === 'ar' ? 'لا توجد جداول مسجّلة' : 'Aucun planning enregistré'}</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {[0, 1, 2, 3, 4, 5, 6].map(wd => {
                const slots = slotsByDay[wd]
                if (!slots || slots.length === 0) return null
                return (
                  <div key={wd} className={`rounded-lg ${wd === todayWd ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'} p-2`}>
                    <p className={`text-[11px] font-bold mb-1 ${wd === todayWd ? 'text-[#2563EB]' : 'text-slate-500'}`}>
                      {dayLabel(wd)} {wd === todayWd && (lang === 'ar' ? '← اليوم' : '← Aujourd\'hui')}
                    </p>
                    <div className="space-y-1">
                      {slots.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-[#0F172A] truncate max-w-[120px]">
                            {s.groupName}
                          </span>
                          <span className="text-slate-400 font-mono shrink-0">
                            {s.startTime}–{s.endTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's sessions */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0F172A] text-sm flex items-center gap-2">
              <Clock size={14} />
              {lang === 'ar' ? 'حصص اليوم' : "Séances d'aujourd'hui"}
            </h3>
            <button onClick={() => navigate('/attendance')} className="text-xs text-[#2563EB] hover:underline">
              {lang === 'ar' ? 'الحضور' : 'Présence'}
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
    </div>
  )
}
