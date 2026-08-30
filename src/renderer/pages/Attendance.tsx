import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScanLine, Search, Calendar, CheckCircle2, Clock, XCircle, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react'

type Tab = 'scanner' | 'roster' | 'calendar'
type StatusType = 'present' | 'absent' | 'late' | null

const STATUS_CLS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700',
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function monthRange(year: number, month: number) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const last = new Date(year, month + 1, 0)
  return { first, last: `${year}-${String(month + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` }
}

// ── Smart Scanner Tab ──────────────────────────────────────────────────────────
function SmartScanner({ lang }: { lang: string }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [sound, setSound] = useState(true)
  const [loading, setLoading] = useState(false)
  const [resolved, setResolved] = useState<any>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [marking, setMarking] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'late' | 'err'; msg: string } | null>(null)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [activeSugIdx, setActiveSugIdx] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Live autocomplete search effect
  useEffect(() => {
    const trimmed = input.trim()
    if (!trimmed || trimmed.toUpperCase().startsWith('STD-') || resolved) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await window.schoolApp.students.searchByName(trimmed)
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setSuggestions(res.data.slice(0, 7))
          setActiveSugIdx(0)
          setShowDropdown(true)
        } else {
          setSuggestions([])
          setShowDropdown(false)
        }
      } catch {
        setSuggestions([])
        setShowDropdown(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [input, resolved])

  const beep = (ok: boolean) => {
    if (!sound) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const o = ctx.createOscillator()
      o.type = ok ? 'sine' : 'sawtooth'
      o.frequency.setValueAtTime(ok ? 880 : 220, ctx.currentTime)
      o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.18)
    } catch {}
  }

  const showFeedback = (type: 'ok' | 'late' | 'err', msg: string) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  const resolve = async (token: string) => {
    if (!token.trim()) return
    setLoading(true)
    setResolved(null)
    setSuggestions([])
    setShowDropdown(false)
    try {
      const res = await window.schoolApp.attendance.resolveStudent(token.trim(), today())
      if (res.success && res.data && !res.data.error) {
        setResolved(res.data)
        setSelectedIdx(0)
      } else {
        showFeedback('err', t('attendance.studentNotFound'))
        beep(false)
      }
    } finally { setLoading(false) }
  }

  const selectSuggestion = (s: any) => {
    const term = s.studentNumber || `${s.lastNameAr} ${s.firstNameAr}`
    setInput(term)
    resolve(s.studentNumber || String(s.id))
  }

  const confirm = async (idx: number) => {
    if (!resolved || !resolved.todaySessions?.length) return
    const session = resolved.todaySessions[idx]
    if (!session) return
    setMarking(true)
    try {
      const res = await window.schoolApp.attendance.markSession(session.id, resolved.student.id, 'present')
      if (res.success) {
        const d = res.data ?? {}
        const status = d.status ?? 'present'
        const name = `${resolved.student.lastNameAr} ${resolved.student.firstNameAr}`

        // Build feedback message with credit info
        let msg = `${name} — ${t(`attendance.${status}`)}`
        if (d.creditBalance !== null && d.creditBalance !== undefined) {
          const balStr = `${Number(d.creditBalance).toLocaleString()} DA`
          if (d.wasInDebt) {
            msg += ` ⚠ رصيد سلبي: ${balStr}`
          } else {
            msg += ` · رصيد: ${balStr}`
          }
        }

        showFeedback(d.wasInDebt ? 'err' : (status === 'late' ? 'late' : 'ok'), msg)
        beep(!d.wasInDebt)
        setResolved(null)
        setInput('')
        setTimeout(() => inputRef.current?.focus(), 100)
      } else {
        showFeedback('err', res.error ?? t('common.error'))
        beep(false)
      }
    } finally { setMarking(false) }
  }

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If autocomplete dropdown is open
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSugIdx(i => Math.min(i + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSugIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectSuggestion(suggestions[activeSugIdx])
        return
      }
      if (e.key === 'Escape') {
        setShowDropdown(false)
        return
      }
    }

    if (e.key === 'Enter') {
      if (resolved) {
        await confirm(selectedIdx)
      } else {
        await resolve(input)
      }
      return
    }

    if (resolved && resolved.todaySessions?.length > 1) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, resolved.todaySessions.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
      const n = parseInt(e.key)
      if (!isNaN(n) && n >= 1 && n <= resolved.todaySessions.length) setSelectedIdx(n - 1)
    }
    if (e.key === 'Escape') { setResolved(null); setInput('') }
  }

  const feedbackCls = feedback?.type === 'ok' ? 'bg-green-50 border-green-300 text-green-800'
    : feedback?.type === 'late' ? 'bg-amber-50 border-amber-300 text-amber-800'
    : 'bg-red-50 border-red-300 text-red-800'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="font-bold text-sm text-[#0F172A]">{t('attendance.readyToScan')}</span>
          </div>
          <button onClick={() => setSound(s => !s)} className="text-slate-400 hover:text-slate-600">
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); if (resolved) setResolved(null) }}
            onKeyDown={onKeyDown}
            placeholder={t('attendance.scanOrType')}
            className="w-full px-4 py-3.5 border-2 border-[#2563EB]/30 rounded-xl text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-slate-50 font-mono"
            dir="auto"
            autoFocus
          />

          {/* Autocomplete Dropdown (Google style, max 7 results) */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 animate-fade-in">
              {suggestions.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => selectSuggestion(s)}
                  onMouseEnter={() => setActiveSugIdx(idx)}
                  className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    activeSugIdx === idx ? 'bg-blue-50 text-[#2563EB]' : 'hover:bg-slate-50 text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-sm" dir="rtl">
                        {s.lastNameAr} {s.firstNameAr}
                      </span>
                      {(s.firstNameFr || s.lastNameFr) && (
                        <span className="text-xs text-slate-400 ml-2 font-sans">
                          ({s.lastNameFr} {s.firstNameFr})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{s.studentNumber}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading && <div className="mt-3 flex justify-center"><div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>}
        {feedback && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold animate-fade-in ${feedbackCls}`}>
            {feedback.type === 'ok' ? <CheckCircle2 size={18} /> : feedback.type === 'late' ? <Clock size={18} /> : <XCircle size={18} />}
            {feedback.msg}
          </div>
        )}
      </div>


      {resolved && (
        <div className="bg-white rounded-2xl border border-border p-5 shadow-lg animate-fade-in space-y-4">
          {/* Student info */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
              {(resolved.student.firstNameAr || resolved.student.firstNameFr || '?').charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#0F172A]" dir="rtl">{resolved.student.lastNameAr} {resolved.student.firstNameAr}</p>
              <p className="text-xs text-slate-400">{resolved.student.studentNumber}</p>
            </div>
            <div className="text-right space-y-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resolved.paymentsSummary?.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {resolved.paymentsSummary?.status === 'paid' ? t('attendance.upToDate') : t('attendance.pending')}
              </span>
            </div>
          </div>

          {/* Recent attendance */}
          {resolved.recentAttendance?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">{t('attendance.recentAttendance')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {resolved.recentAttendance.map((r: any, i: number) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[r.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {r.date} {r.status === 'present' ? '✓' : r.status === 'late' ? '⏱' : '✗'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sessions chooser */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">
              {resolved.todaySessions?.length === 0 ? t('attendance.noSessionsToday')
                : resolved.todaySessions?.length === 1 ? t('attendance.oneSessionToday')
                : t('attendance.multipleSessionsToday')}
            </p>
            {resolved.todaySessions?.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('attendance.noSessionsToday')}</p>
            ) : (
              <div className="space-y-2">
                {resolved.todaySessions.map((s: any, i: number) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedIdx(i); confirm(i) }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${selectedIdx === i ? 'border-[#2563EB] bg-blue-50' : 'border-border hover:border-blue-300'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-[#0F172A]">
                          {lang === 'ar' ? (s.courseNameAr || s.courseNameFr) : (s.courseNameFr || s.courseNameAr)} — {s.groupName}
                        </p>
                        <p className="text-xs text-slate-400">{s.plannedStartTime} – {s.endTime} {s.room ? `· ${s.room}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">#{i + 1}</span>
                        {selectedIdx === i && <span className="text-xs text-[#2563EB] font-bold">↵ Enter</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {resolved.todaySessions?.length > 0 && (
            <p className="text-xs text-slate-400 text-center">{t('attendance.pressEnterToConfirm')} · Esc {t('common.cancel')} · ↑↓ {t('common.filter')}</p>
          )}

          {marking && (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Roster Tab ─────────────────────────────────────────────────────────────────
function RosterView({ lang, initialSession }: { lang: string; initialSession?: { id: number; date: string } | null }) {
  const { t } = useTranslation()
  const [date, setDate] = useState(initialSession?.date || today())
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<number | null>(initialSession?.id || null)
  const [roster, setRoster] = useState<any>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingRoster, setLoadingRoster] = useState(false)

  const loadRoster = useCallback(async (sessionId: number) => {
    setSelectedSession(sessionId)
    setLoadingRoster(true)
    const res = await window.schoolApp.attendance.withRoster(sessionId)
    if (res.success && res.data) setRoster(res.data)
    setLoadingRoster(false)
  }, [])

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    const res = await window.schoolApp.sessions.byDate(date, date)
    if (res.success && res.data) setSessions(res.data)
    else setSessions([])
    setLoadingSessions(false)
  }, [date])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    if (initialSession) {
      setDate(initialSession.date)
      setSelectedSession(initialSession.id)
      loadRoster(initialSession.id)
    }
  }, [initialSession, loadRoster])

  const markStudent = async (studentId: number, status: 'present' | 'absent' | 'late') => {
    if (!selectedSession) return
    await window.schoolApp.attendance.markSession(selectedSession, studentId, status)
    await loadRoster(selectedSession)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Sessions list */}
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-white rounded-xl border border-border p-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('attendance.date')}</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setSelectedSession(null); setRoster(null) }}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20" />
        </div>
        {loadingSessions ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">{t('attendance.noSessionsThisDay')}</p>
        ) : (
          sessions.map(s => (
            <button key={s.id} onClick={() => loadRoster(s.id)}
              className={`w-full text-left bg-white rounded-xl border-2 p-4 transition-all hover:shadow-sm ${selectedSession === s.id ? 'border-[#2563EB] bg-blue-50' : 'border-border'}`}>
              <p className="font-semibold text-sm text-[#0F172A]">
                {lang === 'ar' ? (s.courseNameAr || s.courseNameFr) : (s.courseNameFr || s.courseNameAr)}
              </p>
              <p className="text-xs text-slate-500">{s.groupName} · {s.plannedStartTime}{s.endTime ? `–${s.endTime}` : ''}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{s.presentCount}/{s.enrolledCount}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Roster */}
      <div className="lg:col-span-3">
        {!selectedSession ? (
          <div className="bg-white rounded-xl border border-border p-8 text-center text-slate-400">
            <p className="text-sm">{t('attendance.selectSessionToView')}</p>
          </div>
        ) : loadingRoster ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
        ) : roster ? (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#0F172A]">{roster.session.groupName}</p>
                <p className="text-xs text-slate-400">{roster.session.sessionDate} · {roster.session.plannedStartTime}</p>
              </div>
              <div className="flex gap-3 text-xs font-medium">
                <span className="text-green-600">{roster.session.stats.present} ✓</span>
                <span className="text-amber-600">{roster.session.stats.late} ⏱</span>
                <span className="text-red-500">{roster.session.stats.absent} ✗</span>
                <span className="text-slate-400">{roster.session.stats.total - roster.session.stats.present - roster.session.stats.late - roster.session.stats.absent} —</span>
              </div>
            </div>
            <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
              {roster.students.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                    {(s.firstNameAr || s.firstNameFr || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate" dir="rtl">{s.lastNameAr} {s.firstNameAr}</p>
                    <p className="text-xs text-slate-400">{s.studentNumber}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {(['present', 'late', 'absent'] as const).map(st => (
                      <button key={st} onClick={() => markStudent(s.id, st)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${s.attendanceStatus === st ? STATUS_CLS[st] + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {st === 'present' ? '✓' : st === 'late' ? '⏱' : '✗'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Calendar Tab ───────────────────────────────────────────────────────────────
function CalendarView({ lang, onSessionClick }: { lang: string; onSessionClick: (session: any) => void }) {
  const { t } = useTranslation()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(today())

  const loadMonth = useCallback(async () => {
    const { first, last } = monthRange(year, month)
    const res = await window.schoolApp.sessions.byDate(first, last)
    if (res.success && res.data) setSessions(res.data)
    else setSessions([])
  }, [year, month])

  useEffect(() => { loadMonth() }, [loadMonth])

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const sessionsByDay: Record<string, any[]> = {}
  sessions.forEach(s => { if (!sessionsByDay[s.sessionDate]) sessionsByDay[s.sessionDate] = []; sessionsByDay[s.sessionDate].push(s) })

  const dayLabel = `${year}-${String(month + 1).padStart(2, '0')}`
  const daySessions = selectedDay ? (sessionsByDay[selectedDay] ?? []) : []
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prev} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft size={18} /></button>
          <span className="font-bold text-sm text-[#0F172A]">{monthNames[month]} {year}</span>
          <button onClick={next} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const dateStr = `${dayLabel}-${String(d).padStart(2, '0')}`
            const daySess = sessionsByDay[dateStr] ?? []
            const isToday = dateStr === today()
            const isSelected = dateStr === selectedDay
            return (
              <button key={d} onClick={() => setSelectedDay(dateStr)}
                className={`aspect-square rounded-xl text-xs font-medium transition-all relative flex flex-col items-center justify-center p-1 ${isSelected ? 'bg-[#2563EB] text-white' : isToday ? 'bg-blue-50 text-[#2563EB] ring-2 ring-[#2563EB]' : daySess.length > 0 ? 'hover:bg-slate-50 text-[#0F172A]' : 'text-slate-300'}`}>
                <span>{d}</span>
                {daySess.length > 0 && (
                  <span className={`text-[9px] font-bold leading-none ${isSelected ? 'text-blue-200' : 'text-[#2563EB]'}`}>
                    {daySess.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="font-bold text-sm text-[#0F172A] mb-3">{selectedDay ?? '—'}</p>
          {daySessions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">{t('attendance.noSessionsThisDay')}</p>
          ) : (
            daySessions.map(s => (
              <button key={s.id} onClick={() => onSessionClick(s)}
                className="w-full text-left mb-2 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all">
                <p className="font-semibold text-xs text-[#0F172A]">
                  {lang === 'ar' ? (s.courseNameAr || s.courseNameFr) : (s.courseNameFr || s.courseNameAr)}
                </p>
                <p className="text-[11px] text-slate-400">{s.groupName} · {s.plannedStartTime}</p>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{s.presentCount}/{s.enrolledCount}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                </div>
              </button>
            ))
          )}
        </div>
        <p className="text-xs text-slate-400 text-center">{t('attendance.clickDayToView')}</p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Attendance() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>('scanner')
  const [rosterSession, setRosterSession] = useState<{ id: number; date: string } | null>(null)

  const handleCalendarSessionClick = (session: any) => {
    setRosterSession({ id: session.id, date: session.sessionDate })
    setTab('roster')
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'scanner', label: t('attendance.smartScanner'), icon: <ScanLine size={14} /> },
    { key: 'roster', label: t('attendance.rosterView'), icon: <Search size={14} /> },
    { key: 'calendar', label: t('attendance.calendar'), icon: <Calendar size={14} /> },
  ]

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{t('nav.attendance')}</h2>
          <p className="text-xs text-slate-400">{t('attendance.subtitle')}</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {tabs.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === tb.key ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'scanner' && <SmartScanner lang={i18n.language} />}
      {tab === 'roster' && <RosterView lang={i18n.language} initialSession={rosterSession} />}
      {tab === 'calendar' && <CalendarView lang={i18n.language} onSessionClick={handleCalendarSessionClick} />}
    </div>
  )
}
