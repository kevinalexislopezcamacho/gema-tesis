"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useAuth } from "./auth-context"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt?: string
  animating?: boolean
}

interface ChatContextValue {
  messages: ChatMessage[]
  input: string
  setInput: (v: string) => void
  sending: boolean
  loadingHistory: boolean
  error: string
  clearing: boolean
  isOpen: boolean
  sendMessage: (text: string) => void
  clearHistory: () => void
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
}

export const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat debe usarse dentro de un ChatProvider")
  return ctx
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState("")
  const [clearing, setClearing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const abortRef = useRef(false)
  const historyLoadedRef = useRef(false)

  // Trae el historial UNA sola vez (no cada vez que se abre el widget) —
  // el widget vive montado en el layout durante toda la sesión.
  useEffect(() => {
    if (!user || !token || historyLoadedRef.current) return
    historyLoadedRef.current = true
    fetch(`${API}/chat/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setMessages(d.data) })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [user, token])

  const typeMessage = useCallback((fullText: string, msgId: string) => {
    abortRef.current = false
    let i = 0
    const speed = fullText.length > 500 ? 8 : 18

    const tick = () => {
      if (abortRef.current) return
      i += Math.ceil(fullText.length / 300)
      const chunk = fullText.slice(0, Math.min(i, fullText.length))
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, content: chunk, animating: chunk.length < fullText.length } : m
      ))
      if (i < fullText.length) setTimeout(tick, speed)
    }
    setTimeout(tick, speed)
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || sending) return
    setError("")
    setSending(true)

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    }
    const placeholderId = `a-${Date.now()}`
    const placeholder: ChatMessage = { id: placeholderId, role: "assistant", content: "", animating: true }

    setMessages(prev => [...prev, userMsg, placeholder])
    setInput("")

    fetch(`${API}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: text.trim() }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          typeMessage(d.data.message, placeholderId)
        } else {
          setMessages(prev => prev.filter(m => m.id !== placeholderId))
          setError(d.error || "Error al obtener respuesta")
        }
      })
      .catch(() => {
        setMessages(prev => prev.filter(m => m.id !== placeholderId))
        setError("Error de conexión con el servidor")
      })
      .finally(() => setSending(false))
  }, [sending, token, typeMessage])

  const clearHistory = useCallback(() => {
    setClearing(true)
    abortRef.current = true
    fetch(`${API}/chat/history`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      .then(() => setMessages([]))
      .finally(() => setClearing(false))
  }, [token])

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen(v => !v), [])

  const value: ChatContextValue = {
    messages, input, setInput, sending, loadingHistory, error, clearing, isOpen,
    sendMessage, clearHistory, openChat, closeChat, toggleChat,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
