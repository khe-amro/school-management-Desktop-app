import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Printer, Download, Eye, X, Users, CreditCard, CalendarCheck, TrendingUp } from 'lucide-react'
import type { AttendanceSession, Payment, Student, SchoolSettings } from '@shared/types/index'

const reportOptions = [
  { id: 'students', label: 'Rapport des étudiants', description: 'Liste des élèves inscrits, coordonnées et statut' },
  { id: 'attendance', label: 'Rapport de présence', description: 'Statistiques de présence et séances d\'apprentissage' },
  { id: 'payments', label: 'Rapport des paiements', description: 'Historique détaillé des encaissements et règlements' },
  { id: 'revenue', label: 'Rapport des revenus', description: 'Répartition et synthèse financière par période' },
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
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [stRes, payRes, sessRes, setRes] = await Promise.all([
        window.schoolApp.students.list({ pageSize: 100, status: 'all' }),
        window.schoolApp.payments.list({ pageSize: 100 }),
        window.schoolApp.attendance.listSessions({ limit: 100 }),
        window.schoolApp.settings.get(),
      ])
      if (stRes.success && stRes.data) setStudents(stRes.data.items ?? [])
      if (payRes.success && payRes.data) setPayments(payRes.data.items ?? [])
      if (sessRes.success && sessRes.data) setSessions(sessRes.data ?? [])
      if (setRes.success && setRes.data) setSchoolSettings(setRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredStudents = useMemo(() => {
    return students
  }, [students])

  const filteredPayments = useMemo(() => {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)
    return payments.filter((p) => {
      const d = new Date(p.paymentDate)
      return d >= from && d <= to
    })
  }, [payments, fromDate, toDate])

  const filteredSessions = useMemo(() => {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)
    return sessions.filter((s) => {
      const d = new Date(s.sessionDate)
      return d >= from && d <= to
    })
  }, [sessions, fromDate, toDate])

  const revenueTotal = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  }, [filteredPayments])

  const revenueByMonth = useMemo(() => {
    return filteredPayments.reduce<Record<string, number>>((acc, p) => {
      const m = p.paymentDate.slice(0, 7)
      acc[m] = (acc[m] ?? 0) + p.amount
      return acc
    }, {})
  }, [filteredPayments])

  const maleCount = useMemo(() => students.filter(s => s.gender === 'male').length, [students])
  const femaleCount = useMemo(() => students.filter(s => s.gender === 'female').length, [students])

  const handlePrint = async () => {
    await window.schoolApp.app.print()
  }

  const handleExportPdf = async () => {
    setExporting(true)
    setExportMessage(null)
    try {
      const res = await window.schoolApp.app.printToPdf({
        pageSize: 'A4',
        marginsType: 0,
        filename: `Rapport-${reportType}-${fromDate}-au-${toDate}.pdf`,
      })
      if (res.success && res.data?.path) {
        setExportMessage(`Rapport exporté en PDF avec succès: ${res.data.path}`)
      } else if (!res.success) {
        setExportMessage(`Erreur: ${res.error}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleExportCsv = async () => {
    setExporting(true)
    setExportMessage(null)
    try {
      let csvContent = ''
      if (reportType === 'students') {
        csvContent = 'N_Etudiant,Nom_Ar,Prenom_Ar,Nom_Fr,Prenom_Fr,Genre,Telephone,Statut,Date_Inscription\n'
        students.forEach((s) => {
          csvContent += `"${s.studentNumber}","${s.lastNameAr}","${s.firstNameAr}","${s.lastNameFr}","${s.firstNameFr}","${s.gender}","${s.phone ?? ''}","${s.status}","${s.registrationDate}"\n`
        })
      } else if (reportType === 'payments') {
        csvContent = 'N_Recu,Date,Montant_DA,Methode,Periode,Statut\n'
        filteredPayments.forEach((p) => {
          csvContent += `"${p.receiptNumber}","${p.paymentDate}",${p.amount},"${p.paymentMethod}","${p.billingPeriod}","${p.status}"\n`
        })
      } else if (reportType === 'revenue') {
        csvContent = 'Mois,Total_Revenue_DA\n'
        Object.entries(revenueByMonth).forEach(([m, amt]) => {
          csvContent += `"${m}",${amt}\n`
        })
      } else if (reportType === 'attendance') {
        csvContent = 'ID_Seance,Date,Groupe_ID,Statut,Heure_Debut,Heure_Fin\n'
        filteredSessions.forEach((s) => {
          csvContent += `${s.id},"${s.sessionDate}",${s.groupId},"${s.status}","${s.actualStartTime ?? ''}","${s.endTime ?? ''}"\n`
        })
      }

      const res = await window.schoolApp.app.openSaveDialog()
      if (res.success && res.data && !res.data.canceled && res.data.path) {
        setExportMessage(`Fichier CSV exporté avec succès.`)
      }
    } finally {
      setExporting(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  /* ── Full Printable Report Document Component ── */
  const ReportDocument = () => (
    <div className="report-print-sheet bg-white text-[#0F172A] p-8 max-w-4xl mx-auto">
      {/* Document Header */}
      <div className="border-b-2 border-[#0F172A] pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
              {schoolSettings?.schoolNameFr || 'EDUPILOT DZ'}
            </h1>
            <p className="text-sm font-bold text-slate-700" dir="rtl">
              {schoolSettings?.schoolNameAr || 'إدوبيلوت ديزاد'}
            </p>
            {schoolSettings?.address && (
              <p className="text-xs text-slate-500 mt-1">{schoolSettings.address}</p>
            )}
            {schoolSettings?.phone && (
              <p className="text-xs text-slate-500">Tél: {schoolSettings.phone}</p>
            )}
          </div>
          <div className="text-end">
            <div className="inline-block bg-slate-100 text-slate-800 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-1">
              Document Officiel
            </div>
            <p className="text-xs text-slate-500">Année scolaire: {schoolSettings?.academicYear || '2025-2026'}</p>
            <p className="text-xs text-slate-500">Date d'édition: {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-[#2563EB] uppercase tracking-wide">
              {reportOptions.find(o => o.id === reportType)?.label}
            </h2>
            <p className="text-xs text-slate-500">
              Période du <span className="font-semibold">{fromDate}</span> au <span className="font-semibold">{toDate}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {reportType === 'students' && (
          <>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-slate-500 font-medium">Total Élèves</span>
              <span className="text-xl font-bold text-[#0F172A]">{students.length}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-slate-500 font-medium">Garçons</span>
              <span className="text-xl font-bold text-blue-600">{maleCount}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-slate-500 font-medium">Filles</span>
              <span className="text-xl font-bold text-pink-600">{femaleCount}</span>
            </div>
          </>
        )}

        {reportType === 'payments' && (
          <>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-slate-500 font-medium">Total Règlements</span>
              <span className="text-xl font-bold text-[#0F172A]">{filteredPayments.length}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center col-span-2">
              <span className="block text-xs text-emerald-700 font-medium">Montant Total Encaissé</span>
              <span className="text-2xl font-bold text-emerald-800">{revenueTotal.toLocaleString()} DZD</span>
            </div>
          </>
        )}

        {reportType === 'revenue' && (
          <>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-slate-500 font-medium">Nombre de Mois</span>
              <span className="text-xl font-bold text-[#0F172A]">{Object.keys(revenueByMonth).length}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center col-span-2">
              <span className="block text-xs text-emerald-700 font-medium">Recette Totale Période</span>
              <span className="text-2xl font-bold text-emerald-800">{revenueTotal.toLocaleString()} DZD</span>
            </div>
          </>
        )}

        {reportType === 'attendance' && (
          <>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-slate-500 font-medium">Séances Programmées</span>
              <span className="text-xl font-bold text-[#0F172A]">{filteredSessions.length}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-blue-700 font-medium">Séances Clôturées</span>
              <span className="text-xl font-bold text-blue-800">{filteredSessions.filter(s => s.status === 'closed').length}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
              <span className="block text-xs text-amber-700 font-medium">Séances Ouvertes</span>
              <span className="text-xl font-bold text-amber-800">{filteredSessions.filter(s => s.status === 'open').length}</span>
            </div>
          </>
        )}
      </div>

      {/* Main Data Table */}
      <div className="border border-slate-300 rounded-lg overflow-hidden mb-8">
        {reportType === 'students' && (
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">N° Matricule</th>
                <th className="p-2.5 text-start">Nom & Prénom (Arabe)</th>
                <th className="p-2.5 text-start">Nom & Prénom (Français)</th>
                <th className="p-2.5 text-start">Genre</th>
                <th className="p-2.5 text-start">Téléphone</th>
                <th className="p-2.5 text-start">Date Inscription</th>
                <th className="p-2.5 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStudents.map((st, i) => (
                <tr key={st.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-mono font-bold text-[#2563EB]">{st.studentNumber}</td>
                  <td className="p-2.5 font-bold" dir="rtl">{st.lastNameAr} {st.firstNameAr}</td>
                  <td className="p-2.5">{st.lastNameFr} {st.firstNameFr}</td>
                  <td className="p-2.5">{st.gender === 'male' ? 'Garçon' : 'Fille'}</td>
                  <td className="p-2.5">{st.phone || '—'}</td>
                  <td className="p-2.5">{st.registrationDate}</td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                      {st.status === 'active' ? 'Actif' : st.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'payments' && (
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">N° Reçu</th>
                <th className="p-2.5 text-start">Date</th>
                <th className="p-2.5 text-start">Élève</th>
                <th className="p-2.5 text-start">Mois / Période</th>
                <th className="p-2.5 text-start">Mode</th>
                <th className="p-2.5 text-end">Montant (DZD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPayments.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-mono font-bold text-[#2563EB]">{p.receiptNumber}</td>
                  <td className="p-2.5">{p.paymentDate}</td>
                  <td className="p-2.5 font-medium">{p.studentName || `#${p.studentId}`}</td>
                  <td className="p-2.5">{p.billingPeriod}</td>
                  <td className="p-2.5 capitalize">{p.paymentMethod}</td>
                  <td className="p-2.5 text-end font-bold text-[#0F172A]">{p.amount.toLocaleString()} DA</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td colSpan={5} className="p-2.5 text-end">TOTAL ENCAISSÉ:</td>
                <td className="p-2.5 text-end text-[#2563EB] text-sm">{revenueTotal.toLocaleString()} DA</td>
              </tr>
            </tbody>
          </table>
        )}

        {reportType === 'revenue' && (
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">Période / Mois</th>
                <th className="p-2.5 text-end">Nombre de Règlements</th>
                <th className="p-2.5 text-end">Recettes Totales (DZD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Object.entries(revenueByMonth).map(([month, total], i) => (
                <tr key={month} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-bold">{month}</td>
                  <td className="p-2.5 text-end font-medium">
                    {filteredPayments.filter(p => p.paymentDate.startsWith(month)).length}
                  </td>
                  <td className="p-2.5 text-end font-bold text-emerald-700">{total.toLocaleString()} DA</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td className="p-2.5">TOTAL GÉNÉRAL</td>
                <td className="p-2.5 text-end">{filteredPayments.length} paiements</td>
                <td className="p-2.5 text-end text-emerald-800 text-sm">{revenueTotal.toLocaleString()} DA</td>
              </tr>
            </tbody>
          </table>
        )}

        {reportType === 'attendance' && (
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5 text-start">ID Séance</th>
                <th className="p-2.5 text-start">Date</th>
                <th className="p-2.5 text-start">Groupe</th>
                <th className="p-2.5 text-start">Horaires</th>
                <th className="p-2.5 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSessions.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="p-2.5 font-mono">#{s.id}</td>
                  <td className="p-2.5 font-bold">{s.sessionDate}</td>
                  <td className="p-2.5">{s.groupName || `Groupe #${s.groupId}`}</td>
                  <td className="p-2.5">{s.actualStartTime || s.plannedStartTime || '—'} - {s.endTime || '—'}</td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'closed' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                      {s.status === 'closed' ? 'Clôturée' : 'En cours'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Document Signature Footer */}
      <div className="pt-6 border-t border-slate-300 grid grid-cols-2 text-xs">
        <div>
          <p className="text-slate-500 text-[10px]">Généré automatiquement par le système Edupilot DZ</p>
          <p className="text-slate-500 text-[10px]">Document interne de gestion et de suivi pédagogique</p>
        </div>
        <div className="text-end">
          <p className="font-bold text-slate-800 mb-10">Cachet & Signature de la Direction</p>
          <div className="border-b border-dashed border-slate-400 w-48 ms-auto" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Dedicated Printable Document Container — Visible ONLY on print ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-print-container,
          .report-print-container * { visibility: visible !important; }
          .report-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Hidden print element */}
      <div className="report-print-container" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <ReportDocument />
      </div>

      {/* ── Screen UI ── */}
      <div className="animate-fade-in space-y-6 no-print">
        {/* Top Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.reports')}</h2>
            <p className="text-xs text-slate-400">Générez, prévisualisez et exportez les rapports de l'établissement</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-4 py-2 border border-border bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
            >
              <Eye size={14} /> Aperçu Document
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="px-4 py-2 border border-[#2563EB] text-[#2563EB] rounded-lg text-xs font-semibold hover:bg-[#EFF6FF] flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={14} /> PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8] flex items-center gap-1.5 shadow-xs"
            >
              <Printer size={14} /> Imprimer
            </button>
          </div>
        </div>

        {/* Filter and Control Panel */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className={labelCls}>Type de rapport</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className={inputCls}
              >
                {reportOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date début</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} dir="ltr" />
            </div>
            <div>
              <label className={labelCls}>Date fin</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} dir="ltr" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportCsv}
                disabled={exporting}
                className="flex-1 bg-emerald-600 text-white py-2 px-3 rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          {exportMessage && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex justify-between items-center">
              <span>{exportMessage}</span>
              <button onClick={() => setExportMessage(null)} className="text-blue-500 hover:text-blue-700">✕</button>
            </div>
          )}
        </div>

        {/* 4 Cards Grid of report types */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportOptions.map((opt) => {
            const isSelected = reportType === opt.id
            const Icon = opt.id === 'students' ? Users : opt.id === 'payments' ? CreditCard : opt.id === 'attendance' ? CalendarCheck : TrendingUp
            return (
              <div
                key={opt.id}
                onClick={() => setReportType(opt.id)}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/10'
                    : 'border-border bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 font-bold ${
                  isSelected ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-bold text-sm text-[#0F172A] mb-1">{opt.label}</h3>
                <p className="text-xs text-slate-400">{opt.description}</p>
              </div>
            )
          })}
        </div>

        {/* Main On-Screen Table Preview Section */}
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="flex justify-between items-center p-5 border-b border-[#F1F5F9] bg-slate-50/50">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">
                {reportOptions.find(o => o.id === reportType)?.label}
              </h3>
              <p className="text-xs text-slate-400">
                {reportType === 'students' ? `${students.length} élèves inscrits` :
                 reportType === 'payments' ? `${filteredPayments.length} paiements (${revenueTotal.toLocaleString()} DA)` :
                 reportType === 'revenue' ? `Total: ${revenueTotal.toLocaleString()} DA` :
                 `${filteredSessions.length} séances enregistrées`}
              </p>
            </div>
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-3 py-1.5 bg-white border border-border text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
            >
              <Eye size={13} /> Voir Format Papier
            </button>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                {reportType === 'students' && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                        <th className="p-3 text-start">Matricule</th>
                        <th className="p-3 text-start">Nom & Prénom (AR)</th>
                        <th className="p-3 text-start">Nom & Prénom (FR)</th>
                        <th className="p-3 text-start">Genre</th>
                        <th className="p-3 text-start">Téléphone</th>
                        <th className="p-3 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.slice(0, 50).map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[#2563EB]">{st.studentNumber}</td>
                          <td className="p-3 font-medium text-[#0F172A]" dir="rtl">{st.lastNameAr} {st.firstNameAr}</td>
                          <td className="p-3 text-slate-600">{st.lastNameFr} {st.firstNameFr}</td>
                          <td className="p-3 text-slate-500">{st.gender === 'male' ? 'Garçon' : 'Fille'}</td>
                          <td className="p-3 text-slate-500">{st.phone ?? '—'}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]">
                              {st.status === 'active' ? 'Actif' : st.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'payments' && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                        <th className="p-3 text-start">N° Reçu</th>
                        <th className="p-3 text-start">Date</th>
                        <th className="p-3 text-start">Élève</th>
                        <th className="p-3 text-start">Période</th>
                        <th className="p-3 text-start">Mode</th>
                        <th className="p-3 text-end">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[#2563EB]">{p.receiptNumber}</td>
                          <td className="p-3 text-slate-600">{p.paymentDate}</td>
                          <td className="p-3 font-medium">{p.studentName || `#${p.studentId}`}</td>
                          <td className="p-3 text-slate-600">{p.billingPeriod}</td>
                          <td className="p-3 text-slate-500 capitalize">{p.paymentMethod}</td>
                          <td className="p-3 text-end font-bold text-emerald-600">{p.amount.toLocaleString()} DZD</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {reportType === 'revenue' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold">Total des recettes sur la période sélectionnée</p>
                        <p className="text-2xl font-bold text-emerald-800 mt-1">{revenueTotal.toLocaleString()} DZD</p>
                      </div>
                      <span className="text-xs bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                        {filteredPayments.length} encaissements
                      </span>
                    </div>

                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                          <th className="p-3 text-start">Mois</th>
                          <th className="p-3 text-end">Règlements</th>
                          <th className="p-3 text-end">Recettes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(revenueByMonth).map(([m, val]) => (
                          <tr key={m} className="hover:bg-slate-50">
                            <td className="p-3 font-bold">{m}</td>
                            <td className="p-3 text-end">{filteredPayments.filter(p => p.paymentDate.startsWith(m)).length}</td>
                            <td className="p-3 text-end font-bold text-emerald-700">{val.toLocaleString()} DZD</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {reportType === 'attendance' && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-start">
                        <th className="p-3 text-start">ID Séance</th>
                        <th className="p-3 text-start">Date</th>
                        <th className="p-3 text-start">Groupe</th>
                        <th className="p-3 text-start">Horaires</th>
                        <th className="p-3 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[#2563EB]">#{s.id}</td>
                          <td className="p-3 text-slate-600 font-medium">{s.sessionDate}</td>
                          <td className="p-3 text-slate-600">{s.groupName || `Groupe #${s.groupId}`}</td>
                          <td className="p-3 text-slate-500">{s.actualStartTime || s.plannedStartTime || '—'} - {s.endTime || '—'}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.status === 'closed' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'}`}>
                              {s.status === 'closed' ? 'Clôturée' : 'En cours'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Interactive In-app Print Preview Modal ── */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPreviewModal(false)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-border bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="text-[#2563EB]" size={18} />
                <h3 className="font-bold text-[#0F172A] text-sm">Aperçu du Rapport (Format A4)</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="flex items-center gap-1.5 text-xs border border-[#2563EB] text-[#2563EB] px-3 py-1.5 rounded-lg hover:bg-[#EFF6FF] transition-colors disabled:opacity-50"
                >
                  <Download size={13} /> PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 text-xs bg-[#2563EB] text-white px-3 py-1.5 rounded-lg hover:bg-[#1D4ED8] transition-colors"
                >
                  <Printer size={13} /> Imprimer
                </button>
                <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-200 flex justify-center">
              <div className="bg-white shadow-xl rounded-sm w-full">
                <ReportDocument />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
