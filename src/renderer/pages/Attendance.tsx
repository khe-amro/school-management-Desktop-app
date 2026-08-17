import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ScanLine, CheckCircle2, XCircle, Clock, UserCheck,
  Square, Search, Volume2, VolumeX, User, ArrowRight,
  Calendar, BookOpen, AlertTriangle
} from 'lucide-react'
import type { AttendanceSession, Course, Group, QRScanResult } from '@shared/types/index'

type QRMode = 'attendance' | 'lookup'
type ScanFeedback = { type: 'success' | 'late' | 'error' | 'warn'; message: string } | null

interface StudentLookupResult {
  student: {
    id: number
    studentNumber: string
    firstNameAr: string
    lastNameAr: string
    firstNameFr: string
    lastNameFr: string
    status: string
    phone?: string
    photoPath?: string
  }
  enrollments: any[]
  attendanceSummary: {
    totalSessions: number
    present: number
    absent: number
    late: number
    attendanceRate: number
  }
  paymentsSummary: {
    totalPaid: number
    lastPaymentDate?: string
    status: string
  }
}

export default function Attendance() {
  const { t, i18n } = useTranslation()

  // Mode selection: attendance vs lookup
  const [mode, setMode] = useState<QRMode>('attendance')

  // Selection state
  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)

  // Active attendance session
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [sessionStats, setSessionStats] = useState({ present: 0, absent: 0, late: 0, total: 0 })
  const [scanInput, setScanInput] = useState('')
  const [feedback, setFeedback] = useState<ScanFeedback>(null)
  const [starting, setStarting] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Student Lookup result
  const [lookupResult, setLookupResult] = useState<StudentLookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const scanInputRef = useRef<HTMLInputElement>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    const [cr, gr] = await Promise.all([
      window.schoolApp.courses.list(),
      window.schoolApp.groups.list(),
    ])
    if (cr.success && cr.data) setCourses(cr.data)
    if (gr.success && gr.data) setGroups(gr.data)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Load upcoming sessions when group changes
  useEffect(() => {
    if (selectedGroup) {
      window.schoolApp.sessions.list({ groupId: selectedGroup }).then((res) => {
        if (res.success && res.data) setSessions(res.data)
      })
    } else {
      setSessions([])
    }
  }, [selectedGroup])

  // Auto focus scanner input
  useEffect(() => {
    scanInputRef.current?.focus()
  }, [mode, activeSession])

  const showFeedback = (f: NonNullable<ScanFeedback>) => {
    setFeedback(f)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3500)

    if (soundEnabled) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        osc.type = f.type === 'success' ? 'sine' : f.type === 'late' ? 'triangle' : 'sawtooth'
        osc.frequency.setValueAtTime(f.type === 'success' ? 880 : f.type === 'late' ? 587 : 220, ctx.currentTime)
        osc.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
      } catch { /* ignore */ }
    }
  }

  const refreshStats = async (sessionId: number) => {
    const res = await window.schoolApp.attendance.getSession(sessionId)
    if (res.success && res.data) {
      const records = res.data.records ?? []
      setSessionStats({
        present: records.filter((r) => r.attendanceStatus === 'present').length,
        late: records.filter((r) => r.attendanceStatus === 'late').length,
        absent: records.filter((r) => r.attendanceStatus === 'absent').length,
        total: records.length,
      })
    }
  }

  const handleStartSession = async () => {
    if (!selectedGroup) return
    setStarting(true)
    try {
      const res = await window.schoolApp.attendance.startSession({
        groupId: selectedGroup,
        sessionDate: new Date().toISOString().slice(0, 10),
      })
      if (res.success) {
        setActiveSession(res.data)
        await refreshStats(res.data.id)
      } else {
        showFeedback({ type: 'error', message: res.error ?? t('common.error') })
      }
    } finally {
      setStarting(false)
    }
  }

  const handleEndSession = async () => {
    if (!activeSession) return
    if (!window.confirm(t('attendance.closeSessionConfirm'))) return
    await window.schoolApp.attendance.endSession(activeSession.id)
    setActiveSession(null)
    setScanInput('')
  }

  const handleAttendanceScan = async (token: string) => {
    if (!activeSession) return
    const res = await window.schoolApp.attendance.scan(activeSession.id, token)
    if (!res.success) {
      showFeedback({ type: 'error', message: res.error ?? t('errors.INTERNAL_ERROR') })
      return
    }

    const data = res.data as QRScanResult
    switch (data.code) {
      case 'recorded':
        showFeedback({
          type: data.attendanceStatus === 'late' ? 'late' : 'success',
          message: `${data.studentName} — ${data.attendanceStatus === 'late' ? t('attendance.late') : t('attendance.present')}`,
        })
        await refreshStats(activeSession.id)
        break
      case 'already_scanned':
        showFeedback({ type: 'warn', message: `${data.studentName} — ${t('attendance.alreadyScanned')}` })
        break
      case 'unknown_card':
        showFeedback({ type: 'error', message: t('attendance.unknownCard') })
        break
      case 'disabled_card':
        showFeedback({ type: 'error', message: t('attendance.disabledCard') })
        break
      case 'student_inactive':
        showFeedback({ type: 'error', message: `${data.studentName} — ${t('attendance.studentInactive')}` })
        break
      case 'not_enrolled':
        showFeedback({ type: 'error', message: `${data.studentName} — ${t('attendance.notEnrolled')}` })
        break
      case 'session_closed':
        showFeedback({ type: 'error', message: t('attendance.sessionClosed') })
        break
    }
  }

  const handleLookupScan = async (token: string) => {
    setLookupLoading(true)
    try {
      const res = await window.schoolApp.attendance.lookup(token)
      if (res.success) {
        setLookupResult(res.data)
      } else {
        showFeedback({ type: 'error', message: res.error ?? t('attendance.cardNotFound') })
      }
    } finally {
      setLookupLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const token = scanInput.trim()
    setScanInput('')
    if (!token) return

    if (mode === 'attendance') {
      handleAttendanceScan(token)
    } else {
      handleLookupScan(token)
    }
  }

  const feedbackColor = {
    success: 'bg-green-50 border-green-300 text-green-800',
    late: 'bg-amber-50 border-amber-300 text-amber-800',
    warn: 'bg-blue-50 border-blue-300 text-blue-800',
    error: 'bg-red-50 border-red-300 text-red-800',
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Mode Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.attendance')}</h2>
          <p className="text-xs text-slate-400">{t('attendance.subtitle')}</p>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setMode('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'attendance'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScanLine size={14} /> {t('attendance.modeAttendance')}
          </button>
          <button
            onClick={() => setMode('lookup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'lookup'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search size={14} /> {t('attendance.modeLookup')}
          </button>
        </div>
      </div>

      {/* ── MODE 1: ATTENDANCE MODE ── */}
      {mode === 'attendance' && (
        <>
          {!activeSession ? (
            /* Session Picker Setup */
            <div className="max-w-xl mx-auto bg-white rounded-2xl border border-border p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto text-[#2563EB]">
                <ScanLine size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">{t('attendance.startSession')}</h3>
                <p className="text-slate-400 text-xs mt-1">{t('attendance.startPrompt')}</p>
              </div>

              {/* Group Selector */}
              <div className="space-y-3 text-start">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('attendance.groupCourse')} *</label>
                  <select
                    value={selectedGroup ?? ''}
                    onChange={(e) => setSelectedGroup(Number(e.target.value) || null)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                  >
                    <option value="">{t('attendance.chooseGroup')}</option>
                    {courses.map((course) => {
                      const cg = groups.filter((g) => g.courseId === course.id && g.status === 'active')
                      if (!cg.length) return null
                      const courseName = i18n.language === 'ar' ? (course.nameAr || course.nameFr) : (course.nameFr || course.nameAr)
                      return (
                        <optgroup key={course.id} label={courseName}>
                          {cg.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
              </div>

              <button
                onClick={handleStartSession}
                disabled={!selectedGroup || starting}
                className="w-full bg-[#2563EB] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {starting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('attendance.startSession')}
              </button>
            </div>
          ) : (
            /* Active Scanner UI */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 8 cols: Scanner & Feedback */}
              <div className="lg:col-span-8 space-y-4">
                {/* Stats Header Bar */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{sessionStats.present}</p>
                    <p className="text-xs text-green-700 font-medium mt-1">{t('attendance.presentCount')}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">{sessionStats.late}</p>
                    <p className="text-xs text-amber-700 font-medium mt-1">{t('attendance.lateCount')}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-[#2563EB]">{sessionStats.total}</p>
                    <p className="text-xs text-blue-700 font-medium mt-1">{t('attendance.totalScanned')}</p>
                  </div>
                </div>

                {/* Main Scanner Box */}
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-bold text-[#0F172A]">{t('attendance.readyToScan')}</span>
                    </div>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title={soundEnabled ? t('attendance.disableSound') : t('attendance.enableSound')}
                    >
                      {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                  </div>

                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('attendance.scanOrType')}
                    className="w-full px-4 py-3.5 border-2 border-[#2563EB]/30 rounded-xl text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-background font-mono"
                    dir="ltr"
                    autoFocus
                  />

                  {/* Dynamic Feedback Box */}
                  {feedback && (
                    <div className={`mt-4 flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-bold animate-fade-in ${feedbackColor[feedback.type]}`}>
                      {feedback.type === 'success' && <CheckCircle2 size={20} />}
                      {feedback.type === 'late' && <Clock size={20} />}
                      {feedback.type === 'warn' && <UserCheck size={20} />}
                      {feedback.type === 'error' && <XCircle size={20} />}
                      {feedback.message}
                    </div>
                  )}

                  <button
                    onClick={handleEndSession}
                    className="mt-6 w-full flex items-center justify-center gap-2 py-3 border border-red-300 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
                  >
                    <Square size={14} /> {t('attendance.closeSession')}
                  </button>
                </div>
              </div>

              {/* Right 4 cols: Session details */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white rounded-xl border border-border p-5">
                  <h4 className="font-bold text-sm text-[#0F172A] mb-3">{t('attendance.sessionDetails')}</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">{t('attendance.sessionId')}:</span>
                      <span className="font-mono font-bold">#{activeSession.id}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">{t('attendance.date')}:</span>
                      <span className="font-medium">{activeSession.sessionDate}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">{t('common.status')}:</span>
                      <span className="text-green-600 font-bold">{t('attendance.inProgress')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODE 2: STUDENT LOOKUP MODE (No attendance record created) ── */}
      {mode === 'lookup' && (
        <div className="space-y-6">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="font-bold text-sm text-[#0F172A] mb-3 flex items-center gap-2">
              <Search size={16} className="text-[#2563EB]" /> {t('attendance.quickLookup')}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {t('attendance.quickLookupDesc')}
            </p>
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('attendance.scanPlaceholder')}
              className="w-full px-4 py-3 border-2 border-[#2563EB]/30 rounded-xl text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-background font-mono"
              dir="ltr"
              autoFocus
            />
          </div>

          {lookupLoading && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Lookup Result Card */}
          {lookupResult && !lookupLoading && (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-border p-6 shadow-lg space-y-5 animate-fade-in">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-16 h-16 rounded-full bg-[#EFF6FF] border-2 border-[#2563EB] flex items-center justify-center text-[#2563EB] font-bold text-xl">
                  {lookupResult.student.firstNameAr.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#0F172A]">
                    {lookupResult.student.lastNameAr} {lookupResult.student.firstNameAr}
                  </h3>
                  <p className="text-xs text-slate-400">{lookupResult.student.lastNameFr} {lookupResult.student.firstNameFr}</p>
                  <p className="text-xs font-mono text-[#2563EB] font-bold mt-0.5">{lookupResult.student.studentNumber}</p>
                </div>
                <span className={`ms-auto text-xs px-3 py-1 rounded-full font-bold ${
                  lookupResult.student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {lookupResult.student.status === 'active' ? t('students.active') : t('students.inactive')}
                </span>
              </div>

              {/* Quick stats grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">{t('attendance.totalAttendance')}</p>
                  <p className="text-lg font-bold text-green-600">
                    {lookupResult.attendanceSummary?.present ?? 0} / {lookupResult.attendanceSummary?.totalSessions ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">{t('attendance.financialStatus')}</p>
                  <p className={`text-lg font-bold ${
                    lookupResult.paymentsSummary?.status === 'paid' ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {lookupResult.paymentsSummary?.status === 'paid' ? t('attendance.upToDate') : t('attendance.pending')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
