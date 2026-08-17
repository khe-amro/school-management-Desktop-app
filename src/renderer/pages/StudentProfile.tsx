import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Edit2, QrCode, RefreshCw, Archive,
  Phone, MapPin, Calendar, User, Shield, CreditCard,
  BookOpen, Clock, CheckCircle2, XCircle, StickyNote,
  Plus, Trash2, AlertCircle
} from 'lucide-react'
import type { Student, Payment, AttendanceRecord } from '@shared/types/index'
import QRCode from 'qrcode'

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
}

interface NoteItem {
  id: number
  noteText: string
  adminName?: string
  createdAt: string
}

export default function StudentProfile() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // Tab data
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [tabLoading, setTabLoading] = useState(false)

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

  // Load tab data when switching
  useEffect(() => {
    if (!student) return
    setTabLoading(true)

    async function loadTabData() {
      try {
        if (activeTab === 'enrollments' || activeTab === 'overview') {
          const res = await window.schoolApp.enrollments.byStudent(student!.id)
          if (res.success && res.data) {
            setEnrollments(res.data as EnrollmentWithDetails[])
          }
        }
        if (activeTab === 'payments') {
          const res = await window.schoolApp.payments.byStudent(student!.id)
          if (res.success && res.data) setPayments(res.data)
        }
        // Notes loaded via utility - we'll use a generic approach
        if (activeTab === 'notes') {
          // Notes aren't exposed via preload yet - show empty for now
          setNotes([])
        }
      } finally {
        setTabLoading(false)
      }
    }

    loadTabData()
  }, [activeTab, student])

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

  const handleChangePhoto = async () => {
    if (!student) return
    const res = await window.schoolApp.media.selectImage('student', String(student.id))
    if (res.success && res.data?.path) {
      // Update student record with new photo path
      await window.schoolApp.students.update(student.id, { photoPath: res.data.path } as any)
      // Reload
      const photoRes = await window.schoolApp.media.getImageUrl(res.data.path)
      if (photoRes.success && photoRes.data?.url) setPhotoUrl(photoRes.data.url)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!student) {
    return <div className="text-center py-20 text-slate-400">{t('errors.STUDENT_NOT_FOUND')}</div>
  }

  const initials = student.firstNameAr.charAt(0) + student.lastNameAr.charAt(0)
  const activeEnrollment = enrollments.find((e) => e.status === 'active')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble' },
    { key: 'attendance', label: 'Présence' },
    { key: 'payments', label: 'Paiements' },
    { key: 'enrollments', label: 'Inscriptions' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Top toolbar */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft size={15} /> {t('common.back')}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/students/${student.id}/card`)}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            <QrCode size={14} /> {t('students.card') ?? 'Ticket'}
          </button>
          <button
            onClick={() => navigate(`/students/${student.id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
          >
            <Edit2 size={14} /> {t('common.edit')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* ── LEFT: Identity Card ── */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {/* Color header */}
            <div className="h-16 bg-linear-to-r from-[#1E3A5F] to-[#2563EB]" />

            <div className="px-5 pb-5">
              {/* Avatar */}
              <div className="flex justify-center -mt-8 mb-3 relative">
                <div
                  className="relative group cursor-pointer"
                  onClick={handleChangePhoto}
                  title="Changer la photo"
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`${student.firstNameAr} ${student.lastNameAr}`}
                      className="w-16 h-16 rounded-full object-cover border-3 border-white shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#2563EB] border-3 border-white shadow-md flex items-center justify-center text-white font-bold text-xl">
                      {initials}
                    </div>
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

                <div className="flex gap-2 justify-center mt-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    student.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : student.status === 'inactive'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {student.status === 'active' ? 'Actif' : student.status === 'inactive' ? 'Inactif' : 'Archivé'}
                  </span>
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-sm">
                {student.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span>{student.phone}</span>
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
                    <span className="text-xs">Inscrit le: {student.registrationDate}</span>
                  </div>
                )}
                {student.dateOfBirth && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs">Né le: {student.dateOfBirth}</span>
                  </div>
                )}
              </div>

              {/* QR status */}
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-center">
                <div className="flex items-center justify-center gap-1 text-xs">
                  {student.qrTokenActive ? (
                    <><CheckCircle2 size={12} className="text-green-500" /><span className="text-green-600">Carte QR active</span></>
                  ) : (
                    <><XCircle size={12} className="text-red-500" /><span className="text-red-600">Carte QR désactivée</span></>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="mt-3 text-center">
                <canvas ref={qrCanvasRef} className="mx-auto rounded-lg" />
                <button
                  onClick={handleRegenQR}
                  className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#2563EB] transition-colors mx-auto"
                >
                  <RefreshCw size={11} /> {t('students.regenQR')}
                </button>
              </div>
            </div>
          </div>

          {/* Guardian panel */}
          {(student.guardianName || student.guardianPhone) && (
            <div className="bg-white rounded-xl border border-border p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Shield size={12} /> Tuteur / Parent
              </h3>
              {student.guardianName && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">Nom du tuteur</p>
                  <p className="text-sm font-medium text-[#0F172A]">{student.guardianName}</p>
                </div>
              )}
              {student.guardianRelationship && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">Relation</p>
                  <p className="text-sm text-[#0F172A]">{student.guardianRelationship}</p>
                </div>
              )}
              {student.guardianPhone && (
                <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                  <Phone size={12} className="text-slate-400" />
                  {student.guardianPhone}
                </div>
              )}
            </div>
          )}

          {/* Danger zone */}
          {student.status !== 'archived' && (
            <div className="bg-white rounded-xl border border-red-100 p-4">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertCircle size={12} /> Zone de danger
              </h3>
              <button
                onClick={handleArchive}
                className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 transition-colors"
              >
                <Archive size={12} /> Archiver l'étudiant
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Tabbed content ── */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-[#2563EB] border-[#2563EB] bg-[#EFF6FF]'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tabLoading && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!tabLoading && (
              <>
                {/* ─── Overview Tab ─── */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {activeEnrollment ? (
                      <div className="bg-[#EFF6FF] rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-[#2563EB] mb-3 flex items-center gap-2">
                          <BookOpen size={15} /> Inscription active
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-slate-400">Groupe</p>
                            <p className="font-medium text-[#0F172A]">#{activeEnrollment.groupId}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Tarif mensuel</p>
                            <p className="font-medium text-[#2563EB]">{activeEnrollment.agreedPrice.toLocaleString()} DZD</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Date d'inscription</p>
                            <p className="font-medium text-[#0F172A]">{activeEnrollment.enrollmentDate}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Statut</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                              Actif
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl">
                        <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Aucune inscription active</p>
                        <p className="text-xs mt-1">Inscrivez l'étudiant à un cours et groupe</p>
                      </div>
                    )}

                    {/* Student details summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Genre</p>
                        <p className="text-sm font-medium text-[#0F172A]">
                          {student.gender === 'male' ? '♂ Masculin' : '♀ Féminin'}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">N° Étudiant</p>
                        <p className="text-sm font-mono font-medium text-[#0F172A]">{student.studentNumber}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Attendance Tab ─── */}
                {activeTab === 'attendance' && (
                  <div>
                    <div className="text-center py-12 text-slate-400">
                      <Clock size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">Historique de présence</p>
                      <p className="text-xs mt-1">
                        Sélectionnez une session dans le module Présence pour voir l'historique
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── Payments Tab ─── */}
                {activeTab === 'payments' && (
                  <div>
                    {payments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">Aucun paiement enregistré</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-[#0F172A]">{payment.receiptNumber}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {payment.billingPeriod} · {payment.paymentDate}
                              </p>
                              <p className="text-xs text-slate-400">
                                {payment.paymentMethod === 'cash' ? 'Espèces' : payment.paymentMethod === 'transfer' ? 'Virement' : 'Chèque'}
                              </p>
                            </div>
                            <div className="text-end">
                              <p className="font-bold text-[#2563EB]">{payment.amount.toLocaleString()} DZD</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                payment.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                              }`}>
                                {payment.status === 'paid' ? 'Payé' : 'Annulé'}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="pt-3 border-t border-border flex justify-between text-sm">
                          <span className="text-slate-500 font-medium">Total payé:</span>
                          <span className="font-bold text-[#0F172A]">
                            {payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0).toLocaleString()} DZD
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Enrollments Tab ─── */}
                {activeTab === 'enrollments' && (
                  <div>
                    {enrollments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">Aucune inscription</p>
                        <p className="text-xs mt-1">L'étudiant n'est inscrit à aucun groupe</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {enrollments.map((enroll) => (
                          <div key={enroll.id} className={`p-4 rounded-lg border ${
                            enroll.status === 'active' ? 'border-[#2563EB]/30 bg-[#EFF6FF]' : 'border-border bg-slate-50'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-[#0F172A]">Groupe #{enroll.groupId}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Inscrit le: {enroll.enrollmentDate}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Prix convenu: {enroll.agreedPrice.toLocaleString()} DZD/mois
                                </p>
                              </div>
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                enroll.status === 'active' ? 'bg-green-100 text-green-700' :
                                enroll.status === 'inactive' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {enroll.status === 'active' ? 'Actif' : enroll.status === 'inactive' ? 'Inactif' : 'Terminé'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Notes Tab ─── */}
                {activeTab === 'notes' && (
                  <div>
                    {/* Add note form */}
                    <div className="mb-4">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder={t('students.addNote')}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 resize-none"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={async () => {
                            if (!newNote.trim()) return
                            setSavingNote(true)
                            // Notes API will be available once exposed via preload
                            // For now show the note locally
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
                          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                        >
                          <Plus size={14} />
                          {savingNote ? t('common.saving') : t('common.add')}
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
    </div>
  )
}
