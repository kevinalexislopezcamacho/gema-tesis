"use client"

import { useState } from "react"
import { Check, Lock, ChevronRight, Play, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

const topics = [
  { id: 1, name: "Tipos de Datos", icon: "{ }", status: "completed", progress: 100 },
  { id: 2, name: "Operaciones Lógicas", icon: "&&", status: "completed", progress: 100 },
  { id: 3, name: "Filtros", icon: "?:", status: "current", progress: 60 },
  { id: 4, name: "Condicionales", icon: "if", status: "locked", progress: 0 },
  { id: 5, name: "Bucles", icon: "⟳", status: "locked", progress: 0 },
  { id: 6, name: "Funciones", icon: "fn", status: "locked", progress: 0 },
  { id: 7, name: "Arreglos", icon: "[ ]", status: "locked", progress: 0 },
  { id: 8, name: "Matrices", icon: "[[ ]]", status: "locked", progress: 0 },
]

const difficultyLevels = [
  { level: "Fácil", color: "bg-sky-500", description: "Conceptos básicos" },
  { level: "Medio", color: "bg-blue-500", description: "Aplicación práctica" },
  { level: "Avanzado", color: "bg-indigo-500", description: "Retos complejos" },
]

export function LearningPathSection() {
  const [selectedTopic, setSelectedTopic] = useState(topics[2])
  const [learningMode, setLearningMode] = useState<"video" | "chatbot">("video")

  return (
    <section className="py-24 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      
      <div className="max-w-7xl mx-auto relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Tu Camino de Aprendizaje</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6 text-balance">
            Progresa a través de
            <span className="text-primary"> 8 módulos</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Cada módulo desbloquea el siguiente. Avanza a tu ritmo con videos generados por IA 
            o practica con nuestro chatbot inteligente.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Learning Path Visualization */}
          <div className="relative">
            {/* Connection line */}
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-border" />
            
            <div className="space-y-4">
              {topics.map((topic, index) => (
                <button
                  key={topic.id}
                  onClick={() => topic.status !== "locked" && setSelectedTopic(topic)}
                  disabled={topic.status === "locked"}
                  className={cn(
                    "relative w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group",
                    topic.status === "locked" 
                      ? "opacity-50 cursor-not-allowed" 
                      : "hover:bg-card/80 cursor-pointer",
                    selectedTopic.id === topic.id && "bg-card border border-primary/30 shadow-lg shadow-primary/5"
                  )}
                >
                  {/* Node */}
                  <div className={cn(
                    "relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center font-mono text-lg font-bold transition-all",
                    topic.status === "completed" && "bg-primary text-primary-foreground",
                    topic.status === "current" && "bg-primary/20 text-primary border-2 border-primary animate-pulse",
                    topic.status === "locked" && "bg-secondary text-muted-foreground"
                  )}>
                    {topic.status === "completed" ? (
                      <Check className="w-6 h-6" />
                    ) : topic.status === "locked" ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      topic.icon
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">Módulo {topic.id}</span>
                      {topic.status === "current" && (
                        <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                          En progreso
                        </span>
                      )}
                    </div>
                    <h3 className={cn(
                      "text-lg font-semibold mt-1",
                      topic.status === "locked" ? "text-muted-foreground" : "text-foreground"
                    )}>
                      {topic.name}
                    </h3>
                    
                    {/* Progress bar */}
                    {topic.status !== "locked" && (
                      <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${topic.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  {topic.status !== "locked" && (
                    <ChevronRight className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform",
                      selectedTopic.id === topic.id && "text-primary translate-x-1"
                    )} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Topic Detail Panel */}
          <div className="lg:sticky lg:top-8">
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl shadow-primary/5">
              {/* Header */}
              <div className="p-6 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center font-mono text-xl text-primary font-bold">
                    {selectedTopic.icon}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-mono">Módulo {selectedTopic.id}</span>
                    <h3 className="text-2xl font-bold">{selectedTopic.name}</h3>
                  </div>
                </div>
              </div>

              {/* Learning Mode Toggle */}
              <div className="p-6 border-b border-border">
                <p className="text-sm text-muted-foreground mb-3">Elige cómo aprender:</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setLearningMode("video")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                      learningMode === "video" 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Play className="w-5 h-5" />
                    <span className="font-medium">Videos IA</span>
                  </button>
                  <button
                    onClick={() => setLearningMode("chatbot")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                      learningMode === "chatbot" 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-medium">Chatbot</span>
                  </button>
                </div>
              </div>

              {/* Difficulty Levels */}
              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-4">Niveles de dificultad:</p>
                <div className="space-y-3">
                  {difficultyLevels.map((diff, i) => (
                    <div 
                      key={diff.level}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 transition-all cursor-pointer group",
                        i === 0 && selectedTopic.progress >= 33 && "border-primary/30 bg-primary/5",
                        i === 1 && selectedTopic.progress >= 66 && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <div className={cn("w-3 h-3 rounded-full", diff.color)} />
                      <div className="flex-1">
                        <span className="font-medium">{diff.level}</span>
                        <p className="text-xs text-muted-foreground">{diff.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm text-muted-foreground">3 videos</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="p-6 bg-secondary/30">
                <button className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25">
                  Continuar aprendiendo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
