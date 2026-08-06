import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Users, ScanLine, CreditCard, TrendingUp, UserPlus, BookOpen, AlertCircle } from 'lucide-react'
import type { Student } from '@shared/types/index'

interface DashboardStats {
  totalActiveStudents: number
  presentToday: number
  absentToday: number
  monthRevenue: number
}

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({ totalActiveStudents: 0, presentToday: 0, absentToday: 0, monthRevenue: 0 })
  const [recentStudents, setRecentStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [studentsResult, paymentsResult] = await Promise.all([
          window.schoolApp.students.list({ pageSize: 5, status: 'active' }),
          window.schoolApp.payments.list({ pageSize: 200 }),
        ])

        if (studentsResult.success && studentsResult.data) {
          setStats((s) => ({ ...s, totalActiveStudents: studentsResult.data!.total }))
          setRecentStudents(studentsResult.data.items.slice(0, 5))
        }

        if (paymentsResult.success && paymentsResult.data) {
          const now = new Date()
          const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          const monthRev = paymentsResult.data.items
            .filter((p) => p.billingPeriod === monthStr && p.status === 'paid')
            .reduce((sum, p) => sum + p.amount, 0)
          setStats((s) => ({ ...s, monthRevenue: monthRev }))
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
      label: t('dashboard.presentToday'),
      value: stats.presentToday,
      icon: ScanLine,
      color: 'bg-green-50 text-green-600',
      trend: '',
    },
    {
      label: t('dashboard.absentToday'),
      value: stats.absentToday,
      icon: AlertCircle,
      color: 'bg-red-50 text-red-600',
      trend: '',
    },
    {
      label: t('dashboard.monthRevenue'),
      value: `${stats.monthRevenue.toLocaleString()} دج`,
      icon: CreditCard,
      color: 'bg-teal-50 text-teal-600',
      trend: t('dashboard.thisMonth'),
    },
  ]

  const quickActions = [
    { label: t('dashboard.addStudent'), icon: UserPlus, to: '/students/new', color: 'bg-[#2563EB] hover:bg-[#1D4ED8]' },
    { label: t('dashboard.startAttendance'), icon: ScanLine, to: '/attendance', color: 'bg-accent hover:bg-[#0D9488]' },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                className={`${action.color} text-white rounded-xl p-3.5 flex flex-col items-center gap-2 transition-colors text-center`}
              >
                <action.icon size={20} />
                <span className="text-xs font-medium leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent students */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0F172A] text-sm">{t('nav.students')}</h3>
            <button
              onClick={() => navigate('/students')}
              className="text-xs text-[#2563EB] hover:underline"
            >
              {t('dashboard.viewAll')}
            </button>
          </div>

          {recentStudents.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('students.noStudents')}</p>
              <p className="text-xs mt-1">{t('students.noStudentsDesc')}</p>
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
                    <p className="text-sm font-medium text-[#0F172A] truncate">{s.lastNameAr} {s.firstNameAr}</p>
                    <p className="text-xs text-slate-400">{s.studentNumber}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {t(`students.${s.status}`)}
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
