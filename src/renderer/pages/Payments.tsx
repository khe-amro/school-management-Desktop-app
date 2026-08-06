import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, CreditCard, Search } from 'lucide-react'
import type { Payment, Student, Enrollment } from '@shared/types/index'

export default function Payments() {
  const { t } = useTranslation()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [form, setForm] = useState({ studentId: '', enrollmentId: '', billingPeriod: '', amount: '', paymentMethod: 'cash', paymentDate: new Date().toISOString().slice(0, 10), reference: '', notes: '' })

  const load = async () => {
    const res = await window.schoolApp.payments.list({ pageSize: 100 })
    if (res.success && res.data) setPayments(res.data.items)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleStudentChange = async (sid: string) => {
    setForm((f) => ({ ...f, studentId: sid, enrollmentId: '' }))
    if (!sid) { setEnrollments([]); return }
    const res = await window.schoolApp.enrollments.byStudent(Number(sid))
    if (res.success && res.data) setEnrollments(res.data)
  }

  const openForm = async () => {
    const sr = await window.schoolApp.students.list({ status: 'active', pageSize: 200 })
    if (sr.success && sr.data) setStudents(sr.data.items)
    setEnrollments([])
    setForm({ studentId: '', enrollmentId: '', billingPeriod: new Date().toISOString().slice(0, 7), amount: '', paymentMethod: 'cash', paymentDate: new Date().toISOString().slice(0, 10), reference: '', notes: '' })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.studentId || !form.enrollmentId || !form.amount || !form.billingPeriod) { setError('يرجى ملء جميع الحقول الإلزامية'); return }
    setSaving(true)
    try {
      const res = await window.schoolApp.payments.create({
        studentId: Number(form.studentId), enrollmentId: Number(form.enrollmentId),
        billingPeriod: form.billingPeriod, amount: Number(form.amount),
        paymentMethod: form.paymentMethod as 'cash' | 'transfer' | 'check',
        paymentDate: form.paymentDate, reference: form.reference || null, notes: form.notes || null,
      })
      if (res.success) { setShowForm(false); await load() }
      else setError(res.error ?? '')
    } finally { setSaving(false) }
  }

  const handleCancel = async (id: number) => {
    if (!window.confirm(t('payments.cancelConfirm'))) return
    await window.schoolApp.payments.cancel(id)
    await load()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  const filtered = search
    ? payments.filter((p) => p.receiptNumber.toLowerCase().includes(search.toLowerCase()))
    : payments

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-50">
          <Search size={14} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="search" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full ps-9 pe-3 py-2 border border-border rounded-lg text-sm bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20" />
        </div>
        <button onClick={openForm} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shrink-0">
          <Plus size={15} /> {t('payments.add')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t('payments.noPayments')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-medium">{t('payments.receiptNumber')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('payments.billingPeriod')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('payments.amount')}</th>
                <th className="text-start px-4 py-3 font-medium hidden sm:table-cell">{t('payments.method')}</th>
                <th className="text-start px-4 py-3 font-medium hidden md:table-cell">{t('payments.date')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('payments.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#2563EB]">{p.receiptNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{p.billingPeriod}</td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{p.amount.toLocaleString()} دج</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{t(`payments.${p.paymentMethod}`)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{p.paymentDate}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
                      {t(`payments.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {p.status === 'paid' && (
                      <button onClick={() => handleCancel(p.id)} className="text-xs text-red-500 hover:underline">{t('payments.cancel')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h3 className="font-bold text-[#0F172A] mb-5">{t('payments.add')}</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>{t('payments.student')} *</label>
                <select className={inputCls} value={form.studentId} onChange={(e) => handleStudentChange(e.target.value)}>
                  <option value="">—</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.lastNameAr} {s.firstNameAr} — {s.studentNumber}</option>)}
                </select>
              </div>
              {enrollments.length > 0 && (
                <div>
                  <label className={labelCls}>{t('payments.enrollment')} *</label>
                  <select className={inputCls} value={form.enrollmentId} onChange={(e) => setForm((f) => ({ ...f, enrollmentId: e.target.value }))}>
                    <option value="">—</option>
                    {enrollments.map((e) => <option key={e.id} value={e.id}>Group #{e.groupId} — {e.agreedPrice.toLocaleString()} دج</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{t('payments.billingPeriod')} *</label>
                  <input type="month" className={inputCls} value={form.billingPeriod} onChange={(e) => setForm((f) => ({ ...f, billingPeriod: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className={labelCls}>{t('payments.amount')} (دج) *</label>
                  <input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{t('payments.method')}</label>
                  <select className={inputCls} value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                    <option value="cash">{t('payments.cash')}</option>
                    <option value="transfer">{t('payments.transfer')}</option>
                    <option value="check">{t('payments.check')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('payments.date')}</label>
                  <input type="date" className={inputCls} value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('payments.reference')}</label>
                <input className={inputCls} value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 flex items-center gap-2">
                {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
