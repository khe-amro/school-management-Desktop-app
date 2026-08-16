/**
 * StudentCard.tsx -- rewritten as thermal ticket page
 *
 * Fetches real student data via IPC and renders the StudentTicket
 * component for preview + print/PDF.
 */
import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Printer, Download, RefreshCw } from "lucide-react"
import StudentTicket from "../components/StudentTicket"

interface StudentData {
  id: number
  studentNumber: string
  firstNameFr: string
  lastNameFr: string
  firstNameAr?: string
  lastNameAr?: string
  qrToken: string
  status: "active" | "inactive" | "archived"
  photoPath?: string | null
}

interface EnrollmentData {
  id: number
  groupId: number
  status: string
  groupName?: string
  courseName?: string
}

export default function StudentCard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<StudentData | null>(null)
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState("Edupilot DZ")
  const [academicYear, setAcademicYear] = useState("2025-2026")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ticketRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      try {
        const api = (window as any).schoolApp

        // Load student
        const studentRes = await api.students.getById(Number(id))
        if (!studentRes.success || !studentRes.data) {
          setError("Etudiant introuvable")
          return
        }
        const s = studentRes.data
        setStudent({
          id: s.id,
          studentNumber: s.studentNumber,
          firstNameFr: s.firstNameFr,
          lastNameFr: s.lastNameFr,
          firstNameAr: s.firstNameAr,
          lastNameAr: s.lastNameAr,
          qrToken: s.qrToken,
          status: s.status,
          photoPath: s.photoPath,
        })

        // Load enrollments to get course/group info
        const enrollRes = await api.enrollments.byStudent(Number(id))
        if (enrollRes.success && enrollRes.data && enrollRes.data.length > 0) {
          const active = enrollRes.data.find((e: any) => e.status === "active") ?? enrollRes.data[0]
          setEnrollment(active)
        }

        // Load photo
        if (s.photoPath) {
          const photoRes = await api.media.getImageUrl(s.photoPath)
          if (photoRes.success && photoRes.data?.url) {
            setPhotoUrl(photoRes.data.url)
          }
        }

        // Load school settings
        const settingsRes = await api.settings.get()
        if (settingsRes.success && settingsRes.data) {
          setSchoolName(settingsRes.data.schoolNameFr || "Edupilot DZ")
          setAcademicYear(settingsRes.data.academicYear || "2025-2026")
        }
      } catch (err) {
        setError("Erreur lors du chargement des donnees.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handlePrint = async () => {
    // Trigger native print (the CSS print styles handle the layout)
    const api = (window as any).schoolApp
    await api.app.print()
  }

  const handlePdf = async () => {
    const api = (window as any).schoolApp
    await api.app.printToPdf({
      pageSize: "A4",
      marginsType: 0,
      filename: `ticket-${student?.studentNumber ?? id}.pdf`,
    })
  }

  const handleRegenQR = async () => {
    if (!id) return
    const api = (window as any).schoolApp
    const res = await api.students.regenQR(Number(id))
    if (res.success && res.data) {
      setStudent((prev) => (prev ? { ...prev, qrToken: res.data.token } : prev))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Chargement du ticket...</div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-red-500 text-sm">{error ?? "Etudiant introuvable"}</div>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm hover:underline">
          Retour
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Screen-only header + controls */}
      <div className="print:hidden flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Retour au profil
          </button>
        </div>

        <div className="flex gap-6 items-start">
          {/* Ticket preview */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Apercu du ticket</p>
            <div ref={ticketRef} className="shadow-lg rounded-sm">
              <StudentTicket
                student={student}
                courseName={enrollment?.courseName}
                groupName={enrollment?.groupName}
                schoolName={schoolName}
                academicYear={academicYear}
                photoUrl={photoUrl}
                forPrint={false}
              />
            </div>
          </div>

          {/* Actions panel */}
          <div className="flex-1 max-w-xs space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Actions</h3>
              <div className="space-y-2.5">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Printer size={15} />
                  Imprimer le ticket
                </button>
                <button
                  onClick={handlePdf}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Download size={15} />
                  Exporter en PDF
                </button>
                <button
                  onClick={handleRegenQR}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                >
                  <RefreshCw size={15} />
                  Regenerer le QR code
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Infos du ticket</h4>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between"><span>N etudiant:</span> <span className="font-mono text-slate-800">{student.studentNumber}</span></div>
                <div className="flex justify-between"><span>Cours:</span> <span className="font-medium text-slate-800">{enrollment?.courseName ?? "--"}</span></div>
                <div className="flex justify-between"><span>Groupe:</span> <span className="font-medium text-slate-800">{enrollment?.groupName ?? "--"}</span></div>
                <div className="flex justify-between"><span>Statut:</span>
                  <span className={`font-medium ${student.status === "active" ? "text-green-600" : "text-red-500"}`}>
                    {student.status === "active" ? "Actif" : student.status === "inactive" ? "Inactif" : "Archive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only content */}
      <div className="hidden print:flex print:items-center print:justify-center print:min-h-screen">
        <StudentTicket
          student={student}
          courseName={enrollment?.courseName}
          groupName={enrollment?.groupName}
          schoolName={schoolName}
          academicYear={academicYear}
          photoUrl={photoUrl}
          forPrint={true}
        />
      </div>
    </>
  )
}
