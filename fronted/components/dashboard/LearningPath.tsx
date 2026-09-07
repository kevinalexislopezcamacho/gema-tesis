"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Lock, CheckCircle2, ShieldAlert, Loader2, Play, Flag, X } from "lucide-react"
import { ByteMascot, type ByteColor, type ByteOutfit, type ByteExpression } from "@/components/byte/ByteMascot"
import type { CourseTopic } from "@/hooks/use-topics"
import { useTour } from "@/contexts/tour-context"

export type PathTopic = CourseTopic

export interface PathDifficultyLevel {
  id: string
  label: string
  color: string   // tailwind bg-* class for the dot
  text: string    // tailwind text-* class
  xp: number
}

interface Props {
  topics: PathTopic[]
  difficultyLevels: PathDifficultyLevel[]
  selectedTopic: string | null
  onSelectTopic: (topicId: string) => void
  onSelectDifficulty: (topic: PathTopic, nivel: string) => void
  onTakeExam: (topic: PathTopic) => void
  getTopicStatus: (topicId: string, index: number) => "locked" | "available" | "completed"
  watchedCount: (topicId: string) => number
  isLevelWatched: (topicId: string, nivel: string) => boolean
  loadingVideo: boolean
  byteColor: ByteColor
  byteOutfit: ByteOutfit
  byteStyle: string
}

const SPACING = 130
const PAD_TOP = 60

// Procedural winding x-position (percent of container width) for node `i` of
// `total` — a damped sine zigzag so the path still looks hand-drawn for any
// module count, instead of the original fixed 8-value array only being
// "correct" for exactly 8 topics.
function xPosFor(i: number, total: number): number {
  if (total <= 1) return 50
  // Amplitud reducida (antes 38) para que los nodos de los extremos no se
  // recorten en pantallas angostas — con ancho de nodo 130px, 26% deja
  // margen positivo incluso en un contenedor de ~320px (el más angosto
  // razonable en un celular).
  return 50 + 26 * Math.sin((i / (total - 1)) * Math.PI * 1.8)
}

const STYLE_TO_EXPRESSION: Record<string, ByteExpression> = {
  feliz: "happy", emocionado: "excited", pensativo: "thinking", celebrando: "celebrating",
  triste: "sad", estudioso: "studying", saludando: "waving", sorprendido: "surprised", durmiendo: "sleeping",
}

type Point = { x: number; y: number }

function catmullRom(points: Point[]): string {
  if (points.length < 2) return ""
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

export function LearningPath({
  topics, difficultyLevels, selectedTopic, onSelectTopic, onSelectDifficulty, onTakeExam,
  getTopicStatus, watchedCount, isLevelWatched, loadingVideo,
  byteColor, byteOutfit, byteStyle,
}: Props) {
  const [pressedNode, setPressedNode] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  // El tour resalta todo este camino como spotlight — mientras está activo,
  // las mascotas decorativas (que también viven dentro de este contenedor)
  // quedarían igual de "sin oscurecer" que el propio spotlight y se verían
  // como una segunda mascota superpuesta al tooltip. Se ocultan mientras
  // dura el tour para evitar ese choque visual.
  const { tourActive } = useTour()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const statuses = topics.map((t, i) => getTopicStatus(t.id, i))
  const completedCount = statuses.filter(s => s === "completed").length
  const totalHeight = PAD_TOP * 2 + (topics.length - 1) * SPACING + 30

  const points: Point[] = topics.map((_, i) => ({ x: xPosFor(i, topics.length), y: PAD_TOP + i * SPACING }))
  const pathD = catmullRom(points)
  const progressD = completedCount > 0 ? catmullRom(points.slice(0, completedCount + 1)) : null

  const expression = STYLE_TO_EXPRESSION[byteStyle] ?? "happy"
  const selectedIndex = selectedTopic ? topics.findIndex(t => t.id === selectedTopic) : -1

  return (
    <div>
      <style jsx>{`
        @keyframes lp-dash-flow { to { stroke-dashoffset: -24; } }
        @keyframes lp-pulse-ring { 0% { transform: scale(1); opacity: .55; } 70% { transform: scale(1.45); opacity: 0; } 100% { transform: scale(1.45); opacity: 0; } }
        @keyframes lp-pop-in { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes lp-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes lp-sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes lp-celebrate { 0%, 100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.07, 0.94) translateY(-8px); } }
        @keyframes lp-panel-in { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .lp-dash { animation: lp-dash-flow 2.5s linear infinite; }
        .lp-pulse { animation: lp-pulse-ring 2.2s ease-out infinite; }
        .lp-pop { animation: lp-pop-in .3s ease-out; }
        .lp-bob { animation: lp-bob 3.4s ease-in-out infinite; }
        .lp-bob-slow { animation: lp-bob 3.8s ease-in-out infinite .6s; }
        .lp-sway { animation: lp-sway 2.6s ease-in-out infinite; }
        .lp-celebrate { animation: lp-celebrate 1.3s ease-in-out infinite; }
        .lp-panel { animation: lp-panel-in .18s ease-out; }
      `}</style>

      <div data-tour-id="learning-path-heading" className="scroll-mt-24 flex items-center justify-between mb-6">
        <div>
          <h2 className="font-semibold">Camino de aprendizaje</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Completa los 3 niveles de cada módulo para desbloquear el siguiente</p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{completedCount}/{topics.length}</span>
      </div>

      <div ref={containerRef} className="relative w-full overflow-x-hidden" style={{ height: totalHeight }}>
        {/* Marcador invisible usado SOLO como target del tour guiado: cubre
            justo los primeros ~2.5 nodos del camino (altura acotada, cabe
            en cualquier viewport) para que el spotlight ilumine módulos
            reales en vez de solo una línea de texto — sin heredar la altura
            completa del camino (que puede superar 1000px con 8 módulos y
            rompía el posicionamiento del tooltip). */}
        <div
          data-tour-id="learning-path-preview"
          className="absolute inset-x-0 top-0 scroll-mt-24 pointer-events-none"
          style={{ height: Math.min(totalHeight, PAD_TOP + SPACING * 2.4) }}
        />

        {/* Byte companion, left side (~30% down the path). Anclado a los
            bordes (left:0 / right:0) en vez de un porcentaje — así nunca se
            sale del contenedor sin importar el ancho. Oculto por debajo de
            lg: son puro adorno y en pantallas angostas solo generaban
            desorden/overlap con el primer nodo. */}
        {!tourActive && (
          <div className="hidden lg:flex lp-bob absolute flex-col items-center gap-2 z-[2]" style={{ left: 0, top: totalHeight * 0.3, width: 170 }}>
            <div className="lp-sway">
              <ByteMascot expression={expression} color={byteColor} outfit={byteOutfit} size={150} />
            </div>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full whitespace-nowrap">¡Tú puedes!</span>
          </div>
        )}

        {/* Byte companion, right side (~70% down the path) */}
        {!tourActive && (
          <div className="hidden lg:flex lp-bob-slow absolute flex-col items-center gap-2 z-[2]" style={{ right: 0, top: totalHeight * 0.7, width: 150 }}>
            <div className="lp-celebrate">
              <ByteMascot expression={expression} color={byteColor} outfit={byteOutfit} size={130} />
            </div>
            <span className="text-[11px] font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full whitespace-nowrap">¡Ya casi!</span>
          </div>
        )}

        <p
          className="absolute text-[11px] font-bold tracking-widest uppercase text-muted-foreground m-0 z-[8]"
          style={{ left: `${xPosFor(0, topics.length)}%`, top: -18, transform: "translateX(-50%)" }}
        >
          Inicio
        </p>

        <svg viewBox={`0 0 100 ${totalHeight}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <linearGradient id="lpPathGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" />
              <stop offset="1" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <path d={pathD} fill="none" stroke="var(--border)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.5 1.4" className="lp-dash" />
          {progressD && (
            <path d={progressD} fill="none" stroke="url(#lpPathGrad)" strokeWidth="1.6" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px oklch(0.6 0.19 300 / 0.45))" }} />
          )}
        </svg>

        {topics.map((topic, i) => {
          const status = statuses[i]
          const isSelected = selectedTopic === topic.id
          const isPressed = pressedNode === topic.id
          const xPct = xPosFor(i, topics.length)
          const yPx = PAD_TOP + i * SPACING

          let bg: string, fg: string, border: string, boxShadow: string
          if (status === "completed") {
            bg = "var(--primary)"; fg = "var(--primary-foreground)"
            border = "3px solid var(--primary)"
            boxShadow = isSelected ? "0 2px 0 color-mix(in oklch, var(--primary) 75%, black)" : "0 6px 0 color-mix(in oklch, var(--primary) 75%, black)"
          } else if (status === "locked") {
            bg = "var(--secondary)"; fg = "var(--locked)"
            border = "2px solid var(--border)"
            boxShadow = "0 5px 0 var(--border)"
          } else {
            bg = "var(--card)"; fg = "var(--primary)"
            border = "3px solid var(--primary)"
            boxShadow = isSelected ? "0 2px 0 color-mix(in oklch, var(--primary) 80%, black)" : "0 6px 0 color-mix(in oklch, var(--primary) 80%, black)"
          }

          return (
            <div
              key={topic.id}
              data-tour-id={`topic-node-${topic.id}`}
              className="absolute flex flex-col items-center gap-2.5 z-[5]"
              style={{ left: `${xPct}%`, top: yPx, transform: "translate(-50%, -50%)", width: 130 }}
            >
              <button
                onClick={() => {
                  if (status === "locked") return
                  onSelectTopic(topic.id)
                }}
                onMouseDown={() => setPressedNode(topic.id)}
                onMouseUp={() => setPressedNode(null)}
                onMouseLeave={() => setPressedNode(null)}
                disabled={status === "locked"}
                className="relative focus:outline-none"
                style={{ width: 84, height: 84, cursor: status === "locked" ? "not-allowed" : "pointer" }}
              >
                {status === "available" && (
                  <span className="lp-pulse absolute inset-0 rounded-full" style={{ background: "color-mix(in oklch, var(--primary) 35%, transparent)" }} />
                )}
                <div
                  className={`relative w-[84px] h-[84px] rounded-full flex items-center justify-center font-mono text-[17px] font-bold transition-transform ${status === "completed" ? "lp-pop" : ""}`}
                  style={{
                    background: bg, color: fg, border, boxShadow,
                    transform: isSelected && isPressed ? "translateY(3px)" : "translateY(0)",
                  }}
                >
                  {status === "completed" ? <CheckCircle2 className="w-5 h-5" /> : status === "locked" ? <Lock className="w-4 h-4" /> : topic.icon}
                </div>
              </button>
              <p
                className="text-center text-xs font-bold m-0 leading-tight"
                style={{ color: status === "locked" ? "var(--locked)" : "var(--foreground)", maxWidth: 122 }}
              >
                {topic.name}
              </p>
            </div>
          )
        })}

        <p
          className="absolute flex items-center gap-1 text-[11px] font-bold tracking-widest uppercase text-muted-foreground m-0"
          style={{ left: `${xPosFor(topics.length - 1, topics.length)}%`, top: PAD_TOP + (topics.length - 1) * SPACING, transform: "translate(-50%, 78px)" }}
        >
          <Flag className="w-3 h-3" /> Meta
        </p>

        {/* Popover */}
        {selectedIndex >= 0 && (() => {
          const topic = topics[selectedIndex]
          const status = statuses[selectedIndex]
          const xPct = xPosFor(selectedIndex, topics.length)
          const yPx = PAD_TOP + selectedIndex * SPACING
          const watched = watchedCount(topic.id)

          // Ancho y posición del popover en píxeles reales, acotados al
          // contenedor medido — así nunca se sale de la pantalla en
          // celulares angostos, sin importar dónde caiga el nodo en el
          // zigzag. Antes de la primera medición (containerWidth === 0)
          // se usa un fallback centrado por porcentaje para el primer
          // render.
          const popoverWidthPx = containerWidth > 0 ? Math.min(300, containerWidth * 0.92) : 300
          let popoverStyle: CSSProperties
          if (containerWidth > 0) {
            const nodeCenterPx = (xPct / 100) * containerWidth
            const margin = 10
            const leftPx = Math.max(
              margin,
              Math.min(nodeCenterPx - popoverWidthPx / 2, containerWidth - popoverWidthPx - margin)
            )
            popoverStyle = { left: leftPx, top: yPx + 60, width: popoverWidthPx }
          } else {
            popoverStyle = { left: `${xPct}%`, top: yPx + 60, transform: "translateX(-50%)", width: popoverWidthPx }
          }

          return (
            <>
              <div className="fixed inset-0 z-20" style={{ background: "oklch(0.2 0.02 265 / 0.15)" }} onClick={() => onSelectTopic(topic.id)} />
              <div
                data-tour-id="difficulty-popover"
                className="lp-panel absolute z-30"
                style={popoverStyle}
              >
                <div className="relative rounded-2xl border border-border bg-card p-4 shadow-xl">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm m-0">{topic.name}</h3>
                    <button onClick={() => onSelectTopic(topic.id)} className="text-muted-foreground leading-none"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{topic.description}</p>

                  {watched === 3 && status === "completed" && (
                    <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary text-center font-semibold mb-2.5 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> ¡Módulo completado! Siguiente módulo desbloqueado.
                    </div>
                  )}

                  {watched === 3 && status !== "completed" && (
                    <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 mb-2.5">
                      <p className="text-xs text-foreground text-center font-semibold mb-2 flex items-center justify-center gap-1.5">
                        <Flag className="w-3.5 h-3.5 flex-shrink-0" /> Ya viste los 3 niveles — falta el examen final
                      </p>
                      <button
                        onClick={() => onTakeExam(topic)}
                        className="w-full py-2 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        Tomar examen final
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-1.5 mb-2.5">
                    <ShieldAlert className="w-3 h-3 text-yellow-600 flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground m-0">Ver al menos 85% del video para ganar XP</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {difficultyLevels.map((level, i) => {
                      const seen = isLevelWatched(topic.id, level.id)
                      // Each level requires the previous one to be watched first —
                      // fácil is always open, medio needs fácil, avanzado needs medio.
                      const levelLocked = i > 0 && !isLevelWatched(topic.id, difficultyLevels[i - 1].id)
                      return (
                        <button
                          key={level.id}
                          onClick={() => !levelLocked && onSelectDifficulty(topic, level.id)}
                          disabled={loadingVideo || levelLocked}
                          title={levelLocked ? `Completa "${difficultyLevels[i - 1].label}" primero` : undefined}
                          className={`relative min-w-0 p-2.5 rounded-xl border transition-all text-left group disabled:opacity-50 ${
                            levelLocked ? "cursor-not-allowed" : ""
                          } ${
                            seen ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-primary/40"
                          }`}
                        >
                          {seen && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          {levelLocked && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-muted-foreground/70 flex items-center justify-center">
                              <Lock className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          <div className={`w-2 h-2 rounded-full ${level.color} mb-1.5`} />
                          <p className={`font-semibold text-xs m-0 break-words ${seen ? "text-primary" : level.text}`}>{level.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">+{seen ? Math.floor(level.xp * 0.4) : level.xp} XP</p>
                          <div className="mt-2 flex items-center justify-center h-4">
                            {levelLocked ? null : loadingVideo ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <Play className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
