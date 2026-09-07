// Approximate RGB for the app's oklch primary/accent tokens (jsPDF only
// draws in plain RGB) — sampled from the actual rendered UI, not exact but
// visually consistent with the rest of the app's branding.
const ACCENT  = [124, 58, 237] as const  // ~ oklch(0.6 0.19 300)
const INK     = [30, 30, 40] as const
const MUTED   = [110, 110, 120] as const

// Sampled from the official Universidad de San Buenaventura Cali letterhead
// (HojaMembrete2025) accent bar, so the bottom stripe matches the real thing.
const USB_ORANGE = [231, 134, 65] as const
const USB_GRAY   = [176, 178, 177] as const
const USB_BAR_SPLIT = 0.191 // orange fraction of the bar's width

export interface CertificateData {
  studentName: string
  totalXP: number
  level: number
  completedCount: number
  completedAt: string // ISO date string
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })
}

export async function downloadCertificate({ studentName, totalXP, level, completedCount, completedAt }: CertificateData) {
  // Dynamically imported so Next.js never tries to resolve jsPDF's
  // Node-oriented build during SSR/server bundling (it pulls in a
  // worker_threads path that Turbopack can't statically follow) — this
  // function only ever runs client-side, from a button's onClick.
  const { jsPDF } = await import("jspdf")
  const { USB_HEADER_JPG, USB_FOOTER_JPG, SIGNATURE_PNG } = await import("./certificate-assets")
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const cx = W / 2

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, H, "F")

  // Official USB Cali letterhead header (university seal + institutional
  // accreditation seal), cropped from HojaMembrete2025 — gives the
  // certificate real institutional backing instead of a generic frame.
  const headerW = W - 30
  const headerH = headerW / (1078 / 135) // source crop's aspect ratio
  doc.addImage(USB_HEADER_JPG, "JPEG", 15, 14, headerW, headerH)

  const contentTop = 14 + headerH + 8

  // GEMA wordmark — text only, no icon glyph
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text("GEMA", cx, contentTop + 6, { align: "center" })

  // Title
  const titleY = contentTop + 20
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(...INK)
  doc.text("CERTIFICADO DE FINALIZACIÓN", cx, titleY, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text("Se certifica que", cx, titleY + 9, { align: "center" })

  // Student name
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(...INK)
  doc.text(studentName, cx, titleY + 20, { align: "center" })

  // Divider under the name
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(cx - 42, titleY + 24, cx + 42, titleY + 24)

  // Body paragraph
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  const body =
    "ha completado exitosamente todos los módulos del curso de Fundamentos de Programación en la plataforma " +
    "GEMA, demostrando dominio de los conceptos fundamentales de programación mediante micro-learning " +
    "con videos generados por IA y evaluación adaptativa."
  const lines = doc.splitTextToSize(body, W - 100)
  doc.text(lines, cx, titleY + 32, { align: "center" })

  // Stats row
  const statsY = titleY + 32 + lines.length * 5 + 12
  const stats: [string, string][] = [
    [String(completedCount), "Módulos completados"],
    [String(totalXP), "XP total"],
    [String(level), "Nivel alcanzado"],
  ]
  const gap = 55
  const startX = cx - gap
  stats.forEach(([value, label], i) => {
    const x = startX + i * gap
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(...INK)
    doc.text(value, x, statsY, { align: "center" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label, x, statsY + 5, { align: "center" })
  })

  // Signature — handwritten image sitting just above the line, then the
  // printed name below it (standard signature-block convention).
  const sigY = statsY + 20
  const sigImgAspect = 592 / 201
  const sigImgH = 10
  const sigImgW = sigImgH * sigImgAspect
  doc.addImage(SIGNATURE_PNG, "PNG", cx - sigImgW / 2, sigY - sigImgH - 1.5, sigImgW, sigImgH)

  doc.setDrawColor(...INK)
  doc.setLineWidth(0.3)
  doc.line(cx - 42, sigY, cx + 42, sigY)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text("Kevin Alexis López Camacho", cx, sigY + 5, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text("Autor · Trabajo de grado · Universidad de San Buenaventura Cali", cx, sigY + 9.5, { align: "center" })

  // Date + certificate id (bottom corners)
  const dateRowY = sigY + 12
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(fmtDate(completedAt), 22, dateRowY)
  const certId = `CPA-${new Date(completedAt).getTime().toString(36).toUpperCase()}`
  doc.text(`ID: ${certId}`, W - 22, dateRowY, { align: "right" })

  // Official USB Cali letterhead footer (QR, contact info, ISO 9001 / IQNet
  // certification badges), cropped from the same HojaMembrete2025 template —
  // completes the letterhead frame the header started.
  const footerW = W - 30
  const footerH = footerW / (1078 / 108)
  const footerY = H - 12 - footerH
  doc.addImage(USB_FOOTER_JPG, "JPEG", 15, footerY, footerW, footerH)

  // Accent bar at the very bottom, matching the USB Cali letterhead's stripe
  const barH = 5
  const orangeW = W * USB_BAR_SPLIT
  doc.setFillColor(...USB_ORANGE)
  doc.rect(0, H - barH, orangeW, barH, "F")
  doc.setFillColor(...USB_GRAY)
  doc.rect(orangeW, H - barH, W - orangeW, barH, "F")

  doc.save(`certificado-${studentName.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}
