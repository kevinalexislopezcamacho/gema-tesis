"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { ByteMascot } from "@/components/byte/ByteMascot"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/contexts/auth-context"
import { runCode, detectarLenguaje, LANG_LABELS } from "@/lib/code-runner"
import { X, Play, ChevronRight, ChevronLeft, ChevronDown, Check, Trophy, RotateCcw } from "lucide-react"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-xl flex items-center justify-center" style={{ height: 180, background: "#1e1e1e" }}>
      <span className="text-[#888] text-xs">Cargando editor...</span>
    </div>
  ),
})

interface ExamQuestion {
  id: string
  tipo: "seleccion_multiple" | "codigo"
  lenguaje: string
  enunciado: string
  opciones: string[] | null
  codigoInicial: string | null
}

interface ExamResult {
  score: number
  passed: boolean
  correctCount: number
  total: number
  coinsGained: number
  courseCompleted: boolean
  results: { questionId: string; correcto: boolean; explicacion: string; respuestaCorrecta: string | null }[]
}

interface Props {
  topicId: string
  topicName: string
  onClose: () => void
  onPassed: (courseCompleted: boolean) => void
}

export function TopicExamOverlay({ topicId, topicName, onClose, onPassed }: Props) {
  const { token, getTopicExam, submitTopicExam } = useAuth()

  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState("")
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [index, setIndex] = useState(0)

  const [answers, setAnswers]   = useState<Record<string, string>>({})
  // Display order of opciones per question, shuffled once when the exam loads —
  // grading always uses each option's ORIGINAL index, this only changes what
  // order they're shown in so the correct answer isn't predictably first.
  const [optionOrder, setOptionOrder] = useState<Record<string, number[]>>({})
  const [codigoEdits, setCodigoEdits] = useState<Record<string, string>>({})
  const [stdout, setStdout]     = useState<Record<string, string | null>>({})
  const [ejecutando, setEjecutando] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]     = useState<ExamResult | null>(null)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const data = await getTopicExam(topicId)
      if (cancel) return
      if (!data) {
        setLoadError("No se pudo cargar el examen. Intenta de nuevo.")
      } else {
        setQuestions(data as ExamQuestion[])
        const inicial: Record<string, string> = {}
        const order: Record<string, number[]> = {}
        for (const q of data as ExamQuestion[]) {
          if (q.tipo === "codigo" && q.codigoInicial) inicial[q.id] = q.codigoInicial
          if (q.tipo === "seleccion_multiple" && q.opciones) {
            const idx = q.opciones.map((_, i) => i)
            for (let i = idx.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1))
              ;[idx[i], idx[j]] = [idx[j], idx[i]]
            }
            order[q.id] = idx
          }
        }
        setCodigoEdits(inicial)
        setOptionOrder(order)
      }
      setLoading(false)
    })()
    return () => { cancel = true }
    // Carga la muestra de preguntas UNA sola vez al montar y nunca más — este
    // componente vive mientras dure un intento, y topicId no cambia durante
    // su vida (una nueva materia siempre desmonta y remonta el overlay desde
    // el padre). Depender de `getTopicExam` reabría el examen a mitad de
    // camino cada vez que esa función cambiara de referencia, reemplazando
    // en silencio la muestra de preguntas por otra aleatoria distinta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = questions[index]
  const isLast  = index === questions.length - 1

  const ejecutarActual = async (): Promise<string> => {
    if (!current) return ""
    setEjecutando(true)
    const lang = detectarLenguaje(codigoEdits[current.id] ?? "", current.lenguaje)
    const { stdout: out, stderr, error } = await runCode(codigoEdits[current.id] ?? "", lang, token)
    const salida = error || (!out && stderr) ? `Error:\n${error || stderr}` : out || "(sin salida)"
    setStdout(prev => ({ ...prev, [current.id]: salida }))
    setAnswers(prev => ({ ...prev, [current.id]: salida }))
    setEjecutando(false)
    return salida
  }

  const goNext = async () => {
    if (!current) return
    // ejecutarActual() calls setAnswers(...), but that state update hasn't
    // committed yet by the time we'd read `answers` a few lines below — React
    // batches it for the next render. Capturing the freshly-returned value
    // here and handing it straight to finalizar() (instead of letting it
    // re-read the `answers` closure) is what keeps the auto-run-on-Finalizar
    // path from grading a stale/empty answer while the screen already shows
    // the correct one.
    let respuestaActual = answers[current.id]
    if (current.tipo === "codigo" && stdout[current.id] === undefined) {
      respuestaActual = await ejecutarActual()
    }
    if (isLast) {
      await finalizar({ ...answers, [current.id]: respuestaActual })
    } else {
      setIndex(i => i + 1)
    }
  }

  const finalizar = async (answersOverride?: Record<string, string>) => {
    setSubmitting(true)
    const finalAnswers = answersOverride ?? answers
    const respuestas = questions.map(q => ({ questionId: q.id, respuesta: finalAnswers[q.id] ?? "" }))
    const data = await submitTopicExam(topicId, respuestas)
    setSubmitting(false)
    if (data) {
      setResult(data)
      if (data.passed) onPassed(data.courseCompleted)
    } else {
      setLoadError("No se pudo calificar el examen. Intenta de nuevo.")
    }
  }

  const langInfo = current ? (LANG_LABELS[detectarLenguaje(codigoEdits[current.id] ?? "", current.lenguaje)] ?? LANG_LABELS.python) : LANG_LABELS.python

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border border-border shadow-2xl">
        {!result && (
          <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        )}

        {loading && (
          <div className="p-14 flex flex-col items-center gap-3">
            <Spinner className="w-6 h-6" />
            <p className="text-sm text-muted-foreground">Preparando el examen final de {topicName}...</p>
          </div>
        )}

        {!loading && loadError && !result && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <ByteMascot expression="sad" size={80} />
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        )}

        {!loading && !loadError && !result && current && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-accent uppercase tracking-wide">Examen final · {topicName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pregunta {index + 1} de {questions.length} — necesitas 80% para pasar</p>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden mb-5">
              <div className="h-full bg-accent transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
            </div>

            <p className="text-sm font-semibold mb-4">{current.enunciado}</p>

            {current.tipo === "seleccion_multiple" && current.opciones && (
              <div className="flex flex-col gap-2 mb-4">
                {(optionOrder[current.id] ?? current.opciones.map((_, i) => i)).map((i) => (
                  <button
                    key={i}
                    onClick={() => setAnswers(prev => ({ ...prev, [current.id]: String(i) }))}
                    className={`text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      answers[current.id] === String(i)
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "bg-secondary/40 border-border hover:border-primary/40"
                    }`}
                  >
                    {current.opciones![i]}
                  </button>
                ))}
              </div>
            )}

            {current.tipo === "codigo" && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${langInfo.color}`}>{langInfo.name}</span>
                  <Button size="sm" variant="outline" onClick={ejecutarActual} disabled={ejecutando} className="gap-1.5 h-7 text-xs">
                    {ejecutando ? <Spinner className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    Ejecutar
                  </Button>
                </div>
                <div className="rounded-xl overflow-hidden border border-border">
                  <MonacoEditor
                    height={180}
                    language={langInfo.monacoId}
                    theme="vs-dark"
                    value={codigoEdits[current.id] ?? ""}
                    onChange={(v) => {
                      setCodigoEdits(prev => ({ ...prev, [current.id]: v ?? "" }))
                      setStdout(prev => ({ ...prev, [current.id]: undefined as any }))
                    }}
                    options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                  />
                </div>
                {stdout[current.id] !== undefined && stdout[current.id] !== null && (
                  <div className="mt-2 p-2.5 rounded-lg bg-black/80 font-mono text-xs text-green-400 whitespace-pre-wrap">
                    {stdout[current.id]}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-5">
              <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex(i => i - 1)} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <Button
                size="sm"
                onClick={goNext}
                disabled={submitting || ejecutando || (current.tipo === "seleccion_multiple" && answers[current.id] === undefined)}
                className="gap-1"
              >
                {submitting ? <Spinner className="w-3.5 h-3.5" /> : isLast ? "Finalizar examen" : "Siguiente"}
                {!submitting && !isLast && <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <ByteMascot expression={result.passed ? "celebrating" : "sad"} size={100} />
            <div>
              <h2 className={`text-2xl font-extrabold ${result.passed ? "text-primary" : "text-destructive"}`}>
                {result.passed ? "¡Aprobaste el examen!" : "No alcanzaste el 80%"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {result.correctCount} de {result.total} correctas ({Math.round(result.score * 100)}%)
              </p>
            </div>

            {result.passed ? (
              <div className="w-full p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center gap-2 text-sm text-primary font-semibold">
                <Trophy className="w-4 h-4" /> Módulo "{topicName}" completado — siguiente módulo desbloqueado
                {result.coinsGained > 0 && <span className="font-mono">· +{result.coinsGained} monedas</span>}
              </div>
            ) : (
              <div className="w-full p-3 rounded-xl bg-secondary/50 border border-border text-xs text-muted-foreground">
                Repasa los videos que te falten y vuelve a intentarlo cuando quieras.
              </div>
            )}

            <div className="w-full flex flex-col gap-1.5 mt-2 max-h-72 overflow-y-auto text-left">
              {result.results.map((r, i) => {
                const q = questions[i]
                const isOpen = expandedIndex === i
                const miRespuesta = q ? answers[q.id] : undefined
                return (
                  <div key={r.questionId} className={`flex-shrink-0 rounded-lg overflow-hidden ${r.correcto ? "bg-primary/5" : "bg-destructive/5"}`}>
                    <button
                      onClick={() => setExpandedIndex(isOpen ? null : i)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left"
                    >
                      {r.correcto ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <X className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                      <span className="text-muted-foreground flex-1">Pregunta {i + 1}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && q && (
                      <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2">
                        <p className="text-xs font-medium">{q.enunciado}</p>
                        {q.tipo === "seleccion_multiple" && q.opciones && (
                          <div className="flex flex-col gap-1">
                            {(optionOrder[q.id] ?? q.opciones.map((_, oi) => oi)).map((oi) => {
                              const esCorrecta = String(oi) === (r.respuestaCorrecta ?? "").trim()
                              const esMia = String(oi) === miRespuesta
                              return (
                                <div key={oi} className={`px-2.5 py-1.5 rounded-lg text-xs border flex items-center justify-between gap-2 ${
                                  esCorrecta ? "border-primary bg-primary/10" : esMia ? "border-destructive bg-destructive/10" : "border-border/50 bg-secondary/20 text-muted-foreground"
                                }`}>
                                  <span>{q.opciones![oi]}</span>
                                  {esCorrecta && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                                  {esMia && !esCorrecta && <X className="w-3 h-3 text-destructive flex-shrink-0" />}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {q.tipo === "codigo" && (
                          <div className="space-y-1.5">
                            <div>
                              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Tu salida</p>
                              <pre className="bg-black/70 rounded-lg p-2 text-xs font-mono whitespace-pre-wrap text-foreground/90">{miRespuesta || "(sin respuesta)"}</pre>
                            </div>
                            {!r.correcto && r.respuestaCorrecta && (
                              <div>
                                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Salida esperada</p>
                                <pre className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-xs font-mono whitespace-pre-wrap">{r.respuestaCorrecta}</pre>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground italic">{r.explicacion}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 w-full mt-2">
              {!result.passed && (
                <Button variant="outline" className="flex-1 gap-1.5" onClick={onClose}>
                  <RotateCcw className="w-4 h-4" /> Reintentar después
                </Button>
              )}
              <Button className="flex-1" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
