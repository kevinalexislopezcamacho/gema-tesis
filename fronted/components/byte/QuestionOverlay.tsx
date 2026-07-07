"use client"

import { useState } from "react"
import { ByteMascot } from "./ByteMascot"
import { Button } from "@/components/ui/button"
import { Loader2, Play, Send, Eye, ArrowLeft, Check, X, RefreshCw } from "lucide-react"
import { runPythonCapture } from "@/lib/pyodide-runner"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

export interface OverlayQuestion {
  id: string
  slideIndex: number
  triggerTimeSec: number
  tipo: "seleccion_multiple" | "codigo" | "abierta"
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
}

export function QuestionOverlay({ question, token, onAnswered }: Props) {
  const [seleccion,   setSeleccion]   = useState<number | null>(null)
  const [codigo,      setCodigo]      = useState(question.codigoInicial ?? "")
  const [textoLibre,  setTextoLibre]  = useState("")
  const [stdout,      setStdout]      = useState<string | null>(null)
  const [ejecutando,  setEjecutando]  = useState(false)
  const [enviando,    setEnviando]    = useState(false)
  const [resultado,   setResultado]   = useState<Resultado | null>(null)
  const [revisando,   setRevisando]   = useState(false)

  const yaRespondida = resultado !== null

  const retry = () => {
    setResultado(null)
    setSeleccion(null)
    setCodigo(question.codigoInicial ?? "")
    setTextoLibre("")
    setStdout(null)
    setRevisando(false)
  }

  const ejecutarCodigo = async () => {
    setEjecutando(true)
    const { stdout: out, error } = await runPythonCapture(codigo)
    setStdout(error ? `Error: ${error}` : out || "(sin salida)")
    setEjecutando(false)
  }

  const enviar = async () => {
    let respuesta: string

    if (question.tipo === "seleccion_multiple") {
      if (seleccion === null) return
      respuesta = String(seleccion)
    } else if (question.tipo === "codigo") {
      if (stdout === null) { await ejecutarCodigo(); return }
      respuesta = stdout
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
        setResultado({ correcto: d.data.correcto, explicacion: d.data.explicacion, respuestaCorrecta: d.data.respuestaCorrecta })
      } else {
        setResultado({ correcto: false, explicacion: d.error || "No se pudo calificar la respuesta." })
      }
    } catch {
      setResultado({ correcto: false, explicacion: "Error de conexión al calificar la respuesta." })
    }
    setEnviando(false)
  }

  // ── Pantalla de resultado (feedback inmediato tras calificar) ────────────
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

  // ── Formulario de la pregunta (modo normal o modo revisión de solo lectura) ──
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

          <div className="flex items-center gap-3 mb-4">
            <ByteMascot expression={revisando ? (resultado!.correcto ? "happy" : "thinking") : "thinking"} size={56} />
            <p className="text-sm font-medium flex-1">{question.enunciado}</p>
          </div>

          {question.tipo === "seleccion_multiple" && question.opciones && (
            <div className="space-y-2 mb-4">
              {question.opciones.map((op, i) => {
                const esCorrecta   = revisando && resultado?.respuestaCorrecta !== undefined && String(i) === resultado.respuestaCorrecta
                const esElegidaMal = revisando && seleccion === i && !esCorrecta
                return (
                  <button
                    key={i}
                    onClick={() => !yaRespondida && setSeleccion(i)}
                    disabled={yaRespondida}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors flex items-center justify-between gap-2 ${
                      esCorrecta
                        ? "border-green-500 bg-green-500/10 text-foreground"
                        : esElegidaMal
                        ? "border-destructive bg-destructive/10 text-foreground"
                        : seleccion === i
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground"
                    } ${yaRespondida ? "cursor-default" : "hover:bg-secondary/50"}`}
                  >
                    <span>{op}</span>
                    {esCorrecta && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
                    {esElegidaMal && <X className="w-4 h-4 text-destructive flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}

          {question.tipo === "codigo" && (
            <div className="mb-4 space-y-2">
              <textarea
                value={codigo}
                onChange={e => { if (!yaRespondida) { setCodigo(e.target.value); setStdout(null) } }}
                readOnly={yaRespondida}
                rows={6}
                className="w-full font-mono text-sm bg-secondary/50 border border-border rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button variant="outline" size="sm" onClick={ejecutarCodigo} disabled={ejecutando} className="gap-2">
                {ejecutando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Ejecutar
              </Button>
              {stdout !== null && (
                <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">{stdout}</pre>
              )}
              {revisando && resultado?.respuestaCorrecta && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Salida esperada:</p>
                  <pre className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">{resultado.respuestaCorrecta}</pre>
                </div>
              )}
            </div>
          )}

          {question.tipo === "abierta" && (
            <div className="mb-4 space-y-2">
              <textarea
                value={textoLibre}
                onChange={e => !yaRespondida && setTextoLibre(e.target.value)}
                readOnly={yaRespondida}
                rows={4}
                placeholder="Escribe tu respuesta..."
                className="w-full text-sm bg-secondary/50 border border-border rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {revisando && resultado?.respuestaCorrecta && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Respuesta de referencia:</p>
                  <p className="text-xs bg-green-500/10 border border-green-500/30 rounded-lg p-3">{resultado.respuestaCorrecta}</p>
                </div>
              )}
            </div>
          )}

          {revisando ? (
            <Button onClick={() => setRevisando(false)} className="w-full bg-primary hover:bg-primary/90 gap-2">
              <ArrowLeft className="w-4 h-4" />Volver al resultado
            </Button>
          ) : (
            <Button onClick={enviar} disabled={enviando} className="w-full bg-primary hover:bg-primary/90 gap-2">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {question.tipo === "codigo" && stdout === null ? "Ejecutar y enviar" : "Enviar respuesta"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
