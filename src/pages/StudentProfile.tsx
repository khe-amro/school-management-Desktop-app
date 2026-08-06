import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, CreditCard, Printer, Archive, CheckCircle, XCircle, Clock } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { students, courses, groups, payments, attendanceSessions } from '../data/mockData'
import type { PaymentStatus } from '../types'

const TABS = ['Aperçu', 'Présences', 'Paiements', 'Inscriptions', 'Notes']

export default function StudentProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Aperçu')

  const student = students.find(s => s.id === id)
  if (!student) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <p className="text-lg font-semibold">Étudiant introuvable</p>
      <button onClick={() => navigate('/students')} className="mt-3 text-sm text-blue-600 hover:text-blue-800">← Retour à la liste</button>
    </div>
  )

  const course = courses.find(c => c.id === student.courseId)
  const group = groups.find(g => g.id === student.groupId)
  const studentPayments = payments.filter(p => p.studentId === id)
  const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0)
  const outstanding = student.monthlyFee - (studentPayments.find(p => p.billingPeriod === '2026-07')?.amount ?? 0)

  const attendanceRecords = attendanceSessions.flatMap(s => s.records.filter(r => r.studentId === id).map(r => ({ ...r, session: s })))
  const presentCount = attendanceRecords.filter(r => r.status === 'present').length
  const absentCount = attendanceRecords.filter(r => r.status === 'absent').length
  const lateCount = attendanceRecords.filter(r => r.status === 'late').length
  const total = attendanceRecords.length
  const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/students')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ArrowLeft size={18} /></button>
        <span className="text-sm text-slate-400">Étudiants</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700">{student.firstName} {student.lastName}</span>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left profile card */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col items-center text-center mb-4">
              <img src={student.photo} alt={student.firstName} className="w-20 h-20 rounded-full object-cover bg-slate-100 mb-3" />
              <h2 className="text-base font-bold text-slate-900">{student.firstName} {student.lastName}</h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">{student.studentNumber}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant={student.status}>{student.status}</Badge>
                <Badge variant={student.paymentStatus as PaymentStatus}>{student.paymentStatus}</Badge>
              </div>
            </div>
            <div className="space-y-2.5 text-sm border-t border-slate-100 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Cours</span>
                <span className="font-medium text-slate-800 text-right">{course?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Groupe</span>
                <span className="font-medium text-slate-800">{group?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone</span>
                <span className="font-medium text-slate-800">{student.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Adresse</span>
                <span className="font-medium text-slate-800 text-right max-w-32">{student.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Inscrit le</span>
                <span className="font-medium text-slate-800">{new Date(student.registrationDate).toLocaleDateString('fr-DZ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Carte QR</span>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tuteur</h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-800">{student.guardianName}</p>
              <p className="text-slate-500">{student.guardianRelationship}</p>
              <p className="text-slate-700">{student.guardianPhone}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={() => navigate(`/students/${id}/edit`)} className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
              <Pencil size={14} /> Modifier
            </button>
            <button className="flex items-center justify-center gap-2 w-full bg-green-50 hover:bg-green-100 text-green-700 font-medium py-2.5 rounded-lg transition-colors text-sm border border-green-200">
              <CreditCard size={14} /> Enregistrer paiement
            </button>
            <button onClick={() => navigate(`/students/${id}/card`)} className="flex items-center justify-center gap-2 w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium py-2.5 rounded-lg transition-colors text-sm border border-slate-200">
              <Printer size={14} /> Imprimer carte
            </button>
            <button className="flex items-center justify-center gap-2 w-full text-red-600 hover:bg-red-50 font-medium py-2 rounded-lg transition-colors text-sm">
              <Archive size={14} /> Archiver
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === 'Aperçu' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Présent', value: presentCount, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
                      { label: 'Absent', value: absentCount, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
                      { label: 'En retard', value: lateCount, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
                      { label: 'Taux présence', value: `${rate}%`, color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Informations de paiement</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Frais mensuel</span><span className="font-semibold text-slate-800">{student.monthlyFee.toLocaleString('fr-DZ')} DA</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Total payé</span><span className="font-semibold text-green-700">{totalPaid.toLocaleString('fr-DZ')} DA</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Solde dû</span><span className={`font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>{outstanding > 0 ? outstanding.toLocaleString('fr-DZ') + ' DA' : 'À jour'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Dernier paiement</span><span className="font-medium text-slate-800">{studentPayments.length > 0 ? new Date(studentPayments[studentPayments.length - 1].date).toLocaleDateString('fr-DZ') : '—'}</span></div>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cours & Inscription</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Cours</span><span className="font-medium text-slate-800">{course?.name}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Groupe</span><span className="font-medium text-slate-800">{group?.name}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Salle</span><span className="font-medium text-slate-800">{group?.room}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Horaire</span><span className="font-medium text-slate-800 text-right max-w-28">{group?.schedule}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'Présences' && (
                <div>
                  {attendanceRecords.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Aucune présence enregistrée</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100"><th className="py-2 text-left text-xs text-slate-500 font-semibold">Date</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Heure</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Statut</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {attendanceRecords.map(r => (
                          <tr key={r.id}>
                            <td className="py-2.5">{r.session.date}</td>
                            <td className="py-2.5 font-mono text-xs">{r.scanTime ?? '—'}</td>
                            <td className="py-2.5"><Badge variant={r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'error'}>{r.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'Paiements' && (
                <div>
                  {studentPayments.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Aucun paiement enregistré</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100"><th className="py-2 text-left text-xs text-slate-500 font-semibold">Reçu</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Période</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Montant</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Méthode</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Date</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {studentPayments.map(p => (
                          <tr key={p.id}>
                            <td className="py-2.5 font-mono text-xs text-blue-600">{p.receiptNumber}</td>
                            <td className="py-2.5">{p.billingPeriod}</td>
                            <td className="py-2.5 font-semibold text-green-700">{p.amount.toLocaleString('fr-DZ')} DA</td>
                            <td className="py-2.5 capitalize">{p.method}</td>
                            <td className="py-2.5">{new Date(p.date).toLocaleDateString('fr-DZ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'Inscriptions' && (
                <div className="bg-slate-50 rounded-xl p-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-slate-500">Cours inscrit</span><span className="font-medium">{course?.name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Groupe</span><span className="font-medium">{group?.name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Date début</span><span className="font-medium">{group?.startDate}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Date fin</span><span className="font-medium">{group?.endDate}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Capacité</span><span className="font-medium">{group?.enrolledCount} / {group?.capacity}</span></div>
                  </div>
                </div>
              )}

              {tab === 'Notes' && (
                <div>
                  <textarea placeholder="Ajouter une note sur cet étudiant..." className="w-full h-40 px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white" />
                  <button className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Sauvegarder</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
