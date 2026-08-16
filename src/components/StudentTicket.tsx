/**
 * StudentTicket - thermal receipt/ticket format for students.
 * Designed for 80mm thermal paper printers.
 * Replaces the CR80 card as requested by client.
 */
import React from "react"

// Mini QR pattern renderer
function QRPattern({ token, size = 96 }: { token: string; size?: number }) {
  const CELLS = 17
  const cells: boolean[] = []
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const topLeft = r < 5 && c < 5
      const topRight = r < 5 && c >= CELLS - 5
      const bottomLeft = r >= CELLS - 5 && c < 5
      if (topLeft || topRight || bottomLeft) {
        const isFrame =
          r === 0 || r === 4 || c === 0 || c === 4 ||
          (topRight && (r === 0 || r === 4 || c === CELLS - 5 || c === CELLS - 1)) ||
          (bottomLeft && (r === CELLS - 5 || r === CELLS - 1 || c === 0 || c === 4))
        const isCenter =
          (topLeft && r >= 1 && r <= 3 && c >= 1 && c <= 3) ||
          (topRight && r >= 1 && r <= 3 && c >= CELLS - 4 && c <= CELLS - 2) ||
          (bottomLeft && r >= CELLS - 4 && r <= CELLS - 2 && c >= 1 && c <= 3)
        cells.push(isFrame || isCenter)
        continue
      }
      const seed = token.charCodeAt((r * CELLS + c) % token.length)
      cells.push((seed + r * 3 + c * 7) % 3 !== 0)
    }
  }
  const cell = size / CELLS
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${CELLS}, ${cell}px)`, width: size, height: size, background: "white", padding: 2, border: "1px solid #000" }}>
      {cells.map((dark, i) => (
        <div key={i} style={{ width: cell, height: cell, background: dark ? "#000" : "#fff" }} />
      ))}
    </div>
  )
}

function Dashes() {
  return <div style={{ width: "100%", borderTop: "1px dashed #ccc", margin: "8px 0" }} />
}

export interface StudentTicketProps {
  student: {
    id: number
    studentNumber: string
    firstNameAr?: string
    lastNameAr?: string
    firstNameFr: string
    lastNameFr: string
    qrToken: string
    status: "active" | "inactive" | "archived"
  }
  courseName?: string
  groupName?: string
  schoolName?: string
  academicYear?: string
  photoUrl?: string | null
  forPrint?: boolean
}

export default function StudentTicket({ student, courseName, groupName, schoolName = "Edupilot DZ", academicYear = "2025-2026", photoUrl, forPrint = false }: StudentTicketProps) {
  const fullName = `${student.firstNameFr} ${student.lastNameFr}`
  const isActive = student.status === "active"
  const now = new Date().toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" })

  return (
    <div style={{ width: 320, fontFamily: '"Courier New", Courier, monospace', background: "#fff", color: "#000", fontSize: 11, userSelect: "none", border: forPrint ? "none" : "1px dashed #bbb", borderRadius: forPrint ? 0 : 4, overflow: "hidden" }}>
      <div style={{ background: "#000", color: "#fff", padding: "8px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>EDUPILOT DZ</div>
        <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>{schoolName}</div>
        <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>Annee academique {academicYear}</div>
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>--- TICKET ETUDIANT ---</div>
        <Dashes />
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 4, border: "1px solid #000", overflow: "hidden", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photoUrl ? (
              <img src={photoUrl} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 700, color: "#666" }}>{student.firstNameFr.charAt(0)}{student.lastNameFr.charAt(0)}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{fullName}</div>
            {student.firstNameAr && student.lastNameAr && (
              <div style={{ fontSize: 11, direction: "rtl", textAlign: "right", marginTop: 2 }}>{student.lastNameAr} {student.firstNameAr}</div>
            )}
            <div style={{ fontSize: 10, fontFamily: "monospace", marginTop: 4, color: "#444" }}>N: {student.studentNumber}</div>
            <div style={{ display: "inline-block", fontSize: 9, padding: "1px 6px", borderRadius: 2, border: `1px solid ${isActive ? "#000" : "#888"}`, background: isActive ? "#000" : "#f0f0f0", color: isActive ? "#fff" : "#666", marginTop: 4, fontWeight: 700, letterSpacing: 1 }}>
              {isActive ? "ACTIF" : "INACTIF"}
            </div>
          </div>
        </div>
        <Dashes />
        {(courseName || groupName) && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#555" }}>Cours:</span>
              <span style={{ fontWeight: 700 }}>{courseName ?? "--"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#555" }}>Groupe:</span>
              <span style={{ fontWeight: 700 }}>{groupName ?? "--"}</span>
            </div>
            <Dashes />
          </>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "8px 0" }}>
          <QRPattern token={student.qrToken} size={96} />
          <div style={{ fontSize: 9, color: "#555", textAlign: "center" }}>Scannez pour pointer la presence</div>
          <div style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: 1, color: "#888", border: "1px solid #ddd", padding: "2px 6px", borderRadius: 2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {student.qrToken}
          </div>
        </div>
        <Dashes />
        <div style={{ textAlign: "center", fontSize: 9, color: "#777", lineHeight: 1.5 }}>
          <div>Emis le: {now}</div>
          <div style={{ marginTop: 2 }}>Carte reservee a identification.</div>
          <div>En cas de perte, contactez l&apos;administration.</div>
        </div>
        <div style={{ display: "flex", gap: 1, marginTop: 10, justifyContent: "center" }}>
          {Array.from(student.qrToken.substring(0, 30)).map((ch, i) => (
            <div key={i} style={{ width: (ch.charCodeAt(0) % 3) + 1, height: 24, background: i % 2 === 0 ? "#000" : "#fff", border: i % 2 !== 0 ? "1px solid #eee" : "none" }} />
          ))}
        </div>
      </div>
    </div>
  )
}
