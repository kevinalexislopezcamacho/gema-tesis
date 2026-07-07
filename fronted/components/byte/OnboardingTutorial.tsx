"use client"

import { useState } from "react"
import { ByteMascot, ByteExpression } from "./ByteMascot"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronRight, ChevronLeft, X, Clock, EyeOff } from "lucide-react"

const storageKey = (userId: string) => `codepath-tutorial-done-v1-${userId}`

interface Step {
  expression: ByteExpression
  title: string
  body: string
  highlight?: string
  accentColor?: string
}

const STEPS: Step[] = [
  {
    expression: "waving",
    title: "¡Hola! Soy Byte 👋",
    body: "Tu guía y compañero de aprendizaje en CodePathAI. Voy a mostrarte todo lo que necesitas saber para aprender a programar.",
    highlight: "¡Bienvenido al curso!",
    accentColor: "text-primary",
  },
  {
    expression: "studying",
    title: "Tu Camino de Aprendizaje",
    body: "El curso tiene 8 módulos en orden: Tipos de Datos, Operaciones Lógicas, Filtros, Condicionales, Bucles, Funciones, Arreglos y Matrices.",
    highlight: "¡Completa cada módulo para desbloquear el siguiente!",
    accentColor: "text-accent",
  },
  {
    expression: "excited",
    title: "Aprende a tu ritmo 🎬",
    body: "Cada módulo tiene 3 niveles: Fácil, Medio y Avanzado. Puedes ver los videos generados por IA o chatear conmigo para resolver dudas.",
    highlight: "Debes ver el 85% del video para ganar XP.",
    accentColor: "text-yellow-400",
  },
  {
    expression: "celebrating",
    title: "¡Gana XP y sube de nivel! ⚡",
    body: "Cada video que completes te da puntos de experiencia. Fácil = 50 XP · Medio = 100 XP · Avanzado = 200 XP. Cada 500 XP subes de nivel.",
    highlight: "Si ya viste un video, ganas el 40% de XP al revisarlo.",
    accentColor: "text-primary",
  },
  {
    expression: "thinking",
    title: "Tu racha diaria 🔥",
    body: "Entra cada día para mantener tu racha activa. Si llevas días seguidos, recibirás un mensaje especial mío al entrar.",
    highlight: "¡Una racha de 7 días es solo el comienzo!",
    accentColor: "text-orange-400",
  },
  {
    expression: "happy",
    title: "Logros y recompensas 🏆",
    body: "Hay 40 logros para desbloquear: 20 básicos y 20 avanzados. Cada uno tiene una recompensa. Puedes verlos en la sección de Logros.",
    highlight: "¡Conviértete en un Graduado Digital!",
    accentColor: "text-yellow-400",
  },
  {
    expression: "celebrating",
    title: "¡Estás listo para empezar! 🚀",
    body: "Ya sabes todo lo que necesitas. Puedo ayudarte en el chat con cualquier duda sobre programación o sobre la plataforma.",
    highlight: "¡Mucho ánimo! Estoy aquí para ayudarte.",
    accentColor: "text-green-400",
  },
]

interface Props {
  userId: string
  onClose: () => void
}

export function OnboardingTutorial({ userId, onClose }: Props) {
  const [step,        setStep]        = useState(0)
  const [confirmExit, setConfirmExit] = useState(false)

  const current  = STEPS[step]
  const isLast   = step === STEPS.length - 1
  const pct      = ((step + 1) / STEPS.length) * 100
  const isOnFirst = step === 0

  const finish = () => {
    localStorage.setItem(storageKey(userId), "1")
    onClose()
  }

  // User pressed ✕ — if not on last step, ask what they want
  const handleCloseRequest = () => {
    if (isLast) {
      // Already at the end, just close and mark done
      finish()
    } else {
      // Show confirmation
      setConfirmExit(true)
    }
  }

  const handleLater = () => {
    // Don't mark as done → will show again on next page load
    onClose()
  }

  const handleNeverShow = () => {
    finish()
  }

  const handleResume = () => {
    setConfirmExit(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">

        {confirmExit ? (
          /* ── Exit confirmation screen ────────────────────────── */
          <div className="p-8 flex flex-col items-center text-center gap-5">
            <ByteMascot expression="sad" size={110} />
            <div>
              <h2 className="text-xl font-bold mb-2">¿Salir del tutorial?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vas por el paso {step + 1} de {STEPS.length}. Puedes volver a verlo desde tu perfil cuando quieras.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <Button
                onClick={handleResume}
                className="w-full bg-primary hover:bg-primary/90 gap-2"
              >
                <ChevronLeft className="w-4 h-4" />Continuar el tutorial
              </Button>

              <Button
                variant="outline"
                onClick={handleLater}
                className="w-full gap-2 border-border"
              >
                <Clock className="w-4 h-4" />Verlo después
                <span className="text-xs text-muted-foreground ml-1">(aparecerá la próxima vez)</span>
              </Button>

              <button
                onClick={handleNeverShow}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center gap-1.5"
              >
                <EyeOff className="w-3.5 h-3.5" />No mostrar de nuevo
              </button>
            </div>
          </div>
        ) : (
          /* ── Normal tutorial flow ────────────────────────────── */
          <>
            {/* Progress bar */}
            <div className="px-6 pt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Paso {step + 1} de {STEPS.length}</span>
                <button
                  onClick={handleCloseRequest}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>

            {/* Content */}
            <div className="p-8 flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <ByteMascot
                  expression={current.expression}
                  size={160}
                  animate={isOnFirst || isLast}
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold mb-3">{current.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{current.body}</p>
                {current.highlight && (
                  <div className={`text-sm font-semibold ${current.accentColor} bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5`}>
                    {current.highlight}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-8 pb-6 gap-3">
              <Button
                variant="outline" size="sm"
                onClick={() => setStep(s => s - 1)}
                disabled={isOnFirst}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />Anterior
              </Button>

              {/* Dot indicators */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === step ? "bg-primary w-5" : i < step ? "bg-primary/40 w-2" : "bg-border w-2"
                    }`}
                  />
                ))}
              </div>

              {isLast ? (
                <Button onClick={finish} className="gap-1 bg-primary hover:bg-primary/90">
                  ¡Empezar! <span className="text-base">🚀</span>
                </Button>
              ) : (
                <Button onClick={() => setStep(s => s + 1)} className="gap-1 bg-primary hover:bg-primary/90">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function shouldShowTutorial(userId: string): boolean {
  if (typeof window === "undefined") return false
  return !localStorage.getItem(storageKey(userId))
}
