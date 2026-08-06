import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Search, Download, ChevronRight } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { attendanceSessions, students, courses, groups, teachers } from '../data/mockData'
import type { AttendanceStatus } from '../types'

const rateData = [
  { date: '22/07', rate: 82 }, { date: '23/07', rate: 88 }, { date: '24/07', rate: 79 },
  { date: '25/07', rate: 91 }, { date: '26/07', rate: 85 }, { date: '27/07', rate: 87 }, { date: '28/07', rate: 90 },
]

export default function AttendanceHistory() {
  const [filterCourse, setFilterCourse] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [selectedSession, setSelectedSession] = useState<typeof attendanceSessions[0] | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = attendanceSessions.filter(s => {
    return (!filterCourse || s.courseId === filterCourse) && (!filterDate || s.date === filterDate)
  })

  return (
    <div className="space-y-5">
      {/* Rate chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Taux de présence — 7 derniers jours</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={rateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[60, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(v) => [`${v}%`, 'Taux']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: '#2563EB', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white">
          <option value="">Tous les cours</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white" />
        <button onClick={() => { setFilterCourse(''); setFilterDate('') }} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Réinitialiser</button>
        <button className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Download size={14} /> Exporter
        </button>
      </div>

      {/* Sessions table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cours / Groupe</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Présents</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Absents</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">En retard</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Taux</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(s => {
              const course = courses.find(c => c.id === s.courseId)
              const group = groups.find(g => g.id === s.groupId)
              const present = s.records.filter(r => r.status === 'present').length
              const late = s.records.filter(r => r.status === 'late').length
              const absent = s.records.filter(r => r.status === 'absent').length
              const total = s.records.length
              const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
              return (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{new Date(s.date).toLocaleDateString('fr-DZ')}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{course?.name}</p>
                    <p className="text-xs text-slate-400">{group?.name} · {s.startTime}</p>
                  </td>
                  <td className="px-5 py-3 text-green-700 font-semibold">{present}</td>
                  <td className="px-5 py-3 text-red-600 font-semibold">{absent}</td>
                  <td className="px-5 py-3 text-amber-600 font-semibold">{late}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{rate}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => { setSelectedSession(s); setModalOpen(true) }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                      Voir <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Session detail modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Session du ${selectedSession ? new Date(selectedSession.date).toLocaleDateString('fr-DZ') : ''}`} size="md">
        {selectedSession && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100"><th className="py-2 text-left text-xs text-slate-500 font-semibold">Étudiant</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Heure</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Statut</th></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {selectedSession.records.map(r => {
                const student = students.find(s => s.id === r.studentId)
                return (
                  <tr key={r.id}>
                    <td className="py-2.5 flex items-center gap-2">
                      {student && <img src={student.photo} alt={student.firstName} className="w-6 h-6 rounded-full object-cover" />}
                      <span>{student ? `${student.firstName} ${student.lastName}` : r.studentId}</span>
                    </td>
                    <td className="py-2.5 font-mono text-xs">{r.scanTime ?? '—'}</td>
                    <td className="py-2.5"><Badge variant={r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'error'}>{r.status}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  )
}
