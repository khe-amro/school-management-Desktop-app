import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FileText, Download, Printer, Eye, Calendar } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { monthlyRevenue, students } from '../data/mockData'

const reports = [
  { id: 'students', title: 'Rapport des inscriptions', description: 'Liste des étudiants inscrits par cours et groupe avec leur statut.' },
  { id: 'attendance', title: 'Rapport de présences', description: 'Taux de présence par cours, groupe et enseignant sur la période sélectionnée.' },
  { id: 'revenue', title: 'Rapport des revenus', description: 'Revenus collectés par mois, avec détail par cours et mode de paiement.' },
  { id: 'outstanding', title: 'Rapport des impayés', description: 'Liste des étudiants avec des soldes en attente ou en retard de paiement.' },
  { id: 'enrollment', title: "Rapport d'inscription par cours", description: 'Capacité et taux de remplissage des groupes par cours.' },
]

const previewData = monthlyRevenue

export default function Reports() {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [dateRanges, setDateRanges] = useState<Record<string, { from: string; to: string }>>(
    Object.fromEntries(reports.map(r => [r.id, { from: '2026-01-01', to: '2026-07-31' }]))
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {reports.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
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
                <input type="date" value={dateRanges[r.id].from}
                  onChange={e => setDateRanges(prev => ({ ...prev, [r.id]: { ...prev[r.id], from: e.target.value } }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 bg-white flex-1" />
                <span className="text-slate-300 text-xs">–</span>
                <input type="date" value={dateRanges[r.id].to}
                  onChange={e => setDateRanges(prev => ({ ...prev, [r.id]: { ...prev[r.id], to: e.target.value } }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 bg-white flex-1" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPreviewId(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors font-medium">
                <Eye size={12} /> Aperçu
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Download size={12} /> CSV
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
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
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Revenus mensuels (DA)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={previewData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`${Number(v).toLocaleString('fr-DZ')} DA`, 'Revenus']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100"><th className="py-2 text-left text-xs text-slate-500 font-semibold">Mois</th><th className="py-2 text-right text-xs text-slate-500 font-semibold">Revenus</th><th className="py-2 text-right text-xs text-slate-500 font-semibold">Évolution</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {previewData.map((d, i) => (
                    <tr key={d.month}>
                      <td className="py-2.5 font-medium">{d.month} 2026</td>
                      <td className="py-2.5 text-right font-semibold text-green-700">{d.revenue.toLocaleString('fr-DZ')} DA</td>
                      <td className="py-2.5 text-right text-xs">
                        {i > 0 ? (
                          <span className={previewData[i].revenue >= previewData[i-1].revenue ? 'text-green-600' : 'text-red-600'}>
                            {previewData[i].revenue >= previewData[i-1].revenue ? '▲' : '▼'} {Math.abs(Math.round((d.revenue / previewData[i-1].revenue - 1) * 100))}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {previewId === 'students' && (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100"><th className="py-2 text-left text-xs text-slate-500 font-semibold">Étudiant</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">N°</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Statut</th><th className="py-2 text-left text-xs text-slate-500 font-semibold">Paiement</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {students.map(s => (
                  <tr key={s.id}><td className="py-2.5 font-medium">{s.firstName} {s.lastName}</td><td className="py-2.5 font-mono text-xs text-blue-600">{s.studentNumber}</td><td className="py-2.5 capitalize">{s.status}</td><td className="py-2.5 capitalize">{s.paymentStatus}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {(previewId === 'attendance' || previewId === 'outstanding' || previewId === 'enrollment') && (
            <div className="text-center py-12 text-slate-400">
              <FileText size={32} className="mx-auto mb-2" />
              <p>Aperçu disponible pour la période sélectionnée</p>
              <p className="text-xs mt-1">Cliquez sur "CSV" ou "Imprimer" pour exporter le rapport complet</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
