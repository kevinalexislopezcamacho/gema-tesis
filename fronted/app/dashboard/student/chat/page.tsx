"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeft, Send, Trash2,
  Loader2, Sparkles, TrendingUp, BookOpen,
  MessageSquare, Zap, AlertCircle
} from "lucide-react"
import { ByteMascot } from "@/components/byte/ByteMascot"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt?: string
  animating?: boolean
}

// Starters shown when there are no messages
const STARTERS = [
  { icon: TrendingUp, text: "¿Cómo voy en el curso?" },
  { icon: BookOpen,   text: "¿Qué módulos me faltan completar?" },
  { icon: Zap,        text: "Explícame los tipos de datos en Python" },
  { icon: MessageSquare, text: "¿Cómo funcionan los bucles for?" },
  { icon: Sparkles,   text: "Dame un ejemplo de función con parámetros" },
  { icon: BookOpen,   text: "¿Qué son las listas y cómo se usan?" },
]

// Minimal markdown-like renderer: bold + code blocks + line breaks
function renderContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```\w*\n?/, "").replace(/```$/, "")
      return (
        <pre key={i} className="my-2 p-3 bg-black/40 border border-white/10 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre text-green-300">
          {code}
        </pre>
      )
    }
    // inline: bold (**text**), newlines
    const lines = part.split("\n")
    return (
      <span key={i}>
        {lines.map((line, li) => {
          const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
          return (
            <span key={li}>
              {boldParts.map((bp, bi) =>
                bp.startsWith("**") && bp.endsWith("**")
                  ? <strong key={bi}>{bp.slice(2, -2)}</strong>
                  : <span key={bi}>{bp}</span>
              )}
              {li < lines.length - 1 && <br />}
            </span>
          )
        })}
      </span>
    )
  })
}

export default function ChatPage() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState("")
  const [sending,     setSending]     = useState(false)
  const [loadingHist, setLoadingHist] = useState(true)
  const [error,       setError]       = useState("")
  const [clearing,    setClearing]    = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef   = useRef<boolean>(false)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.push("/login")
  }, [user, isLoading, router])

  // Load history
  useEffect(() => {
    if (!user || !token) return
    fetch(`${API}/chat/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) setMessages(d.data)
      })
      .catch(() => {})
      .finally(() => setLoadingHist(false))
  }, [user, token])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Typewriter effect for assistant message
  const typeMessage = useCallback((fullText: string, msgId: string) => {
    abortRef.current = false
    let i = 0
    const speed = fullText.length > 500 ? 8 : 18 // ms per char, faster for long responses

    const tick = () => {
      if (abortRef.current) return
      i += Math.ceil(fullText.length / 300) // type in chunks for speed
      const chunk = fullText.slice(0, Math.min(i, fullText.length))
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, content: chunk, animating: chunk.length < fullText.length } : m
      ))
      if (i < fullText.length) {
        setTimeout(tick, speed)
      }
    }
    setTimeout(tick, speed)
  }, [])

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return
    setError("")
    setSending(true)

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    }
    const placeholderId = `a-${Date.now()}`
    const placeholder: Message = {
      id: placeholderId,
      role: "assistant",
      content: "",
      animating: true,
    }

    setMessages(prev => [...prev, userMsg, placeholder])
    setInput("")

    try {
      const r = await fetch(`${API}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text.trim() }),
      })
      const d = await r.json()

      if (d.success) {
        // Start typewriter
        typeMessage(d.data.message, placeholderId)
      } else {
        setMessages(prev => prev.filter(m => m.id !== placeholderId))
        setError(d.error || "Error al obtener respuesta")
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== placeholderId))
      setError("Error de conexión con el servidor")
    }
    setSending(false)
  }

  const handleSubmit = () => {
    if (input.trim()) sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleClear = async () => {
    if (!confirm("¿Borrar todo el historial de chat?")) return
    setClearing(true)
    abortRef.current = true
    await fetch(`${API}/chat/history`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    setMessages([])
    setClearing(false)
  }

  if (isLoading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner /></div>
  }

  const progress    = user.progress!
  const initials    = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const showStarters = !loadingHist && messages.length === 0

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/student">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />Volver
            </Button>
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <ByteMascot expression="happy" size={36} />
            <div>
              <p className="text-sm font-bold leading-tight">Byte</p>
              <p className="text-xs text-muted-foreground leading-tight">Tu asistente de programación</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-full bg-secondary/50">
            <Zap className="w-3 h-3 text-yellow-400" />{progress.totalXP} XP
          </span>
          <Button
            variant="ghost" size="sm"
            onClick={handleClear}
            disabled={clearing || messages.length === 0}
            className="text-muted-foreground hover:text-destructive gap-1.5 text-xs"
          >
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Limpiar chat</span>
          </Button>
        </div>
      </header>

      {/* ── Messages area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Welcome banner */}
          {showStarters && (
            <div className="flex flex-col items-center text-center py-6">
              <ByteMascot expression="waving" size={140} animate />
              <h2 className="text-xl font-bold mb-1 mt-2">¡Hola, {user.name.split(" ")[0]}! 👋</h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                Soy Byte, tu tutor de programación. Puedo ayudarte con los temas del curso,
                resolver dudas y darte retroalimentación sobre tu progreso.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-2xl">
                {STARTERS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s.text)}
                    className="flex items-center gap-2 p-3 rounded-xl bg-secondary/40 border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left text-sm"
                  >
                    <s.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingHist && (
            <div className="flex justify-center py-12"><Spinner /></div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              {msg.role === "user" ? (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
              ) : (
                <div className="flex-shrink-0">
                  <ByteMascot
                    expression={msg.content === "" && msg.animating ? "thinking" : "happy"}
                    size={36}
                  />
                </div>
              )}

              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border/50 rounded-tl-sm"
              }`}>
                {msg.role === "assistant" && msg.content === "" && msg.animating ? (
                  <div className="flex items-center gap-1 py-1">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                ) : (
                  <div>
                    {renderContent(msg.content)}
                    {msg.animating && (
                      <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3 max-w-lg mx-auto">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border/50 bg-card/30 backdrop-blur-xl px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-secondary/50 border border-border rounded-2xl px-4 py-3 focus-within:border-primary/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta... (Enter para enviar, Shift+Enter para nueva línea)"
              disabled={sending}
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground max-h-32 min-h-[24px] leading-6 disabled:opacity-60"
              style={{ height: "auto" }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 128) + "px"
              }}
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 flex-shrink-0 disabled:opacity-40"
            >
              {sending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            CodeBot puede cometer errores. Verifica información importante.
          </p>
        </div>
      </div>
    </div>
  )
}
