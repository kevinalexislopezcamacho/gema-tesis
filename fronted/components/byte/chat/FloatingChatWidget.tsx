"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useChat } from "@/contexts/chat-context"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Send, Trash2, Loader2, Sparkles, TrendingUp, BookOpen, MessageSquare,
  Zap, AlertCircle, X, MessageCircle,
} from "lucide-react"
import { ByteMascot } from "@/components/byte/ByteMascot"

const STARTERS = [
  { icon: TrendingUp, text: "¿Cómo voy en el curso?" },
  { icon: BookOpen,   text: "¿Qué módulos me faltan completar?" },
  { icon: Zap,        text: "Explícame los tipos de datos en Python" },
  { icon: MessageSquare, text: "¿Cómo funcionan los bucles for?" },
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

export function FloatingChatWidget() {
  const { user } = useAuth()
  const {
    messages, input, setInput, sending, loadingHistory, error, clearing, isOpen,
    sendMessage, clearHistory, openChat, closeChat, toggleChat,
  } = useChat()

  const bottomRef = useRef<HTMLDivElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isOpen])

  if (!user || (user.role !== "student" && user.role !== "admin")) return null

  const byteName = user.progress?.byteName || "Byte"
  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const showStarters = !loadingHistory && messages.length === 0

  const handleSubmit = () => {
    if (input.trim()) sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
      {/* Burbuja flotante */}
      {!isOpen && (
        <button
          onClick={openChat}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-xl flex items-center justify-center transition-transform hover:scale-105"
          title={`Chatear con ${byteName}`}
        >
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </button>
      )}

      {/* Panel expandido */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(92vw,380px)] h-[min(80vh,560px)] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <ByteMascot expression="happy" size={32} />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">{byteName}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Tu asistente de programación</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost" size="icon"
                onClick={() => setConfirmClear(true)}
                disabled={clearing || messages.length === 0}
                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                title="Limpiar chat"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={closeChat} className="w-7 h-7 text-muted-foreground">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {confirmClear ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="text-sm">¿Borrar todo el historial de chat?</p>
              <div className="flex gap-2 w-full">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmClear(false)}>Cancelar</Button>
                <Button size="sm" className="flex-1" onClick={() => { clearHistory(); setConfirmClear(false) }}>Borrar</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                {showStarters && (
                  <div className="flex flex-col items-center text-center py-2">
                    <ByteMascot expression="waving" size={90} animate />
                    <h2 className="text-base font-bold mb-1 mt-2">¡Hola, {user.name.split(" ")[0]}!</h2>
                    <p className="text-muted-foreground text-xs mb-4">
                      Soy {byteName}, tu tutor de programación. Pregúntame lo que necesites.
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 w-full">
                      {STARTERS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(s.text)}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/40 border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left text-xs"
                        >
                          <s.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">{s.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loadingHistory && <div className="flex justify-center py-8"><Spinner /></div>}

                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {msg.role === "user" ? (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                        {initials}
                      </div>
                    ) : (
                      <div className="flex-shrink-0">
                        <ByteMascot expression={msg.content === "" && msg.animating ? "thinking" : "happy"} size={28} />
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary/50 border border-border/50 rounded-tl-sm"
                    }`}>
                      {msg.role === "assistant" && msg.content === "" && msg.animating ? (
                        <div className="flex items-center gap-1 py-1">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      ) : (
                        <div>
                          {renderContent(msg.content)}
                          {msg.animating && <span className="inline-block w-0.5 h-3 bg-primary ml-0.5 animate-pulse" />}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {error && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-2.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div data-tour-id="chat-input" className="flex-shrink-0 border-t border-border/50 bg-card/30 backdrop-blur-xl px-3 py-3">
                <div className="flex items-end gap-2 bg-secondary/50 border border-border rounded-2xl px-3 py-2.5 focus-within:border-primary/50 transition-colors">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta..."
                    disabled={sending}
                    rows={1}
                    className="flex-1 bg-transparent resize-none outline-none text-xs placeholder:text-muted-foreground max-h-24 min-h-[20px] leading-5 disabled:opacity-60"
                    onInput={e => {
                      const el = e.currentTarget
                      el.style.height = "auto"
                      el.style.height = Math.min(el.scrollHeight, 96) + "px"
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={handleSubmit}
                    disabled={!input.trim() || sending}
                    className="w-7 h-7 rounded-xl bg-primary hover:bg-primary/90 flex-shrink-0 disabled:opacity-40"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
