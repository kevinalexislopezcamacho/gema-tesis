"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    id: 1,
    icon: "D",
    role: "Docente",
    title: "Crea el contenido",
    desc: "Define temas y genera videos con IA. Configura dificultad y retos.",
    color: "text-amber-600",
    iconBg: "bg-amber-500/12",
  },
  {
    id: 2,
    icon: "E",
    role: "Estudiante",
    title: "Accede y aprende",
    desc: "Elige tema y nivel, ve el video o usa el chatbot, responde retos.",
    color: "text-primary",
    iconBg: "bg-primary/12",
  },
  {
    id: 3,
    icon: "S",
    role: "Sistema",
    title: "Adapta y registra",
    desc: "Ajusta dificultad, otorga XP y notifica al docente sobre el avance.",
    color: "text-accent",
    iconBg: "bg-accent/12",
  },
]

export function AuthorSection() {
  const [openStep, setOpenStep] = useState<number | null>(1)

  return (
    <section className="py-[88px] px-6 bg-background border-t border-border">
      <div className="max-w-[1000px] mx-auto grid md:grid-cols-2 gap-14 items-center">
        <div>
          <h2 className="text-[32px] font-extrabold tracking-tight mb-[18px]">
            Un proyecto para cerrar la brecha en programación
          </h2>
          <p className="text-[15px] leading-[1.7] text-muted-foreground mb-7">
            GEMA usa IA generativa para producir videos cortos por tema y nivel, evalúa el desempeño en tiempo
            real y ajusta la dificultad, para que cada estudiante avance a su propio ritmo.
          </p>
          <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-border w-fit">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-extrabold text-base flex-shrink-0">
              KL
            </div>
            <div>
              <p className="text-sm font-bold m-0">Kevin Alexis López Camacho</p>
              <p className="text-xs text-muted-foreground mt-0.5">Autor · Trabajo de grado · 2026</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold tracking-wider uppercase text-muted-foreground mb-3.5">
            Explora cómo funciona
          </p>
          <div className="flex flex-col gap-1.5">
            {STEPS.map((step) => {
              const open = openStep === step.id
              return (
                <button
                  key={step.id}
                  onClick={() => setOpenStep(open ? null : step.id)}
                  className={cn(
                    "flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-colors",
                    open ? "bg-secondary/40 border-border" : "border-transparent hover:bg-secondary/20"
                  )}
                >
                  <span
                    className={cn(
                      "w-[38px] h-[38px] rounded-xl flex items-center justify-center font-mono font-extrabold text-[15px] flex-shrink-0",
                      step.iconBg,
                      step.color
                    )}
                  >
                    {step.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-[10px] font-bold tracking-wider uppercase", step.color)}>
                      {step.role}
                    </span>
                    <p className="text-sm font-bold mt-0.5 mb-0">{step.title}</p>
                    {open && (
                      <p className="text-xs leading-relaxed text-muted-foreground mt-2 mb-0">{step.desc}</p>
                    )}
                  </div>
                  <ChevronDown
                    className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform", open && "rotate-180")}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
