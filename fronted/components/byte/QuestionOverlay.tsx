"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { ByteMascot } from "./ByteMascot"
import { Button } from "@/components/ui/button"
import { Loader2, Play, Send, Eye, ArrowLeft, Check, X, RefreshCw, Lightbulb, ChevronRight, AlertTriangle } from "lucide-react"
import { runCode, detectarLenguaje, LANG_LABELS } from "@/lib/code-runner"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

// Monaco loads from CDN — skip SSR
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl flex items-center justify-center"
      style={{ height: 200, background: "#1e1e1e" }}
    >
      <span className="text-[#888] text-xs">Cargando editor...</span>
    </div>
  ),
})

export interface OverlayQuestion {
  id: string
  slideIndex: number
  triggerTimeSec: number
  tipo: "seleccion_multiple" | "codigo" | "abierta"
  lenguaje?: string | null
  enunciado: string
  opciones?: string[] | null
  codigoInicial?: string | null
}

interface Props {
  question: OverlayQuestion
  token: string | null
  onAnswered: (correcto: boolean) => void
}

interface Resultado {
  correcto: boolean
  explicacion: string
  respuestaCorrecta?: string
  codigoSolucion?: string | null
}

const HINT_DELAY: Record<OverlayQuestion["tipo"], number> = {
  seleccion_multiple: 25,
  abierta:            40,
  codigo:             50,
}

// For existing data where GPT embedded the code inside the enunciado text
function separarEnunciadoCodigo(
  enunciado: string,
  codigoInicial: string | null | undefined
): { texto: string; codigo: string } {
  if (codigoInicial?.trim()) return { texto: enunciado, codigo: codigoInicial }

  const colonIdx = enunciado.indexOf(':')
  if (colonIdx > 15 && colonIdx < enunciado.length - 30) {
    const afterColon = enunciado.slice(colonIdx + 1).trim()
    const CODE_MARKERS = [
      '#include', 'public class', 'def ', 'cout', 'System.out', 'console.log',
      '# completar', '// completar', 'print(', 'int main', 'function ',
    ]
    if (CODE_MARKERS.some(m => afterColon.includes(m))) {
      return { texto: enunciado.slice(0, colonIdx).trim(), codigo: afterColon }
    }
  }
  return { texto: enunciado, codigo: '' }
}

function generarPistas(q: OverlayQuestion, lang: string): string[] {
  if (q.tipo === "codigo") {
    const isPython     = lang === 'python'
    const tieneTriple  = q.codigoInicial?.includes("???") || q.codigoInicial?.includes("/* AQUÍ */")
    const tieneCompl   = q.codigoInicial?.includes("completar")
    const esDesde0     = q.codigoInicial?.includes("Comienza a programar")
    const indentNote   = isPython
      ? "No olvides la indentación — Python usa espacios o tab al inicio de cada línea dentro de la estructura."
      : "Asegúrate de poner las instrucciones dentro de las llaves {} y respetar la indentación."

    if (tieneTriple) return [
      "Busca el marcador ??? (o /* AQUÍ */) — ese es exactamente el único lugar donde debes escribir algo.",
      "Piensa: ¿qué valor, variable o expresión debería producir la salida que pide el enunciado?",
      "Ejecuta el código tal como está para ver el error. Eso te dice qué tipo de dato espera ahí.",
    ]
    if (tieneCompl) return [
      `Hay una estructura con el marcador ${isPython ? '# completar aquí' : '// completar aquí'} adentro. Solo debes llenar ese bloque.`,
      "Piensa instrucción a instrucción: ¿qué pasos necesita ese bloque para cumplir el objetivo?",
      indentNote,
    ]
    if (esDesde0) return [
      "Empieza desde la primera instrucción: ¿qué dato tienes? ¿qué necesitas calcular o imprimir?",
      "Escribe una línea, ejecútala para ver si avanzas, y sigue desde ahí.",
      "Compara tu salida con lo que pide el enunciado. La diferencia te dice qué ajustar.",
    ]
    return [
      "Lee el enunciado y mira el código — ahí está la clave de lo que falta.",
      "Ejecuta primero para ver qué produce actualmente y qué debería producir.",
      "Compara tu salida con la salida esperada línea a línea.",
    ]
  }

  if (q.tipo === "seleccion_multiple") return [
    "Elimina primero las opciones que definitivamente no pueden ser correctas.",
    "Piensa en lo que el video explicó justo antes de esta pregunta. La respuesta está directamente ahí.",
    "Si dudas entre dos opciones, elige la más directamente relacionada con lo que Byte explicó.",
  ]

  return [
    "No necesitas usar las palabras exactas del video. Explica con tus propias palabras.",
    "Una o dos oraciones claras es suficiente. Menciona el concepto principal y para qué sirve.",
    "Piensa: si le explicaras esto a un amigo que no lo vio, ¿qué le dirías? Escribe eso.",
  ]
}

export function QuestionOverlay({ question, token, onAnswered }: Props) {
  const { texto: enunciadoTexto, codigo: codigoExtraido } = separarEnunciadoCodigo(
    question.enunciado,
    question.codigoInicial
  )

  const [seleccion,  setSeleccion]  = useState<number | null>(null)
  const [codigo,     setCodigo]     = useState(question.codigoInicial?.trim() || codigoExtraido)
  const [textoLibre, setTextoLibre] = useState("")
  const [stdout,     setStdout]     = useState<string | null>(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [enviando,   setEnviando]   = useState(false)
  const [resultado,  setResultado]  = useState<Resultado | null>(null)
  const [revisando,  setRevisando]  = useState(false)

  const [elapsed,          setElapsed]          = useState(0)
  const [hintOpen,         setHintOpen]         = useState(false)
  const [currentHintIndex, setCurrentHintIndex] = useState(0)

  // Display order for opciones is shuffled per question instance so the correct
  // answer isn't predictably in the same position — grading still uses each
  // option's ORIGINAL index, so nothing downstream needs to know about this.
  const shuffledIndices = useMemo(() => {
    const n = question.opciones?.length ?? 0
    const idx = Array.from({ length: n }, (_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx
  }, [question.id])

  const lang      = detectarLenguaje(codigo, question.lenguaje)
  const langInfo  = LANG_LABELS[lang] ?? LANG_LABELS['python']
  const hints     = generarPistas(question, lang)
  const delay     = HINT_DELAY[question.tipo]
  const showHintBtn = elapsed >= delay && !resultado

  useEffect(() => {
    if (resultado) return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [resultado])

  const yaRespondida = resultado !== null

  const retry = () => {
    setResultado(null)
    setSeleccion(null)
    setCodigo(question.codigoInicial?.trim() || codigoExtraido)
    setTextoLibre("")
    setStdout(null)
    setRevisando(false)
    setHintOpen(false)
    setCurrentHintIndex(0)
    setElapsed(0)
  }

  const ejecutarCodigo = async (): Promise<string> => {
    setEjecutando(true)
    const { stdout: out, stderr, error } = await runCode(codigo, lang, token)
    const salida = error || (!out && stderr) ? `Error:\n${error || stderr}` : out || "(sin salida)"
    setStdout(salida)
    setEjecutando(false)
    return salida
  }

  const enviar = async () => {
    let respuesta: string

    if (question.tipo === "seleccion_multiple") {
      if (seleccion === null) return
      respuesta = String(seleccion)
    } else if (question.tipo === "codigo") {
      respuesta = stdout !== null ? stdout : await ejecutarCodigo()
    } else {
      if (!textoLibre.trim()) return
      respuesta = textoLibre.trim()
    }

    setEnviando(true)
    try {
      const r = await fetch(`${API}/questions/${question.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ respuesta }),
      })
      const d = await r.json()
      if (d.success) {
        setResultado({
          correcto: d.data.correcto,
          explicacion: d.data.explicacion,
          respuestaCorrecta: d.data.respuestaCorrecta,
          codigoSolucion: d.data.codigoSolucion,
        })
      } else {
        setResultado({ correcto: false, explicacion: d.error || "No se pudo calificar la respuesta." })
      }
    } catch {
      setResultado({ correcto: false, explicacion: "Error de conexión al calificar la respuesta." })
    }
    setEnviando(false)
  }

  // ── Pantalla de resultado ────────────────────────────────────────────────
  if (resultado && !revisando) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 rounded-xl">
        <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <ByteMascot expression={resultado.correcto ? "celebrating" : "sad"} size={110} />
            <div>
              <h2 className={`text-xl font-bold mb-2 ${resultado.correcto ? "text-green-400" : "text-destructive"}`}>
                {resultado.correcto ? "¡Correcto!" : "Respuesta incorrecta"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{resultado.explicacion}</p>
            </div>

            {resultado.correcto ? (
              <div className="flex flex-col gap-2 w-full">
                <Button onClick={() => onAnswered(true)} className="w-full bg-primary hover:bg-primary/90">
                  Continuar el video
                </Button>
                <Button variant="outline" onClick={() => setRevisando(true)} className="w-full gap-2">
                  <Eye className="w-4 h-4" />Revisar la pregunta
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                {resultado.codigoSolucion && (
                  <div className="w-full rounded-2xl border border-amber-500/40 bg-amber-500/5 overflow-hidden text-left mb-1">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-amber-500/25 bg-amber-500/10">
                      <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs font-bold text-amber-600">Fallaste 3 veces seguidas — aquí tienes la solución</p>
                    </div>
                    <pre className="p-3.5 text-xs font-mono whitespace-pre-wrap text-foreground/90">{resultado.codigoSolucion}</pre>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Debes responder correctamente para continuar el video.</p>
                <Button onClick={retry} className="w-full bg-primary hover:bg-primary/90 gap-2">
                  <RefreshCw className="w-4 h-4" />Intentar de nuevo
                </Button>
                <Button variant="outline" onClick={() => setRevisando(true)} className="w-full gap-2">
                  <Eye className="w-4 h-4" />Ver la respuesta correcta
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 rounded-xl overflow-y-auto">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-auto">
        <div className="p-6">

          {revisando && (
            <button
              onClick={() => setRevisando(false)}
              className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />Volver al resultado
            </button>
          )}

          {/* Header: Byte + enunciado */}
          <div className="flex items-start gap-3 mb-4">
            <ByteMascot
              expression={revisando && resultado ? (resultado.correcto ? "happy" : "sad") : "thinking"}
              size={48}
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">
                {question.tipo === "codigo" ? "Pregunta de código" : question.tipo === "abierta" ? "Pregunta abierta" : "Selección múltiple"}
              </p>
              <p className="text-sm font-medium leading-snug">{enunciadoTexto}</p>
            </div>
          </div>

          {/* ── Selección múltiple ──────────────────────────────────────────── */}
          {question.tipo === "seleccion_multiple" && question.opciones && (
            <div className="space-y-2 mb-4">
              {shuffledIndices.map((i) => {
                const op = question.opciones![i]
                const correctaRaw  = resultado?.respuestaCorrecta ?? ''
                const esCorrecta   = revisando && correctaRaw !== '' && (
                  String(i) === correctaRaw.trim() ||
                  op.toLowerCase().trim() === correctaRaw.toLowerCase().trim()
                )
                const esElegidaMal = revisando && seleccion === i && !esCorrecta
                return (
                  <button
                    key={i}
                    onClick={() => !yaRespondida && setSeleccion(i)}
                    disabled={yaRespondida}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors flex items-center justify-between gap-2 ${
                      esCorrecta     ? "border-green-500 bg-green-500/10 text-foreground"
                      : esElegidaMal ? "border-destructive bg-destructive/10 text-foreground"
                      : seleccion === i ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary/30 text-muted-foreground"
                    } ${yaRespondida ? "cursor-default" : "hover:bg-secondary/50"}`}
                  >
                    <span>{op}</span>
                    {esCorrecta    && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
                    {esElegidaMal  && <X     className="w-4 h-4 text-destructive flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Código ─────────────────────────────────────────────────────── */}
          {question.tipo === "codigo" && (
            <div className="mb-4 space-y-2">
              {/* Editor header with language badge */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Editor
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${langInfo.color}`}>
                  {langInfo.name}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Monaco Editor */}
              <div className="rounded-xl overflow-hidden border border-border">
                <MonacoEditor
                  height={200}
                  language={langInfo.monacoId}
                  theme="vs-dark"
                  value={codigo}
                  onChange={v => { if (!yaRespondida) { setCodigo(v ?? ''); setStdout(null) } }}
                  options={{
                    readOnly:               yaRespondida,
                    minimap:                { enabled: false },
                    lineNumbers:            'on',
                    fontSize:               13,
                    fontFamily:             "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
                    scrollBeyondLastLine:   false,
                    automaticLayout:        true,
                    wordWrap:               'on',
                    tabSize:                4,
                    insertSpaces:           true,
                    folding:                false,
                    renderLineHighlight:    'all',
                    overviewRulerBorder:    false,
                    hideCursorInOverviewRuler: true,
                    scrollbar:              { vertical: 'auto', horizontal: 'auto', verticalScrollbarSize: 6 },
                    padding:                { top: 10, bottom: 10 },
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={ejecutarCodigo} disabled={ejecutando || yaRespondida} className="gap-2">
                  {ejecutando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {ejecutando ? "Ejecutando..." : "Ejecutar"}
                </Button>
                {stdout !== null && (
                  <span className={`text-[10px] inline-flex items-center gap-1 ${stdout.startsWith("Error") ? "text-destructive" : "text-green-400"}`}>
                    {stdout.startsWith("Error") ? <><AlertTriangle className="w-3 h-3" /> Error</> : <><Check className="w-3 h-3" /> Ejecutado</>}
                  </span>
                )}
              </div>

              {stdout !== null && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Salida</p>
                  <pre className={`border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap ${
                    stdout.startsWith("Error") ? "bg-destructive/5 border-destructive/30 text-destructive" : "bg-black/50 border-border"
                  }`}>{stdout}</pre>
                </div>
              )}

              {revisando && resultado?.respuestaCorrecta && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Salida esperada</p>
                  <pre className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">{resultado.respuestaCorrecta}</pre>
                </div>
              )}
            </div>
          )}

          {/* ── Abierta ────────────────────────────────────────────────────── */}
          {question.tipo === "abierta" && (
            <div className="mb-4 space-y-2">
              <textarea
                value={textoLibre}
                onChange={e => !yaRespondida && setTextoLibre(e.target.value)}
                readOnly={yaRespondida}
                rows={4}
                placeholder="Escribe tu respuesta con tus propias palabras..."
                className="w-full text-sm bg-secondary/50 border border-border rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {revisando && resultado?.respuestaCorrecta && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Respuesta de referencia</p>
                  <p className="text-xs bg-green-500/10 border border-green-500/30 rounded-lg p-3">{resultado.respuestaCorrecta}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Botón de envío ──────────────────────────────────────────────── */}
          {!revisando && (
            <Button onClick={enviar} disabled={enviando} className="w-full bg-primary hover:bg-primary/90 gap-2">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {question.tipo === "codigo" && stdout === null ? "Ejecutar y enviar" : "Enviar respuesta"}
            </Button>
          )}
          {revisando && (
            <Button onClick={() => setRevisando(false)} className="w-full bg-primary hover:bg-primary/90 gap-2">
              <ArrowLeft className="w-4 h-4" />Volver al resultado
            </Button>
          )}

          {/* ── Sistema de pistas ───────────────────────────────────────────── */}
          {showHintBtn && !revisando && (
            <div className="mt-3 border-t border-border/60 pt-3">
              {!hintOpen ? (
                <button
                  onClick={() => setHintOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-semibold hover:bg-amber-500/20 transition-all animate-pulse"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  ¿Necesitas una pista?
                </button>
              ) : (
                <div className="rounded-xl bg-amber-500/8 border border-amber-500/25 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] font-bold tracking-widest text-amber-600 uppercase">
                        Pista {currentHintIndex + 1} de {hints.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setHintOpen(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ocultar
                    </button>
                  </div>

                  <div className="p-3 flex items-start gap-3">
                    <ByteMascot expression="thinking" size={44} className="flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs leading-relaxed text-foreground/90">
                        {hints[currentHintIndex]}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {hints.map((_, i) => (
                          <div key={i} className={`h-1.5 rounded-full transition-all ${
                            i <= currentHintIndex ? "w-4 bg-amber-500" : "w-1.5 bg-border"
                          }`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {currentHintIndex < hints.length - 1 && (
                    <div className="px-3 pb-3">
                      <button
                        onClick={() => setCurrentHintIndex(i => i + 1)}
                        className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold hover:text-amber-700 transition-colors"
                      >
                        Ver siguiente pista <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
