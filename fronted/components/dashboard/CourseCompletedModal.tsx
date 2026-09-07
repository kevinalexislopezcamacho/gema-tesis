"use client"

import { Button } from "@/components/ui/button"
import { X, Download } from "lucide-react"
import { downloadCertificate } from "@/lib/certificate"

interface Props {
  studentName: string
  totalXP: number
  level: number
  completedCount: number
  onClose: () => void
}

export function CourseCompletedModal({ studentName, totalXP, level, completedCount, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden bg-card border border-border shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-gradient-to-br from-primary to-accent px-6 pt-8 pb-8 flex flex-col items-center text-center">
          <div className="w-full max-w-[280px] rounded-2xl overflow-hidden shadow-lg animate-in zoom-in-75 duration-500">
            <video
              src="/video-course-complete.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto block"
            />
          </div>
          <h2 className="text-2xl font-extrabold text-white mt-3">¡Felicidades!</h2>
          <p className="text-white/90 text-sm mt-1">Completaste todo el curso de Fundamentos de Programación</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold font-mono text-primary">{completedCount}</p>
              <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground mt-0.5">Módulos</p>
            </div>
            <div>
              <p className="text-xl font-bold font-mono text-primary">{totalXP}</p>
              <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground mt-0.5">XP total</p>
            </div>
            <div>
              <p className="text-xl font-bold font-mono text-primary">{level}</p>
              <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground mt-0.5">Nivel</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Descarga tu certificado de finalización — puedes volver a descargarlo cuando quieras desde tu panel.
          </p>

          <Button
            className="w-full gap-2"
            onClick={() =>
              downloadCertificate({
                studentName,
                totalXP,
                level,
                completedCount,
                completedAt: new Date().toISOString(),
              })
            }
          >
            <Download className="w-4 h-4" />
            Descargar certificado
          </Button>
        </div>
      </div>
    </div>
  )
}
