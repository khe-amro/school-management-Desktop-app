import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, FileText, Users, CreditCard, Printer, Calendar } from 'lucide-react'
import type { AttendanceSession, Payment, Student } from '@shared/types/index'

const reportOptions = [
  { id: 'students', labelKey: 'reports.students', description: 'قائمة الطلاب المسجلين وحالاتهم' },
  { id: 'attendance', labelKey: 'reports.attendance', description: 'إحصاءات الحضور والغياب' },
  { id: 'payments', labelKey: 'reports.payments', description: 'سجل المدفوعات والمتأخرات' },
  { id: 'revenue', labelKey: 'reports.revenue', description: 'الإيرادات الشهرية والسنوية' },
] as const

type ReportType = (typeof reportOptions)[number]['id']

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function Reports() {
  const { t } = useTranslation()
  const [reportType, setReportType] = useState<ReportType>('students')
  const [fromDate, setFromDate] = useState(formatDateInput(new Date(new Date().setMonth(new Date().getMonth() - 1))))
  const [toDate, setToDate] = useState(formatDateInput(new Date()))
  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [debugInfo, setDebugInfo] = useState<{ studentsOk?: boolean; studentsTotal?: number; paymentsOk?: boolean; paymentsTotal?: number; sessionsOk?: boolean; sessionsTotal?: number }>({})
  const [lastResponses, setLastResponses] = useState<{ studentsRes?: any; paymentsRes?: any; sessionsRes?: any }>({})
  const [showRawDebug, setShowRawDebug] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [pdfExportLoading, setPdfExportLoading] = useState(false)
  const [pdfExportStatus, setPdfExportStatus] = useState<string | null>(null)

  useEffect(() => {
    async function loadAll() {
      setLoading(true)

      // Use safe maximums enforced by the main process schemas (<= 200)
      const calls = [
        window.schoolApp.students.list({ pageSize: 200, status: 'active' }),
        window.schoolApp.payments.list({ pageSize: 200 }),
        window.schoolApp.attendance.listSessions({ limit: 200 }),
      ]

      // Run all and collect individual successes/failures so one failure doesn't block others
      const settled = await Promise.allSettled(calls)

      const studentsRes = settled[0].status === 'fulfilled' ? settled[0].value : { success: false, error: String(settled[0].reason) }
      const paymentsRes = settled[1].status === 'fulfilled' ? settled[1].value : { success: false, error: String(settled[1].reason) }
      const sessionsRes = settled[2].status === 'fulfilled' ? settled[2].value : { success: false, error: String(settled[2].reason) }

      // Debug logging and visible diagnostics
      // eslint-disable-next-line no-console
      console.log('Reports.loadAll settled', { studentsRes, paymentsRes, sessionsRes })
      setLastResponses({ studentsRes, paymentsRes, sessionsRes })

      if (studentsRes && (studentsRes as any).success && (studentsRes as any).data) setStudents((studentsRes as any).data.items)
      if (paymentsRes && (paymentsRes as any).success && (paymentsRes as any).data) setPayments((paymentsRes as any).data.items)
      if (sessionsRes && (sessionsRes as any).success && (sessionsRes as any).data) setSessions((sessionsRes as any).data)

      setDebugInfo({
        studentsOk: !!(studentsRes && (studentsRes as any).success),
        studentsTotal: (studentsRes as any).success && (studentsRes as any).data ? (studentsRes as any).data.total : undefined,
        paymentsOk: !!(paymentsRes && (paymentsRes as any).success),
        paymentsTotal: (paymentsRes as any).success && (paymentsRes as any).data ? (paymentsRes as any).data.total : undefined,
        sessionsOk: !!(sessionsRes && (sessionsRes as any).success),
        sessionsTotal: (sessionsRes as any).success && Array.isArray((sessionsRes as any).data) ? (sessionsRes as any).data.length : undefined,
      })

      setLoading(false)
    }

    // Restore last report selection (if any)
    try {
      const raw = localStorage.getItem('reports:last')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.reportType) setReportType(parsed.reportType)
        if (parsed.fromDate) setFromDate(parsed.fromDate)
        if (parsed.toDate) setToDate(parsed.toDate)
        if (parsed.previewVisible) setPreviewVisible(true)
      }
    } catch (e) {
      // ignore
    }

    loadAll()
  }, [])

  const filteredPayments = useMemo(() => {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    return payments.filter((payment) => {
      const paymentDate = new Date(payment.paymentDate)
      return paymentDate >= from && paymentDate <= to
    })
  }, [payments, fromDate, toDate])

  const filteredSessions = useMemo(() => {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    return sessions.filter((session) => {
      const sessionDate = new Date(session.sessionDate)
      return sessionDate >= from && sessionDate <= to
    })
  }, [sessions, fromDate, toDate])

  const revenueTotal = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + payment.amount, 0)
  }, [filteredPayments])

  const reportTitle = reportOptions.find((option) => option.id === reportType)?.labelKey ?? 'reports.students'

  const handleGenerate = () => {
    setPreviewVisible(true)
    setPdfExportStatus(null)
    // Persist last generated report so it survives navigation
    try {
      localStorage.setItem('reports:last', JSON.stringify({ reportType, fromDate, toDate, previewVisible: true }))
    } catch (e) {
      // ignore
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportPdf = async () => {
    setPdfExportStatus(null)
    setPdfExportLoading(true)
    try {
      const res = await window.schoolApp.app.printToPdf({ pageSize: 'A4', marginsType: 0 })
      if (res.success) {
        setPdfExportStatus(`تم حفظ التقرير كملف PDF في: ${res.data.path}`)
      } else {
        setPdfExportStatus(`فشل حفظ PDF: ${res.error ?? 'غير معروف'}`)
      }
    } catch (error) {
      setPdfExportStatus(`فشل حفظ PDF: ${String(error)}`)
    } finally {
      setPdfExportLoading(false)
    }
  }

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-border">
          <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          {t('common.loading')}
        </div>
      )
    }

    if (reportType === 'students') {
      const activeStudents = students
      return (
        <div className="bg-white rounded-xl border border-border p-6 print-receipt">
          {/* Diagnostic info */}
          <div className="mb-4 text-xs text-slate-400">
            <div>Debug: studentsOk: {String(debugInfo.studentsOk ?? false)}, studentsTotal: {String(debugInfo.studentsTotal ?? '—')}</div>
            <div>Debug: paymentsOk: {String(debugInfo.paymentsOk ?? false)}, paymentsTotal: {String(debugInfo.paymentsTotal ?? '—')}</div>
            <div>Debug: sessionsOk: {String(debugInfo.sessionsOk ?? false)}, sessionsTotal: {String(debugInfo.sessionsTotal ?? '—')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <p className="text-xs uppercase text-slate-500">{t('reports.students')}</p>
              <h2 className="text-2xl font-semibold text-slate-900">{activeStudents.length} {t('reports.activeStudents')}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 ms-auto">
              <button onClick={handlePrint} className="print-button inline-flex items-center gap-2 rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
                <Printer size={14} /> {t('common.print')}
              </button>
              <button onClick={handleExportPdf} disabled={pdfExportLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors">
                <FileText size={14} /> {pdfExportLoading ? t('common.saving') : 'PDF'}
              </button>
            </div>
          </div>
          {pdfExportStatus && <div className="mb-4 text-sm text-slate-600">{pdfExportStatus}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeStudents.map((student) => (
              <div key={student.id} className="rounded-2xl border border-border p-4">
                <div className="font-semibold text-slate-900">{student.lastNameAr} {student.firstNameAr}</div>
                <div className="text-slate-500 text-xs mt-1">{student.studentNumber}</div>
                <div className="text-slate-500 text-xs mt-2">{t('students.gender')}: {t(`students.${student.gender}`)}</div>
                <div className="text-slate-500 text-xs">{t('students.dateOfBirth')}: {student.dateOfBirth ?? '—'}</div>
                <div className="text-slate-500 text-xs">{t('students.phone')}: {student.phone ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (reportType === 'attendance') {
      return (
        <div className="bg-white rounded-xl border border-border p-6 print-receipt">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <p className="text-xs uppercase text-slate-500">{t('reports.attendance')}</p>
              <h2 className="text-2xl font-semibold text-slate-900">{filteredSessions.length} {t('reports.sessions')}</h2>
              <p className="text-slate-500 text-sm">{fromDate} → {toDate}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ms-auto">
              <button onClick={handlePrint} className="print-button inline-flex items-center gap-2 rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
                <Printer size={14} /> {t('common.print')}
              </button>
              <button onClick={handleExportPdf} disabled={pdfExportLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors">
                <FileText size={14} /> {pdfExportLoading ? t('common.saving') : 'PDF'}
              </button>
            </div>
          </div>
          {pdfExportStatus && <div className="mb-4 text-sm text-slate-600">{pdfExportStatus}</div>}

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-start px-4 py-3">{t('attendance.date')}</th>
                <th className="text-start px-4 py-3">{t('attendance.group')}</th>
                <th className="text-start px-4 py-3">{t('common.status')}</th>
                <th className="text-start px-4 py-3">{t('attendance.start')}</th>
                <th className="text-start px-4 py-3">{t('attendance.end')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#0F172A]">{session.sessionDate}</td>
                  <td className="px-4 py-3 text-slate-500">#{session.groupId}</td>
                  <td className="px-4 py-3 text-slate-500">{t(`attendance.${session.status}`)}</td>
                  <td className="px-4 py-3 text-slate-500">{session.actualStartTime ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{session.endTime ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (reportType === 'payments') {
      return (
        <div className="bg-white rounded-xl border border-border p-6 print-receipt">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <p className="text-xs uppercase text-slate-500">{t('reports.payments')}</p>
              <h2 className="text-2xl font-semibold text-slate-900">{filteredPayments.length} {t('reports.paymentsCount')}</h2>
              <p className="text-slate-500 text-sm">{fromDate} → {toDate}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ms-auto">
              <button onClick={handlePrint} className="print-button inline-flex items-center gap-2 rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
                <Printer size={14} /> {t('common.print')}
              </button>
              <button onClick={handleExportPdf} disabled={pdfExportLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors">
                <FileText size={14} /> {pdfExportLoading ? t('common.saving') : 'PDF'}
              </button>
            </div>
          </div>
          {pdfExportStatus && <div className="mb-4 text-sm text-slate-600">{pdfExportStatus}</div>}

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-start px-4 py-3">{t('payments.receiptNumber')}</th>
                <th className="text-start px-4 py-3">{t('payments.student')}</th>
                <th className="text-start px-4 py-3">{t('payments.amount')}</th>
                <th className="text-start px-4 py-3">{t('payments.date')}</th>
                <th className="text-start px-4 py-3">{t('payments.method')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#2563EB]">{payment.receiptNumber}</td>
                  <td className="px-4 py-3 text-slate-500">{payment.studentName ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{payment.amount.toLocaleString()} دج</td>
                  <td className="px-4 py-3 text-slate-500">{payment.paymentDate}</td>
                  <td className="px-4 py-3 text-slate-500">{t(`payments.${payment.paymentMethod}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (reportType === 'revenue') {
      const revenueByMonth = filteredPayments.reduce<Record<string, number>>((acc, payment) => {
        const month = payment.paymentDate.slice(0, 7)
        acc[month] = (acc[month] ?? 0) + payment.amount
        return acc
      }, {})

      return (
        <div className="bg-white rounded-xl border border-border p-6 print-receipt">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <p className="text-xs uppercase text-slate-500">{t('reports.revenue')}</p>
              <h2 className="text-2xl font-semibold text-slate-900">{revenueTotal.toLocaleString()} دج</h2>
              <p className="text-slate-500 text-sm">{fromDate} → {toDate}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ms-auto">
              <button onClick={handlePrint} className="print-button inline-flex items-center gap-2 rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
                <Printer size={14} /> {t('common.print')}
              </button>
              <button onClick={handleExportPdf} disabled={pdfExportLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors">
                <FileText size={14} /> {pdfExportLoading ? t('common.saving') : 'PDF'}
              </button>
            </div>
          </div>
          {pdfExportStatus && <div className="mb-4 text-sm text-slate-600">{pdfExportStatus}</div>}

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-start px-4 py-3">{t('reports.month')}</th>
                <th className="text-start px-4 py-3">{t('reports.revenueAmount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {Object.entries(revenueByMonth).map(([month, amount]) => (
                <tr key={month} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700">{month}</td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{amount.toLocaleString()} دج</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return null
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-xl border border-border p-6 mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="w-full md:w-64">
              <label className="block text-xs font-medium text-slate-500 mb-2">{t('reports.selectReport')}</label>
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as ReportType)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
              >
                {reportOptions.map((option) => (
                  <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">{t('common.from')}</label>
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">{t('common.to')}</label>
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
              </div>
              <button onClick={handleGenerate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-semibold hover:bg-[#1D4ED8] transition-colors">
                <Calendar size={16} /> {t('reports.generate')}
              </button>
            </div>
          </div>

          <div className="text-slate-500 text-sm">
            <p className="font-semibold">{t(reportTitle)}</p>
            <p>{t('reports.previewHint')}</p>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-500 me-3">Debug raw responses</label>
        <input type="checkbox" checked={showRawDebug} onChange={(e) => setShowRawDebug(e.target.checked)} />
      </div>

      {previewVisible ? (
        <div>
          {renderPreview()}
          {showRawDebug && (
            <div className="bg-white rounded-xl border border-border p-4 mt-4 text-xs overflow-auto">
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(lastResponses, null, 2)}</pre>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-slate-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">{t('reports.noData')}</p>
          <p className="text-xs mt-1">{t('reports.selectReportHint')}</p>
        </div>
      )}
    </div>
  )
}

