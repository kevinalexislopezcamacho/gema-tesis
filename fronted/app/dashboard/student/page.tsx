"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import {
  Terminal, LogOut, Play, Bot, Trophy, Flame, Zap, Lock,
  CheckCircle2, ChevronRight, Video, MessageSquare, Star,
  Clock, BookOpen, AlertCircle, Loader2, X, UserCircle,
  ShieldAlert, RefreshCw, PartyPopper, Medal, Maximize2, Minimize2, Menu
} from "lucide-react"
import { ByteMascot } from "@/components/byte/ByteMascot"
import { OnboardingTutorial, shouldShowTutorial } from "@/components/byte/OnboardingTutorial"
import { QuestionOverlay, OverlayQuestion } from "@/components/byte/QuestionOverlay"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

const MIN_WATCH_RATIO = 0.85

const TOPICS = [
  { id: "datos",               name: "Tipos de Datos",      icon: "{ }",  description: "Variables, constantes y tipos primitivos" },
  { id: "operaciones-logicas", name: "Operaciones Lógicas", icon: "&&",   description: "AND, OR, NOT y expresiones booleanas" },
  { id: "filtros",             name: "Filtros",             icon: "?:",   description: "Filtrado de datos y validaciones" },
  { id: "condicionales",       name: "Condicionales",       icon: "if",   description: "If, else, switch y toma de decisiones" },
  { id: "bucles",              name: "Bucles",              icon: "for",  description: "For, while, do-while e iteraciones" },
  { id: "funciones",           name: "Funciones",           icon: "fn()", description: "Declaración, parámetros y retorno" },
  { id: "arreglos",            name: "Arreglos",            icon: "[ ]",  description: "Arrays unidimensionales y métodos" },
  { id: "matrices",            name: "Matrices",            icon: "[[]]", description: "Arrays bidimensionales y operaciones" },
]

const DIFFICULTY_LEVELS = [
  { id: "fácil",    label: "Fácil",    color: "bg-green-500",  border: "border-green-500/50",  text: "text-green-400",  xp: 50  },
  { id: "medio",    label: "Medio",    color: "bg-yellow-500", border: "border-yellow-500/50", text: "text-yellow-400", xp: 100 },
  { id: "avanzado", label: "Avanzado", color: "bg-red-500",    border: "border-red-500/50",    text: "text-red-400",    xp: 200 },
]

interface VideoItem {
  id: string; titulo: string; tema: string; subtema: string
  nivel: string; duracionEstimada: string; videoUrl: string; slides: number
}

interface XpNotif   { xp: number; isFirstWatch: boolean }
interface WatchEntry { videoId: string; topicId: string; nivel: string; watchCount: number }

// watchedMap[topicId] = Set of watched niveles for that topic
type WatchedMap = Record<string, Set<string>>

interface StreakPopup {
  streak: number
  previousStreak: number
  wasReset: boolean
  daysDiff: number
}

function streakMessage(popup: StreakPopup): { title: string; sub: string; emoji: string } {
  if (popup.wasReset) {
    return { emoji: "💪", title: "¡Nuevo inicio!", sub: "Tu racha se reinició — vuelves a empezar. ¡No te rindas!" }
  }
  const n = popup.streak
  if (n >= 30) return { emoji: "👑", title: `¡${n} días de racha!`, sub: "Eres una leyenda pura. Nada te detiene." }
  if (n >= 14) return { emoji: "🔥", title: `¡${n} días seguidos!`, sub: "Dos semanas ininterrumpidas. ¡Eres imparable!" }
  if (n >= 7)  return { emoji: "🔥", title: `¡${n} días de racha!`, sub: "¡Una semana completa! Sigue construyendo el hábito." }
  if (n >= 5)  return { emoji: "🔥", title: `¡${n} días seguidos!`, sub: `Llevas ${n} días aprendiendo. ¡Vas muy bien!` }
  if (n >= 3)  return { emoji: "🔥", title: `¡Racha de ${n} días!`, sub: "La constancia es la clave del aprendizaje." }
  if (n === 2) return { emoji: "🔥", title: "¡2 días seguidos!", sub: "Buen comienzo — ¡mantén el ritmo!" }
  return       { emoji: "🚀", title: "¡Bienvenido de vuelta!", sub: "Empieza tu racha de hoy y aprende algo nuevo." }
}

export default function StudentDashboard() {
  const router = useRouter()
  const { user, token, logout, isLoading, setLearningMode, recordVideoWatch, checkDailyLogin } = useAuth()

  const [selectedTopic,      setSelectedTopic]      = useState<string | null>(null)
  const [learningModeLocal,  setLearningModeLocal]  = useState<"video" | "chatbot">("video")

  // Video state
  const [currentVideo,      setCurrentVideo]      = useState<VideoItem | null>(null)
  const [currentTopicId,    setCurrentTopicId]    = useState<string>("")
  const [currentDifficulty, setCurrentDifficulty] = useState<string>("medio")
  const [loadingVideo,      setLoadingVideo]       = useState(false)
  const [videoError,        setVideoError]         = useState("")

  // Which difficulty levels have been watched per topic
  const [watchedMap,   setWatchedMap]   = useState<WatchedMap>({})

  // Segment tracking (prevents seek cheating)
  const watchedSecsRef = useRef(0)
  const lastTimeRef    = useRef<number | null>(null)
  const [watchedPct,   setWatchedPct]   = useState(0)
  const [watchWarning, setWatchWarning] = useState("")

  // Preguntas adaptativas embebidas en el video
  const videoRef          = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [questions,        setQuestions]       = useState<OverlayQuestion[]>([])
  const [answeredIds,      setAnsweredIds]     = useState<Set<string>>(new Set())
  const [activeQuestion,   setActiveQuestion]  = useState<OverlayQuestion | null>(null)
  const [isFullscreen,     setIsFullscreen]    = useState(false)

  // Notifications
  const [xpNotif,           setXpNotif]           = useState<XpNotif | null>(null)
  const [topicCompletedName, setTopicCompletedName] = useState<string | null>(null)
  const [streakPopup,        setStreakPopup]        = useState<StreakPopup | null>(null)
  const [showTutorial,       setShowTutorial]       = useState(false)
  const [sidebarOpen,        setSidebarOpen]        = useState(false)

  // â”€â”€ Auth guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.push("/login")
    if (user?.progress) setLearningModeLocal(user.progress.learningMode)
  }, [user, isLoading, router])

  // â”€â”€ Show tutorial on first visit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (user && shouldShowTutorial(user.id)) {
      const t = setTimeout(() => setShowTutorial(true), 600)
      return () => clearTimeout(t)
    }
  }, [user])

  // â”€â”€ Daily login streak check (once per calendar day, not once per tab) â”€â”€
  useEffect(() => {
    if (!user || !token) return
    // Guarda la fecha de hoy en vez de un flag fijo — así si vuelves al día
    // siguiente en la misma pestaña (sin cerrarla), el check se vuelve a disparar.
    const today   = new Date().toISOString().slice(0, 10)
    const seenKey = `streak-checked-${user.id}`
    if (sessionStorage.getItem(seenKey) === today) return
    sessionStorage.setItem(seenKey, today)

    checkDailyLogin().then(result => {
      if (!result) return
      // Show popup whether streak changed (new day) or was just reset
      if (result.changed) {
        setStreakPopup({
          streak:         result.streak,
          previousStreak: result.previousStreak,
          wasReset:       result.wasReset,
          daysDiff:       result.daysDiff,
        })
        setTimeout(() => setStreakPopup(null), 7000)
      }
    })
  }, [user, token])

  // â”€â”€ Load watched-videos history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!user || !token) return
    fetch(`${API}/students/${user.id}/watched-videos`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const map: WatchedMap = {}
          ;(d.data as WatchEntry[]).forEach(w => {
            if (!w.topicId) return
            if (!map[w.topicId]) map[w.topicId] = new Set()
            map[w.topicId].add(w.nivel.toLowerCase())
          })
          setWatchedMap(map)
        }
      })
      .catch(() => {})
  }, [user, token])

  // â”€â”€ Reset segment tracking on new video â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    watchedSecsRef.current = 0
    lastTimeRef.current    = null
    setWatchedPct(0)
    setWatchWarning("")
  }, [currentVideo])

  // â”€â”€ Track fullscreen state (pantalla completa debe ser del contenedor, no
  //    del <video> solo, para que el overlay de preguntas siga siendo visible) â”€â”€
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === videoContainerRef.current)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoContainerRef.current?.requestFullscreen()
    }
  }

  // â”€â”€ Load adaptive questions for the current video â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    setQuestions([])
    setAnsweredIds(new Set())
    setActiveQuestion(null)
    if (!currentVideo || !token) return

    fetch(`${API}/videos/${currentVideo.id}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setQuestions(d.data) })
      .catch(() => {})
  }, [currentVideo, token])

  if (isLoading || !user || user.role !== "student") {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
  }

  const progress       = user.progress!
  const completedCount = progress.completedTopics.length
  const progressPct    = (completedCount / TOPICS.length) * 100

  const getTopicStatus = (topicId: string, index: number) => {
    if (progress.completedTopics.includes(topicId)) return "completed"
    if (index === 0) return "available"
    if (progress.completedTopics.includes(TOPICS[index - 1].id)) return "available"
    return "locked"
  }

  // How many difficulties watched for a topic (0-3)
  const watchedCount = (topicId: string) => watchedMap[topicId]?.size ?? 0
  const isLevelWatched = (topicId: string, nivel: string) =>
    watchedMap[topicId]?.has(nivel.toLowerCase()) ?? false

  // â”€â”€ Fetch video by topic + difficulty â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSelectDifficulty = async (topic: typeof TOPICS[0], nivel: string) => {
    setCurrentVideo(null)
    setVideoError("")
    setLoadingVideo(true)
    setCurrentTopicId(topic.id)
    setCurrentDifficulty(nivel)

    try {
      const r = await fetch(`${API}/videos`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (d.success) {
        const found = (d.data as VideoItem[]).find(v => {
          const temaMatch =
            v.tema.toLowerCase().includes(topic.name.toLowerCase()) ||
            topic.name.toLowerCase().includes(v.tema.toLowerCase())
          return temaMatch && v.nivel.toLowerCase() === nivel.toLowerCase()
        })
        found
          ? setCurrentVideo(found)
          : setVideoError(`Aún no hay un video de "${topic.name}" en nivel ${nivel}. El docente lo generará pronto.`)
      }
    } catch {
      setVideoError("No se pudo conectar con el servidor.")
    }
    setLoadingVideo(false)
  }

  // â”€â”€ Segment tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    const now   = video.currentTime
    if (lastTimeRef.current !== null) {
      const diff = now - lastTimeRef.current
      if (diff > 0 && diff <= 2.5) watchedSecsRef.current += diff
    }
    lastTimeRef.current = now
    if (video.duration > 0) setWatchedPct(Math.round(Math.min(watchedSecsRef.current / video.duration, 1) * 100))

    // â”€â”€ Pausar para mostrar una pregunta adaptativa al llegar a su timestamp â”€â”€
    if (!activeQuestion) {
      const pendiente = questions.find(q => !answeredIds.has(q.id) && now >= q.triggerTimeSec)
      if (pendiente) {
        video.pause()
        setActiveQuestion(pendiente)
      }
    }
  }

  const handleQuestionAnswered = () => {
    if (activeQuestion) setAnsweredIds(prev => new Set(prev).add(activeQuestion.id))
    setActiveQuestion(null)
    videoRef.current?.play()
  }

  // â”€â”€ Video ended â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleVideoEnded = async () => {
    if (!currentVideo || !currentTopicId || !currentDifficulty) return

    if (watchedPct < MIN_WATCH_RATIO * 100) {
      setWatchWarning(
        `Solo viste el ${watchedPct}% del video. Necesitas ver al menos el ${MIN_WATCH_RATIO * 100}% para ganar XP. ¡No hagas trampa! 😅`
      )
      return
    }

    setWatchWarning("")
    const result = await recordVideoWatch(currentTopicId, currentDifficulty, currentVideo.id, watchedPct / 100)
    if (!result) return

    // Update local watchedMap
    setWatchedMap(prev => {
      const updated = { ...prev }
      if (!updated[currentTopicId]) updated[currentTopicId] = new Set()
      else updated[currentTopicId] = new Set(updated[currentTopicId])
      updated[currentTopicId].add(currentDifficulty.toLowerCase())
      return updated
    })

    // Show XP notification
    setXpNotif(result)
    setTimeout(() => setXpNotif(null), 5000)

    // Show module completion notification
    if (result.topicCompleted) {
      const topicName = TOPICS.find(t => t.id === currentTopicId)?.name ?? "módulo"
      setTopicCompletedName(topicName)
      setTimeout(() => setTopicCompletedName(null), 6000)
    }
  }

  const handleLearningModeChange = (mode: "video" | "chatbot") => {
    setLearningModeLocal(mode)
    setLearningMode(mode)
  }

  const closeVideo = () => {
    setCurrentVideo(null)
    setVideoError("")
    setWatchWarning("")
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {showTutorial && <OnboardingTutorial userId={user.id} onClose={() => setShowTutorial(false)} />}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <aside className={`
        fixed md:static z-50 md:z-auto inset-y-0 left-0
        w-60 flex-shrink-0 flex flex-col
        bg-[oklch(0.10_0.025_240)] border-r border-border/50
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border/40 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold tracking-tight text-sm">CodePath<span className="text-primary">AI</span></span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-3 mb-3">Aprender</p>
          {([
            { href: "/dashboard/student",              icon: BookOpen,      label: "Mi Aprendizaje", active: true  },
            { href: "/dashboard/student/achievements", icon: Trophy,        label: "Logros"                        },
            { href: "/dashboard/student/chat",         icon: MessageSquare, label: "Chat con Byte"                 },
            { href: "/dashboard/student/profile",      icon: UserCircle,    label: "Mi Perfil"                     },
          ] as {href:string;icon:React.ElementType;label:string;active?:boolean}[]).map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border/40 space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard/student/profile">
              <Avatar className="w-8 h-8 border border-primary/30 hover:border-primary transition-colors cursor-pointer flex-shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Nivel {progress.level}</p>
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0 text-muted-foreground" onClick={() => { logout(); router.push("/") }}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
              <span className="font-mono">{progress.totalXP % 500} XP</span>
              <span>/ 500 próx. nivel</span>
            </div>
            <div className="h-1.5 bg-secondary/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                style={{ width: `${(progress.totalXP % 500) / 500 * 100}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* â”€â”€ Main area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border/40 bg-background/60 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:block">
              <p className="text-sm">
                <span className="text-muted-foreground">Hola, </span>
                <span className="font-semibold">{user.name.split(" ")[0]}</span>
                <span className="ml-1">👋</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-sm font-bold text-orange-400 font-mono">{progress.streak}</span>
              <span className="text-xs text-orange-400/70 hidden sm:inline">días</span>
            </div>
            <Link href="/dashboard/student/achievements">
              <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
                <Trophy className="w-4 h-4 text-yellow-400" />
              </button>
            </Link>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">

          {/* Floating notifications */}
          {streakPopup && (() => {
            const msg = streakMessage(streakPopup)
            return (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-400 w-full max-w-sm px-4">
                <div className={`rounded-2xl shadow-2xl p-4 border flex items-start gap-3 ${
                  streakPopup.wasReset ? "bg-card border-border" : "bg-gradient-to-br from-orange-500/15 via-card to-card border-orange-500/30"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${streakPopup.wasReset ? "bg-secondary" : "bg-orange-500/20"}`}>
                    {msg.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${streakPopup.wasReset ? "" : "text-orange-300"}`}>{msg.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{msg.sub}</p>
                    {!streakPopup.wasReset && (
                      <div className="mt-2 flex items-center gap-1">
                        {Array.from({ length: Math.min(streakPopup.streak, 7) }).map((_, i) => (
                          <div key={i} className="w-5 h-5 rounded-full bg-orange-500/30 flex items-center justify-center text-[10px]">🔥</div>
                        ))}
                        {streakPopup.streak > 7 && <span className="text-xs text-orange-400 font-medium ml-0.5">+{streakPopup.streak - 7}</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setStreakPopup(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })()}

          {xpNotif && (
            <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 ${
                xpNotif.isFirstWatch ? "bg-primary/20 border-primary/40 text-primary" : "bg-card border-border"
              }`}>
                <Zap className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm">+{xpNotif.xp} XP</p>
                  <p className="text-xs opacity-70">{xpNotif.isFirstWatch ? "¡Primera vez!" : "Re-vista (-60%)"}</p>
                </div>
              </div>
            </div>
          )}

          {topicCompletedName && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="bg-gradient-to-r from-primary to-accent text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3">
                <PartyPopper className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm">¡Módulo completado!</p>
                  <p className="text-xs opacity-90">{topicCompletedName} — 3 niveles vistos 🚀</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 md:p-6 lg:p-8 space-y-5">

            {/* â”€â”€ Video player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {(currentVideo || loadingVideo || videoError) && (
              <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-sm">
                      {loadingVideo ? "Buscando video..." : currentVideo?.titulo || "Video no disponible"}
                    </h2>
                    {currentVideo && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentVideo.subtema} · {currentVideo.duracionEstimada} · {currentVideo.slides} slides
                      </p>
                    )}
                  </div>
                  <button onClick={closeVideo} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {currentVideo && !loadingVideo && (
                  <div className="px-5 pb-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                      <span className="flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5 text-yellow-400" />Progreso anti-trampa</span>
                      <span className={watchedPct >= MIN_WATCH_RATIO * 100 ? "text-green-400 font-semibold" : ""}>{watchedPct}% / 85%</span>
                    </div>
                    <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${watchedPct >= MIN_WATCH_RATIO * 100 ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${watchedPct}%` }}
                      />
                      <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: "85%" }} />
                    </div>
                  </div>
                )}

                <div className="px-5 pb-5">
                  {loadingVideo && (
                    <div className="aspect-video bg-secondary/50 rounded-xl flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Cargando video...</p>
                      </div>
                    </div>
                  )}
                  {videoError && !loadingVideo && (
                    <div className="aspect-video bg-secondary/30 rounded-xl flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4 px-8 text-center">
                        <ByteMascot expression="sad" size={90} />
                        <div>
                          <p className="text-sm text-muted-foreground">{videoError}</p>
                          <p className="text-xs text-muted-foreground mt-1">Usa el chatbot mientras tanto.</p>
                        </div>
                        <Link href="/dashboard/student/chat">
                          <Button size="sm" variant="outline" className="gap-2"><Bot className="w-4 h-4" />Preguntarle a Byte</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                  {currentVideo && !loadingVideo && (
                    <>
                      <div ref={videoContainerRef} className={`relative ${isFullscreen ? "flex items-center bg-black" : ""}`}>
                        <video
                          ref={videoRef}
                          src={currentVideo.videoUrl}
                          controls autoPlay
                          controlsList="nofullscreen"
                          className="w-full rounded-xl bg-black"
                          onTimeUpdate={handleTimeUpdate}
                          onEnded={handleVideoEnded}
                          onError={() => setVideoError("No se pudo cargar el video. Verifica que el servidor Python esté activo.")}
                        />
                        <button
                          onClick={toggleFullscreen}
                          title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                          className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                        >
                          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        {activeQuestion && (
                          <QuestionOverlay question={activeQuestion} token={token} onAnswered={handleQuestionAnswered} />
                        )}
                      </div>
                      {watchWarning && (
                        <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
                          <ShieldAlert className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-yellow-300">{watchWarning}</p>
                            <button
                              className="mt-1 text-xs text-yellow-400 underline flex items-center gap-1"
                              onClick={() => { setWatchWarning(""); watchedSecsRef.current = 0; lastTimeRef.current = null; setWatchedPct(0) }}
                            >
                              <RefreshCw className="w-3 h-3" />Reintentar desde el inicio
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* â”€â”€ Stats tiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { icon: Zap,           value: progress.totalXP,         label: "XP TOTAL",      border: "border-l-primary",    bg: "bg-primary/5",    text: "text-primary"    },
                { icon: Trophy,        value: progress.level,            label: "NIVEL",      border: "border-l-accent",     bg: "bg-accent/5",     text: "text-accent"     },
                { icon: Video,         value: progress.videosWatched,   label: "VIDEOS VISTOS", border: "border-l-blue-400",   bg: "bg-blue-500/5",   text: "text-blue-400"   },
                { icon: MessageSquare, value: progress.chatbotSessions, label: "SESIONES CHAT", border: "border-l-violet-400", bg: "bg-violet-500/5", text: "text-violet-400" },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} border border-border/40 border-l-2 ${s.border} rounded-2xl p-4 flex items-center gap-3`}>
                  <s.icon className={`w-4 h-4 ${s.text} flex-shrink-0`} />
                  <div>
                    <p className={`text-xl font-bold font-mono leading-tight ${s.text}`}>
                      {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                    </p>
                    <p className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* â”€â”€ Course progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-sm">Progreso del curso</h2>
                  <p className="text-xs text-muted-foreground">{completedCount} de {TOPICS.length} módulos completados</p>
                </div>
                <span className="text-2xl font-bold font-mono text-primary">{progressPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex items-center gap-1 mt-2.5">
                {TOPICS.map((t) => (
                  <div key={t.id} title={t.name} className={`h-1 flex-1 rounded-full transition-colors ${progress.completedTopics.includes(t.id) ? "bg-primary" : "bg-border/40"}`} />
                ))}
              </div>
            </div>

            {/* â”€â”€ Learning mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="flex gap-1 p-1 bg-secondary/40 rounded-xl border border-border/30">
              {([
                { mode: "video",   icon: Video, label: "Videos IA",    href: null,                        iconColor: "text-primary" },
                { mode: "chatbot", icon: Bot,   label: "Chat con Byte", href: "/dashboard/student/chat",  iconColor: "text-accent"  },
              ] as {mode:string;icon:React.ElementType;label:string;href:string|null;iconColor:string}[]).map(m => {
                const isActive = learningModeLocal === m.mode
                const inner = (
                  <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    isActive ? "bg-card shadow-sm border border-border/50 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                    <m.icon className={`w-4 h-4 ${isActive ? m.iconColor : ""}`} />
                    {m.label}
                  </div>
                )
                return m.href ? (
                  <Link key={m.mode} href={m.href} className="flex-1" onClick={() => handleLearningModeChange(m.mode as "video" | "chatbot")}>{inner}</Link>
                ) : (
                  <button key={m.mode} className="flex-1" onClick={() => handleLearningModeChange(m.mode as "video" | "chatbot")}>{inner}</button>
                )
              })}
            </div>

            {/* â”€â”€ Topics grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">Camino de aprendizaje</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Completa los 3 niveles de cada módulo para desbloquear el siguiente</p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{completedCount}/{TOPICS.length}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {TOPICS.map((topic, index) => {
                  const status     = getTopicStatus(topic.id, index)
                  const isSelected = selectedTopic === topic.id
                  const watched    = watchedCount(topic.id)
                  const isComplete = status === "completed"

                  return (
                    <div key={topic.id}>
                      <button
                        onClick={() => {
                          if (status === "locked") return
                          setSelectedTopic(isSelected ? null : topic.id)
                          setCurrentVideo(null); setVideoError(""); setWatchWarning("")
                        }}
                        disabled={status === "locked"}
                        className={`w-full p-4 rounded-2xl border transition-all text-left ${
                          status === "locked"   ? "border-border/20 bg-secondary/10 opacity-40 cursor-not-allowed"
                          : isComplete          ? "border-primary/30 bg-primary/5 hover:bg-primary/8"
                          : isSelected          ? "border-primary/40 bg-card/60 ring-1 ring-primary/20"
                          :                       "border-border/40 bg-card/20 hover:border-primary/30 hover:bg-card/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono text-sm font-bold flex-shrink-0 ${
                            isComplete          ? "bg-primary/20 text-primary"
                            : status === "locked" ? "bg-secondary/30 text-muted-foreground"
                            : isSelected          ? "bg-primary/15 text-primary"
                            :                       "bg-secondary/60 text-foreground"
                          }`}>
                            {isComplete          ? <CheckCircle2 className="w-5 h-5" />
                            : status === "locked" ? <Lock className="w-4 h-4" />
                            : topic.icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className={`font-semibold text-sm ${status === "locked" ? "text-muted-foreground" : ""}`}>{topic.name}</h3>
                              {isComplete && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">âœ“</span>}
                              {progress.currentTopic === topic.id && !isComplete && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">Activo</span>}
                            </div>
                            <p className={`text-xs truncate ${status === "locked" ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{topic.description}</p>
                            {status !== "locked" && (
                              <div className="flex items-center gap-1 mt-2">
                                {DIFFICULTY_LEVELS.map(lvl => (
                                  <div key={lvl.id} title={lvl.label} className={`h-1 rounded-full flex-1 transition-all ${isLevelWatched(topic.id, lvl.id) ? lvl.color : "bg-border/40"}`} />
                                ))}
                                <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">{watched}/3</span>
                              </div>
                            )}
                          </div>

                          {status !== "locked" && (
                            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${isSelected ? "rotate-90 text-primary" : ""}`} />
                          )}
                        </div>
                      </button>

                      {/* Difficulty panel */}
                      {isSelected && status !== "locked" && (
                        <div className="mt-2 p-4 rounded-2xl bg-secondary/20 border border-border/30">
                          <div className="flex items-center gap-2 mb-3">
                            <ShieldAlert className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                            <p className="text-[11px] text-muted-foreground">Ver al menos 85% del video para ganar XP</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {DIFFICULTY_LEVELS.map(level => {
                              const seen = isLevelWatched(topic.id, level.id)
                              return (
                                <button
                                  key={level.id}
                                  onClick={() => handleSelectDifficulty(topic, level.id)}
                                  disabled={loadingVideo}
                                  className={`relative p-3 rounded-xl border transition-all text-left group disabled:opacity-50 ${
                                    seen ? "bg-primary/10 border-primary/30" : "bg-card/50 border-border/50 hover:border-primary/40 hover:bg-card/80"
                                  }`}
                                >
                                  {seen && (
                                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  )}
                                  <div className={`w-2 h-2 rounded-full ${level.color} mb-1.5`} />
                                  <p className={`font-semibold text-xs ${seen ? "text-primary" : level.text}`}>{level.label}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">+{seen ? Math.floor(level.xp * 0.4) : level.xp} XP</p>
                                  <div className="mt-2 flex items-center justify-center h-4">
                                    {loadingVideo
                                      ? <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                      : <Play className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    }
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          {watched === 3 && !isComplete && (
                            <div className="mt-3 p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                              ¡Has visto todos los niveles! El módulo se completará automáticamente.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
