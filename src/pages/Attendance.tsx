import { useState, useRef, useEffect } from 'react'
import { ScanLine, Volume2, VolumeX, Maximize, CheckCircle, XCircle, AlertTriangle, Clock, Users, Printer, Download, Plus } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { students, courses, groups } from '../data/mockData'
import type { AttendanceRecord, AttendanceStatus } from '../types'

type ScanState = 'idle' | 'success' | 'already' | 'invalid' | 'not-enrolled'

interface LiveRecord {
  id: string
  studentId: string
  status: AttendanceStatus
  scanTime: string
}

export default function Attendance() {
  const [selectedCourse, setSelectedCourse] = useState(courses[0].id)
  const [selectedGroup, setSelectedGroup] = useState(groups[0].id)
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionTime, setSessionTime] = useState('08:00')
  const [tokenInput, setTokenInput] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scannedStudent, setScannedStudent] = useState<typeof students[0] | null>(null)
  const [scanTime, setScanTime] = useState('')
  const [records, setRecords] = useState<LiveRecord[]>([])
  const [sound, setSound] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const availableGroups = groups.filter(g => g.courseId === selectedCourse)
  const currentGroup = groups.find(g => g.id === selectedGroup)
  const groupStudents = students.filter(s => s.groupId === selectedGroup)

  const present = records.filter(r => r.status === 'present').length
  const late = records.filter(r => r.status === 'late').length
  const rate = groupStudents.length > 0 ? Math.round(((present + late) / groupStudents.length) * 100) : 0

  useEffect(() => { inputRef.current?.focus() }, [])

  const processScan = (token: string) => {
    const trimmed = token.trim().toUpperCase()
    if (!trimmed) return

    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    setScanTime(timeStr)

    const student = students.find(s => s.token.toUpperCase() === trimmed || s.studentNumber.toUpperCase() === trimmed)

    if (!student) {
      setScanState('invalid')
      setScannedStudent(null)
      setTimeout(() => setScanState('idle'), 3000)
      return
    }

    if (student.status !== 'active') {
      setScanState('invalid')
      setScannedStudent(student)
      setTimeout(() => setScanState('idle'), 3000)
      return
    }

    if (!groupStudents.find(s => s.id === student.id)) {
      setScanState('not-enrolled')
      setScannedStudent(student)
      setTimeout(() => setScanState('idle'), 3000)
      return
    }

    if (records.find(r => r.studentId === student.id)) {
      setScanState('already')
      setScannedStudent(student)
      setTimeout(() => setScanState('idle'), 3000)
      return
    }

    const [sh, sm] = sessionTime.split(':').map(Number)
    const [nh, nm] = timeStr.split(':').map(Number)
    const diffMins = (nh * 60 + nm) - (sh * 60 + sm)
    const status: AttendanceStatus = diffMins > 10 ? 'late' : 'present'

    setScannedStudent(student)
    setScanState('success')
    setRecords(prev => [...prev, { id: `r${Date.now()}`, studentId: student.id, status, scanTime: timeStr }])
    setTimeout(() => setScanState('idle'), 3000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      processScan(tokenInput)
      setTokenInput('')
    }
  }

  const scanStateConfig = {
    idle: { bg: 'bg-slate-50', border: 'border-slate-200', icon: ScanLine, iconColor: 'text-slate-300', label: 'Scanner la carte étudiant', sublabel: 'Approchez la carte QR ou saisissez le token' },
    success: { bg: 'bg-green-50', border: 'border-green-300', icon: CheckCircle, iconColor: 'text-green-500', label: scannedStudent ? `${scannedStudent.firstName} ${scannedStudent.lastName}` : '', sublabel: `Présence enregistrée · ${scanTime}` },
    already: { bg: 'bg-yellow-50', border: 'border-yellow-300', icon: AlertTriangle, iconColor: 'text-yellow-500', label: scannedStudent ? `${scannedStudent.firstName} ${scannedStudent.lastName}` : '', sublabel: 'Étudiant déjà pointé dans cette session' },
    invalid: { bg: 'bg-red-50', border: 'border-red-300', icon: XCircle, iconColor: 'text-red-500', label: 'Carte invalide ou désactivée', sublabel: 'Token non reconnu dans le système' },
    'not-enrolled': { bg: 'bg-orange-50', border: 'border-orange-300', icon: AlertTriangle, iconColor: 'text-orange-500', label: scannedStudent ? `${scannedStudent.firstName} ${scannedStudent.lastName}` : '', sublabel: 'Étudiant non inscrit dans ce groupe' },
  }

  const cfg = scanStateConfig[scanState]
  const CfgIcon = cfg.icon

  return (
    <div className="grid grid-cols-3 gap-5 h-full">
      {/* Left: Scanner */}
      <div className="col-span-2 flex flex-col gap-4">
        {/* Session config */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Cours</label>
              <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedGroup(groups.find(g => g.courseId === e.target.value)?.id ?? '') }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Groupe</label>
              <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Heure début</label>
              <input type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white" />
            </div>
          </div>
        </div>

        {/* Scanner area */}
        <div className={`bg-white rounded-xl border-2 shadow-sm p-8 flex flex-col items-center justify-center transition-all duration-300 ${cfg.border} ${cfg.bg}`}>
          <CfgIcon size={64} className={`mb-4 ${cfg.iconColor} transition-all`} />
          {scanState === 'success' && scannedStudent && (
            <img src={scannedStudent.photo} alt={scannedStudent.firstName}
              className="w-16 h-16 rounded-full object-cover border-4 border-green-300 mb-3 -mt-2" />
          )}
          <p className="text-lg font-bold text-slate-900 text-center">{cfg.label}</p>
          <p className="text-sm text-slate-500 mt-1 text-center">{cfg.sublabel}</p>

          <div className="mt-6 flex gap-3 w-full max-w-sm">
            <input
              ref={inputRef}
              type="text"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="STD-2026-00017"
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono bg-white"
            />
            <button
              onClick={() => { processScan(tokenInput); setTokenInput('') }}
              className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Scanner
            </button>
          </div>
        </div>

        {/* Attendance list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Présences de la session ({records.length})</h3>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><Plus size={12} /> Manuel</button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><Printer size={12} /> Imprimer</button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><Download size={12} /> Exporter</button>
            </div>
          </div>
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <ScanLine size={32} className="mb-2" />
              <p className="text-sm">Aucune présence enregistrée</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Étudiant</th><th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Heure</th><th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th><th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {records.map(r => {
                  const student = students.find(s => s.id === r.studentId)!
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <img src={student.photo} alt={student.firstName} className="w-7 h-7 rounded-full object-cover bg-slate-100" />
                        <span className="font-medium text-slate-800">{student.firstName} {student.lastName}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.scanTime}</td>
                      <td className="px-4 py-2.5"><Badge variant={r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'error'}>{r.status}</Badge></td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setRecords(prev => prev.map(rec => rec.id === r.id ? { ...rec, status: rec.status === 'present' ? 'late' : 'present' } : rec))}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors">Corriger</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right: Stats */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Son</span>
          <button onClick={() => setSound(s => !s)} className="text-slate-400 hover:text-slate-700 transition-colors">
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        {[
          { label: 'Présents', value: present, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Attendus', value: groupStudents.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'En retard', value: late, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5 text-center border border-slate-100`}>
            <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-600">Taux de présence</span>
            <span className="text-sm font-bold text-blue-700">{rate}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Absents ce jour</h4>
          <div className="space-y-2">
            {groupStudents.filter(s => !records.find(r => r.studentId === s.id)).map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <img src={s.photo} alt={s.firstName} className="w-6 h-6 rounded-full object-cover bg-slate-100" />
                <span className="text-xs text-slate-600">{s.firstName} {s.lastName}</span>
              </div>
            ))}
            {groupStudents.filter(s => !records.find(r => r.studentId === s.id)).length === 0 && (
              <p className="text-xs text-green-600 font-medium">Tous les étudiants sont présents !</p>
            )}
          </div>
        </div>

        <button className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm mt-auto">
          Terminer la session
        </button>
      </div>
    </div>
  )
}
