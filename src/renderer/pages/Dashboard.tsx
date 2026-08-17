import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Users, ScanLine, CreditCard, UserPlus, BookOpen, AlertCircle, Calendar, Clock } from 'lucide-react'
import type { Student } from '@shared/types/index'

interface DashboardStats {
  totalActiveStudents: number
  presentToday: number
  absentToday: number
  monthRevenue: number
}

interface UpcomingSession {
  id: number
  groupId: number
  groupName?: string
  sessionDate: string
  plannedStartTime?: string
  status: string
}

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({ totalActiveStudents: 0, presentToday: 0, absentToday: 0, monthRevenue: 0 })
  const [recentStudents, setRecentStudents] = useState<Student[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [studentsResult, paymentsSummary, upcomingRes] = await Promise.all([
          window.schoolApp.students.list({ pageSize: 5, status: 'active' }),
          window.schoolApp.payments.summary(),
          window.schoolApp.sessions.upcoming({ limit: 5 }),
        ])

        if (studentsResult.success && studentsResult.data) {
          setStats((s) => ({ ...s, totalActiveStudents: studentsResult.data!.total }))
          setRecentStudents(studentsResult.data.items.slice(0, 5))
        }

        if (paymentsSummary.success && paymentsSummary.data) {
          setStats((s) => ({ ...s, monthRevenue: paymentsSummary.data!.monthRevenue }))
        }

        if (upcomingRes.success && upcomingRes.data) {
          setUpcomingSessions(upcomingRes.data)
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const statCards = [
    {
      label: t('dashboard.activeStudents'),
      value: stats.totalActiveStudents,
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
      trend: t('dashboard.students'),
    },
    {
      label: t('dashboard.todayClasses'),
      value: upcomingSessions.length,
      icon: ScanLine,
      color: 'bg-green-50 text-green-600',
      trend: t('dashboard.plannedSessions'),
    },
    {
      label: t('dashboard.monthRevenue'),
      value: `${stats.monthRevenue.toLocaleString()} DA`,
      icon: CreditCard,
      color: 'bg-teal-50 text-teal-600',
      trend: t('dashboard.thisMonth'),
    },
  ]

  const quickActions = [
    { label: t('dashboard.addStudent'), icon: UserPlus, to: '/students/new', color: 'bg-[#2563EB] hover:bg-[#1D4ED8]' },
    { label: t('dashboard.startAttendance'), icon: ScanLine, to: '/attendance', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: t('dashboard.recordPayment'), icon: CreditCard, to: '/payments', color: 'bg-[#7C3AED] hover:bg-[#6D28D9]' },
    { label: t('dashboard.createCourse'), icon: BookOpen, to: '/courses', color: 'bg-[#F59E0B] hover:bg-[#D97706]' },
  ]

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
                {card.trend && <p className="text-xs text-slate-400 mt-1">{card.trend}</p>}
              </div>
              <div className={`p-2.5 rounded-lg ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions + recent students */}
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

        {/* Recent students */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0F172A] text-sm">{t('nav.students')}</h3>
            <button onClick={() => navigate('/students')} className="text-xs text-[#2563EB] hover:underline">
              {t('dashboard.viewAll')}
            </button>
          </div>

          {recentStudents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('students.noStudents')}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentStudents.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] font-semibold text-xs shrink-0">
                    {s.firstNameAr.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate" dir="rtl">{s.lastNameAr} {s.firstNameAr}</p>
                    <p className="text-xs text-slate-400">{s.studentNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming sessions */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0F172A] text-sm flex items-center gap-2">
              <Calendar size={14} /> {t('dashboard.todayClasses')}
            </h3>
            <button onClick={() => navigate('/courses')} className="text-xs text-[#2563EB] hover:underline">
              {t('courses.manage')}
            </button>
          </div>

          {upcomingSessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">{t('dashboard.noClassesToday')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((sess) => (
                <div key={sess.id} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#0F172A]">{sess.groupName ?? `Groupe #${sess.groupId}`}</p>
                    <p className="text-slate-400">{sess.plannedStartTime ?? '10:00'}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-[#2563EB] font-semibold text-[10px]">
                    {sess.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
