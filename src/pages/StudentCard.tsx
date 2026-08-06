import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Download, RefreshCw, RotateCcw } from 'lucide-react'
import { students, courses, groups } from '../data/mockData'
import Logo from '../components/Logo'

function QRCode({ token, size = 80 }: { token: string; size?: number }) {
  const cells = Array.from({ length: 121 }, (_, i) => {
    const row = Math.floor(i / 11)
    const col = i % 11
    const isCorner = (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3)
    return isCorner || (Math.abs(token.charCodeAt(i % token.length) + row * 3 + col) % 2 === 0)
  })
  const cellSize = size / 11
  return (
    <div style={{ width: size, height: size, display: 'grid', gridTemplateColumns: `repeat(11, ${cellSize}px)`, background: 'white', padding: 4, border: '1px solid #E2E8F0', borderRadius: 4 }}>
      {cells.map((dark, i) => <div key={i} style={{ width: cellSize, height: cellSize, background: dark ? '#0F172A' : 'white' }} />)}
    </div>
  )
}

export default function StudentCard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [side, setSide] = useState<'front' | 'back'>('front')

  const student = students.find(s => s.id === id)
  if (!student) return <div className="text-center py-20 text-slate-400">Étudiant introuvable</div>

  const course = courses.find(c => c.id === student.courseId)
  const group = groups.find(g => g.id === student.groupId)

  const cardStyle = { width: 340, height: 214, borderRadius: 12 }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/students/${id}`)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ArrowLeft size={18} /></button>
        <h2 className="text-lg font-semibold text-slate-900">Carte étudiant</h2>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Card preview */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setSide('front')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${side === 'front' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Recto</button>
            <button onClick={() => setSide('back')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${side === 'back' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Verso</button>
          </div>

          <div className="flex justify-center">
            {side === 'front' ? (
              <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', color: 'white', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {/* Decorative arc */}
                <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(37,99,235,0.25)' }} />
                <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(20,184,166,0.18)' }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Logo size={22} collapsed />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>EDUPILOT DZ</p>
                      <p style={{ fontSize: 8, color: '#94A3B8', letterSpacing: 0.3 }}>Année 2025–2026</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 8, color: '#14B8A6', fontWeight: 600, letterSpacing: 1 }}>CARTE ÉTUDIANT</span>
                </div>

                {/* Student info */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', position: 'relative' }}>
                  <img src={student.photo} alt={student.firstName} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{student.firstName} {student.lastName}</p>
                    <p style={{ fontSize: 9, color: '#94A3B8', marginTop: 3, letterSpacing: 0.3 }}>{course?.name} · {group?.name}</p>
                    <p style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace', marginTop: 4 }}>{student.studentNumber}</p>
                  </div>
                  <QRCode token={student.token} size={56} />
                </div>
              </div>
            ) : (
              <div style={{ ...cardStyle, background: '#F8FAFC', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ background: '#0F172A', height: 32, margin: -18, marginBottom: 14, display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
                  <Logo size={18} collapsed />
                  <span style={{ color: 'white', fontSize: 10, fontWeight: 600 }}>EDUPILOT DZ</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 10, color: '#475569' }}>
                  <div style={{ display: 'flex', gap: 4 }}><span style={{ fontWeight: 600 }}>Tuteur:</span><span>{student.guardianName} — {student.guardianPhone}</span></div>
                  <div style={{ display: 'flex', gap: 4 }}><span style={{ fontWeight: 600 }}>École:</span><span>Edupilot DZ · +213 555 000 000 · info@edupilot.dz</span></div>
                  <div style={{ background: '#F1F5F9', borderRadius: 6, padding: '6px 8px', fontSize: 9, color: '#64748B' }}>
                    Cette carte est destinée exclusivement à l'identification et à la pointage des présences. En cas de perte, veuillez contacter l'administration.
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: '#94A3B8' }}>
                  <span>Expire: Juillet 2026</span>
                  <Logo size={16} collapsed />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
            <button className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
              <Printer size={15} /> Imprimer la carte
            </button>
            <button className="flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
              <Download size={15} /> Télécharger aperçu
            </button>
            <button className="flex items-center justify-center gap-2 w-full text-blue-600 hover:bg-blue-50 font-medium py-2.5 rounded-lg transition-colors text-sm border border-blue-200">
              <RefreshCw size={15} /> Regénérer le QR token
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Informations carte</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Token QR</span><span className="font-mono text-xs text-blue-700">{student.token}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Statut</span><span className="text-green-600 font-medium">Active</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Expiration</span><span className="font-medium">Juil. 2026</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
