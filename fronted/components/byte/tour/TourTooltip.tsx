"use client"

import { useState } from "react"
import { ByteMascot, type ByteColor, type ByteOutfit } from "@/components/byte/ByteMascot"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft, X, Clock, EyeOff, Rocket } from "lucide-react"
import { TourAudioPlayer } from "./TourAudioPlayer"
import type { TourStep } from "@/lib/tour/types"

interface Props {
  step: TourStep
  stepNumber: number
  totalSteps: number
  isFirst: boolean
  isLast: boolean
  autoPlayAudio: boolean
  byteColor: ByteColor
  byteOutfit: ByteOutfit
  onNext: () => void
  onPrev: () => void
  onLater: () => void
  onNeverShowAgain: () => void
}

export function TourTooltip({
  step, stepNumber, totalSteps, isFirst, isLast, autoPlayAudio,
  byteColor, byteOutfit, onNext, onPrev, onLater, onNeverShowAgain,
}: Props) {
  const [confirmExit, setConfirmExit] = useState(false)

  const handleCloseRequest = () => {
    if (isLast) onNeverShowAgain()
    else setConfirmExit(true)
  }

  return (
    <div className="bg-card border border-border rounded-3xl shadow-2xl w-[min(92vw,26rem)] max-h-[min(85vh,42rem)] overflow-hidden flex flex-col">
      {confirmExit ? (
        <div className="p-5 sm:p-7 flex flex-col items-center text-center gap-3 sm:gap-4 overflow-y-auto">
          <ByteMascot expression="sad" size={72} color={byteColor} outfit={byteOutfit} />
          <div>
            <h2 className="text-lg font-bold mb-2">¿Salir del tour?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vas por el paso {stepNumber} de {totalSteps}. Puedes volver a verlo desde tu perfil cuando quieras.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full">
            <Button onClick={() => setConfirmExit(false)} className="w-full bg-primary hover:bg-primary/90 gap-2">
              <ChevronLeft className="w-4 h-4" />Continuar el tour
            </Button>
            <Button variant="outline" onClick={onLater} className="w-full gap-2 border-border">
              <Clock className="w-4 h-4" />Verlo después
            </Button>
            <button
              onClick={onNeverShowAgain}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center gap-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" />No mostrar de nuevo
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="px-5 pt-4 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-muted-foreground">Paso {stepNumber} de {totalSteps}</span>
            <button onClick={handleCloseRequest} className="text-muted-foreground hover:text-foreground transition-colors" title="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1 mx-5 mt-2 bg-secondary rounded-full overflow-hidden flex-shrink-0">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(stepNumber / totalSteps) * 100}%` }} />
          </div>

          <div className="p-4 sm:p-6 flex flex-col items-center text-center gap-2 sm:gap-3 overflow-y-auto min-h-0">
            <ByteMascot expression={step.expression} size={80} animate color={byteColor} outfit={byteOutfit} />
            <h2 className="text-base sm:text-lg font-bold">{step.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
            <TourAudioPlayer src={step.audioSrc} stepId={step.id} autoPlay={autoPlayAudio} />
          </div>

          <div className="flex items-center justify-between px-6 pb-5 pt-2 gap-3 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onPrev} disabled={isFirst} className="gap-1">
              <ChevronLeft className="w-4 h-4" />Atrás
            </Button>
            <Button size="sm" onClick={onNext} className="gap-1 bg-primary hover:bg-primary/90">
              {isLast ? <>¡Empezar! <Rocket className="w-4 h-4" /></> : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
