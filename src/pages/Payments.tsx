import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Download, Printer, TrendingUp, AlertCircle, DollarSign, Users, X, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import type { Payment, PaymentMethod } from '../types'

function Receipt({ payment, student, group, course, schoolSettings, onClose }: {
  payment: any
  student: any
  group: any
  course: any
  schoolSettings: any
  onClose: () => void
}) {
  const handlePrint = async () => {
    const api = (window as any).schoolApp
    if (api) await api.app.print()
  }

  return (
    <div>
      <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-white font-mono text-sm shadow-sm" style={{ width: 300, margin: '0 auto' }}>
        <div className="text-center mb-4">
          <p className="font-bold text-base text-slate-900 tracking-wider">✦ EDUPILOT DZ ✦</p>
          <p className="text-xs text-slate-600 font-semibold mt-0.5">{schoolSettings?.schoolNameFr || 'Edupilot School'}</p>
          <p className="text-[11px] text-slate-400 mt-1">Reçu N° {payment.receiptNumber}</p>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Étudiant:</span>
            <span className="font-bold text-slate-800">{student ? `${student.firstNameFr} ${student.lastNameFr}` : `N° ${payment.studentId}`}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">N° Étudiant:</span>
            <span className="font-mono text-slate-700">{student?.studentNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Cours:</span>
            <span>{course?.nameFr || course?.nameAr || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Groupe:</span>
            <span>{group?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Période:</span>
            <span className="font-semibold">{payment.billingPeriod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Mode:</span>
            <span className="capitalize">{payment.paymentMethod || payment.method}</span>
          </div>
          {payment.reference && (
            <div className="flex justify-between">
              <span className="text-slate-500">Réf:</span>
              <span>{payment.reference}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Date:</span>
            <span>{new Date(payment.paymentDate || payment.date).toLocaleDateString('fr-DZ')}</span>
          </div>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <div className="flex justify-between font-bold text-base text-slate-900">
          <span>TOTAL</span>
          <span>{Number(payment.amount).toLocaleString('fr-DZ')} DA</span>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <p className="text-[10px] text-slate-400 text-center">Merci pour votre confiance !</p>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
        >
          <Printer size={14} /> Imprimer reçu
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [schoolSettings, setSchoolSettings] = useState<any | null>(null)

  const [summary, setSummary] = useState({ monthRevenue: 0, todayCollected: 0, outstanding: 0, overdue: 0 })
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [receiptModal, setReceiptModal] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    studentId: '',
    enrollmentId: '',
    billingPeriod: new Date().toISOString().substring(0, 7),
    amount: '2500',
    method: 'cash' as PaymentMethod,
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  })

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [pRes, sRes, gRes, cRes, sumRes, setRes] = await Promise.all([
        api.payments.list({ pageSize: 100 }),
        api.students.list({ pageSize: 500 }),
        api.groups.list(),
        api.courses.list(),
        api.payments.summary ? api.payments.summary() : Promise.resolve({ success: false }),
        api.settings.get(),
      ])

      if (pRes.success && pRes.data) setPayments(pRes.data.items || [])
      if (sRes.success && sRes.data) setStudents(sRes.data.items || [])
      if (gRes.success && gRes.data) setGroups(gRes.data || [])
      if (cRes.success && cRes.data) setCourses(cRes.data || [])
      if (sumRes.success && sumRes.data) setSummary(sumRes.data)
      if (setRes.success && setRes.data) setSchoolSettings(setRes.data)
    } catch (err) {
      console.error('Failed to load payments:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  // When student selected in add modal, load their active enrollments
  const handleStudentSelect = async (studentId: string) => {
    setForm(f => ({ ...f, studentId, enrollmentId: '' }))
    if (!studentId || !api) return
    try {
      const enRes = await api.enrollments.byStudent(Number(studentId))
      if (enRes.success && enRes.data && enRes.data.length > 0) {
        setEnrollments(enRes.data)
        const active = enRes.data.find((e: any) => e.status === 'active') ?? enRes.data[0]
        setForm(f => ({
          ...f,
          enrollmentId: String(active.id),
          amount: String(active.agreedPrice || 2500)
        }))
      } else {
        setEnrollments([])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddPayment = async () => {
    if (!api || !form.studentId || !form.enrollmentId || !form.amount) {
      alert('Veuillez sélectionner un étudiant avec inscription et renseigner le montant')
      return
    }

    try {
      const res = await api.payments.create({
        studentId: Number(form.studentId),
        enrollmentId: Number(form.enrollmentId),
        billingPeriod: form.billingPeriod,
        amount: Number(form.amount),
        paymentMethod: form.method,
        paymentDate: form.date,
        reference: form.reference || null,
        notes: form.notes || null,
      })

      if (res.success && res.data) {
        setAddModalOpen(false)
        setReceiptModal(res.data)
        loadData()
      } else {
        alert(res.error?.message || 'Erreur lors de l\'enregistrement du paiement')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCancelPayment = async (id: number) => {
    const reason = prompt('Motif d\'annulation :')
    if (reason === null || !api) return
    try {
      const res = await api.payments.cancel(id, reason)
      if (res.success) {
        loadData()
      } else {
        alert(res.error?.message || 'Erreur annulation')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = payments.filter(p => {
    const student = students.find(s => s.id === p.studentId)
    const q = search.toLowerCase()
    const matchSearch = !q || `${student?.firstNameFr} ${student?.lastNameFr} ${p.receiptNumber}`.toLowerCase().includes(q)
    const matchStatus = !filterStatus || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const methodLabels: Record<PaymentMethod, string> = { cash: 'Espèces', transfer: 'Virement', check: 'Chèque' }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Revenus ce mois"
          value={`${summary.monthRevenue.toLocaleString('fr-DZ')} DA`}
          change="Facturation mensuelle"
          changePositive
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Collecté aujourd'hui"
          value={`${summary.todayCollected.toLocaleString('fr-DZ')} DA`}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Solde en attente"
          value={`${summary.outstanding.toLocaleString('fr-DZ')} DA`}
          change="estimé"
          icon={AlertCircle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Paiements en retard"
          value={summary.overdue}
          icon={Users}
          iconColor="text-red-500"
          iconBg="bg-red-50"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par étudiant ou N° reçu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full placeholder-slate-400 text-slate-700"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700"
        >
          <option value="">Tous les statuts</option>
          <option value="paid">Payé</option>
          <option value="cancelled">Annulé</option>
        </select>
        <button
          onClick={() => (window as any).schoolApp?.app.print()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Printer size={14} /> Imprimer
        </button>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={14} /> Enregistrer
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['N° Reçu', 'Étudiant', 'Période', 'Montant', 'Méthode', 'Date', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                    Aucun paiement trouvé
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const student = students.find(s => s.id === p.studentId)
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{p.receiptNumber}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">
                          {student ? `${student.firstNameFr} ${student.lastNameFr}` : `Étudiant #${p.studentId}`}
                        </span>
                        <p className="text-[11px] font-mono text-slate-400">{student?.studentNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{p.billingPeriod}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{Number(p.amount).toLocaleString('fr-DZ')} DA</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{methodLabels[p.paymentMethod as PaymentMethod] || p.paymentMethod}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{new Date(p.paymentDate).toLocaleDateString('fr-DZ')}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === 'paid' ? 'success' : 'error'}>
                          {p.status === 'paid' ? 'Payé' : 'Annulé'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <button
                          onClick={() => setReceiptModal(p)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          <Printer size={12} /> Reçu
                        </button>
                        {p.status === 'paid' && (
                          <button
                            onClick={() => handleCancelPayment(p.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium ml-1"
                            title="Annuler ce reçu"
                          >
                            <XCircle size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add payment modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Enregistrer un paiement" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Étudiant *</label>
              <select
                value={form.studentId}
                onChange={e => handleStudentSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                <option value="">Sélectionner un étudiant</option>
                {students.filter(s => s.status === 'active').map(s => (
                  <option key={s.id} value={s.id}>{s.firstNameFr} {s.lastNameFr} ({s.studentNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Inscription / Groupe *</label>
              <select
                value={form.enrollmentId}
                onChange={e => setForm(f => ({ ...f, enrollmentId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                <option value="">Sélectionner l'inscription</option>
                {enrollments.map(en => {
                  const g = groups.find(grp => grp.id === en.groupId)
                  return (
                    <option key={en.id} value={en.id}>{g?.name || `Groupe #${en.groupId}`} — {en.agreedPrice} DA</option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Période de facturation</label>
              <input
                type="month"
                value={form.billingPeriod}
                onChange={e => setForm(f => ({ ...f, billingPeriod: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Montant (DA) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="2500"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Méthode de paiement</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                <option value="cash">Espèces</option>
                <option value="transfer">Virement</option>
                <option value="check">Chèque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Date du paiement</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Référence / N° Chèque</label>
            <input
              type="text"
              placeholder="Optionnel..."
              value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleAddPayment} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Enregistrer & Émettre reçu</button>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal open={receiptModal !== null} onClose={() => setReceiptModal(null)} title="Reçu de paiement" size="sm">
        {receiptModal && (
          <Receipt
            payment={receiptModal}
            student={students.find(s => s.id === receiptModal.studentId)}
            group={groups.find(g => g.id === receiptModal.groupId)}
            course={courses.find(c => c.id === receiptModal.courseId)}
            schoolSettings={schoolSettings}
            onClose={() => setReceiptModal(null)}
          />
        )}
      </Modal>
    </div>
  )
}
