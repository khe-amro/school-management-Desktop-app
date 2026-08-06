import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScanLine, CheckCircle2, XCircle, Clock, UserCheck, Square } from 'lucide-react'
import type { AttendanceSession, Course, Group, QRScanResult } from '@shared/types/index'

type ScanFeedback = { type: 'success' | 'late' | 'error' | 'warn'; message: string } | null

export default function Attendance() {
  const { t } = useTranslation()
  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [session, setSession] = useState<AttendanceSession | null>(null)
  const [sessionStats, setSessionStats] = useState({ present: 0, absent: 0, late: 0 })
  const [scanInput, setScanInput] = useState('')
  const [feedback, setFeedback] = useState<ScanFeedback>(null)
  const [starting, setStarting] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([window.schoolApp.courses.list(), window.schoolApp.groups.list()]).then(([cr, gr]) => {
      if (cr.success && cr.data) setCourses(cr.data)
      if (gr.success && gr.data) setGroups(gr.data)
    })
  }, [])

  // Focus scan input when session is active
  useEffect(() => {
    if (session) scanInputRef.current?.focus()
  }, [session])

  const refreshStats = async (sessionId: number) => {
    const res = await window.schoolApp.attendance.getSession(sessionId)
    if (res.success && res.data) {
      const records = res.data.records
      setSessionStats({
        present: records.filter((r) => r.attendanceStatus === 'present').length,
        late: records.filter((r) => r.attendanceStatus === 'late').length,
        absent: records.filter((r) => r.attendanceStatus === 'absent').length,
      })
    }
  }

  const showFeedback = (f: NonNullable<ScanFeedback>) => {
    setFeedback(f)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000)
  }

  const handleStartSession = async () => {
    if (!selectedGroup) return
    setStarting(true)
    const res = await window.schoolApp.attendance.startSession({
      groupId: selectedGroup,
      sessionDate: new Date().toISOString().slice(0, 10),
    })
    setStarting(false)
    if (res.success && res.data) {
      setSession(res.data)
      setSessionStats({ present: 0, absent: 0, late: 0 })
    }
  }

  const handleEndSession = async () => {
    if (!session) return
    if (!window.confirm('هل تريد إنهاء الجلسة؟')) return
    await window.schoolApp.attendance.endSession(session.id)
    setSession(null)
    setScanInput('')
  }

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const token = scanInput.trim()
    setScanInput('')
    if (!token || !session) return

    const res = await window.schoolApp.attendance.scan(session.id, token)
    if (!res.success) {
      showFeedback({ type: 'error', message: t('errors.INTERNAL_ERROR') })
      return
    }

    const data = res.data as QRScanResult
    switch (data.code) {
      case 'recorded':
        showFeedback({ type: data.attendanceStatus === 'late' ? 'late' : 'success', message: `${data.studentName} — ${t(`attendance.${data.attendanceStatus}`)}` })
        await refreshStats(session.id)
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

  const feedbackColor = {
    success: 'bg-green-50 border-green-300 text-green-800',
    late: 'bg-amber-50 border-amber-300 text-amber-800',
    warn: 'bg-blue-50 border-blue-300 text-blue-800',
    error: 'bg-red-50 border-red-300 text-red-800',
  }

  const activeGroups = groups.filter((g) => g.status === 'active')

  if (!session) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-5">
            <ScanLine size={28} className="text-[#2563EB]" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">{t('attendance.startSession')}</h2>
          <p className="text-slate-400 text-sm mb-6">{t('attendance.selectGroup')}</p>

          <select
            value={selectedGroup ?? ''}
            onChange={(e) => setSelectedGroup(Number(e.target.value) || null)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm mb-4 bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          >
            <option value="">— {t('attendance.selectGroup')} —</option>
            {courses.map((course) => {
              const cg = activeGroups.filter((g) => g.courseId === course.id)
              if (!cg.length) return null
              return (
                <optgroup key={course.id} label={course.nameAr}>
                  {cg.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </optgroup>
              )
            })}
          </select>

          <button
            onClick={handleStartSession}
            disabled={!selectedGroup || starting}
            className="w-full bg-[#2563EB] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {starting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {t('attendance.startSession')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-4">
      {/* Session stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{sessionStats.present}</p>
          <p className="text-xs text-green-600 font-medium mt-1">{t('attendance.presentCount')}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{sessionStats.late}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">{t('attendance.lateCount')}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{sessionStats.absent}</p>
          <p className="text-xs text-red-600 font-medium mt-1">{t('attendance.absentCount')}</p>
        </div>
      </div>

      {/* Scanner */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-[#0F172A]">{t('attendance.scanQR')}</span>
          <span className="ms-auto text-xs text-slate-400">{new Date().toLocaleDateString()}</span>
        </div>

        <input
          ref={scanInputRef}
          type="text"
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          onKeyDown={handleScan}
          placeholder={t('attendance.scanPlaceholder')}
          className="w-full px-4 py-3 border-2 border-[#2563EB]/30 rounded-xl text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-background font-mono"
          dir="ltr"
          autoFocus
        />

        {/* Feedback */}
        {feedback && (
          <div className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-fade-in ${feedbackColor[feedback.type]}`}>
            {feedback.type === 'success' && <CheckCircle2 size={18} />}
            {feedback.type === 'late' && <Clock size={18} />}
            {feedback.type === 'warn' && <UserCheck size={18} />}
            {feedback.type === 'error' && <XCircle size={18} />}
            {feedback.message}
          </div>
        )}

        <button
          onClick={handleEndSession}
          className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
        >
          <Square size={13} /> {t('attendance.endSession')}
        </button>
      </div>
    </div>
  )
}
