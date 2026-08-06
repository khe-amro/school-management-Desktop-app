import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, UserCheck, UserX, TrendingUp, AlertCircle, Plus, ScanLine, CreditCard, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import { students, payments, weeklyAttendance, monthlyRevenue, groups, courses, teachers } from '../data/mockData'
import type { PaymentStatus } from '../types'

const todayClasses = [
  { time: '08:00', course: 'English A1', group: 'A1 Morning', room: 'Room 101', teacher: 'Amina Benali', enrolled: 12 },
  { time: '09:00', course: 'Mathématiques', group: 'Math Group A', room: 'Room 201', teacher: 'Karim Meziani', enrolled: 16 },
  { time: '10:00', course: 'English B1', group: 'B1 Morning', room: 'Room 103', teacher: 'Amina Benali', enrolled: 8 },
  { time: '10:00', course: 'French', group: 'French Morning', room: 'Room 104', teacher: 'Youcef Brahim', enrolled: 11 },
  { time: '14:00', course: 'Informatique', group: 'Computers Basics 1', room: 'Lab 1', teacher: 'Fatima Ouahab', enrolled: 9 },
]

const recentScans = [
  { student: 'Meriem Benhamouda', time: '08:03', group: 'A1 Morning', status: 'present' },
  { student: 'Adel Himeur', time: '07:58', group: 'A1 Morning', status: 'present' },
  { student: 'Amine Khelifi', time: '08:18', group: 'A1 Morning', status: 'late' },
  { student: 'Souhila Hadji', time: '14:01', group: 'Computers Basics 1', status: 'present' },
]

const overdueStudents = students.filter(s => s.paymentStatus === 'overdue' || s.paymentStatus === 'unpaid').slice(0, 5)

export default function Dashboard() {
  const navigate = useNavigate()
  const activeStudents = students.filter(s => s.status === 'active').length
  const monthRevenue = payments.filter(p => p.billingPeriod === '2026-07').reduce((sum, p) => sum + p.amount, 0)
  const outstanding = students.filter(s => s.paymentStatus === 'overdue').length

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard title="Étudiants actifs" value={activeStudents} change="2 ce mois" changePositive={true} icon={Users} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Présents aujourd'hui" value={34} change="+8% vs hier" changePositive={true} icon={UserCheck} iconColor="text-green-600" iconBg="bg-green-50" />
        <StatCard title="Absents aujourd'hui" value={8} change="-3% vs hier" changePositive={true} icon={UserX} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="Revenus ce mois" value={`${monthRevenue.toLocaleString('fr-DZ')} DA`} change="+12% vs juin" changePositive={true} icon={TrendingUp} iconColor="text-teal-600" iconBg="bg-teal-50" />
        <StatCard title="Paiements en retard" value={outstanding} change="étudiants" icon={AlertCircle} iconColor="text-amber-600" iconBg="bg-amber-50" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Présences — 7 derniers jours</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyAttendance} barSize={18} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              <Bar dataKey="present" name="Présents" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="Absents" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name="En retard" fill="#FCD34D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Revenus mensuels (DA)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString('fr-DZ')} DA`, 'Revenus']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
              <Line type="monotone" dataKey="revenue" stroke="#14B8A6" strokeWidth={2.5} dot={{ fill: '#14B8A6', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Today's classes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Cours aujourd'hui</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {todayClasses.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                <span className="text-xs font-mono text-blue-600 w-12 shrink-0">{c.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.course}</p>
                  <p className="text-xs text-slate-500 truncate">{c.group} · {c.room}</p>
                </div>
                <span className="text-xs text-slate-400">{c.enrolled}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent scans */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Scans récents</h2>
            <button onClick={() => navigate('/attendance')} className="text-xs text-blue-600 hover:text-blue-800">Scanner →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentScans.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">{r.student[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.student}</p>
                  <p className="text-xs text-slate-500">{r.group}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-slate-600">{r.time}</p>
                  <Badge variant={r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'error'}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Students with overdue */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Paiements en retard</h2>
            <button onClick={() => navigate('/payments')} className="text-xs text-blue-600 hover:text-blue-800">Voir tout →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {overdueStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <img src={s.photo} alt={s.firstName} className="w-7 h-7 rounded-full object-cover bg-slate-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-slate-500">{s.monthlyFee.toLocaleString('fr-DZ')} DA / mois</p>
                </div>
                <Badge variant={s.paymentStatus as PaymentStatus}>{s.paymentStatus}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Actions rapides</h2>
        <div className="flex gap-3">
          {[
            { label: 'Ajouter un étudiant', icon: Plus, to: '/students/new', color: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Démarrer la présence', icon: ScanLine, to: '/attendance', color: 'bg-teal-600 hover:bg-teal-700' },
            { label: 'Enregistrer un paiement', icon: CreditCard, to: '/payments', color: 'bg-green-600 hover:bg-green-700' },
            { label: 'Créer un cours', icon: BookOpen, to: '/courses', color: 'bg-purple-600 hover:bg-purple-700' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors ${a.color}`}
            >
              <a.icon size={15} /> {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
