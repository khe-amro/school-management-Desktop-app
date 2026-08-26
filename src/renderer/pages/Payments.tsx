import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import {
  Plus, Search, Printer, X, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  BookOpen, AlertCircle, CreditCard, ChevronDown, Filter
} from 'lucide-react'
import type { Payment, Student, Enrollment, Group, Course } from '@shared/types/index'

interface PaymentSummary {
  monthRevenue: number
  todayCollected: number
  outstanding: number
  overdue: number
}

// Convert Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII (0-9)
function normalizeNumberInput(val: string): string {
  const ascii = val
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
  return ascii.replace(/[^0-9.]/g, '')
}

// ── Searchable Student Combobox ─────────────────────────────────────────────
function StudentCombobox({
  students,
  value,
  onChange,
  inputCls,
  placeholder,
}: {
  students: Student[]
  value: string
  onChange: (id: string) => void
  inputCls: string
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync display label when value changes from outside (e.g. auto-select)
  const selectedStudent = students.find((s) => String(s.id) === value)
  const displayLabel = selectedStudent
    ? `${selectedStudent.lastNameAr} ${selectedStudent.firstNameAr} — ${selectedStudent.studentNumber}`
    : ''

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = query.toLowerCase()
  const filtered = query
    ? students.filter((s) =>
        `${s.lastNameAr} ${s.firstNameAr} ${s.lastNameFr} ${s.firstNameFr} ${s.studentNumber} ${s.phone ?? ''}`
          .toLowerCase()
          .includes(q)
      )
    : students

  return (
    <div ref={ref} className="relative">
      <div
        className={`${inputCls} flex items-center cursor-pointer gap-2`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <input
            autoFocus
            className="flex-1 outline-none bg-transparent text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 text-sm truncate ${!displayLabel ? 'text-slate-400' : ''}`}>
            {displayLabel || placeholder}
          </span>
        )}
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Aucun résultat</div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex justify-between items-center ${String(s.id) === value ? 'bg-blue-50 font-semibold text-[#2563EB]' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(String(s.id))
                  setOpen(false)
                }}
              >
                <span>{s.lastNameAr} {s.firstNameAr}</span>
                <span className="text-[10px] font-mono text-slate-400">{s.studentNumber}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function Payments() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'ar' | 'fr' | 'en'
  const location = useLocation()

  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<PaymentSummary>({ monthRevenue: 0, todayCollected: 0, outstanding: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [overdueFilter, setOverdueFilter] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reference lists
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [receiptModal, setReceiptModal] = useState<Payment | null>(null)

  // Form State
  const [form, setForm] = useState({
    studentId: '',
    enrollmentId: '',
    newGroupId: '', // If student not enrolled, user picks a group directly
    billingPeriod: new Date().toISOString().slice(0, 7),
    amount: '',
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, summaryRes, grpRes, crsRes] = await Promise.all([
        window.schoolApp.payments.list({ pageSize: 100 }),
        window.schoolApp.payments.summary(),
        window.schoolApp.groups.list(),
        window.schoolApp.courses.list(),
      ])
      if (listRes.success && listRes.data) setPayments(listRes.data.items)
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data)
      if (grpRes.success && grpRes.data) setGroups(grpRes.data)
      if (crsRes.success && crsRes.data) setCourses(crsRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Auto-open form with pre-selected student when navigating from StudentProfile ──
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const preselectedStudentId = params.get('studentId')
    if (preselectedStudentId) {
      openForm(preselectedStudentId)
    }
  }, [location.search])

  const handleStudentChange = async (sid: string) => {
    setError('')
    setForm((f) => ({ ...f, studentId: sid, enrollmentId: '', newGroupId: '', amount: '' }))
    if (!sid) {
      setEnrollments([])
      return
    }

    const res = await window.schoolApp.enrollments.byStudent(Number(sid))
    if (res.success && res.data && res.data.length > 0) {
      setEnrollments(res.data)
      // Auto-select first active enrollment and pre-fill its price
      const first = res.data[0]
      setForm((f) => ({
        ...f,
        studentId: sid,
        enrollmentId: String(first.id),
        newGroupId: '',
        amount: String(first.agreedPrice || ''),
      }))
    } else {
      setEnrollments([])
      // If student has no enrollments, if groups exist, default to first group
      if (groups.length > 0) {
        setForm((f) => ({
          ...f,
          studentId: sid,
          enrollmentId: '',
          newGroupId: String(groups[0].id),
          amount: String(groups[0].monthlyPrice || ''),
        }))
      }
    }
  }

  const handleEnrollmentChange = (enrollId: string) => {
    const found = enrollments.find((e) => e.id === Number(enrollId))
    setForm((f) => ({
      ...f,
      enrollmentId: enrollId,
      newGroupId: '',
      amount: found ? String(found.agreedPrice || '') : f.amount,
    }))
  }

  const handleNewGroupChange = (grpId: string) => {
    const found = groups.find((g) => g.id === Number(grpId))
    setForm((f) => ({
      ...f,
      newGroupId: grpId,
      enrollmentId: '',
      amount: found ? String(found.monthlyPrice || '') : f.amount,
    }))
  }

  const openForm = async (preselectedStudentId?: string) => {
    const sr = await window.schoolApp.students.list({ status: 'active', pageSize: 1000 })
    const studentList = sr.success && sr.data ? sr.data.items : []
    setStudents(studentList)

    const defaultForm = {
      studentId: preselectedStudentId ?? '',
      enrollmentId: '',
      newGroupId: '',
      billingPeriod: new Date().toISOString().slice(0, 7),
      amount: '',
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString().slice(0, 10),
      reference: '',
      notes: '',
    }
    setForm(defaultForm)
    setEnrollments([])
    setError('')
    setShowForm(true)

    // If a student is pre-selected, auto-load their enrollments
    if (preselectedStudentId) {
      const res = await window.schoolApp.enrollments.byStudent(Number(preselectedStudentId))
      if (res.success && res.data && res.data.length > 0) {
        setEnrollments(res.data)
        const first = res.data[0]
        setForm((f) => ({
          ...f,
          enrollmentId: String(first.id),
          amount: String(first.agreedPrice || ''),
        }))
      }
    }
  }

  const handleSave = async () => {
    if (!form.studentId) {
      setError(t('payments.student') + ' * ' + t('common.required'))
      return
    }
    if (!form.enrollmentId && !form.newGroupId) {
      setError(t('payments.groupOrCourseRequired'))
      return
    }
    if (!form.amount || Number(form.amount) < 0) {
      setError(t('payments.amount') + ' * ' + t('common.required'))
      return
    }
    if (!form.billingPeriod) {
      setError(t('payments.billingPeriod') + ' * ' + t('common.required'))
      return
    }

    setSaving(true)
    setError('')

    try {
      let finalEnrollmentId = Number(form.enrollmentId)

      // If student was not enrolled yet, auto-enroll them in the selected group now
      if (!finalEnrollmentId && form.newGroupId) {
        const enrollRes = await window.schoolApp.enrollments.create({
          studentId: Number(form.studentId),
          groupId: Number(form.newGroupId),
          agreedPrice: Number(form.amount),
          enrollmentDate: form.paymentDate || new Date().toISOString().slice(0, 10),
        })

        if (!enrollRes.success) {
          setError(enrollRes.error ?? t('common.error'))
          setSaving(false)
          return
        }
        finalEnrollmentId = enrollRes.data.id
      }

      const res = await window.schoolApp.payments.create({
        studentId: Number(form.studentId),
        enrollmentId: finalEnrollmentId,
        billingPeriod: form.billingPeriod,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod as 'cash' | 'transfer' | 'check',
        paymentDate: form.paymentDate,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      })

      if (!res.success) {
        setError(res.error ?? t('common.error'))
      } else {
        setShowForm(false)
        setReceiptModal(res.data)
        await load()
      }
    } catch (err: any) {
      setError(err?.message ?? t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (id: number) => {
    if (!window.confirm(t('payments.cancelConfirm'))) return
    await window.schoolApp.payments.cancel(id)
    await load()
  }

  const handlePrintReceipt = async () => {
    await window.schoolApp.app.print()
  }

  const getCourseGroupName = (courseId: number, groupName: string) => {
    const course = courses.find((c) => c.id === courseId)
    if (!course) return groupName
    const cName = lang === 'ar' ? course.nameAr : course.nameFr
    return `${cName} — ${groupName}`
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  // ── Filter: search text + overdue toggle ──
  const filtered = payments.filter((p) => {
    if (overdueFilter && p.status !== 'cancelled') return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.receiptNumber.toLowerCase().includes(q) ||
      (p.studentName && p.studentName.toLowerCase().includes(q)) ||
      (p.studentNumber && p.studentNumber.toLowerCase().includes(q)) ||
      (p.courseName && p.courseName.toLowerCase().includes(q)) ||
      (p.groupName && p.groupName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="animate-fade-in space-y-6">
      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-emerald-500" />
            <p className="text-xs text-slate-400 font-medium">{t('dashboard.monthRevenue')}</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{summary.monthRevenue.toLocaleString()} DA</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-[#2563EB]" />
            <p className="text-xs text-slate-400 font-medium">{t('payments.todayCollected')}</p>
          </div>
          <p className="text-2xl font-bold text-[#2563EB]">{summary.todayCollected.toLocaleString()} DA</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-amber-500" />
            <p className="text-xs text-slate-400 font-medium">{t('payments.outstanding')}</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.outstanding.toLocaleString()} DA</p>
        </div>
        {/* Overdue card — clickable to filter */}
        <button
          onClick={() => setOverdueFilter((v) => !v)}
          className={`p-5 rounded-xl border shadow-xs text-start transition-colors ${
            overdueFilter
              ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
              : 'bg-white border-border hover:bg-red-50/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs text-slate-400 font-medium">{t('dashboard.overduePayments')}</p>
            {overdueFilter && (
              <span className="ml-auto text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                Filtre actif
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-red-600">{summary.overdue} {t('payments.students')}</p>
          <p className="text-[10px] text-red-400 mt-1">Cliquer pour filtrer</p>
        </button>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search size={14} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-9 pe-3 py-2 border border-border rounded-lg text-sm bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>
        {overdueFilter && (
          <button
            onClick={() => setOverdueFilter(false)}
            className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100"
          >
            <X size={12} /> Effacer le filtre
          </button>
        )}
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={15} /> {t('payments.add')}
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">{overdueFilter ? 'Aucun paiement en retard' : t('payments.noPayments')}</p>
          </div>
        ) : (
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-border">
              <tr>
                <th className="px-4 py-3 text-start">{t('payments.receiptNumber')}</th>
                <th className="px-4 py-3 text-start">{t('payments.student')}</th>
                <th className="px-4 py-3 text-start">{t('payments.courseAndGroup')}</th>
                <th className="px-4 py-3 text-start">{t('payments.billingPeriod')}</th>
                <th className="px-4 py-3 text-start">{t('payments.amount')}</th>
                <th className="px-4 py-3 text-start">{t('payments.method')}</th>
                <th className="px-4 py-3 text-start">{t('payments.date')}</th>
                <th className="px-4 py-3 text-start">{t('payments.status')}</th>
                <th className="px-4 py-3 text-end">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#0F172A]">{p.receiptNumber}</td>
                  <td className="px-4 py-3 font-medium text-[#0F172A]">
                    <div>{p.studentName ?? `Student #${p.studentId}`}</div>
                    {p.studentNumber && <div className="text-[10px] text-slate-400 font-mono">{p.studentNumber}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="font-medium">{p.courseName ?? ''}</span>
                    {p.groupName && <span className="text-slate-400 text-[11px] block">{p.groupName}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{p.billingPeriod}</td>
                  <td className="px-4 py-3 font-bold text-[#2563EB]">{p.amount.toLocaleString()} DA</td>
                  <td className="px-4 py-3 text-slate-600">
                    {t(`payments.${p.paymentMethod}`)}
                    {p.reference && <span className="text-[10px] text-slate-400 block font-mono">#{p.reference}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{p.paymentDate}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {p.status === 'paid' ? t('payments.paid') : t('payments.cancelled')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end flex gap-2 justify-end">
                    <button onClick={() => setReceiptModal(p)} className="text-xs text-[#2563EB] hover:underline flex items-center gap-1">
                      <Printer size={12} /> {t('payments.receipt')}
                    </button>
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

      {/* Payment Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-[#0F172A]">{t('payments.add')}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3.5">
              {/* Student Selector — searchable combobox */}
              <div>
                <label className={labelCls}>{t('payments.student')} *</label>
                <StudentCombobox
                  students={students}
                  value={form.studentId}
                  onChange={handleStudentChange}
                  inputCls={inputCls}
                  placeholder={`— ${t('payments.student')} —`}
                />
              </div>

              {/* Course & Group Selector (Enrollment) */}
              {form.studentId && (
                <div>
                  <label className={labelCls}>{t('payments.courseAndGroup')} *</label>
                  {enrollments.length > 0 ? (
                    <select className={inputCls} value={form.enrollmentId} onChange={(e) => handleEnrollmentChange(e.target.value)}>
                      <option value="">{t('payments.selectCourseGroup')}</option>
                      {enrollments.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.courseName ? `${e.courseName} — ` : ''}{e.groupName ?? `${t('courses.groups')} #${e.groupId}`} ({e.agreedPrice.toLocaleString()} DA)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                      <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{t('payments.notEnrolledYet')}</span>
                      </div>
                      <select className={inputCls} value={form.newGroupId} onChange={(e) => handleNewGroupChange(e.target.value)}>
                        <option value="">{t('payments.selectCourseGroup')}</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {getCourseGroupName(g.courseId, g.name)} ({g.monthlyPrice.toLocaleString()} DA)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Billing Period & Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{t('payments.billingPeriod')} *</label>
                  <input
                    type="month"
                    className={inputCls}
                    value={form.billingPeriod}
                    onChange={(e) => setForm((f) => ({ ...f, billingPeriod: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('payments.amount')} (DA) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputCls}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: normalizeNumberInput(e.target.value) }))}
                    onKeyDown={(e) => { if (!/[\d.,٠-٩۰-۹Backspace Delete ArrowLeft ArrowRight Tab]/.test(e.key) && e.key.length === 1) e.preventDefault() }}
                    placeholder="0.00"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Payment Method & Date */}
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
                  <input
                    type="date"
                    className={inputCls}
                    value={form.paymentDate}
                    onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Reference / Note */}
              <div>
                <label className={labelCls}>{t('payments.reference')} / {t('common.notes')}</label>
                <input
                  className={inputCls}
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder={t('payments.referencePlaceholder')}
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs mt-3 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 flex items-center gap-2 shadow-xs"
              >
                {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Ticket Modal */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReceiptModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-[#0F172A]">{t('payments.receipt')}</h3>
              <button onClick={() => setReceiptModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {/* Printable Ticket Receipt */}
            <div className="space-y-3 text-xs text-slate-700 font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
              <div className="text-center">
                <p className="font-extrabold text-base text-[#0F172A] tracking-wider">EDUPILOT DZ</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('payments.receiptNumber')}: {receiptModal.receiptNumber}</p>
              </div>

              <div className="border-b border-dashed border-slate-300 my-2" />

              {receiptModal.studentName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.student')}:</span>
                  <span className="font-bold text-[#0F172A] text-end">{receiptModal.studentName}</span>
                </div>
              )}
              {receiptModal.studentNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('students.studentNumber')}:</span>
                  <span className="font-bold text-slate-600">{receiptModal.studentNumber}</span>
                </div>
              )}

              {(receiptModal.courseName || receiptModal.groupName) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.courseAndGroup')}:</span>
                  <span className="font-bold text-[#0F172A] text-end">
                    {receiptModal.courseName ? `${receiptModal.courseName} ` : ''}
                    {receiptModal.groupName ? `(${receiptModal.groupName})` : ''}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500">{t('payments.billingPeriod')}:</span>
                <span className="font-bold text-[#0F172A]">{receiptModal.billingPeriod}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">{t('payments.method')}:</span>
                <span>{t(`payments.${receiptModal.paymentMethod}`)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">{t('payments.date')}:</span>
                <span>{receiptModal.paymentDate}</span>
              </div>

              {receiptModal.reference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.reference')}:</span>
                  <span className="font-semibold">{receiptModal.reference}</span>
                </div>
              )}

              <div className="border-b border-dashed border-slate-300 my-2" />

              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-sm text-[#0F172A]">{t('payments.amount')}:</span>
                <span className="font-extrabold text-base text-[#2563EB]">{receiptModal.amount.toLocaleString()} DA</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={handlePrintReceipt}
                className="w-full py-2.5 bg-[#2563EB] text-white rounded-lg text-xs font-bold hover:bg-[#1D4ED8] flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Printer size={15} /> {t('payments.printReceipt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
