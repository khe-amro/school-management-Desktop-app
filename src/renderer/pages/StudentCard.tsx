import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Printer, Download, Eye } from 'lucide-react'
import QRCode from 'qrcode'
import type { Student, Enrollment, Payment } from '@shared/types/index'

interface SchoolInfo {
  schoolNameAr: string
  schoolNameFr: string
  academicYear: string
  phone?: string | null
  address?: string | null
}

export default function StudentCard() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [school, setSchool] = useState<SchoolInfo>({ schoolNameAr: '', schoolNameFr: 'EDUPILOT DZ', academicYear: '2025-2026' })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [lastPayment, setLastPayment] = useState<Payment | null>(null)
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null)
  const [remainingSessions, setRemainingSessions] = useState<number>(0)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const studentId = Number(id)
        const [studentRes, settingsRes, enrollRes, payRes, summaryRes] = await Promise.all([
          window.schoolApp.students.getById(studentId),
          window.schoolApp.settings.get(),
          window.schoolApp.enrollments.byStudent(studentId),
          window.schoolApp.payments.byStudent(studentId),
          window.schoolApp.attendance.getStudentSummary(studentId),
        ])

        if (studentRes.success && studentRes.data) {
          const s = studentRes.data
          setStudent(s)

          // Load photo
          if (s.photoPath) {
            try {
              const photoRes = await window.schoolApp.media.getImageUrl(s.photoPath)
              if (photoRes.success && photoRes.data?.url) setPhotoUrl(photoRes.data.url)
            } catch {}
          }
        }

        if (settingsRes.success && settingsRes.data) {
          setSchool({
            schoolNameAr: settingsRes.data.schoolNameAr ?? '',
            schoolNameFr: settingsRes.data.schoolNameFr ?? 'EDUPILOT DZ',
            academicYear: settingsRes.data.academicYear ?? '2025-2026',
            phone: settingsRes.data.phone,
            address: settingsRes.data.address,
          })
        }

        if (enrollRes.success && enrollRes.data) {
          setEnrollments(enrollRes.data)
          if (enrollRes.data.length > 0) {
            const firstEnrollment = enrollRes.data.find(e => e.status === 'active') ?? enrollRes.data[0]
            try {
              const remRes = await window.schoolApp.attendance.getRemainingSessionsCount(firstEnrollment.id)
              if (remRes.success && typeof remRes.data?.count === 'number') {
                setRemainingSessions(remRes.data.count)
              }
            } catch {}
          }
        }

        if (payRes.success && payRes.data && payRes.data.length > 0) {
          // Sort descending by paymentDate
          const sorted = [...payRes.data].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
          setLastPayment(sorted[0])
        }

        if (summaryRes.success && summaryRes.data?.attendanceStats) {
          setAttendanceRate(summaryRes.data.attendanceStats.attendanceRate)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const fullNameAr = student ? `${student.lastNameAr} ${student.firstNameAr}` : ''
  const fullNameFr = student ? `${student.lastNameFr} ${student.firstNameFr}` : ''
  const initials = student ? (student.firstNameAr.charAt(0) + student.lastNameAr.charAt(0)) : ''

  const primaryEnrollment = useMemo(() => {
    return enrollments.find(e => e.status === 'active') ?? enrollments[0]
  }, [enrollments])

  // Generate QR Code with rich structured payload
  useEffect(() => {
    if (student?.qrToken) {
      const courseName = primaryEnrollment?.courseName ?? primaryEnrollment?.groupName ?? 'Non assigné'
      const paymentInfo = lastPayment ? `${lastPayment.amount.toLocaleString()} DA (${lastPayment.billingPeriod || lastPayment.paymentDate})` : 'Aucun paiement enregistré'
      const rateInfo = attendanceRate !== null ? `${attendanceRate}%` : '100%'
      const remainingInfo = remainingSessions > 0 ? `${remainingSessions} séances restantes` : 'À jour'

      // Clean structured plain text card — instantly readable by all smartphones, Google Lens, and QR scanners
      const lines = [
        school.schoolNameFr || 'EDUPILOT DZ',
        `Matricule: ${student.studentNumber}`,
        `Nom: ${fullNameAr}`,
        `Nom FR: ${fullNameFr}`,
        student.phone ? `Tél: ${student.phone}` : null,
        `Cours: ${courseName}`,
        `Paiement: ${paymentInfo}`,
        `Présence: ${rateInfo}`,
        `Séances: ${remainingInfo}`,
        `ID: ${student.qrToken}`,
      ].filter(Boolean)

      const qrPayload = lines.join('\n')

      QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err))
    }
  }, [student, primaryEnrollment, lastPayment, attendanceRate, remainingSessions, school, fullNameAr, fullNameFr])

  const handlePrint = async () => {
    setPrinting(true)
    try {
      await window.schoolApp.app.print()
    } finally {
      setPrinting(false)
    }
  }

  const handleSavePDF = async () => {
    setPrinting(true)
    try {
      await window.schoolApp.app.printToPdf({
        pageSize: 'A4' as any,
        marginsType: 0,
        filename: `Ticket-${student?.studentNumber || 'etudiant'}.pdf`,
      })
    } finally {
      setPrinting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!student) {
    return <div className="text-center py-20 text-slate-400">{t('errors.STUDENT_NOT_FOUND')}</div>
  }

  /* ── 80mm Thermal Ticket Component ── */
  const TicketContent = () => (
    <div
      className="student-ticket-content"
      style={{
        width: '80mm',
        fontFamily: "'Courier New', Courier, monospace",
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '6mm 5mm',
        boxSizing: 'border-box',
        margin: '0 auto',
      }}
    >
      {/* Header: School name */}
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <div style={{ fontSize: '11pt', fontWeight: 'bold', letterSpacing: '1px' }}>
          {school.schoolNameFr || 'EDUPILOT DZ'}
        </div>
        {school.schoolNameAr && (
          <div style={{ fontSize: '10pt', fontWeight: 'bold', direction: 'rtl', marginTop: '1mm' }}>
            {school.schoolNameAr}
          </div>
        )}
        <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />
        <div style={{ fontSize: '10pt', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>
          TICKET ÉTUDIANT
        </div>
        <div style={{ fontSize: '8pt', color: '#555' }}>Année scolaire: {school.academicYear}</div>
        <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />
      </div>

      {/* Photo / Initials */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3mm' }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Photo"
            style={{
              width: '22mm',
              height: '22mm',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #000',
            }}
          />
        ) : (
          <div style={{
            width: '22mm', height: '22mm', borderRadius: '50%',
            border: '2px solid #000', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '13pt', fontWeight: 'bold',
          }}>
            {initials}
          </div>
        )}
      </div>

      {/* Student Names */}
      <div style={{ textAlign: 'center', marginBottom: '2.5mm' }}>
        <div style={{ fontSize: '12pt', fontWeight: 'bold', direction: 'rtl' }}>{fullNameAr}</div>
        <div style={{ fontSize: '9.5pt', color: '#222', marginTop: '1mm' }}>{fullNameFr}</div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />

      {/* Student Identity Details */}
      <div style={{ fontSize: '8pt', lineHeight: '1.6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'bold' }}>N° Matricule:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.studentNumber}</span>
        </div>
        {student.phone && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Téléphone:</span>
            <span>{student.phone}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'bold' }}>Statut:</span>
          <span style={{ fontWeight: 'bold' }}>{student.status === 'active' ? 'ACTIF' : 'INACTIF'}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />

      {/* Course & Group Enrollment Details */}
      <div style={{ fontSize: '8pt', lineHeight: '1.6' }}>
        <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1mm' }}>INSCRIPTION & COURS:</div>
        {enrollments.length > 0 ? (
          enrollments.map((en, idx) => (
            <div key={en.id || idx} style={{ marginBottom: '1mm' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>• {en.courseName || en.groupName || `Groupe #${en.groupId}`}</span>
                <span style={{ fontWeight: 'bold' }}>{en.agreedPrice ? `${en.agreedPrice.toLocaleString()} DA` : ''}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#666', fontStyle: 'italic' }}>Aucune inscription active</div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />

      {/* Payment Information */}
      <div style={{ fontSize: '8pt', lineHeight: '1.6' }}>
        <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1mm' }}>DERNIER PAIEMENT:</div>
        {lastPayment ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Montant réglé:</span>
              <span style={{ fontWeight: 'bold' }}>{lastPayment.amount.toLocaleString()} DZD</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Période / Mois:</span>
              <span>{lastPayment.billingPeriod || 'Mensuel'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Date de paiement:</span>
              <span>{lastPayment.paymentDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>N° Reçu:</span>
              <span style={{ fontFamily: 'monospace' }}>{lastPayment.receiptNumber}</span>
            </div>
          </>
        ) : (
          <div style={{ color: '#b91c1c', fontWeight: 'bold' }}>Aucun règlement enregistré</div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />

      {/* Attendance & Remaining Lessons */}
      <div style={{ fontSize: '8pt', lineHeight: '1.6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Taux de présence:</span>
          <span style={{ fontWeight: 'bold' }}>{attendanceRate !== null ? `${attendanceRate}%` : '100%'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Séances restantes (mois):</span>
          <span style={{ fontWeight: 'bold' }}>{remainingSessions > 0 ? `${remainingSessions} séances` : 'À jour'}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />

      {/* Rich QR Code Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5mm', margin: '2mm 0' }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{ width: '40mm', height: '40mm', display: 'block', imageRendering: 'pixelated' }}
          />
        ) : (
          <div style={{ width: '40mm', height: '40mm', border: '1px dashed #999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt', color: '#999' }}>
            QR Code
          </div>
        )}
        <div style={{ fontSize: '6.5pt', color: '#555', fontFamily: 'monospace', textAlign: 'center', wordBreak: 'break-all', maxWidth: '70mm' }}>
          ID: {student.qrToken}
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2.5mm 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '6.5pt', color: '#666', lineHeight: '1.4' }}>
        <div>Inscrit le: {student.registrationDate}</div>
        <div>Scannez ce QR Code pour voir le profil & pointer la présence</div>
      </div>
    </div>
  )

  return (
    <>
      {/* Print-only ticket — centered on page */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .student-ticket-print,
          .student-ticket-print * { visibility: visible !important; }
          .student-ticket-print {
            position: absolute !important;
            left: 50% !important;
            top: 5mm !important;
            transform: translateX(-50%) !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
          }
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Hidden print area */}
      <div className="student-ticket-print" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <TicketContent />
      </div>

      {/* Toolbar — hidden on print */}
      <div className="no-print flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft size={15} /> {t('common.back')}
        </button>

        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 border border-border bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Eye size={15} /> {t('common.preview') ?? 'Aperçu'}
          </button>
          <button
            onClick={handleSavePDF}
            disabled={printing}
            className="flex items-center gap-2 border border-[#2563EB] text-[#2563EB] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#EFF6FF] transition-colors disabled:opacity-50"
          >
            <Download size={15} /> PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
          >
            <Printer size={15} /> {t('common.print')}
          </button>
        </div>
      </div>

      {/* On-screen ticket preview card */}
      <div className="no-print flex justify-center">
        <div className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden" style={{ width: '360px' }}>
          <div className="h-2 bg-linear-to-r from-[#2563EB] to-[#06B6D4]" />

          <div className="p-6">
            {/* School name */}
            <div className="text-center mb-4">
              <p className="text-[10px] font-bold tracking-[3px] text-slate-400 uppercase mb-1">
                {school.schoolNameFr || 'EDUPILOT DZ'}
              </p>
              {school.schoolNameAr && (
                <p className="text-sm font-bold text-[#0F172A]" dir="rtl">{school.schoolNameAr}</p>
              )}
              <div className="border-b border-dashed border-slate-300 my-2.5" />
              <p className="text-xs font-bold tracking-[2px] text-[#0F172A] uppercase">TICKET ÉTUDIANT</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Année scolaire: {school.academicYear}</p>
            </div>

            {/* Photo */}
            <div className="flex justify-center mb-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={fullNameFr}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#2563EB]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#EFF6FF] border-2 border-[#2563EB] flex items-center justify-center text-[#2563EB] font-bold text-2xl">
                  {initials}
                </div>
              )}
            </div>

            {/* Names */}
            <div className="text-center mb-3">
              <p className="font-bold text-[#0F172A] text-base" dir="rtl">{fullNameAr}</p>
              <p className="text-slate-500 text-sm">{fullNameFr}</p>
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            {/* Student details */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">MATRICULE</span>
                <span className="font-mono font-bold text-[#0F172A]">{student.studentNumber}</span>
              </div>
              {student.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">TÉLÉPHONE</span>
                  <span className="text-[#0F172A]">{student.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">COURS / GROUPE</span>
                <span className="font-semibold text-[#2563EB]">
                  {primaryEnrollment?.courseName || primaryEnrollment?.groupName || 'Inscrit'}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            {/* Payment & Attendance details */}
            <div className="space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-lg">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">DERNIER PAIEMENT:</span>
                <span className="font-bold text-emerald-600">
                  {lastPayment ? `${lastPayment.amount.toLocaleString()} DA` : 'Non réglé'}
                </span>
              </div>
              {lastPayment && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Période: {lastPayment.billingPeriod || 'Mensuel'}</span>
                  <span>{lastPayment.paymentDate}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium">PRÉSENCE:</span>
                <span className="font-semibold text-[#0F172A]">
                  {attendanceRate !== null ? `${attendanceRate}%` : '100%'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">LEÇONS RESTANTES:</span>
                <span className="font-semibold text-blue-600">
                  {remainingSessions > 0 ? `${remainingSessions} séances` : 'À jour'}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-32 h-32 rounded-lg" />
              ) : (
                <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  Chargement...
                </div>
              )}
              <p className="text-[9px] font-mono text-slate-400 text-center break-all max-w-65">{student.qrToken}</p>
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            <p className="text-center text-[9px] text-slate-400">
              Scannez ce QR Code pour afficher le profil & pointer
            </p>
          </div>

          <div className="h-1 bg-linear-to-r from-[#2563EB] to-[#06B6D4]" />
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4 no-print">
        Format ticket thermique 80mm · {student.studentNumber}
      </p>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-[#0F172A]">Aperçu du ticket 80mm</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSavePDF}
                  disabled={printing}
                  className="flex items-center gap-1.5 text-sm border border-[#2563EB] text-[#2563EB] px-3 py-1.5 rounded-lg hover:bg-[#EFF6FF] transition-colors disabled:opacity-50"
                >
                  <Download size={13} /> Enregistrer PDF
                </button>
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="flex items-center gap-1.5 text-sm bg-[#2563EB] text-white px-3 py-1.5 rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                >
                  <Printer size={13} /> Imprimer
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 flex justify-center bg-slate-100">
              <div className="shadow-lg bg-white">
                <TicketContent />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
