import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ScanLine, Volume2, VolumeX, CheckCircle, XCircle, AlertTriangle,
  Clock, Users, Printer, Download, Plus, Search, Eye, RefreshCw, X
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import type { AttendanceStatus } from '../types'

type ScanState = 'idle' | 'success' | 'already' | 'invalid' | 'not-enrolled' | 'overdue'

interface ScannedStudentInfo {
  id: number
  studentNumber: string
  firstNameFr: string
  lastNameFr: string
  firstNameAr?: string
  lastNameAr?: string
  photoPath?: string | null
  photoUrl?: string | null
  paymentStatus?: string
  remainingSessions?: number
}

interface LiveRecord {
  id: string
  studentId: number
  studentName: string
  studentNumber: string
  photoUrl?: string | null
  status: AttendanceStatus
  scanTime: string
  source: 'qr' | 'manual'
}

function playBeep(type: 'success' | 'error' | 'warning') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08) // E6
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else if (type === 'warning') {
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    }
  } catch {
    // AudioContext not available or blocked
  }
}

export default function Attendance() {
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionTime, setSessionTime] = useState('08:00')
  const [activeSession, setActiveSession] = useState<any | null>(null)
  const [groupStudents, setGroupStudents] = useState<any[]>([])

  // Mode: 'attendance' vs 'lookup'
  const [mode, setMode] = useState<'attendance' | 'lookup'>('attendance')
  const [tokenInput, setTokenInput] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scannedStudent, setScannedStudent] = useState<ScannedStudentInfo | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  const [scanTime, setScanTime] = useState('')
  const [records, setRecords] = useState<LiveRecord[]>([])
  const [sound, setSound] = useState(true)
  const [loading, setLoading] = useState(false)

  // Lookup result modal
  const [lookupResult, setLookupResult] = useState<any | null>(null)
  const [manualModal, setManualModal] = useState(false)
  const [manualStudentId, setManualStudentId] = useState<number | ''>('')
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('present')

  const inputRef = useRef<HTMLInputElement>(null)
  const api = (window as any).schoolApp

  // Load initial courses & groups
  useEffect(() => {
    const init = async () => {
      if (!api) return
      try {
        const cRes = await api.courses.list({ status: 'active' })
        if (cRes.success && cRes.data) {
          setCourses(cRes.data)
          if (cRes.data.length > 0) {
            setSelectedCourse(String(cRes.data[0].id))
          }
        }
      } catch (err) {
        console.error('Failed to load courses:', err)
      }
    }
    init()
  }, [])

  // Load groups when course changes
  useEffect(() => {
    const loadGroups = async () => {
      if (!api || !selectedCourse) return
      try {
        const gRes = await api.groups.byCourse(Number(selectedCourse))
        if (gRes.success && gRes.data) {
          setGroups(gRes.data)
          if (gRes.data.length > 0) {
            setSelectedGroup(String(gRes.data[0].id))
          } else {
            setSelectedGroup('')
          }
        }
      } catch (err) {
        console.error('Failed to load groups:', err)
      }
    }
    loadGroups()
  }, [selectedCourse])

  // Load group students & active session when group changes
  const loadGroupDetails = useCallback(async () => {
    if (!api || !selectedGroup) {
      setGroupStudents([])
      setActiveSession(null)
      setRecords([])
      return
    }

    try {
      // 1. Get enrollments for group
      const enrollRes = await api.enrollments.byGroup(Number(selectedGroup))
      if (enrollRes.success && enrollRes.data) {
        const studentsList: any[] = []
        for (const en of enrollRes.data) {
          const sRes = await api.students.getById(en.studentId)
          if (sRes.success && sRes.data) {
            let photoUrl = null
            if (sRes.data.photoPath) {
              const pRes = await api.media.getImageUrl(sRes.data.photoPath)
              if (pRes.success) photoUrl = pRes.data.url
            }
            studentsList.push({ ...sRes.data, enrollmentId: en.id, photoUrl })
          }
        }
        setGroupStudents(studentsList)
      }

      // 2. Check for open session today
      const sessRes = await api.sessions.list({ groupId: Number(selectedGroup), status: 'open' })
      if (sessRes.success && sessRes.data && sessRes.data.length > 0) {
        const current = sessRes.data[0]
        setActiveSession(current)
        // Load records for session
        const fullSess = await api.attendance.getSession(current.id)
        if (fullSess.success && fullSess.data?.records) {
          const liveRecs: LiveRecord[] = []
          for (const r of fullSess.data.records) {
            const stu = await api.students.getById(r.studentId)
            let photoUrl = null
            if (stu.data?.photoPath) {
              const pRes = await api.media.getImageUrl(stu.data.photoPath)
              if (pRes.success) photoUrl = pRes.data.url
            }
            liveRecs.push({
              id: String(r.id),
              studentId: r.studentId,
              studentName: stu.data ? `${stu.data.firstNameFr} ${stu.data.lastNameFr}` : `Étudiant #${r.studentId}`,
              studentNumber: stu.data?.studentNumber ?? '',
              photoUrl,
              status: r.attendanceStatus as AttendanceStatus,
              scanTime: r.scannedAt ? new Date(r.scannedAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' }) : '--:--',
              source: (r.source as 'qr' | 'manual') || 'qr'
            })
          }
          setRecords(liveRecs)
        }
      } else {
        setActiveSession(null)
        setRecords([])
      }
    } catch (err) {
      console.error('Failed to load group details:', err)
    }
  }, [selectedGroup])

  useEffect(() => {
    loadGroupDetails()
  }, [loadGroupDetails])

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode, scanState])

  // Start a new session
  const handleStartSession = async () => {
    if (!api || !selectedGroup) return
    setLoading(true)
    try {
      const res = await api.attendance.startSession({
        groupId: Number(selectedGroup),
        sessionDate,
        plannedStartTime: sessionTime,
        lateThresholdMinutes: 10,
      })
      if (res.success && res.data) {
        setActiveSession(res.data)
        setRecords([])
        if (sound) playBeep('success')
      } else {
        alert(res.error?.message || 'Erreur lors du démarrage de la session')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // End active session
  const handleEndSession = async () => {
    if (!api || !activeSession) return
    if (!confirm('Voulez-vous vraiment clôturer cette session de présence ?')) return
    setLoading(true)
    try {
      const res = await api.attendance.endSession(activeSession.id)
      if (res.success) {
        setActiveSession(null)
        setRecords([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Process QR or Manual Token Scan
  const processScan = async (token: string) => {
    const trimmed = token.trim()
    if (!trimmed || !api) return

    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    setScanTime(timeStr)

    if (mode === 'lookup') {
      // Lookup mode: safe preview, does NOT modify attendance
      try {
        const res = await api.attendance.lookup(trimmed)
        if (res.success && res.data) {
          setLookupResult(res.data)
          if (sound) playBeep('success')
        } else {
          setScanState('invalid')
          setScanMessage('Token non reconnu dans le système')
          if (sound) playBeep('error')
          setTimeout(() => setScanState('idle'), 3000)
        }
      } catch {
        setScanState('invalid')
        setTimeout(() => setScanState('idle'), 3000)
      }
      return
    }

    // Attendance mode
    if (!activeSession) {
      alert('Veuillez démarrer une session avant de scanner')
      return
    }

    try {
      const res = await api.attendance.scan(activeSession.id, trimmed)
      if (res.success && res.data) {
        const { student, status, isDuplicate, remainingSessions } = res.data
        let photoUrl = null
        if (student?.photoPath) {
          const pRes = await api.media.getImageUrl(student.photoPath)
          if (pRes.success) photoUrl = pRes.data.url
        }

        const studentInfo: ScannedStudentInfo = {
          id: student.id,
          studentNumber: student.studentNumber,
          firstNameFr: student.firstNameFr,
          lastNameFr: student.lastNameFr,
          firstNameAr: student.firstNameAr,
          lastNameAr: student.lastNameAr,
          photoPath: student.photoPath,
          photoUrl,
          remainingSessions
        }
        setScannedStudent(studentInfo)

        if (isDuplicate) {
          setScanState('already')
          setScanMessage('Étudiant déjà pointé dans cette session')
          if (sound) playBeep('warning')
        } else {
          setScanState('success')
          setScanMessage(`Présence enregistrée (${status === 'late' ? 'En retard' : 'Présent'}) · ${timeStr}`)
          if (sound) playBeep('success')

          // Add to live list
          setRecords(prev => [
            {
              id: String(Date.now()),
              studentId: student.id,
              studentName: `${student.firstNameFr} ${student.lastNameFr}`,
              studentNumber: student.studentNumber,
              photoUrl,
              status: status as AttendanceStatus,
              scanTime: timeStr,
              source: 'qr'
            },
            ...prev
          ])
        }
        setTimeout(() => setScanState('idle'), 3500)
      } else {
        const errCode = res.error?.code
        const errMsg = res.error?.message || 'Erreur lors du scan'
        if (errCode === 'NOT_ENROLLED') {
          setScanState('not-enrolled')
          setScanMessage('Étudiant non inscrit dans ce groupe')
        } else {
          setScanState('invalid')
          setScanMessage(errMsg)
        }
        if (sound) playBeep('error')
        setTimeout(() => setScanState('idle'), 3500)
      }
    } catch (err: any) {
      setScanState('invalid')
      setScanMessage(err?.message || 'Erreur scan')
      if (sound) playBeep('error')
      setTimeout(() => setScanState('idle'), 3000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      processScan(tokenInput)
      setTokenInput('')
    }
  }

  // Add manual attendance
  const handleAddManual = async () => {
    if (!api || !activeSession || !manualStudentId) return
    try {
      const res = await api.attendance.markManually({
        sessionId: activeSession.id,
        studentId: Number(manualStudentId),
        attendanceStatus: manualStatus,
        notes: 'Ajout manuel'
      })
      if (res.success) {
        const stu = groupStudents.find(s => s.id === Number(manualStudentId))
        setRecords(prev => [
          {
            id: String(Date.now()),
            studentId: Number(manualStudentId),
            studentName: stu ? `${stu.firstNameFr} ${stu.lastNameFr}` : `Étudiant #${manualStudentId}`,
            studentNumber: stu?.studentNumber ?? '',
            photoUrl: stu?.photoUrl,
            status: manualStatus,
            scanTime: new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' }),
            source: 'manual'
          },
          ...prev.filter(r => r.studentId !== Number(manualStudentId))
        ])
        setManualModal(false)
        setManualStudentId('')
      } else {
        alert(res.error?.message || 'Erreur')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const present = records.filter(r => r.status === 'present').length
  const late = records.filter(r => r.status === 'late').length
  const expected = groupStudents.length
  const rate = expected > 0 ? Math.round(((present + late) / expected) * 100) : 0

  const scanStateConfig = {
    idle: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      icon: ScanLine,
      iconColor: 'text-slate-400',
      label: mode === 'attendance' ? 'Scanner la carte / ticket étudiant' : 'Mode Recherche Rapide (Lookup)',
      sublabel: mode === 'attendance' ? 'Approchez le ticket QR ou saisissez le token' : 'Scannez pour consulter sans enregistrer de présence'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      label: scannedStudent ? `${scannedStudent.firstNameFr} ${scannedStudent.lastNameFr}` : '',
      sublabel: scanMessage
    },
    already: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      label: scannedStudent ? `${scannedStudent.firstNameFr} ${scannedStudent.lastNameFr}` : '',
      sublabel: scanMessage
    },
    invalid: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      icon: XCircle,
      iconColor: 'text-red-500',
      label: 'Token invalide ou erreur',
      sublabel: scanMessage
    },
    'not-enrolled': {
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      label: 'Étudiant non inscrit',
      sublabel: scanMessage
    },
    overdue: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      label: 'Paiement en retard',
      sublabel: scanMessage
    }
  }

  const cfg = scanStateConfig[scanState]
  const CfgIcon = cfg.icon

  return (
    <div className="grid grid-cols-3 gap-5 h-full">
      {/* Left: Scanner & Sessions */}
      <div className="col-span-2 flex flex-col gap-4">
        {/* Session config header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Cours</label>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                {courses.map(c => <option key={c.id} value={c.id}>{c.nameFr || c.nameAr || c.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Groupe</label>
              <select
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Date & Heure</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
                <input
                  type="time"
                  value={sessionTime}
                  onChange={e => setSessionTime(e.target.value)}
                  className="w-20 px-2 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>
            <div>
              {!activeSession ? (
                <button
                  onClick={handleStartSession}
                  disabled={loading || !selectedGroup}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Démarrer session
                </button>
              ) : (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Session en cours
                  </div>
                  <button
                    onClick={handleEndSession}
                    className="text-xs text-red-600 hover:text-red-800 font-medium ml-2"
                  >
                    Clôturer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mode Toggle & Scanner */}
        <div className={`bg-white rounded-xl border-2 shadow-sm p-7 flex flex-col items-center justify-center transition-all duration-300 relative ${cfg.border} ${cfg.bg}`}>
          {/* Mode Switcher */}
          <div className="absolute top-3 right-3 flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setMode('attendance')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'attendance' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Mode Présence
            </button>
            <button
              onClick={() => setMode('lookup')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'lookup' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Mode Recherche
            </button>
          </div>

          <CfgIcon size={56} className={`mb-3 ${cfg.iconColor} transition-all`} />

          {scanState === 'success' && scannedStudent?.photoUrl && (
            <img
              src={scannedStudent.photoUrl}
              alt={scannedStudent.firstNameFr}
              className="w-16 h-16 rounded-full object-cover border-4 border-green-300 mb-2 -mt-1 shadow"
            />
          )}

          <p className="text-lg font-bold text-slate-900 text-center">{cfg.label}</p>
          <p className="text-sm text-slate-500 mt-0.5 text-center">{cfg.sublabel}</p>

          <div className="mt-5 flex gap-2.5 w-full max-w-md">
            <input
              ref={inputRef}
              type="text"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scannez QR ou saisissez le token..."
              className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono bg-white"
            />
            <button
              onClick={() => { processScan(tokenInput); setTokenInput('') }}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              Scanner
            </button>
          </div>
        </div>

        {/* Live Attendance List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-white">
            <h3 className="text-sm font-semibold text-slate-800">
              Présences de la session ({records.length} / {groupStudents.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setManualModal(true)}
                disabled={!activeSession}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <Plus size={12} /> Manuel
              </button>
              <button
                onClick={() => (window as any).schoolApp?.app.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Printer size={12} /> Imprimer
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-72">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <ScanLine size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Aucune présence enregistrée pour cette session</p>
                {!activeSession && <p className="text-xs text-slate-400 mt-1">Démarrez une session pour commencer le pointage</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 sticky top-0">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Étudiant</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">N°</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Heure</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 flex items-center gap-2.5">
                        {r.photoUrl ? (
                          <img src={r.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-slate-100" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {r.studentName.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-slate-800">{r.studentName}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.studentNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.scanTime}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'error'}>
                          {r.status === 'present' ? 'Présent' : r.status === 'late' ? 'En retard' : 'Absent'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 uppercase font-mono">
                        {r.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Right: Stats & Absents */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Retour sonore</span>
          <button
            onClick={() => setSound(s => !s)}
            className={`p-1.5 rounded-lg border transition-colors ${sound ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-400 border-slate-200 hover:bg-slate-50'}`}
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-3.5 text-center border border-green-100">
            <p className="text-3xl font-bold text-green-700">{present}</p>
            <p className="text-xs text-green-800 font-medium mt-0.5">Présents</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3.5 text-center border border-amber-100">
            <p className="text-3xl font-bold text-amber-700">{late}</p>
            <p className="text-xs text-amber-800 font-medium mt-0.5">En retard</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3.5 text-center border border-blue-100">
            <p className="text-3xl font-bold text-blue-700">{expected}</p>
            <p className="text-xs text-blue-800 font-medium mt-0.5">Attendus</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-600 font-medium">Taux de présence</span>
            <span className="text-sm font-bold text-blue-700">{rate}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
          </div>
        </div>

        {/* Absents list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 flex flex-col overflow-hidden">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Non pointés ({groupStudents.filter(s => !records.some(r => r.studentId === s.id)).length})
          </h4>
          <div className="space-y-2 overflow-y-auto flex-1 max-h-56">
            {groupStudents
              .filter(s => !records.some(r => r.studentId === s.id))
              .map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover bg-slate-200" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                        {s.firstNameFr.charAt(0)}
                      </div>
                    )}
                    <span className="text-xs font-medium text-slate-700">{s.firstNameFr} {s.lastNameFr}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{s.studentNumber}</span>
                </div>
              ))}
            {groupStudents.length > 0 && groupStudents.filter(s => !records.some(r => r.studentId === s.id)).length === 0 && (
              <p className="text-xs text-green-600 font-medium py-4 text-center">Tous les étudiants du groupe sont présents !</p>
            )}
          </div>
        </div>
      </div>

      {/* Manual Attendance Modal */}
      <Modal open={manualModal} onClose={() => setManualModal(false)} title="Pointage manuel" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Étudiant</label>
            <select
              value={manualStudentId}
              onChange={e => setManualStudentId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="">Sélectionner un étudiant</option>
              {groupStudents.map(s => (
                <option key={s.id} value={s.id}>{s.firstNameFr} {s.lastNameFr} ({s.studentNumber})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Statut</label>
            <select
              value={manualStatus}
              onChange={e => setManualStatus(e.target.value as AttendanceStatus)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="present">Présent</option>
              <option value="late">En retard</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setManualModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleAddManual} disabled={!manualStudentId} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg">Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Lookup Mode Result Modal */}
      <Modal open={lookupResult !== null} onClose={() => setLookupResult(null)} title="Consultation Étudiant" size="md">
        {lookupResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xl text-blue-600 border">
                {lookupResult.student.firstNameFr.charAt(0)}{lookupResult.student.lastNameFr.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{lookupResult.student.firstNameFr} {lookupResult.student.lastNameFr}</h3>
                <p className="text-xs font-mono text-slate-500">{lookupResult.student.studentNumber}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={lookupResult.student.status}>{lookupResult.student.status}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">Total présences</span>
                <span className="text-sm font-bold text-green-700">{lookupResult.summary?.presentCount ?? 0} séances</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">Retards</span>
                <span className="text-sm font-bold text-amber-700">{lookupResult.summary?.lateCount ?? 0} séances</span>
              </div>
            </div>

            {lookupResult.enrollments && lookupResult.enrollments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Inscriptions actives</h4>
                <div className="space-y-1.5">
                  {lookupResult.enrollments.map((en: any) => (
                    <div key={en.id} className="p-2 rounded bg-slate-50 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{en.group?.name || 'Groupe'}</span>
                        <span className="text-slate-500 ml-2">({en.group?.course?.nameFr || 'Cours'})</span>
                      </div>
                      <span className="font-mono text-blue-700 font-semibold">{en.agreedPrice} DA</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setLookupResult(null)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Fermer</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
