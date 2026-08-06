import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import type { Student } from '@shared/types/index'

export default function StudentCard() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const qrRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    window.schoolApp.students.getById(Number(id)).then((res) => {
      if (res.success && res.data) setStudent(res.data)
    })
  }, [id])

  useEffect(() => {
    if (student && qrRef.current) {
      QRCode.toCanvas(qrRef.current, student.qrToken, {
        width: 100, margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      })
    }
  }, [student])

  const handlePrint = () => window.print()

  if (!student) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      {/* Toolbar (hidden on print) */}
      <div className="no-print flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors">
          <ArrowLeft size={15} /> {t('common.back')}
        </button>
        <button onClick={handlePrint} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors ms-auto">
          <Printer size={15} /> {t('common.print')}
        </button>
      </div>

      {/* Card — 85.6mm × 54mm (ID card size) */}
      <div className="print-card flex justify-center">
        <div
          style={{ width: '85.6mm', height: '54mm' }}
          className="bg-[#0F172A] rounded-xl overflow-hidden flex relative shadow-2xl"
        >
          {/* Left accent */}
          <div className="w-2 bg-[#2563EB] shrink-0" />

          {/* Content */}
          <div className="flex-1 flex items-center gap-3 p-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-base shrink-0">
              {student.firstNameAr.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-accent text-[9px] font-bold uppercase tracking-widest mb-0.5">Edupilot DZ</p>
              <p className="text-white font-bold text-sm leading-tight">{student.lastNameAr} {student.firstNameAr}</p>
              <p className="text-slate-400 text-[10px] leading-tight">{student.lastNameFr} {student.firstNameFr}</p>
              <p className="text-slate-500 font-mono text-[9px] mt-1">{student.studentNumber}</p>
              <p className="text-slate-500 text-[9px]">
                {student.gender === 'male' ? '♂' : '♀'} · {student.dateOfBirth ?? ''}
              </p>
            </div>

            {/* QR */}
            <div className="bg-white p-1 rounded-lg shrink-0">
              <canvas ref={qrRef} className="block" />
            </div>
          </div>

          {/* Bottom stripe */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-[#2563EB] to-accent" />
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4 no-print">{t('students.qrCode')} · {student.qrToken}</p>
    </div>
  )
}
