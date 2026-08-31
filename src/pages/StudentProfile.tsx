import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, CreditCard, Printer, Archive, CheckCircle, XCircle, Clock, Save, Trash2, Plus } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import type { PaymentStatus, AttendanceStatus } from '../types'

const TABS = ['Aperçu', 'Présences', 'Paiements', 'Inscriptions', 'Notes']

export default function StudentProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Aperçu')

  const [student, setStudent] = useState<any | null>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const api = (window as any).schoolApp

  const loadProfile = useCallback(async () => {
    if (!api || !id) return
    setLoading(true)
    try {
      const sId = Number(id)
      const [sRes, eRes, pRes] = await Promise.all([
        api.students.getById(sId),
        api.enrollments.byStudent(sId),
        api.payments.byStudent(sId)
      ])

      if (sRes.success && sRes.data) {
        setStudent(sRes.data)
        if (sRes.data.photoPath) {
          const pImg = await api.media.getImageUrl(sRes.data.photoPath)
          if (pImg.success) setPhotoUrl(pImg.data.url)
        }
      }

      if (eRes.success && eRes.data) {
        // Enriched with group & course info
        const enriched = await Promise.all(
          eRes.data.map(async (en: any) => {
            const gRes = await api.groups.list()
            const group = gRes.data?.find((g: any) => g.id === en.groupId)
            const cRes = await api.courses.list()
            const course = cRes.data?.find((c: any) => c.id === group?.courseId)
            return {
              ...en,
              groupName: group?.name ?? '—',
              courseName: (course?.nameFr || course?.nameAr) ?? '—',
              room: group?.room ?? '—',
              startDate: group?.startDate ?? '—',
              endDate: group?.endDate ?? '—',
              capacity: group?.capacity ?? 0,
            }
          })
        )
        setEnrollments(enriched)
      }

      if (pRes.success && pRes.data) {
        setPayments(pRes.data)
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }, [api, id])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleArchive = async () => {
    if (!api || !id || !confirm('Archiver cet étudiant ?')) return
    try {
      const res = await api.students.archive(Number(id))
      if (res.success) navigate('/students')
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddNote = () => {
    if (!newNote.trim()) return
    const noteObj = {
      id: Date.now(),
      text: newNote,
      date: new Date().toLocaleDateString('fr-DZ'),
    }
    setNotes(prev => [noteObj, ...prev])
    setNewNote('')
  }

  const handleDeleteNote = (noteId: number) => {
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <p className="text-sm">Chargement du profil...</p>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg font-semibold">Étudiant introuvable</p>
        <button onClick={() => navigate('/students')} className="mt-3 text-sm text-blue-600 hover:text-blue-800">
          ← Retour à la liste
        </button>
      </div>
    )
  }

  const activeEnrollment = enrollments.find(e => e.status === 'active') ?? enrollments[0]
  const totalPaid = payments.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0)
  const monthlyFee = activeEnrollment?.agreedPrice ?? 0

  const presentCount = attendanceRecords.filter(r => r.attendanceStatus === 'present').length
  const absentCount = attendanceRecords.filter(r => r.attendanceStatus === 'absent').length
  const lateCount = attendanceRecords.filter(r => r.attendanceStatus === 'late').length
  const totalAttendances = attendanceRecords.length
  const attendanceRate = totalAttendances > 0 ? Math.round(((presentCount + lateCount) / totalAttendances) * 100) : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/students')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm text-slate-400">Étudiants</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700">{student.firstNameFr} {student.lastNameFr}</span>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left profile card */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col items-center text-center mb-4">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-20 h-20 rounded-full object-cover bg-slate-100 mb-3 border-2 border-slate-200 shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl mb-3 shadow-sm">
                  {student.firstNameFr?.charAt(0)}{student.lastNameFr?.charAt(0)}
                </div>
              )}
              <h2 className="text-base font-bold text-slate-900">{student.firstNameFr} {student.lastNameFr}</h2>
              {student.firstNameAr && student.lastNameAr && (
                <p className="text-xs text-slate-500 mt-0.5" dir="rtl">{student.lastNameAr} {student.firstNameAr}</p>
              )}
              <p className="text-xs font-mono text-slate-400 mt-0.5">{student.studentNumber}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant={student.status}>{student.status}</Badge>
              </div>
            </div>

            <div className="space-y-2.5 text-sm border-t border-slate-100 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Cours</span>
                <span className="font-medium text-slate-800 text-right">{activeEnrollment?.courseName ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Groupe</span>
                <span className="font-medium text-slate-800">{activeEnrollment?.groupName ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone</span>
                <span className="font-medium text-slate-800 font-mono text-xs">{student.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Adresse</span>
                <span className="font-medium text-slate-800 text-right max-w-32 truncate">{student.address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Inscrit le</span>
                <span className="font-medium text-slate-800">
                  {student.registrationDate ? new Date(student.registrationDate).toLocaleDateString('fr-DZ') : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Ticket QR</span>
                <Badge variant={student.qrTokenActive ? 'success' : 'error'}>
                  {student.qrTokenActive ? 'Actif' : 'Désactivé'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tuteur</h3>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-slate-800">{student.guardianName || 'Non renseigné'}</p>
              <p className="text-xs text-slate-500">{student.guardianRelationship || '—'}</p>
              <p className="text-xs font-mono text-slate-700">{student.guardianPhone || '—'}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate(`/students/${id}/edit`)}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm shadow-sm"
            >
              <Pencil size={14} /> Modifier
            </button>
            <button
              onClick={() => navigate(`/students/${id}/card`)}
              className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors text-sm shadow-sm"
            >
              <Printer size={14} /> Imprimer ticket
            </button>
            <button
              onClick={handleArchive}
              className="flex items-center justify-center gap-2 w-full text-red-600 hover:bg-red-50 font-medium py-2 rounded-lg transition-colors text-sm"
            >
              <Archive size={14} /> Archiver
            </button>
          </div>
        </div>

        {/* Main content tabs */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/40' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'Aperçu' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Présent', value: presentCount, color: 'text-green-600', bg: 'bg-green-50' },
                      { label: 'Absent', value: absentCount, color: 'text-red-600', bg: 'bg-red-50' },
                      { label: 'En retard', value: lateCount, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Taux', value: `${attendanceRate}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center border border-slate-100`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Informations de paiement</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tarif mensuel</span>
                          <span className="font-semibold text-slate-800">{monthlyFee.toLocaleString('fr-DZ')} DA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total payé</span>
                          <span className="font-semibold text-green-700">{totalPaid.toLocaleString('fr-DZ')} DA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Nb paiements</span>
                          <span className="font-medium text-slate-800">{payments.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cours & Inscription</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Cours</span>
                          <span className="font-medium text-slate-800">{activeEnrollment?.courseName ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Groupe</span>
                          <span className="font-medium text-slate-800">{activeEnrollment?.groupName ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Salle</span>
                          <span className="font-medium text-slate-800">{activeEnrollment?.room ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'Présences' && (
                <div>
                  {attendanceRecords.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">Aucune présence enregistrée</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                          <th className="py-2.5 text-left">Date</th>
                          <th className="py-2.5 text-left">Heure</th>
                          <th className="py-2.5 text-left">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {attendanceRecords.map((r, i) => (
                          <tr key={i}>
                            <td className="py-2.5">{r.sessionDate}</td>
                            <td className="py-2.5 font-mono text-xs">{r.scannedAt ?? '—'}</td>
                            <td className="py-2.5">
                              <Badge variant={r.attendanceStatus === 'present' ? 'success' : r.attendanceStatus === 'late' ? 'warning' : 'error'}>
                                {r.attendanceStatus}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'Paiements' && (
                <div>
                  {payments.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">Aucun paiement enregistré pour cet étudiant</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                          <th className="py-2.5 text-left">N° Reçu</th>
                          <th className="py-2.5 text-left">Période</th>
                          <th className="py-2.5 text-right">Montant</th>
                          <th className="py-2.5 text-left">Méthode</th>
                          <th className="py-2.5 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payments.map(p => (
                          <tr key={p.id}>
                            <td className="py-2.5 font-mono text-xs text-blue-700">{p.receiptNumber}</td>
                            <td className="py-2.5">{p.billingPeriod}</td>
                            <td className="py-2.5 text-right font-semibold text-green-700">{p.amount.toLocaleString('fr-DZ')} DA</td>
                            <td className="py-2.5 capitalize">{p.paymentMethod}</td>
                            <td className="py-2.5 text-xs text-slate-500">{new Date(p.paymentDate).toLocaleDateString('fr-DZ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'Inscriptions' && (
                <div className="space-y-3">
                  {enrollments.map(en => (
                    <div key={en.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-slate-800 text-base">{en.groupName}</span>
                        <Badge variant={en.status}>{en.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div><span className="text-slate-400">Cours:</span> {en.courseName}</div>
                        <div><span className="text-slate-400">Salle:</span> {en.room}</div>
                        <div><span className="text-slate-400">Tarif convenu:</span> {en.agreedPrice} DA/mois</div>
                        <div><span className="text-slate-400">Date début:</span> {en.startDate}</div>
                      </div>
                      
                      {/* Convert Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII (0-9) */}
                      {(() => {
                        function normalizeNumberInput(val: string): string {
                          const ascii = val
                            .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
                            .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵٦٧٨٩'.indexOf(d)])
                          return ascii.replace(/[^0-9.]/g, '')
                        }
                        return (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <label className="block font-medium text-slate-600 mb-1 text-xs">
                              {lang === 'ar' ? 'المبلغ المراد تحويله (دج) *' : 'Montant à transférer (DA) *'}
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-bold text-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none"
                              value={transferAmount}
                              onChange={(e) => setTransferAmount(normalizeNumberInput(e.target.value))}
                              placeholder="0"
                              dir="ltr"
                            />
                            <div className="flex gap-1.5 mt-2 flex-wrap text-[11px]">
                              {[500, 1000, 1500, 2000].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setTransferAmount(String(amt))}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-md font-medium text-slate-600 transition-colors"
                                >
                                  {amt} DA
                                </button>
                              ))}
                              {transferModalSource && (
                                <button
                                  type="button"
                                  onClick={() => setTransferAmount(String(transferModalSource.agreedPrice || 0))}
                                  className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md font-bold transition-colors"
                                >
                                  {lang === 'ar' ? 'المبلغ كاملاً' : 'Total'} ({transferModalSource.agreedPrice} DA)
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Notes' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Ajouter une note administrative sur cet étudiant..."
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      className="flex-1 h-20 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none outline-none focus:border-blue-500 bg-white"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {notes.map(n => (
                      <div key={n.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between">
                        <div>
                          <p className="text-sm text-slate-800">{n.text}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">{n.date}</span>
                        </div>
                        <button onClick={() => handleDeleteNote(n.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
