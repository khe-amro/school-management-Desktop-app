import { useState } from 'react'
import { Search, Plus, Download, Printer, TrendingUp, AlertCircle, DollarSign, Users } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import { payments as initialPayments, students, courses, groups } from '../data/mockData'
import type { Payment, PaymentMethod } from '../types'

function Receipt({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const student = students.find(s => s.id === payment.studentId)
  const course = courses.find(c => c.id === payment.courseId)
  return (
    <div>
      <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50 font-mono text-sm">
        <div className="text-center mb-4">
          <p className="font-bold text-base text-slate-900">EDUPILOT DZ</p>
          <p className="text-xs text-slate-500">Reçu de paiement</p>
          <p className="text-xs text-slate-400 mt-1">{payment.receiptNumber}</p>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-slate-500">Étudiant</span><span className="font-medium">{student?.firstName} {student?.lastName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Cours</span><span>{course?.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Période</span><span>{payment.billingPeriod}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Méthode</span><span className="capitalize">{payment.method}</span></div>
          {payment.reference && <div className="flex justify-between"><span className="text-slate-500">Référence</span><span>{payment.reference}</span></div>}
          <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{new Date(payment.date).toLocaleDateString('fr-DZ')}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Reçu par</span><span>{payment.receivedBy}</span></div>
        </div>
        <div className="border-t border-dashed border-slate-300 my-3" />
        <div className="flex justify-between font-bold text-base text-slate-900">
          <span>TOTAL</span>
          <span>{payment.amount.toLocaleString('fr-DZ')} DA</span>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><Printer size={13} /> Imprimer</button>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Fermer</button>
      </div>
    </div>
  )
}

export default function Payments() {
  const [payments, setPayments] = useState(initialPayments)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [receiptModal, setReceiptModal] = useState<Payment | null>(null)
  const [form, setForm] = useState({ studentId: '', groupId: '', courseId: '', billingPeriod: '2026-07', amount: '', method: 'cash' as PaymentMethod, reference: '', notes: '', date: new Date().toISOString().split('T')[0] })

  const monthRevenue = payments.filter(p => p.billingPeriod === '2026-07').reduce((s, p) => s + p.amount, 0)
  const todayPayments = payments.filter(p => p.date === new Date().toISOString().split('T')[0]).reduce((s, p) => s + p.amount, 0)
  const overdueCount = students.filter(s => s.paymentStatus === 'overdue').length

  const filtered = payments.filter(p => {
    const student = students.find(s => s.id === p.studentId)
    const q = search.toLowerCase()
    const matchSearch = !q || `${student?.firstName} ${student?.lastName} ${p.receiptNumber}`.toLowerCase().includes(q)
    const matchStatus = !filterStatus || p.status === filterStatus
    const matchGroup = !filterGroup || p.groupId === filterGroup
    return matchSearch && matchStatus && matchGroup
  }).sort((a, b) => b.date.localeCompare(a.date))

  const handleAddPayment = () => {
    const course = groups.find(g => g.id === form.groupId)
    const newPayment: Payment = {
      id: `p${Date.now()}`,
      receiptNumber: `RCP-2026-${(payments.length + 1).toString().padStart(3, '0')}`,
      studentId: form.studentId,
      groupId: form.groupId,
      courseId: form.courseId || course?.courseId || '',
      billingPeriod: form.billingPeriod,
      amount: Number(form.amount),
      method: form.method,
      reference: form.reference,
      notes: form.notes,
      date: form.date,
      receivedBy: 'Admin',
      status: 'paid',
    }
    const added = [newPayment, ...payments]
    setPayments(added)
    setAddModalOpen(false)
    setReceiptModal(newPayment)
  }

  const methodLabels: Record<PaymentMethod, string> = { cash: 'Espèces', transfer: 'Virement', check: 'Chèque' }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Revenus ce mois" value={`${monthRevenue.toLocaleString('fr-DZ')} DA`} change="+12% vs juin" changePositive icon={TrendingUp} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Collecté aujourd'hui" value={`${todayPayments.toLocaleString('fr-DZ')} DA`} icon={DollarSign} iconColor="text-green-600" iconBg="bg-green-50" />
        <StatCard title="Solde en attente" value="12 500 DA" change="estimé" icon={AlertCircle} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Paiements en retard" value={overdueCount} icon={Users} iconColor="text-red-500" iconBg="bg-red-50" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1">
          <Search size={14} className="text-slate-400" />
          <input type="text" placeholder="Rechercher par étudiant ou N° reçu..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full placeholder-slate-400" />
        </div>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white">
          <option value="">Tous les groupes</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white">
          <option value="">Tous</option>
          <option value="paid">Payé</option>
          <option value="cancelled">Annulé</option>
        </select>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <Download size={14} /> Exporter
        </button>
        <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          <Plus size={14} /> Enregistrer
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['N° Reçu', 'Étudiant', 'Cours / Groupe', 'Période', 'Montant', 'Méthode', 'Date', 'Reçu par', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => {
                const student = students.find(s => s.id === p.studentId)
                const course = courses.find(c => c.id === p.courseId)
                const group = groups.find(g => g.id === p.groupId)
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{p.receiptNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {student && <img src={student.photo} alt={student.firstName} className="w-7 h-7 rounded-full object-cover bg-slate-100" />}
                        <span className="font-medium text-slate-800">{student?.firstName} {student?.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{course?.name}</p>
                      <p className="text-xs text-slate-400">{group?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.billingPeriod}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{p.amount.toLocaleString('fr-DZ')} DA</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{methodLabels[p.method]}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(p.date).toLocaleDateString('fr-DZ')}</td>
                    <td className="px-4 py-3 text-slate-600">{p.receivedBy}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setReceiptModal(p)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <Printer size={12} /> Reçu
                      </button>
                    </td>
                  </tr>
                )
              })}
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
              <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value, groupId: students.find(s => s.id === e.target.value)?.groupId ?? '', courseId: students.find(s => s.id === e.target.value)?.courseId ?? '' }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                <option value="">Sélectionner</option>
                {students.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Période de facturation</label>
              <input type="month" value={form.billingPeriod} onChange={e => setForm(f => ({ ...f, billingPeriod: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Montant (DA) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="2500" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Méthode de paiement</label>
              <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                <option value="cash">Espèces</option>
                <option value="transfer">Virement</option>
                <option value="check">Chèque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Référence</label>
              <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="N° chèque ou référence..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleAddPayment} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Receipt modal */}
      <Modal open={receiptModal !== null} onClose={() => setReceiptModal(null)} title="Reçu de paiement" size="sm">
        {receiptModal && <Receipt payment={receiptModal} onClose={() => setReceiptModal(null)} />}
      </Modal>
    </div>
  )
}
