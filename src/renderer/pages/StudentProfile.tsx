import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Edit2, QrCode, RefreshCw, Archive,
  Phone, MapPin, Calendar, User, Shield, CreditCard,
  BookOpen, Clock, CheckCircle2, XCircle, StickyNote,
  Plus, AlertCircle, ArrowRightLeft, X, Check, ChevronDown, RotateCcw, AlertTriangle
} from 'lucide-react'
import type { Student, Payment, Group, Course, Teacher } from '@shared/types/index'
import { getCourseName, formatCurrency } from '../utils/format'
import QRCode from 'qrcode'

// Convert Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII (0-9)
function normalizeNumberInput(val: string): string {
  const ascii = val
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵٦٧٨٩'.indexOf(d)])
  return ascii.replace(/[^0-9.]/g, '')
}

function FilterCombobox({
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (val: string) => void
  options: string[]
}) {
  const [open, setOpen] = useState(false)

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(value.toLowerCase().trim())
  )

  return (
    <div className="relative w-full">
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full text-xs bg-white border border-slate-300 rounded-xl ps-3 pe-8 py-2.5 font-medium focus:ring-2 focus:ring-[#2563EB] focus:outline-none shadow-2xs"
        />
        {value ? (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className="absolute right-2 text-slate-400 pointer-events-none"
          />
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
            <div
              onClick={() => { onChange(''); setOpen(false); }}
              className="px-3 py-1.5 cursor-pointer hover:bg-slate-100 font-bold text-slate-400 border-b border-slate-100"
            >
              -- {label} --
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-slate-400 italic">
                لا توجد نتائج
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 hover:text-[#2563EB] font-medium transition-colors ${
                    value === opt ? 'bg-blue-50 text-[#2563EB] font-bold' : 'text-slate-700'
                  }`}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

type Tab = 'overview' | 'attendance' | 'payments' | 'enrollments' | 'notes'

interface EnrollmentWithDetails {
  id: number
  studentId: number
  groupId: number
  agreedPrice: number
  enrollmentDate: string
  status: string
  groupName?: string
  courseName?: string
  teacherName?: string
  balance?: number
  sessionsUsed?: number
}

interface NoteItem {
  id: number
  noteText: string
  adminName?: string
  createdAt: string
}

interface SessionHistoryItem {
  sessionId: number
  sessionDate: string
  plannedStartTime: string | null
  endTime: string | null
  sessionStatus: string
  sessionType: string
  groupId: number
  groupName: string
  courseNameAr: string
  courseNameFr: string
  teacherName: string | null
  attendanceStatus: 'present' | 'absent' | 'late' | 'not_active' | 'unmarked'
  scannedAt: string | null
  source: string | null
}

export default function StudentProfile() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const lang = i18n.language as 'ar' | 'fr' | 'en'

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // Tab data
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [tabLoading, setTabLoading] = useState(false)

  // Available groups/courses/teachers for adding enrollment or transfer
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([])

  // Modal: Add Enrollment with Hierarchical Combobox Filter
  const [showAddEnrollModal, setShowAddEnrollModal] = useState(false)
  const [newEnrollGroupId, setNewEnrollGroupId] = useState('')
  const [modalModule, setModalModule] = useState('')
  const [modalTeacher, setModalTeacher] = useState('')
  const [modalGroup, setModalGroup] = useState('')
  const [savingEnroll, setSavingEnroll] = useState(false)

  // Modal: Transfer Credit (Idea Implementation)
  const [transferModalSource, setTransferModalSource] = useState<EnrollmentWithDetails | null>(null)
  const [transferTargetEnrollId, setTransferTargetEnrollId] = useState('')
  const [transferAmount, setTransferAmount] = useState('1000')
  const [transferCloseSource, setTransferCloseSource] = useState(true)
  const [transferReason, setTransferReason] = useState('')
  const [savingTransfer, setSavingTransfer] = useState(false)

  const load = useCallback(async () => {
    const res = await window.schoolApp.students.getById(Number(id))
    if (res.success && res.data) {
      setStudent(res.data)
      if (res.data.photoPath) {
        try {
          const photoRes = await window.schoolApp.media.getImageUrl(res.data.photoPath)
          if (photoRes.success && photoRes.data?.url) setPhotoUrl(photoRes.data.url)
        } catch { /* ignore */ }
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (student?.qrToken && qrCanvasRef.current) {
      const payload = [
        'EDUPILOT DZ',
        `Matricule: ${student.studentNumber}`,
        `Nom: ${student.lastNameAr} ${student.firstNameAr}`,
        `Nom FR: ${student.lastNameFr} ${student.firstNameFr}`,
        student.phone ? `Tél: ${student.phone}` : null,
        `Statut: ${student.status === 'active' ? 'Actif' : student.status}`,
        `ID: ${student.qrToken}`,
      ].filter(Boolean).join('\n')

      QRCode.toCanvas(qrCanvasRef.current, payload, {
        width: 150,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      }).catch(() => {})
    }
  }, [student])

  // Helper to load enrollments along with their credit balances
  const loadEnrollmentsWithBalances = useCallback(async (studentId: number) => {
    const res = await window.schoolApp.enrollments.byStudent(studentId)
    if (res.success && res.data) {
      const list = res.data as EnrollmentWithDetails[]
      const withBalances = await Promise.all(
        list.map(async (e) => {
          try {
            const balRes = await window.schoolApp.payments.balance(e.id)
            if (balRes.success && balRes.data) {
              return {
                ...e,
                balance: balRes.data.balance,
                sessionsUsed: balRes.data.sessionsUsed,
              }
            }
          } catch { /* ignore */ }
          return { ...e, balance: 0, sessionsUsed: 0 }
        })
      )
      setEnrollments(withBalances)
    }
  }, [])

  // Helper to load session history for student
  const loadSessionHistory = useCallback(async (studentId: number) => {
    try {
      const hist = await window.schoolApp.attendance.getSessionHistory(studentId)
      if (hist && Array.isArray(hist)) setSessionHistory(hist)
    } catch (err) {
      console.error('Failed to load session history:', err)
    }
  }, [])

  // Load tab data when switching
  useEffect(() => {
    if (!student) return
    setTabLoading(true)

    async function loadTabData() {
      try {
        if (activeTab === 'enrollments' || activeTab === 'overview') {
          await loadEnrollmentsWithBalances(student!.id)
          const [grpRes, crsRes, tchRes] = await Promise.all([
            window.schoolApp.groups.list({ status: 'active' }),
            window.schoolApp.courses.list({ status: 'active' }),
            window.schoolApp.teachers.list({ status: 'active' }),
          ])
          if (grpRes.success && grpRes.data) setAvailableGroups(grpRes.data)
          if (crsRes.success && crsRes.data) setAvailableCourses(crsRes.data)
          if (tchRes.success && tchRes.data) setAvailableTeachers(tchRes.data)
        }
        if (activeTab === 'attendance') {
          await loadSessionHistory(student!.id)
        }
        if (activeTab === 'payments') {
          const res = await window.schoolApp.payments.byStudent(student!.id)
          if (res.success && res.data) setPayments(res.data)
        }
        if (activeTab === 'notes') {
          setNotes([])
        }
      } finally {
        setTabLoading(false)
      }
    }

    loadTabData()
  }, [activeTab, student, loadEnrollmentsWithBalances, loadSessionHistory])

  // ─── Cascaded Combobox Options & Auto-fill Logic for Enrollment Modal ────────
  const getCourseNameHelper = useCallback((c: Course) => getCourseName(c, lang), [lang])

  const getTeacherName = useCallback((t: Teacher) => {
    const fullName = `${t.lastName ?? ''} ${t.firstName ?? ''}`.trim()
    return fullName || `Prof #${t.id}`
  }, [])

  // Modules list
  const moduleOptions = useMemo(() => {
    const set = new Set<string>()
    availableCourses.forEach(c => {
      const name = getCourseNameHelper(c)
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [availableCourses, getCourseNameHelper])

  // Teachers list (filtered by modalModule if selected)
  const teacherOptions = useMemo(() => {
    let filtered = availableTeachers
    if (modalModule) {
      const course = availableCourses.find(c => getCourseName(c).toLowerCase() === modalModule.toLowerCase())
      if (course) {
        filtered = filtered.filter(t => t.courseId === course.id)
      }
    }
    const set = new Set<string>()
    filtered.forEach(t => {
      const name = getTeacherName(t)
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [availableTeachers, availableCourses, modalModule, getCourseName, getTeacherName])

  // Groups list & map (filtered by modalModule & modalTeacher if selected)
  const groupOptionsMap = useMemo(() => {
    let filtered = availableGroups
    if (modalModule) {
      const course = availableCourses.find(c => getCourseName(c).toLowerCase() === modalModule.toLowerCase())
      if (course) {
        filtered = filtered.filter(g => g.courseId === course.id)
      }
    }
    if (modalTeacher) {
      const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === modalTeacher.toLowerCase())
      if (teacher) {
        filtered = filtered.filter(g => g.teacherId === teacher.id)
      }
    }
    const map = new Map<string, Group>()
    filtered.forEach(g => {
      const c = availableCourses.find(crs => crs.id === g.courseId)
      const cName = c ? getCourseName(c) : ''
      const label = `${cName ? `${cName} — ` : ''}${g.name}`
      map.set(label, g)
    })
    return map
  }, [availableGroups, availableCourses, availableTeachers, modalModule, modalTeacher, getCourseName, getTeacherName])

  const groupOptions = useMemo(() => {
    return Array.from(groupOptionsMap.keys()).sort()
  }, [groupOptionsMap])

  // Cascading Change Handlers
  const handleModalModuleChange = (newMod: string) => {
    setModalModule(newMod)
    if (!newMod) {
      setModalTeacher('')
      setModalGroup('')
      setNewEnrollGroupId('')
      return
    }
    if (modalTeacher) {
      const course = availableCourses.find(c => getCourseName(c).toLowerCase() === newMod.toLowerCase())
      const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === modalTeacher.toLowerCase())
      if (course && teacher && teacher.courseId !== course.id) {
        setModalTeacher('')
        setModalGroup('')
        setNewEnrollGroupId('')
      }
    }
  }

  const handleModalTeacherChange = (newTeacher: string) => {
    setModalTeacher(newTeacher)
    if (!newTeacher) {
      setModalGroup('')
      setNewEnrollGroupId('')
      return
    }
    // Auto-fill module if skipped directly to teacher!
    const teacher = availableTeachers.find(t => getTeacherName(t).toLowerCase() === newTeacher.toLowerCase())
    if (teacher && teacher.courseId) {
      const course = availableCourses.find(c => c.id === teacher.courseId)
      if (course) {
        setModalModule(getCourseName(course))
      }
    }
    if (modalGroup) {
      const selectedGrp = groupOptionsMap.get(modalGroup)
      if (selectedGrp && teacher && selectedGrp.teacherId !== teacher.id) {
        setModalGroup('')
        setNewEnrollGroupId('')
      }
    }
  }

  const handleModalGroupChange = (newGroupLabel: string) => {
    setModalGroup(newGroupLabel)
    if (!newGroupLabel) {
      setNewEnrollGroupId('')
      return
    }
    let targetGrp = groupOptionsMap.get(newGroupLabel)
    if (!targetGrp) {
      for (const g of availableGroups) {
        const c = availableCourses.find(crs => crs.id === g.courseId)
        const cName = c ? getCourseName(c) : ''
        const label = `${cName ? `${cName} — ` : ''}${g.name}`
        if (label.toLowerCase() === newGroupLabel.toLowerCase()) {
          targetGrp = g
          break
        }
      }
    }

    if (targetGrp) {
      setNewEnrollGroupId(String(targetGrp.id))
      // Auto-fill teacher & module if skipped directly to group!
      if (targetGrp.teacherId) {
        const teacher = availableTeachers.find(t => t.id === targetGrp.teacherId)
        if (teacher) {
          setModalTeacher(getTeacherName(teacher))
          if (teacher.courseId) {
            const course = availableCourses.find(c => c.id === teacher.courseId)
            if (course) setModalModule(getCourseName(course))
          }
        }
      } else if (targetGrp.courseId) {
        const course = availableCourses.find(c => c.id === targetGrp.courseId)
        if (course) setModalModule(getCourseName(course))
      }
    }
  }

  const handleOpenAddEnrollModal = () => {
    setModalModule('')
    setModalTeacher('')
    setModalGroup('')
    setNewEnrollGroupId('')
    setShowAddEnrollModal(true)
  }

  const handleRegenQR = async () => {
    if (!student) return
    if (!window.confirm(t('students.regenQRConfirm'))) return
    const res = await window.schoolApp.students.regenQR(student.id)
    if (res.success) await load()
  }

  const handleArchive = async () => {
    if (!student) return
    if (!window.confirm(t('students.archiveConfirm'))) return
    await window.schoolApp.students.archive(student.id)
    navigate('/students')
  }

  const handleRestore = async () => {
    if (!student) return
    if (!window.confirm(t('students.restoreConfirm') || 'Restaurer cet étudiant ?')) return
    await window.schoolApp.students.update(student.id, { status: 'active' } as any)
    await window.schoolApp.students.regenQR(student.id)
    await load()
  }

  const handleChangePhoto = async () => {
    if (!student) return
    const res = await window.schoolApp.media.selectImage('student', String(student.id))
    if (res.success && res.data?.path) {
      await window.schoolApp.students.update(student.id, { photoPath: res.data.path } as any)
      const photoRes = await window.schoolApp.media.getImageUrl(res.data.path)
      if (photoRes.success && photoRes.data?.url) setPhotoUrl(photoRes.data.url)
    }
  }

  // Toggle enrollment status specifically per module (Active <-> Inactive)
  const handleToggleEnrollmentStatus = async (enrollId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const confirmMsg = nextStatus === 'inactive'
      ? t('students.suspendConfirm')
      : t('students.reactivateConfirm')
    if (!window.confirm(confirmMsg)) return

    await window.schoolApp.enrollments.update(enrollId, { status: nextStatus })
    if (student) await loadEnrollmentsWithBalances(student.id)
  }

  // Mark student in a specific session (Present, Late, Absent, Not Active)
  const handleMarkStudentInSession = async (sessionId: number, newStatus: 'present' | 'absent' | 'late' | 'not_active') => {
    if (!student) return
    try {
      const res = await window.schoolApp.attendance.markSession(sessionId, student.id, newStatus)
      if (res.success) {
        await loadSessionHistory(student.id)
        await loadEnrollmentsWithBalances(student.id)
      }
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    }
  }

  // Add new enrollment from profile (uses group monthlyPrice by default)
  const handleAddEnrollment = async () => {
    if (!student || !newEnrollGroupId) return
    setSavingEnroll(true)
    try {
      const selectedGrp = availableGroups.find((g) => g.id === Number(newEnrollGroupId))
      if (!selectedGrp) {
        alert(t('students.selectGroupFirst'))
        return
      }

      const res = await window.schoolApp.enrollments.create({
        studentId: student.id,
        groupId: Number(newEnrollGroupId),
        agreedPrice: selectedGrp.monthlyPrice || 0,
        enrollmentDate: new Date().toISOString().slice(0, 10),
      })

      if (res.success) {
        setShowAddEnrollModal(false)
        setNewEnrollGroupId('')
        setModalModule('')
        setModalTeacher('')
        setModalGroup('')
        await loadEnrollmentsWithBalances(student.id)
      } else {
        alert(res.error)
      }
    } finally {
      setSavingEnroll(false)
    }
  }

  // Execute Credit Transfer between courses
  const handleExecuteCreditTransfer = async () => {
    if (!student || !transferModalSource || !transferTargetEnrollId || !transferAmount) return
    setSavingTransfer(true)
    try {
      const targetEnroll = enrollments.find((e) => e.id === Number(transferTargetEnrollId))
      const amount = Number(transferAmount)
      const currentMonth = new Date().toISOString().slice(0, 7)

      // 1. Record credit payment onto destination enrollment
      const sourceName = transferModalSource.courseName ?? `Groupe #${transferModalSource.groupId}`
      const targetName = targetEnroll?.courseName ?? `Groupe #${targetEnroll?.groupId}`
      const transferMemo = `Transfert de solde (${amount} DA) depuis [${sourceName}] vers [${targetName}]. ${transferReason}`

      await window.schoolApp.payments.create({
        studentId: student.id,
        enrollmentId: Number(transferTargetEnrollId),
        billingPeriod: currentMonth,
        amount: amount,
        paymentMethod: 'transfer',
        paymentDate: new Date().toISOString().slice(0, 10),
        reference: `TRANSFER-${Date.now().toString().slice(-4)}`,
        notes: transferMemo,
      })

      // 2. Optionally close/complete the source enrollment
      if (transferCloseSource) {
        await window.schoolApp.enrollments.update(transferModalSource.id, { status: 'completed' })
      }

      setTransferModalSource(null)
      setTransferTargetEnrollId('')
      setTransferReason('')

      // Reload tabs
      await loadEnrollmentsWithBalances(student.id)
      const payListRes = await window.schoolApp.payments.byStudent(student.id)
      if (payListRes.success && payListRes.data) setPayments(payListRes.data)

      alert(t('students.transferSuccess'))
    } catch (err: any) {
      alert(err?.message ?? t('common.error'))
    } finally {
      setSavingTransfer(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#2563EB] border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!student) {
    return <div className="text-center py-20 text-slate-400">{t('errors.STUDENT_NOT_FOUND')}</div>
  }

  const initials = student.firstNameAr.charAt(0) + student.lastNameAr.charAt(0)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('students.overview') },
    { key: 'attendance', label: t('students.courseHistory') },
    { key: 'payments', label: t('nav.payments') },
    { key: 'enrollments', label: t('students.enrollments') },
    { key: 'notes', label: t('common.notes') },
  ]

  // Net student debt across active enrollments
  const totalNetBalance = enrollments.reduce((acc, e) => acc + (e.balance ?? 0), 0)
  const isStudentInDebt = totalNetBalance < 0

  return (
    <div className="animate-fade-in space-y-5">
      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors font-medium"
        >
          <ArrowLeft size={15} /> {t('common.back')}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/students/${student.id}/card`)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <QrCode size={13} /> {t('students.card')}
          </button>
          <button
            onClick={() => navigate(`/students/${student.id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8] transition-colors shadow-xs"
          >
            <Edit2 size={13} /> {t('common.edit')}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── LEFT: Profile card ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col items-center">
              {/* Photo */}
              <div className="relative group cursor-pointer mb-3" onClick={handleChangePhoto} title={t('students.changePhoto')}>
                <div className="w-20 h-20 rounded-full overflow-hidden bg-[#EFF6FF] border-2 border-[#2563EB]/20 flex items-center justify-center text-[#2563EB] font-bold text-xl shadow-xs">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Edit2 size={14} className="text-white" />
                  </div>
                </div>
              </div>

              {/* Name & badges */}
              <div className="text-center mb-4">
                <h2 className="font-bold text-[#0F172A] text-base" dir="rtl">
                  {student.lastNameAr} {student.firstNameAr}
                </h2>
                <p className="text-slate-400 text-sm">{student.lastNameFr} {student.firstNameFr}</p>
                <p className="text-[10px] font-mono text-slate-400 mt-1">{student.studentNumber}</p>

                {/* Overall Debt/Payment Status Badge */}
                <div className="flex gap-2 justify-center mt-2.5 flex-wrap">
                  {isStudentInDebt ? (
                    <span className="text-xs px-3 py-1 rounded-full font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                      <AlertCircle size={12} />
                      {t('students.inDebtWithAmount', { amount: Math.abs(totalNetBalance).toLocaleString() })}
                    </span>
                  ) : (
                    <span className="text-xs px-3 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      {t('students.paidZeroDebt')}
                    </span>
                  )}
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-sm w-full pt-3 border-t border-slate-100">
                {student.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span dir="ltr">{student.phone}</span>
                  </div>
                )}
                {student.address && (
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-xs">{student.address}</span>
                  </div>
                )}
                {student.registrationDate && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs">{t('students.registrationDate')}: {student.registrationDate}</span>
                  </div>
                )}
                {student.dateOfBirth && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs">{t('students.dateOfBirth')}: {student.dateOfBirth}</span>
                  </div>
                )}
              </div>

              {/* QR status */}
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-center w-full">
                <div className="flex items-center justify-center gap-1 text-xs">
                  {student.qrTokenActive ? (
                    <><CheckCircle2 size={12} className="text-green-500" /><span className="text-green-600 font-medium">QR Active</span></>
                  ) : (
                    <><XCircle size={12} className="text-red-500" /><span className="text-red-600 font-medium">QR Disabled</span></>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="mt-3 text-center">
                <canvas ref={qrCanvasRef} className="mx-auto rounded-lg border border-slate-100 shadow-xs" />
                <button
                  onClick={handleRegenQR}
                  className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#2563EB] transition-colors mx-auto font-medium"
                >
                  <RefreshCw size={11} /> {t('students.regenQR')}
                </button>
              </div>
            </div>
          </div>

          {/* Guardian panel */}
          {(student.guardianName || student.guardianPhone) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Shield size={12} /> {t('students.guardianLabel')}
              </h3>
              {student.guardianName && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">{t('students.guardianName')}</p>
                  <p className="text-sm font-medium text-[#0F172A]">{student.guardianName}</p>
                </div>
              )}
              {student.guardianRelationship && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">{t('students.guardianRelationship')}</p>
                  <p className="text-sm text-[#0F172A]">{student.guardianRelationship}</p>
                </div>
              )}
              {student.guardianPhone && (
                <div className="flex items-center gap-2 text-sm text-[#0F172A]" dir="ltr">
                  <Phone size={12} className="text-slate-400" />
                  {student.guardianPhone}
                </div>
              )}
            </div>
          )}

          {/* Archive / Restore Box */}
          {student.status === 'archived' ? (
            <div className="bg-white rounded-xl border border-emerald-200 p-4 bg-emerald-50/40 shadow-xs">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                <CheckCircle2 size={13} /> {t('students.restoreStudent')}
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                {t('students.archivedNotice')}
              </p>
              <button
                onClick={handleRestore}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <RefreshCw size={13} /> {t('students.restoreAndActivate')}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-red-100 p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertCircle size={12} /> {t('students.archiveDangerZone')}
              </h3>
              <button
                onClick={handleArchive}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
              >
                <Archive size={13} /> {t('students.archive')}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT (2 cols): Tabbed content ── */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-[#2563EB] border-[#2563EB] bg-white'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 flex-1">
            {tabLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* ─── Overview Tab ─── */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                          <BookOpen size={14} className="text-[#2563EB]" />
                          <span>{t('courses.groups')}</span>
                        </div>
                        <p className="text-xl font-bold text-[#0F172A]">{t('students.activeGroupsCount', { count: enrollments.filter(e => e.status === 'active').length })}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                          <CreditCard size={14} className="text-emerald-500" />
                          <span>{t('students.monthlyTotal')}</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-600">
                          {enrollments.filter(e => e.status === 'active').reduce((acc, e) => acc + (e.agreedPrice || 0), 0).toLocaleString()} DA
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A] mb-3">{t('students.enrollmentsAndBalances')}</h4>
                      {enrollments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-3">{t('students.noEnrollmentsYet')}</p>
                      ) : (
                        <div className="space-y-2.5">
                          {enrollments.map((enr) => {
                            const isEnrActive = enr.status === 'active'
                            const bal = enr.balance ?? 0
                            const sessionPrice = (enr.agreedPrice || 2000) / 4
                            const remSessions = Math.round((bal / sessionPrice) * 10) / 10

                            return (
                              <div key={enr.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center text-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-[#0F172A] text-sm">{enr.courseName ?? ''} — {enr.groupName ?? `Groupe #${enr.groupId}`}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      isEnrActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {isEnrActive ? t('teachers.active') : t('teachers.inactive')}
                                    </span>
                                  </div>
                                  <p className="text-slate-400 mt-0.5">{enr.enrollmentDate} · {enr.agreedPrice.toLocaleString()} DA / {t('students.perMonth')}</p>
                                </div>
                                <div className="text-end">
                                  {bal < 0 ? (
                                    <span className="font-bold text-red-600 text-sm block">
                                      {t('students.inDebtWithAmount', { amount: Math.abs(bal).toLocaleString() })}
                                    </span>
                                  ) : (
                                    <span className="font-bold text-emerald-600 text-sm block">
                                      +{formatCurrency(bal, lang)}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {remSessions} séances
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Attendance & Session Audit Log Tab ─── */}
                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-sm text-[#0F172A]">{t('students.sessionHistory')}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t('students.sessionHistorySubtitle')}
                        </p>
                      </div>
                      <button
                        onClick={() => student && loadSessionHistory(student.id)}
                        className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 rounded-lg transition-colors"
                        title={t('common.refresh')}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>

                    {sessionHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Clock size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">{t('students.noSessionsRecorded')}</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                                <th className="text-start px-3 py-2.5">{t('attendance.dateTime')}</th>
                                <th className="text-start px-3 py-2.5">{t('students.courseAndGroup')}</th>
                                <th className="text-start px-3 py-2.5">{t('students.teacher')}</th>
                                <th className="text-start px-3 py-2.5">{t('students.statusInSession')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sessionHistory.map((s) => {
                                const status = s.attendanceStatus

                                return (
                                  <tr key={s.sessionId} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-3 py-2.5 font-medium">
                                      <p className="font-bold text-[#0F172A]">{s.sessionDate}</p>
                                      {s.plannedStartTime && <p className="text-[11px] text-slate-400 font-mono">{s.plannedStartTime}</p>}
                                    </td>
                                    <td className="px-3 py-2.5 font-medium">
                                      <p className="font-bold text-[#0F172A]">{s.courseNameAr || s.courseNameFr}</p>
                                      <p className="text-[11px] text-slate-500">{s.groupName}</p>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600 font-medium">{s.teacherName ?? '—'}</td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <button
                                          onClick={() => handleMarkStudentInSession(s.sessionId, 'present')}
                                          className={`px-2 py-1 rounded-md font-bold transition-all text-[11px] ${
                                            status === 'present'
                                              ? 'bg-emerald-600 text-white shadow-xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                          }`}
                                        >
                                          {t('attendance.present')}
                                        </button>

                                        <button
                                          onClick={() => handleMarkStudentInSession(s.sessionId, 'late')}
                                          className={`px-2 py-1 rounded-md font-bold transition-all text-[11px] ${
                                            status === 'late'
                                              ? 'bg-amber-500 text-white shadow-xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                                          }`}
                                        >
                                          {t('attendance.late')}
                                        </button>

                                        <button
                                          onClick={() => handleMarkStudentInSession(s.sessionId, 'absent')}
                                          className={`px-2 py-1 rounded-md font-bold transition-all text-[11px] ${
                                            status === 'absent'
                                              ? 'bg-red-600 text-white shadow-xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'
                                          }`}
                                        >
                                          {t('attendance.absent')}
                                        </button>

                                        <button
                                          onClick={() => handleMarkStudentInSession(s.sessionId, 'not_active')}
                                          className={`px-2 py-1 rounded-md font-bold transition-all text-[11px] ${
                                            status === 'not_active'
                                              ? 'bg-slate-700 text-white shadow-xs'
                                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                          }`}
                                          title={t('students.notActiveSessionTooltip')}
                                        >
                                          {t('teachers.inactive')}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Payments Tab ─── */}
                {activeTab === 'payments' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-sm text-[#0F172A]">{t('nav.payments')}</h4>
                      <button
                        onClick={() => navigate(`/payments?studentId=${student.id}`)}
                        className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1"
                      >
                        + {t('payments.add')}
                      </button>
                    </div>

                    {payments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">{t('payments.noPayments')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {payments.map((p) => (
                          <div key={p.id} className="p-3.5 bg-slate-50 rounded-xl flex justify-between items-center text-xs border border-slate-200/60">
                            <div>
                              <p className="font-mono font-bold text-[#0F172A]">{p.receiptNumber}</p>
                              <p className="text-slate-400 mt-0.5">{p.billingPeriod} · {p.paymentDate}</p>
                              {p.notes && <p className="text-[11px] text-slate-500 mt-0.5 italic">{p.notes}</p>}
                            </div>
                            <div className="text-end">
                              <p className="font-bold text-[#2563EB] text-sm">{p.amount.toLocaleString()} DA</p>
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mt-1 ${
                                p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                              }`}>
                                {p.status === 'paid' ? t('payments.paid') : t('payments.cancelled')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Enrollments Tab (With Per-Module Status & Credit Balances) ─── */}
                {activeTab === 'enrollments' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-sm text-[#0F172A]">{t('students.enrollments')}</h4>
                      <button
                        onClick={handleOpenAddEnrollModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#1D4ED8] transition-colors shadow-xs"
                      >
                        <Plus size={13} /> {t('students.addEnrollmentToGroup')}
                      </button>
                    </div>

                    {enrollments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">{t('students.noEnrollmentsYet')}</p>
                        <button
                          onClick={handleOpenAddEnrollModal}
                          className="mt-3 text-xs text-[#2563EB] hover:underline font-semibold"
                        >
                          + {t('students.enrollInFirstGroup')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {enrollments.map((enroll) => {
                          const isActive = enroll.status === 'active'
                          const isInactive = enroll.status === 'inactive'
                          const bal = enroll.balance ?? 0
                          const sessionPrice = (enroll.agreedPrice || 2000) / 4
                          const remSessions = Math.round((bal / sessionPrice) * 10) / 10
                          const otherActiveEnrollments = enrollments.filter(e => e.id !== enroll.id && e.status === 'active')

                          return (
                            <div
                              key={enroll.id}
                              className={`p-4 rounded-xl border transition-all ${
                                isActive
                                  ? 'border-[#2563EB]/30 bg-[#EFF6FF]/40'
                                  : isInactive
                                  ? 'border-amber-200 bg-amber-50/40'
                                  : 'border-slate-200 bg-slate-50/60 opacity-80'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-sm text-[#0F172A]">
                                      {enroll.courseName ?? ''} — {enroll.groupName ?? `Groupe #${enroll.groupId}`}
                                    </h5>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      isActive
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isInactive
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {isActive
                                        ? t('students.activeInModule')
                                        : isInactive
                                        ? t('students.inactiveSuspended')
                                        : t('students.inactive')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {t('courses.monthlyPrice')}: <span className="font-bold text-[#0F172A]">{enroll.agreedPrice.toLocaleString()} DA</span> / {t('students.perMonth')}
                                  </p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {t('students.registrationDate')}: {enroll.enrollmentDate}
                                  </p>
                                </div>

                                {/* Enrollment Group Credit Balance Badge */}
                                <div className="text-end">
                                  {bal < 0 ? (
                                    <div className="bg-red-100 border border-red-200 text-red-700 px-3 py-1 rounded-xl text-end">
                                      <span className="font-extrabold text-xs block">{t('students.inDebtWithAmount', { amount: Math.abs(bal).toLocaleString() })}</span>
                                      <span className="text-[10px] font-medium text-red-600">{Math.abs(remSessions)} séances</span>
                                    </div>
                                  ) : (
                                    <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-xl text-end">
                                      <span className="font-extrabold text-xs block">+{formatCurrency(bal, lang)}</span>
                                      <span className="text-[10px] font-medium text-emerald-700">{remSessions} séances</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons on enrollment */}
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60 flex-wrap justify-end">
                                {/* Transfer Credit action button */}
                                {isActive && otherActiveEnrollments.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setTransferModalSource(enroll)
                                      setTransferTargetEnrollId(String(otherActiveEnrollments[0].id))
                                      setTransferAmount('1000')
                                      setTransferCloseSource(true)
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white rounded text-xs font-semibold hover:bg-amber-600 transition-colors shadow-xs"
                                    title={t('students.transferCreditTooltip')}
                                  >
                                    <ArrowRightLeft size={12} /> {t('students.transferBalanceToAnother')}
                                  </button>
                                )}

                                {/* Module Active / Inactive Status Toggle */}
                                <button
                                  onClick={() => handleToggleEnrollmentStatus(enroll.id, enroll.status)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                                    isActive
                                      ? 'border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                      : 'border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  }`}
                                >
                                  {isActive ? (
                                    <><AlertTriangle size={12} /> {t('students.markInactive')}</>
                                  ) : (
                                    <><Check size={12} /> {t('students.reactivateEnrollment')}</>
                                  )}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Notes Tab ─── */}
                {activeTab === 'notes' && (
                  <div>
                    <div className="mb-4">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder={t('students.addNote')}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 resize-none bg-white"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={async () => {
                            if (!newNote.trim()) return
                            setSavingNote(true)
                            setNotes((prev) => [{
                              id: Date.now(),
                              noteText: newNote,
                              adminName: t('common.administrator'),
                              createdAt: new Date().toISOString(),
                            }, ...prev])
                            setNewNote('')
                            setSavingNote(false)
                          }}
                          disabled={!newNote.trim() || savingNote}
                          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 shadow-xs"
                        >
                          <Plus size={14} />
                          {savingNote ? t('common.saving') : t('common.save')}
                        </button>
                      </div>
                    </div>

                    {notes.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <StickyNote size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{t('students.noNotes')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <div key={note.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-[#0F172A] whitespace-pre-wrap">{note.noteText}</p>
                            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                              <span>{note.adminName ?? 'Admin'}</span>
                              <span>{new Date(note.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Add New Enrollment ── */}
      {showAddEnrollModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddEnrollModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base">{t('students.enrollInNewGroup')}</h3>
              <button onClick={() => setShowAddEnrollModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              {/* 1. Module Filter (Choose + Search) */}
              <FilterCombobox
                label={t('students.moduleFilter')}
                placeholder={t('students.filterModulePlaceholder')}
                value={modalModule}
                onChange={handleModalModuleChange}
                options={moduleOptions}
              />

              {/* 2. Teacher Filter (Choose + Search) */}
              <FilterCombobox
                label={t('students.teacherFilter')}
                placeholder={t('students.filterTeacherPlaceholder')}
                value={modalTeacher}
                onChange={handleModalTeacherChange}
                options={teacherOptions}
              />

              {/* 3. Group Filter (Choose + Search) */}
              <FilterCombobox
                label={t('students.groupFilter')}
                placeholder={t('students.filterGroupPlaceholder')}
                value={modalGroup}
                onChange={handleModalGroupChange}
                options={groupOptions}
              />

              {/* Selected Group details summary box if group is chosen */}
              {newEnrollGroupId && (() => {
                const grp = availableGroups.find(g => g.id === Number(newEnrollGroupId))
                if (!grp) return null
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between font-medium animate-fade-in mt-2">
                    <div>
                      <span className="font-bold">{grp.name}</span>
                      <p className="text-[11px] text-blue-700 mt-0.5">{t('courses.monthlyPrice')}:</p>
                    </div>
                    <span className="text-sm font-bold text-[#2563EB] font-mono bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                      {grp.monthlyPrice.toLocaleString()} DA
                    </span>
                  </div>
                )
              })()}
            </div>

            {/* Reset Filters button if any filter is active */}
            {(modalModule || modalTeacher || modalGroup) && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => {
                    setModalModule('')
                    setModalTeacher('')
                    setModalGroup('')
                    setNewEnrollGroupId('')
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600 font-bold hover:underline"
                >
                  <RotateCcw size={12} />
                  <span>{t('students.resetOptions')}</span>
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddEnrollModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddEnrollment}
                disabled={savingEnroll || !newEnrollGroupId}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                {savingEnroll ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Transfer Credit between Courses (User's Idea) ── */}
      {transferModalSource && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setTransferModalSource(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#0F172A] flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-amber-500" />
                {t('students.transferCreditModalTitle')}
              </h3>
              <button onClick={() => setTransferModalSource(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              {/* Source info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-400">{t('students.sourceCourse')}:</p>
                <p className="font-bold text-[#0F172A] text-sm mt-0.5">
                  {transferModalSource.courseName ?? `Groupe #${transferModalSource.groupId}`}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {t('courses.monthlyPrice')}: {transferModalSource.agreedPrice.toLocaleString()} DA
                </p>
              </div>

              {/* Destination Enrollment */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {t('students.targetCourseGroup')} *
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  value={transferTargetEnrollId}
                  onChange={(e) => setTransferTargetEnrollId(e.target.value)}
                >
                  <option value="">— {t('students.selectTargetGroup')} —</option>
                  {enrollments
                    .filter(e => e.id !== transferModalSource.id && e.status === 'active')
                    .map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.courseName ?? ''} — {target.groupName ?? `Groupe #${target.groupId}`} ({target.agreedPrice.toLocaleString()} DA)
                      </option>
                    ))}
                </select>
              </div>

              {/* Amount to transfer */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {t('students.amountToTransfer')} *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-extrabold text-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(normalizeNumberInput(e.target.value))}
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                {/* Quick preset buttons */}
                <div className="flex gap-1.5 mt-2 flex-wrap text-[11px]">
                  {[500, 1000, 1500, 2000, 2500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTransferAmount(String(amt))}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded font-medium text-slate-600 transition-colors"
                    >
                      {amt} DA
                    </button>
                  ))}
                  {transferModalSource && (
                    <button
                      type="button"
                      onClick={() => setTransferAmount(String(transferModalSource.agreedPrice || 0))}
                      className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded font-bold transition-colors"
                    >
                      {t('students.fullAmount')} ({transferModalSource.agreedPrice} DA)
                    </button>
                  )}
                </div>
              </div>

              {/* Checkbox: Close source group */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={transferCloseSource}
                  onChange={(e) => setTransferCloseSource(e.target.checked)}
                  className="rounded text-[#2563EB] focus:ring-0"
                />
                <span className="text-slate-700">
                  {t('students.closeSourceGroupCheckbox')}
                </span>
              </label>

              {/* Notes */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {t('students.transferReasonLabel')}
                </label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder={t('students.transferReasonPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setTransferModalSource(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-600"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleExecuteCreditTransfer}
                disabled={savingTransfer || !transferTargetEnrollId || !transferAmount}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5 shadow-xs"
              >
                <ArrowRightLeft size={13} />
                {savingTransfer ? t('common.saving') : t('students.confirmTransfer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
