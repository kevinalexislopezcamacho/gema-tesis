"use client"

import { Sparkles, Brain, Trophy, BarChart3, MessageSquare, Zap, Target, Video } from "lucide-react"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Video,
    title: "Videos educativos con IA",
    description: "El docente crea videos personalizados usando IA generativa. Los estudiantes acceden a una biblioteca organizada por tema y nivel de dificultad.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Brain,
    title: "Evaluación adaptativa",
    description: "El sistema ajusta la dificultad de las preguntas automáticamente según el desempeño del estudiante en cada sesión.",
    color: "from-sky-500 to-blue-500",
  },
  {
    icon: Trophy,
    title: "Gamificación por competencias",
    description: "Gana XP, sube de nivel y desbloquea insignias al completar temas. El progreso se mide por habilidades específicas.",
    color: "from-indigo-500 to-blue-500",
  },
  {
    icon: MessageSquare,
    title: "Chatbot inteligente",
    description: "Resuelve dudas al instante con nuestro asistente de IA especializado en programación. Disponible como alternativa a los videos.",
    color: "from-violet-500 to-indigo-500",
  },
  {
    icon: BarChart3,
    title: "Tablero académico",
    description: "Monitoreo del progreso individual y análisis institucional de datos en tiempo real para docentes e instituciones.",
    color: "from-cyan-500 to-teal-500",
  },
  {
    icon: Zap,
    title: "Retroalimentación inmediata",
    description: "Recibe feedback al instante durante y después de cada video. Las preguntas aparecen en momentos clave del contenido.",
    color: "from-blue-400 to-sky-500",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Características</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            Tecnología que transforma
            <br />
            <span className="text-primary">tu aprendizaje</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Una plataforma diseñada para maximizar la comprensión y retención
            de los fundamentos de programación.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-8 rounded-3xl border border-border bg-card/50 backdrop-blur-sm hover:bg-card transition-all duration-500 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className={cn(
                "absolute inset-0 rounded-3xl bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-500",
                feature.color
              )} />
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br",
                feature.color
              )}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-border rounded-tr-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-border rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>

        {/* Para estudiantes / Para docentes */}
        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <div className="relative p-8 rounded-3xl border border-border bg-gradient-to-br from-primary/10 to-transparent overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[60px] group-hover:scale-150 transition-transform duration-700" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
                <Target className="w-4 h-4" />
                Para Estudiantes
              </div>
              <h3 className="text-2xl font-bold mb-4">Aprende a tu manera</h3>
              <ul className="space-y-3 text-muted-foreground">
                {[
                  "Elige entre videos o chatbot inteligente",
                  "Accede a la biblioteca de contenidos por tema",
                  "Responde retos durante y después de cada video",
                  "Sube de nivel y desbloquea logros",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative p-8 rounded-3xl border border-border bg-gradient-to-br from-accent/10 to-transparent overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-[60px] group-hover:scale-150 transition-transform duration-700" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium mb-4">
                <BarChart3 className="w-4 h-4" />
                Para Docentes
              </div>
              <h3 className="text-2xl font-bold mb-4">Control total del curso</h3>
              <ul className="space-y-3 text-muted-foreground">
                {[
                  "Crea cursos, temas y videos con ayuda de IA",
                  "Define la dificultad y los retos de cada video",
                  "Monitorea el progreso de cada estudiante",
                  "Identifica brechas de conocimiento con analíticas",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
