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
  ShieldAlert, RefreshCw, PartyPopper, Medal, Maximize2, Minimize2
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

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.push("/login")
    if (user?.progress) setLearningModeLocal(user.progress.learningMode)
  }, [user, isLoading, router])

  // ── Show tutorial on first visit ────────────────────────────────────────
  useEffect(() => {
    if (user && shouldShowTutorial(user.id)) {
      const t = setTimeout(() => setShowTutorial(true), 600)
      return () => clearTimeout(t)
    }
  }, [user])

  // ── Daily login streak check (once per calendar day, not once per tab) ──
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

  // ── Load watched-videos history ──────────────────────────────────────────
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

  // ── Reset segment tracking on new video ─────────────────────────────────
  useEffect(() => {
    watchedSecsRef.current = 0
    lastTimeRef.current    = null
    setWatchedPct(0)
    setWatchWarning("")
  }, [currentVideo])

  // ── Track fullscreen state (pantalla completa debe ser del contenedor, no
  //    del <video> solo, para que el overlay de preguntas siga siendo visible) ──
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

  // ── Load adaptive questions for the current video ───────────────────────
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

  // ── Fetch video by topic + difficulty ────────────────────────────────────
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

  // ── Segment tracking ─────────────────────────────────────────────────────
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    const now   = video.currentTime
    if (lastTimeRef.current !== null) {
      const diff = now - lastTimeRef.current
      if (diff > 0 && diff <= 2.5) watchedSecsRef.current += diff
    }
    lastTimeRef.current = now
    if (video.duration > 0) setWatchedPct(Math.round(Math.min(watchedSecsRef.current / video.duration, 1) * 100))

    // ── Pausar para mostrar una pregunta adaptativa al llegar a su timestamp ──
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

  // ── Video ended ──────────────────────────────────────────────────────────
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
    <div className="min-h-screen bg-background">
      {showTutorial && (
        <OnboardingTutorial userId={user.id} onClose={() => setShowTutorial(false)} />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold">CodePath<span className="text-primary">AI</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
              <Flame className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">{progress.streak} días</span>
            </div>
            <Link href="/dashboard/student/profile">
              <Avatar className="w-9 h-9 border border-primary/30 hover:border-primary transition-colors cursor-pointer">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {user.name.split(" ").map((n: string) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">Nivel {progress.level}</p>
            </div>
            <Link href="/dashboard/student/achievements">
              <Button variant="ghost" size="icon" className="hidden md:flex" title="Logros">
                <Trophy className="w-4 h-4 text-yellow-400" />
              </Button>
            </Link>
            <Link href="/dashboard/student/profile">
              <Button variant="ghost" size="icon" className="hidden md:flex"><UserCircle className="w-4 h-4" /></Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => { logout(); router.push("/") }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">

        {/* ── Streak popup (daily login) ──────────────────────────────────── */}
        {streakPopup && (() => {
          const msg = streakMessage(streakPopup)
          return (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-400 w-full max-w-sm px-4">
              <div className={`rounded-2xl shadow-2xl p-5 border flex items-start gap-4 ${
                streakPopup.wasReset
                  ? "bg-card border-border"
                  : "bg-gradient-to-br from-orange-500/20 via-card to-card border-orange-500/30"
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${
                  streakPopup.wasReset ? "bg-secondary" : "bg-orange-500/20"
                }`}>
                  {msg.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-base ${streakPopup.wasReset ? "" : "text-orange-300"}`}>
                    {msg.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{msg.sub}</p>
                  {!streakPopup.wasReset && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {Array.from({ length: Math.min(streakPopup.streak, 7) }).map((_, i) => (
                        <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          i < streakPopup.streak ? "bg-orange-500/30 text-orange-300" : "bg-secondary text-muted-foreground"
                        }`}>
                          🔥
                        </div>
                      ))}
                      {streakPopup.streak > 7 && (
                        <span className="text-xs text-orange-400 font-medium">+{streakPopup.streak - 7} más</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setStreakPopup(null)}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })()}

        {/* ── XP notification ─────────────────────────────────────────────── */}
        {xpNotif && (
          <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
              xpNotif.isFirstWatch ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"
            }`}>
              <Zap className={`w-5 h-5 ${xpNotif.isFirstWatch ? "" : "text-yellow-400"}`} />
              <div>
                <p className="font-bold text-sm">+{xpNotif.xp} XP {xpNotif.isFirstWatch ? "" : "(re-vista)"}</p>
                <p className={`text-xs ${xpNotif.isFirstWatch ? "opacity-80" : "text-muted-foreground"}`}>
                  {xpNotif.isFirstWatch ? "¡Primera vez que ves este video! 🎉" : "Ya viste este video — XP reducido"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Module-complete banner ───────────────────────────────────────── */}
        {topicCompletedName && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-gradient-to-r from-primary to-accent text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
              <PartyPopper className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-bold">¡Módulo completado!</p>
                <p className="text-sm opacity-90">{topicCompletedName} — has visto los 3 niveles 🚀</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Video player ────────────────────────────────────────────────── */}
        {(currentVideo || loadingVideo || videoError) && (
          <Card className="bg-card/50 border-border/50 mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {loadingVideo ? "Buscando video..." : currentVideo?.titulo || "Video no disponible"}
                  </CardTitle>
                  {currentVideo && (
                    <CardDescription className="mt-1">
                      {currentVideo.subtema} · {currentVideo.duracionEstimada} · {currentVideo.slides} slides
                    </CardDescription>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeVideo}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {currentVideo && !loadingVideo && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progreso visto</span>
                    <span className={watchedPct >= MIN_WATCH_RATIO * 100 ? "text-green-400 font-medium" : "text-muted-foreground"}>
                      {watchedPct}% / {MIN_WATCH_RATIO * 100}% mínimo
                    </span>
                  </div>
                  <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        watchedPct >= MIN_WATCH_RATIO * 100 ? "bg-green-500" : "bg-primary"
                      }`}
                      style={{ width: `${watchedPct}%` }}
                    />
                    {/* 85% threshold marker */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/50" style={{ left: `${MIN_WATCH_RATIO * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-yellow-400" />
                    El sistema detecta saltos — ve el video completo para ganar XP
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loadingVideo && (
                <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Cargando video...</p>
                  </div>
                </div>
              )}
              {videoError && !loadingVideo && (
                <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 px-8 text-center">
                    <ByteMascot expression="sad" size={100} />
                    <div>
                      <p className="text-muted-foreground font-medium">{videoError}</p>
                      <p className="text-xs text-muted-foreground mt-1">Mientras tanto, puedes usar el chatbot para aprender este tema.</p>
                    </div>
                    <Link href="/dashboard/student/chat">
                      <Button size="sm" variant="outline" className="gap-2">
                        <Bot className="w-4 h-4" />Preguntarle a Byte
                      </Button>
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
                      className="absolute bottom-3 right-3 w-9 h-9 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    {activeQuestion && (
                      <QuestionOverlay
                        question={activeQuestion}
                        token={token}
                        onAnswered={handleQuestionAnswered}
                      />
                    )}
                  </div>
                  {watchWarning && (
                    <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-300 font-medium">{watchWarning}</p>
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
            </CardContent>
          </Card>
        )}

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Zap,           value: progress.totalXP,         label: "XP Total",       color: "text-primary",    bg: "bg-primary/10"    },
            { icon: Trophy,        value: progress.level,           label: "Nivel",           color: "text-accent",     bg: "bg-accent/10"     },
            { icon: Video,         value: progress.videosWatched,   label: "Videos vistos",  color: "text-blue-500",   bg: "bg-blue-500/10"   },
            { icon: MessageSquare, value: progress.chatbotSessions, label: "Sesiones chat",  color: "text-purple-500", bg: "bg-purple-500/10" },
          ].map((s, i) => (
            <Card key={i} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Progreso general ────────────────────────────────────────────── */}
        <Card className="bg-card/50 border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />Tu Progreso
            </CardTitle>
            <CardDescription>{completedCount} de {TOPICS.length} módulos completados</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPct} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground">{progressPct.toFixed(0)}% del curso completado</p>
          </CardContent>
        </Card>

        {/* ── Modo de aprendizaje ─────────────────────────────────────────── */}
        <Card className="bg-card/50 border-border/50 mb-8">
          <CardHeader>
            <CardTitle>Modo de Aprendizaje</CardTitle>
            <CardDescription>Elige cómo quieres aprender cada tema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { mode: "video",   icon: Video, label: "Videos IA",  desc: "Aprende con videos generados por IA",   active: "border-primary bg-primary/10", iconColor: "text-primary", href: null                      },
                { mode: "chatbot", icon: Bot,   label: "Chatbot",    desc: "Chatea con CodeBot, tu tutor de IA",    active: "border-accent bg-accent/10",   iconColor: "text-accent",  href: "/dashboard/student/chat" },
              ].map(m => {
                const inner = (
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${learningModeLocal === m.mode ? "bg-primary/20" : "bg-secondary"}`}>
                      <m.icon className={`w-6 h-6 ${learningModeLocal === m.mode ? m.iconColor : "text-muted-foreground"}`} />
                    </div>
                    <span className={`font-medium ${learningModeLocal === m.mode ? m.iconColor : ""}`}>{m.label}</span>
                    <p className="text-xs text-muted-foreground text-center">{m.desc}</p>
                  </div>
                )
                return m.href ? (
                  <Link key={m.mode} href={m.href}>
                    <button onClick={() => handleLearningModeChange(m.mode as "video" | "chatbot")}
                      className={`w-full p-4 rounded-xl border-2 transition-all ${learningModeLocal === m.mode ? m.active : "border-border/50 hover:border-primary/30"}`}>
                      {inner}
                    </button>
                  </Link>
                ) : (
                  <button key={m.mode} onClick={() => handleLearningModeChange(m.mode as "video" | "chatbot")}
                    className={`p-4 rounded-xl border-2 transition-all ${learningModeLocal === m.mode ? m.active : "border-border/50 hover:border-primary/30"}`}>
                    {inner}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Camino de aprendizaje ────────────────────────────────────────── */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />Camino de Aprendizaje
            </CardTitle>
            <CardDescription>Completa los 3 niveles de cada módulo para desbloquear el siguiente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {TOPICS.map((topic, index) => {
                const status     = getTopicStatus(topic.id, index)
                const isSelected = selectedTopic === topic.id
                const watched    = watchedCount(topic.id)         // 0, 1, 2 o 3
                const isComplete = status === "completed"

                return (
                  <div key={topic.id} className="relative">
                    {index < TOPICS.length - 1 && (
                      <div className={`absolute left-6 top-16 w-0.5 h-8 ${isComplete ? "bg-primary" : "bg-border"}`} />
                    )}

                    <button
                      onClick={() => {
                        if (status === "locked") return
                        setSelectedTopic(isSelected ? null : topic.id)
                        setCurrentVideo(null); setVideoError(""); setWatchWarning("")
                      }}
                      disabled={status === "locked"}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        status === "locked"
                          ? "border-border/30 bg-secondary/20 opacity-60 cursor-not-allowed"
                          : isComplete
                          ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                          : "border-border/50 hover:border-primary/50 bg-card/50"
                      } ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono text-lg font-bold flex-shrink-0 ${
                          isComplete         ? "bg-primary/20 text-primary"
                          : status === "locked" ? "bg-secondary text-muted-foreground"
                          : "bg-secondary text-foreground"
                        }`}>
                          {isComplete         ? <CheckCircle2 className="w-6 h-6" />
                          : status === "locked" ? <Lock className="w-5 h-5" />
                          : topic.icon}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className={`font-semibold ${status === "locked" ? "text-muted-foreground" : ""}`}>{topic.name}</h3>
                            {isComplete && <Badge variant="secondary" className="bg-primary/20 text-primary border-0 text-xs">✓ Completado</Badge>}
                            {progress.currentTopic === topic.id && !isComplete && (
                              <Badge variant="secondary" className="bg-accent/20 text-accent border-0 text-xs">En progreso</Badge>
                            )}
                          </div>
                          <p className={`text-sm truncate ${status === "locked" ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                            {topic.description}
                          </p>

                          {/* Mini progress dots for available/in-progress topics */}
                          {status !== "locked" && !isComplete && (
                            <div className="flex items-center gap-1.5 mt-2">
                              {DIFFICULTY_LEVELS.map(lvl => {
                                const seen = isLevelWatched(topic.id, lvl.id)
                                return (
                                  <div key={lvl.id} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                    seen ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                                  }`}>
                                    {seen && <CheckCircle2 className="w-2.5 h-2.5" />}
                                    <span>{lvl.label}</span>
                                  </div>
                                )
                              })}
                              <span className="text-xs text-muted-foreground ml-1">{watched}/3</span>
                            </div>
                          )}
                          {/* For completed topics, show all 3 checked */}
                          {isComplete && (
                            <div className="flex items-center gap-1.5 mt-2">
                              {DIFFICULTY_LEVELS.map(lvl => (
                                <div key={lvl.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>{lvl.label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {status !== "locked" && (
                          <ChevronRight className={`w-5 h-5 transition-transform flex-shrink-0 ${isSelected ? "text-primary rotate-90" : "text-muted-foreground"}`} />
                        )}
                      </div>
                    </button>

                    {/* ── Difficulty panel ─────────────────────────────── */}
                    {isSelected && status !== "locked" && (
                      <div className="mt-3 ml-16 p-4 rounded-xl bg-secondary/30 border border-border/50">
                        <h4 className="font-medium mb-1 text-sm">Selecciona el nivel de dificultad:</h4>
                        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-yellow-400" />
                          Debes ver al menos el 85% del video para obtener XP
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          {DIFFICULTY_LEVELS.map(level => {
                            const seen = isLevelWatched(topic.id, level.id)
                            return (
                              <button
                                key={level.id}
                                onClick={() => handleSelectDifficulty(topic, level.id)}
                                disabled={loadingVideo}
                                className={`relative p-3 rounded-lg border transition-all group disabled:opacity-50 ${
                                  seen
                                    ? "bg-primary/10 border-primary/40"
                                    : `bg-card/50 ${level.border} hover:bg-card`
                                }`}
                              >
                                {/* Watched badge */}
                                {seen && (
                                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                  </div>
                                )}

                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`w-3 h-3 rounded-full ${level.color}`} />
                                  <span className={`font-medium text-sm ${seen ? "text-primary" : level.text}`}>{level.label}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Star className="w-3 h-3" />
                                  <span>{seen ? `+${Math.floor(level.xp * 0.4)} XP` : `+${level.xp} XP`}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <Clock className="w-3 h-3" />
                                  <span>~3 min</span>
                                </div>
                                {seen && (
                                  <p className="text-xs text-primary/70 mt-1">Visto ✓</p>
                                )}
                                <div className="mt-2 flex items-center justify-center">
                                  {loadingVideo
                                    ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    : <Play className={`w-4 h-4 ${seen ? "text-primary/50 opacity-100" : "text-primary opacity-0 group-hover:opacity-100"} transition-opacity`} />
                                  }
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* All 3 watched → show completion hint */}
                        {watched === 3 && !isComplete && (
                          <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            ¡Has visto todos los niveles! El módulo se completará automáticamente.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
