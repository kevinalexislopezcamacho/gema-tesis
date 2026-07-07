"use client"

import { Video, Play, Brain, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  {
    number: "01",
    icon: Video,
    role: "Docente",
    roleColor: "text-amber-500",
    roleBg: "bg-amber-500/10 border-amber-500/20",
    title: "El docente crea el contenido",
    description: "El docente crea el curso, define los temas y usa la IA para generar videos educativos. Configura la dificultad y agrega preguntas y retos a cada video.",
    color: "from-amber-500 to-orange-500",
    details: ["Crea cursos y temas", "Genera videos con IA", "Configura dificultad y retos"],
  },
  {
    number: "02",
    icon: Play,
    role: "Estudiante",
    roleColor: "text-sky-500",
    roleBg: "bg-sky-500/10 border-sky-500/20",
    title: "El estudiante accede y aprende",
    description: "El estudiante selecciona el tema que quiere estudiar y elige entre ver un video o usar el chatbot. Durante el video aparecen preguntas que refuerzan el aprendizaje.",
    color: "from-sky-500 to-blue-500",
    details: ["Selecciona tema y nivel", "Ve el video o usa el chatbot", "Responde retos en tiempo real"],
  },
  {
    number: "03",
    icon: Brain,
    role: "Sistema",
    roleColor: "text-purple-500",
    roleBg: "bg-purple-500/10 border-purple-500/20",
    title: "El sistema adapta y registra",
    description: "Según el desempeño del estudiante, el sistema ajusta la dificultad de las evaluaciones, actualiza el progreso, otorga XP y notifica al docente sobre el avance.",
    color: "from-violet-500 to-purple-500",
    details: ["Ajusta dificultad automáticamente", "Otorga XP y logros", "Actualiza tablero académico"],
  },
]

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">¿Cómo funciona?</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6 text-balance">
            Tres pasos hacia el
            <span className="text-primary"> dominio de la programación</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Una experiencia diseñada para docentes que crean contenido con IA
            y estudiantes que aprenden a su propio ritmo.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 relative">
          {/* Connector lines (desktop) */}
          <div className="hidden lg:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-amber-500/30 via-sky-500/30 to-violet-500/30 z-0" />

          {steps.map((step, index) => (
            <div key={index} className="relative group">
              <div className="relative p-8 rounded-3xl border border-border bg-card/50 backdrop-blur-sm hover:bg-card transition-all duration-500 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 h-full flex flex-col">

                {/* Step number */}
                <div className="flex items-start justify-between mb-6">
                  <span className={cn(
                    "text-6xl font-black opacity-10 leading-none",
                    index === 0 && "text-amber-500",
                    index === 1 && "text-sky-500",
                    index === 2 && "text-purple-500",
                  )}>
                    {step.number}
                  </span>
                  {/* Role badge */}
                  <span className={cn(
                    "text-xs font-semibold px-3 py-1 rounded-full border",
                    step.roleBg, step.roleColor
                  )}>
                    {step.role}
                  </span>
                </div>

                {/* Icon */}
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br",
                  step.color
                )}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6 flex-1">
                  {step.description}
                </p>

                {/* Details */}
                <ul className="space-y-2">
                  {step.details.map((detail, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className={cn(
                        "w-3 h-3 flex-shrink-0",
                        index === 0 && "text-amber-500",
                        index === 1 && "text-sky-500",
                        index === 2 && "text-purple-500",
                      )} />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
