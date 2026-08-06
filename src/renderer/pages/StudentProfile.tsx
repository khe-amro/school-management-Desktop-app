import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Edit2, CreditCard, QrCode, RefreshCw, Archive } from 'lucide-react'
import type { Student } from '@shared/types/index'
import QRCode from 'qrcode'

export default function StudentProfile() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const load = async () => {
    const res = await window.schoolApp.students.getById(Number(id))
    if (res.success && res.data) {
      setStudent(res.data)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (student?.qrToken && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, student.qrToken, {
        width: 160, margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      }).catch(console.error)
    }
  }, [student?.qrToken])

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

  if (loading) return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
  if (!student) return <div className="text-center py-20 text-slate-400">{t('errors.STUDENT_NOT_FOUND')}</div>

  const infoRow = (label: string, value: string | null | undefined) =>
    value ? (
      <div className="py-2 border-b border-[#F1F5F9] last:border-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[#0F172A]">{value}</p>
      </div>
    ) : null

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors">
          <ArrowLeft size={15} /> {t('common.back')}
        </button>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/students/${student.id}/card`)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-slate-50 transition-colors">
            <QrCode size={14} /> {t('students.card')}
          </button>
          <button onClick={() => navigate(`/students/${student.id}/edit`)} className="flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors">
            <Edit2 size={14} /> {t('common.edit')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile card */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] font-bold text-2xl mx-auto mb-3">
              {student.firstNameAr.charAt(0)}
            </div>
            <h2 className="font-bold text-[#0F172A] text-lg">{student.lastNameAr} {student.firstNameAr}</h2>
            <p className="text-slate-400 text-sm">{student.lastNameFr} {student.firstNameFr}</p>
            <span className={`inline-block mt-2 text-xs px-2.5 py-0.5 rounded-full font-medium ${
              student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {t(`students.${student.status}`)}
            </span>
          </div>

          {/* QR code */}
          <div className="text-center border-t border-[#F1F5F9] pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('students.qrCode')}</p>
            <canvas ref={qrCanvasRef} className="mx-auto rounded-lg" />
            <p className="text-[10px] font-mono text-slate-300 mt-2 truncate px-2">{student.studentNumber}</p>
            <button
              onClick={handleRegenQR}
              className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#2563EB] transition-colors mx-auto"
            >
              <RefreshCw size={11} /> {t('students.regenQR')}
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Personal info */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="font-semibold text-[#0F172A] text-sm mb-3">{t('common.name')}</h3>
            <div className="grid grid-cols-2 gap-x-6">
              {infoRow(t('students.studentNumber'), student.studentNumber)}
              {infoRow(t('students.gender'), t(`students.${student.gender}`))}
              {infoRow(t('students.dateOfBirth'), student.dateOfBirth)}
              {infoRow(t('students.registrationDate'), student.registrationDate)}
              {infoRow(t('students.phone'), student.phone)}
              {infoRow(t('students.secondaryPhone'), student.secondaryPhone)}
              {infoRow(t('students.address'), student.address)}
            </div>
          </div>

          {/* Guardian */}
          {(student.guardianName || student.guardianPhone) && (
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-[#0F172A] text-sm mb-3">{t('students.guardianName')}</h3>
              {infoRow(t('students.guardianName'), student.guardianName)}
              {infoRow(t('students.guardianRelationship'), student.guardianRelationship)}
              {infoRow(t('students.guardianPhone'), student.guardianPhone)}
            </div>
          )}

          {/* Danger zone */}
          {student.status !== 'archived' && (
            <div className="bg-white rounded-xl border border-red-200 p-5">
              <h3 className="font-semibold text-red-600 text-sm mb-3 flex items-center gap-2">
                <Archive size={14} /> {t('students.archive')}
              </h3>
              <p className="text-xs text-slate-500 mb-3">{t('students.archiveConfirm')}</p>
              <button
                onClick={handleArchive}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
              >
                {t('students.archive')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
