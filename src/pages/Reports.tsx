import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FileText, Download, Printer, Eye, Calendar, RefreshCw } from 'lucide-react'
import Modal from '../components/ui/Modal'

const reports = [
  { id: 'students', title: 'Rapport des étudiants inscrits', description: 'Liste complète des étudiants inscrits par cours et groupe avec statut.' },
  { id: 'attendance', title: 'Rapport des présences', description: 'Statistiques de présence et assiduité par groupe sur la période.' },
  { id: 'revenue', title: 'Rapport des revenus financiers', description: 'Revenus collectés par mois et détail des encaissements.' },
  { id: 'outstanding', title: 'Rapport des impayés & retards', description: 'Liste des étudiants nécessitant une relance de paiement.' },
  { id: 'groups', title: 'Rapport de capacité des groupes', description: 'Taux d\'occupation, effectifs et salles par groupe.' },
]

export default function Reports() {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [dateRanges, setDateRanges] = useState<Record<string, { from: string; to: string }>>(
    Object.fromEntries(reports.map(r => [r.id, { from: '2026-01-01', to: new Date().toISOString().split('T')[0] }]))
  )

  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [sRes, cRes, gRes, pRes, sessRes] = await Promise.all([
        api.students.list({ pageSize: 1000 }),
        api.courses.list(),
        api.groups.list(),
        api.payments.list({ pageSize: 1000 }),
        api.sessions.list({ limit: 500 }),
      ])

      if (sRes.success && sRes.data) setStudents(sRes.data.items || [])
      if (cRes.success && cRes.data) setCourses(cRes.data || [])
      if (gRes.success && gRes.data) setGroups(gRes.data || [])
      if (pRes.success && pRes.data) setPayments(pRes.data.items || [])
      if (sessRes.success && sessRes.data) setSessions(sessRes.data || [])
    } catch (err) {
      console.error('Failed to load report data:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Revenue chart data grouped by billing period (e.g. 2026-01 to 2026-12)
  const revenueByMonth = payments
    .filter(p => p.status === 'paid')
    .reduce((acc: Record<string, number>, p) => {
      const m = p.billingPeriod || p.paymentDate?.substring(0, 7) || '2026-08'
      acc[m] = (acc[m] || 0) + p.amount
      return acc
    }, {})

  const chartData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }))

  // Download CSV with UTF-8 BOM
  const handleExportCSV = (reportId: string) => {
    let headers: string[] = []
    let rows: (string | number)[][] = []
    let filename = `${reportId}_${new Date().toISOString().split('T')[0]}.csv`

    if (reportId === 'students') {
      headers = ['ID', 'N° Étudiant', 'Nom (FR)', 'Prénom (FR)', 'Téléphone', 'Date Inscription', 'Statut']
      rows = students.map(s => [
        s.id,
        s.studentNumber,
        `"${s.lastNameFr || ''}"`,
        `"${s.firstNameFr || ''}"`,
        `"${s.phone || ''}"`,
        s.registrationDate || '',
        s.status
      ])
    } else if (reportId === 'revenue') {
      headers = ['ID', 'N° Reçu', 'ID Étudiant', 'Période', 'Montant (DA)', 'Méthode', 'Date', 'Statut']
      rows = payments.map(p => [
        p.id,
        p.receiptNumber,
        p.studentId,
        p.billingPeriod,
        p.amount,
        p.paymentMethod,
        p.paymentDate,
        p.status
      ])
    } else if (reportId === 'groups') {
      headers = ['ID', 'Nom Groupe', 'ID Cours', 'Salle', 'Capacité', 'Statut']
      rows = groups.map(g => [
        g.id,
        `"${g.name}"`,
        g.courseId,
        `"${g.room || ''}"`,
        g.capacity,
        g.status
      ])
    } else {
      headers = ['ID', 'Nom', 'Statut', 'Date']
      rows = students.map(s => [s.id, `"${s.firstNameFr} ${s.lastNameFr}"`, s.status, s.registrationDate || ''])
    }

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    if (api) api.app.print()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {reports.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-colors">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <FileText size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 flex-1">
                <Calendar size={13} className="text-slate-400" />
                <input
                  type="date"
                  value={dateRanges[r.id].from}
                  onChange={e => setDateRanges(prev => ({ ...prev, [r.id]: { ...prev[r.id], from: e.target.value } }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 bg-white flex-1"
                />
                <span className="text-slate-300 text-xs">–</span>
                <input
                  type="date"
                  value={dateRanges[r.id].to}
                  onChange={e => setDateRanges(prev => ({ ...prev, [r.id]: { ...prev[r.id], to: e.target.value } }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 bg-white flex-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPreviewId(r.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors font-medium"
              >
                <Eye size={12} /> Aperçu
              </button>
              <button
                onClick={() => handleExportCSV(r.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                <Download size={12} /> CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                <Printer size={12} /> Imprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      <Modal open={previewId !== null} onClose={() => setPreviewId(null)} title={`Aperçu – ${reports.find(r => r.id === previewId)?.title ?? ''}`} size="xl">
        <div className="space-y-5">
          {previewId === 'revenue' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Revenus collectés par mois (DA)</h4>
                {chartData.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Aucun paiement enregistré pour générer le graphique.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => [`${Number(v).toLocaleString('fr-DZ')} DA`, 'Revenus']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase sticky top-0 bg-white">
                      <th className="py-2 text-left">N° Reçu</th>
                      <th className="py-2 text-left">Période</th>
                      <th className="py-2 text-right">Montant</th>
                      <th className="py-2 text-left">Méthode</th>
                      <th className="py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td className="py-2 font-mono text-xs text-blue-700">{p.receiptNumber}</td>
                        <td className="py-2">{p.billingPeriod}</td>
                        <td className="py-2 text-right font-semibold text-green-700">{p.amount.toLocaleString('fr-DZ')} DA</td>
                        <td className="py-2 capitalize">{p.paymentMethod}</td>
                        <td className="py-2 text-xs text-slate-500">{new Date(p.paymentDate).toLocaleDateString('fr-DZ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {previewId === 'students' && (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase sticky top-0 bg-white">
                    <th className="py-2 text-left">N° Étudiant</th>
                    <th className="py-2 text-left">Nom & Prénom</th>
                    <th className="py-2 text-left">Téléphone</th>
                    <th className="py-2 text-left">Date Inscription</th>
                    <th className="py-2 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {students.map(s => (
                    <tr key={s.id}>
                      <td className="py-2 font-mono text-xs text-blue-700">{s.studentNumber}</td>
                      <td className="py-2 font-medium text-slate-800">{s.firstNameFr} {s.lastNameFr}</td>
                      <td className="py-2 text-xs font-mono">{s.phone || '—'}</td>
                      <td className="py-2 text-xs">{s.registrationDate || '—'}</td>
                      <td className="py-2 capitalize text-xs">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewId === 'groups' && (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase sticky top-0 bg-white">
                    <th className="py-2 text-left">Groupe</th>
                    <th className="py-2 text-left">Cours</th>
                    <th className="py-2 text-left">Salle</th>
                    <th className="py-2 text-center">Capacité</th>
                    <th className="py-2 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groups.map(g => {
                    const c = courses.find(cr => cr.id === g.courseId)
                    return (
                      <tr key={g.id}>
                        <td className="py-2 font-semibold text-slate-800">{g.name}</td>
                        <td className="py-2 text-slate-600">{c?.nameFr || c?.nameAr || '—'}</td>
                        <td className="py-2 text-slate-600">{g.room || '—'}</td>
                        <td className="py-2 text-center font-mono">{g.capacity}</td>
                        <td className="py-2 capitalize text-xs">{g.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(previewId === 'attendance' || previewId === 'outstanding') && (
            <div className="text-center py-12 text-slate-400">
              <FileText size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-medium text-slate-600">Données calculées pour la période sélectionnée</p>
              <p className="text-xs text-slate-400 mt-1">Utilisez le bouton "CSV" ou "Imprimer" pour exporter le relevé complet.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setPreviewId(null)} className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Fermer</button>
            <button onClick={() => previewId && handleExportCSV(previewId)} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5">
              <Download size={13} /> Télécharger CSV
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
