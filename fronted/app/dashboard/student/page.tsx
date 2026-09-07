"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import {
  LogOut, Bot, Trophy, Flame, Zap,
  Video, MessageSquare,
  BookOpen, Loader2, X, UserCircle, ShoppingBag,
  ShieldAlert, RefreshCw, PartyPopper, Maximize2, Minimize2,
  Dumbbell, Crown, GraduationCap, Rocket, Coins,
  type LucideIcon,
} from "lucide-react"
import { ByteMascot } from "@/components/byte/ByteMascot"
import { QuestionOverlay, OverlayQuestion } from "@/components/byte/QuestionOverlay"
import { LearningPath } from "@/components/dashboard/LearningPath"
import { CourseCompletedModal } from "@/components/dashboard/CourseCompletedModal"
import { TopicExamOverlay } from "@/components/dashboard/TopicExamOverlay"
import { useTopics, type CourseTopic } from "@/hooks/use-topics"
import { downloadCertificate } from "@/lib/certificate"
import { useChat } from "@/contexts/chat-context"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

const MIN_WATCH_RATIO = 0.85

const DIFFICULTY_LEVELS = [
  { id: "fácil",    label: "Fácil",    color: "bg-green-500",  border: "border-green-500/50",  text: "text-green-600",  xp: 50  },
  { id: "medio",    label: "Medio",    color: "bg-yellow-500", border: "border-yellow-500/50", text: "text-yellow-600", xp: 100 },
  { id: "avanzado", label: "Avanzado", color: "bg-red-500",    border: "border-red-500/50",    text: "text-red-600",    xp: 200 },
]

const NAV_ITEMS = [
  { href: "/dashboard/student",              icon: BookOpen,      label: "Mi Aprendizaje", active: true, tourId: "nav-learning" },
  { href: "/dashboard/student/achievements", icon: Trophy,        label: "Logros",                       tourId: "nav-achievements" },
  { href: "/dashboard/student/store",        icon: ShoppingBag,   label: "Tienda",                       tourId: "nav-store" },
]

interface VideoItem {
  id: string; titulo: string; tema: string; subtema: string
  nivel: string; duracionEstimada: string; videoUrl: string; slides: number
}

interface XpNotif   { xp: number; coinsGained: number; isFirstWatch: boolean }
interface WatchEntry { videoId: string; topicId: string; nivel: string; watchCount: number }

// watchedMap[topicId] = Set of watched niveles for that topic
type WatchedMap = Record<string, Set<string>>

interface StreakPopup {
  streak: number
  previousStreak: number
  wasReset: boolean
  daysDiff: number
}

function streakMessage(popup: StreakPopup): { title: string; sub: string; icon: LucideIcon } {
  if (popup.wasReset) {
    return { icon: Dumbbell, title: "¡Nuevo inicio!", sub: "Tu racha se reinició — vuelves a empezar. ¡No te rindas!" }
  }
  const n = popup.streak
  if (n >= 30) return { icon: Crown, title: `¡${n} días de racha!`, sub: "Eres una leyenda pura. Nada te detiene." }
  if (n >= 14) return { icon: Flame, title: `¡${n} días seguidos!`, sub: "Dos semanas ininterrumpidas. ¡Eres imparable!" }
  if (n >= 7)  return { icon: Flame, title: `¡${n} días de racha!`, sub: "¡Una semana completa! Sigue construyendo el hábito." }
  if (n >= 5)  return { icon: Flame, title: `¡${n} días seguidos!`, sub: `Llevas ${n} días aprendiendo. ¡Vas muy bien!` }
  if (n >= 3)  return { icon: Flame, title: `¡Racha de ${n} días!`, sub: "La constancia es la clave del aprendizaje." }
  if (n === 2) return { icon: Flame, title: "¡2 días seguidos!", sub: "Buen comienzo — ¡mantén el ritmo!" }
  return       { icon: Rocket, title: "¡Bienvenido de vuelta!", sub: "Empieza tu racha de hoy y aprende algo nuevo." }
}

export default function StudentDashboard() {
  const router = useRouter()
  const { user, token, logout, isLoading, setLearningMode, recordVideoWatch, checkDailyLogin } = useAuth()
  const { topics: TOPICS, loading: topicsLoading } = useTopics()
  const chat = useChat()

  const [selectedTopic,      setSelectedTopic]      = useState<string | null>(null)
  const [learningModeLocal,  setLearningModeLocal]  = useState<"video" | "chatbot">("video")
  const [showCourseCompleted, setShowCourseCompleted] = useState(false)
  const [examTopic, setExamTopic] = useState<CourseTopic | null>(null)
  const [pendingCourseCompleted, setPendingCourseCompleted] = useState(false)

  // Video state
  const [currentVideo,      setCurrentVideo]      = useState<VideoItem | null>(null)
  const [currentTopicId,    setCurrentTopicId]    = useState<string>("")
  const [currentDifficulty, setCurrentDifficulty] = useState<string>("medio")
  const [loadingVideo,      setLoadingVideo]       = useState(false)
  const [videoError,        setVideoError]         = useState("")

  // Which difficulty levels have been watched per topic
  const [watchedMap,   setWatchedMap]   = useState<WatchedMap>({})

  // Segment tracking (prevents seek cheating). Tracks the SET of whole
  // seconds actually covered while playing forward, not a running total of
  // elapsed play-time — a plain counter let a student rewind to the start
  // and replay the same opening seconds over and over to keep inflating
  // "watched" percentage without ever reaching the rest of the video.
  // Re-watching an already-covered range now adds nothing new.
  const watchedSecondsRef = useRef<Set<number>>(new Set())
  const lastTimeRef    = useRef<number | null>(null)
  const [watchedPct,   setWatchedPct]   = useState(0)
  const [watchWarning, setWatchWarning] = useState("")

  // Preguntas adaptativas embebidas en el video
  const videoRef          = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoSectionRef   = useRef<HTMLDivElement>(null)
  const hasStartedRef     = useRef(false)

  const [questions,        setQuestions]       = useState<OverlayQuestion[]>([])
  const [answeredIds,      setAnsweredIds]     = useState<Set<string>>(new Set())
  const [activeQuestion,   setActiveQuestion]  = useState<OverlayQuestion | null>(null)
  const [isFullscreen,     setIsFullscreen]    = useState(false)

  // Notifications
  const [xpNotif,           setXpNotif]           = useState<XpNotif | null>(null)
  const [topicCompletedName, setTopicCompletedName] = useState<string | null>(null)
  const [streakPopup,        setStreakPopup]        = useState<StreakPopup | null>(null)

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.push("/login")
    if (user?.progress) setLearningModeLocal(user.progress.learningMode)
  }, [user, isLoading, router])

  // ── Daily login streak check (once per calendar day, not once per tab) ──
  useEffect(() => {
    if (!user || !token) return
    const today   = new Date().toISOString().slice(0, 10)
    const seenKey = `streak-checked-${user.id}`
    if (sessionStorage.getItem(seenKey) === today) return
    sessionStorage.setItem(seenKey, today)

    checkDailyLogin().then(result => {
      if (!result) return
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

  // ── Reset segment tracking on new video ──────────────────────────────────
  useEffect(() => {
    watchedSecondsRef.current.clear()
    lastTimeRef.current    = null
    hasStartedRef.current  = false
    setWatchedPct(0)
    setWatchWarning("")
  }, [currentVideo])

  // ── Scroll the video into view as soon as it starts loading — otherwise the
  // player appears above the fold with no visual cue, and a student who just
  // clicked a level has to notice and manually scroll up to find it.
  useEffect(() => {
    if (loadingVideo) videoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [loadingVideo])

  // ── Track fullscreen state ───────────────────────────────────────────────
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

  if (isLoading || !user || user.role !== "student" || !user.progress || topicsLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
  }

  const progress       = user.progress!
  const byteName       = progress.byteName || "Byte"
  const completedCount = progress.completedTopics.length
  const progressPct    = (completedCount / TOPICS.length) * 100

  const getTopicStatus = (topicId: string, index: number) => {
    if (progress.completedTopics.includes(topicId)) return "completed"
    if (index === 0) return "available"
    if (progress.completedTopics.includes(TOPICS[index - 1].id)) return "available"
    return "locked"
  }

  const watchedCount = (topicId: string) => watchedMap[topicId]?.size ?? 0
  const isLevelWatched = (topicId: string, nivel: string) =>
    watchedMap[topicId]?.has(nivel.toLowerCase()) ?? false

  // ── Fetch video by topic + difficulty ────────────────────────────────────
  const handleSelectDifficulty = async (topic: CourseTopic, nivel: string) => {
    // Close the path popover — otherwise its full-screen dismiss overlay stays
    // mounted underneath the video and swallows the next click anywhere on the
    // page (which also resets currentVideo, making the player look like it
    // "closes" on the very first click after opening a video).
    setSelectedTopic(null)
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

  // ── Segment tracking ──────────────────────────────────────────────────────
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    const now   = video.currentTime
    if (lastTimeRef.current !== null) {
      const diff = now - lastTimeRef.current
      if (diff > 0 && diff <= 2.5) {
        // Mark every whole second crossed as watched — a Set dedupes replays
        // of the same range instead of letting them add to the total again.
        for (let s = Math.floor(lastTimeRef.current); s <= Math.floor(now); s++) {
          watchedSecondsRef.current.add(s)
        }
      }
    }
    lastTimeRef.current = now
    if (video.duration > 0) setWatchedPct(Math.round(Math.min(watchedSecondsRef.current.size / video.duration, 1) * 100))

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

  // ── Video ended ────────────────────────────────────────────────────────
  const handleVideoEnded = async () => {
    if (!currentVideo || !currentTopicId || !currentDifficulty) return

    if (watchedPct < MIN_WATCH_RATIO * 100) {
      setWatchWarning(
        `Solo viste el ${watchedPct}% del video. Necesitas ver al menos el ${MIN_WATCH_RATIO * 100}% para ganar XP.`
      )
      return
    }

    setWatchWarning("")
    const result = await recordVideoWatch(currentTopicId, currentDifficulty, currentVideo.id, watchedPct / 100)
    if (!result) return

    setWatchedMap(prev => {
      const updated = { ...prev }
      if (!updated[currentTopicId]) updated[currentTopicId] = new Set()
      else updated[currentTopicId] = new Set(updated[currentTopicId])
      updated[currentTopicId].add(currentDifficulty.toLowerCase())
      return updated
    })

    setXpNotif(result)
    setTimeout(() => setXpNotif(null), 5000)

    if (result.topicCompleted) {
      const topicName = TOPICS.find(t => t.id === currentTopicId)?.name ?? "módulo"
      setTopicCompletedName(topicName)
      setTimeout(() => setTopicCompletedName(null), 6000)
    }
  }

  const handleLearningModeChange = (mode: "video" | "chatbot") => {
    setLearningModeLocal(mode)
    setLearningMode(mode)
    if (mode === "chatbot") chat.openChat()
  }

  const closeVideo = () => {
    setCurrentVideo(null)
    setVideoError("")
    setWatchWarning("")
  }

  return (
    <div className="min-h-screen bg-background">
      {showCourseCompleted && (
        <CourseCompletedModal
          studentName={user.name}
          totalXP={progress.totalXP}
          level={progress.level}
          completedCount={completedCount}
          onClose={() => setShowCourseCompleted(false)}
        />
      )}
      {examTopic && (
        <TopicExamOverlay
          topicId={examTopic.id}
          topicName={examTopic.name}
          onClose={() => {
            setExamTopic(null)
            setSelectedTopic(null)
            if (pendingCourseCompleted) {
              setShowCourseCompleted(true)
              setPendingCourseCompleted(false)
            }
          }}
          onPassed={(courseCompleted) => {
            if (courseCompleted) setPendingCourseCompleted(true)
          }}
        />
      )}

      {/* ── Top header (replaces the sidebar) ──────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo-icon.png" alt="GEMA" className="w-8 h-8 object-contain" />
              <span className="font-bold text-sm tracking-tight hidden sm:inline">GEMA</span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour-id={item.tourId}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    item.active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div data-tour-id="streak-chip" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-sm font-bold text-orange-600 font-mono">{progress.streak}</span>
            </div>
            <Link href="/dashboard/student/profile" data-tour-id="profile-avatar">
              <Avatar className="w-9 h-9 border border-primary/20 hover:border-primary transition-colors cursor-pointer">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                  {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={() => { logout(); router.push("/") }}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Floating notifications ───────────────────────────────────────── */}
      {streakPopup && (() => {
        const msg = streakMessage(streakPopup)
        return (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-400 w-full max-w-sm px-4">
            <div className={`rounded-2xl shadow-xl p-4 border flex items-start gap-3 bg-card ${
              streakPopup.wasReset ? "border-border" : "border-orange-200"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${streakPopup.wasReset ? "bg-secondary" : "bg-orange-500/15"}`}>
                <msg.icon className={`w-5 h-5 ${streakPopup.wasReset ? "text-muted-foreground" : "text-orange-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${streakPopup.wasReset ? "" : "text-orange-600"}`}>{msg.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{msg.sub}</p>
                {!streakPopup.wasReset && (
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: Math.min(streakPopup.streak, 7) }).map((_, i) => (
                      <div key={i} className="w-5 h-5 rounded-full bg-orange-500/15 flex items-center justify-center"><Flame className="w-3 h-3 text-orange-600" /></div>
                    ))}
                    {streakPopup.streak > 7 && <span className="text-xs text-orange-600 font-medium ml-0.5">+{streakPopup.streak - 7}</span>}
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
          <div className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 bg-card ${
            xpNotif.isFirstWatch ? "border-primary/30 text-primary" : "border-border"
          }`}>
            <Zap className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm flex items-center gap-1.5">
                +{xpNotif.xp} XP
                {xpNotif.coinsGained > 0 && (
                  <span className="text-amber-600 inline-flex items-center gap-0.5">
                    +{xpNotif.coinsGained} <Coins className="h-3.5 w-3.5" />
                  </span>
                )}
              </p>
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
              <p className="font-bold text-sm">¡Viste los 3 niveles!</p>
              <p className="text-xs opacity-90">{topicCompletedName} — toma el examen final para desbloquear el siguiente módulo</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

        <div className="flex items-center flex-wrap gap-8">
          <div>
            <h1 className="text-[30px] font-extrabold tracking-tight leading-tight">
              Hola, {user.name.split(" ")[0]}
            </h1>
            <Link href="/dashboard/student/achievements" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mt-1">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />Ver logros
            </Link>
          </div>

          <div className="flex items-center gap-8 flex-wrap">
            {[
              { icon: Zap,           value: progress.totalXP,         label: "XP total",      text: "text-primary"    },
              { icon: Trophy,        value: progress.level,           label: "Nivel",         text: "text-accent"     },
              { icon: Video,         value: progress.videosWatched,   label: "Videos vistos", text: "text-blue-600"   },
              { icon: MessageSquare, value: progress.chatbotSessions, label: "Sesiones chat", text: "text-violet-600" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <s.icon className={`w-4 h-4 ${s.text} flex-shrink-0`} />
                <div>
                  <p className={`text-lg font-bold font-mono leading-tight ${s.text}`}>
                    {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                  </p>
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Video player ────────────────────────────────────────────────── */}
        {(currentVideo || loadingVideo || videoError) && (
          <div ref={videoSectionRef} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-sm">
                  {loadingVideo ? "Buscando video..." : currentVideo?.titulo || "Video no disponible"}
                </h2>
                {currentVideo && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentVideo.tema} · {currentVideo.duracionEstimada} · {currentVideo.slides} slides
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
                  <span className="flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5 text-yellow-500" />Progreso anti-trampa</span>
                  <span className={watchedPct >= MIN_WATCH_RATIO * 100 ? "text-green-600 font-semibold" : ""}>{watchedPct}% / 85%</span>
                </div>
                <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${watchedPct >= MIN_WATCH_RATIO * 100 ? "bg-green-500" : "bg-primary"}`}
                    style={{ width: `${watchedPct}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-px bg-foreground/20" style={{ left: "85%" }} />
                </div>
              </div>
            )}

            <div className="px-5 pb-5">
              {loadingVideo && (
                <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Cargando video...</p>
                  </div>
                </div>
              )}
              {videoError && !loadingVideo && (
                <div className="aspect-video bg-secondary/60 rounded-xl flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 px-8 text-center">
                    <ByteMascot expression="sad" size={90} />
                    <div>
                      <p className="text-sm text-muted-foreground">{videoError}</p>
                      <p className="text-xs text-muted-foreground mt-1">Usa el chatbot mientras tanto.</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => chat.openChat()}>
                      <Bot className="w-4 h-4" />Preguntarle a {byteName}
                    </Button>
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
                      onLoadedData={() => {
                        setVideoError("")
                        // The `autoPlay` attribute alone is unreliable once the video
                        // element mounts asynchronously (after the fetch that finds
                        // it) instead of synchronously inside the click that started
                        // it — some browsers no longer treat that as tied to the
                        // original user gesture. An explicit play() call here is a
                        // no-op if it's already playing, and a harmless no-op (never
                        // shown to the student) if the browser blocks it outright —
                        // the visible `controls` still let them press play themselves.
                        videoRef.current?.play().catch(() => {})
                      }}
                      onPlaying={() => { hasStartedRef.current = true; setVideoError("") }}
                      onError={() => {
                        // The browser aborts and reissues its in-flight range request
                        // any time playback is interrupted — pausing, seeking, toggling
                        // fullscreen, or just normal buffering over a real network — and
                        // that fires a spurious `error` event even though playback is
                        // fine. Once the video has successfully started playing at least
                        // once, we know the source is valid, so later `error` events are
                        // just this noise and must never re-show the fatal banner (that
                        // was making the player look like it "closes" on any interaction).
                        if (hasStartedRef.current) return
                        setTimeout(() => {
                          const v = videoRef.current
                          if (v && v.readyState === 0 && v.buffered.length === 0) {
                            setVideoError("No se pudo cargar el video. Verifica que el servidor Python esté activo.")
                          }
                        }, 1500)
                      }}
                    />
                    <button
                      onClick={toggleFullscreen}
                      title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                      className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    {activeQuestion && (
                      <QuestionOverlay key={activeQuestion.id} question={activeQuestion} token={token} onAnswered={handleQuestionAnswered} />
                    )}
                  </div>
                  {watchWarning && (
                    <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-start gap-3">
                      <ShieldAlert className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-yellow-700">{watchWarning}</p>
                        <button
                          className="mt-1 text-xs text-yellow-700 underline flex items-center gap-1"
                          onClick={() => { setWatchWarning(""); watchedSecondsRef.current.clear(); lastTimeRef.current = null; setWatchedPct(0) }}
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

        {/* ── Course progress ───────────────────────────────────────────────── */}
        <div data-tour-id="course-progress">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-sm">Progreso del curso</h2>
              <p className="text-xs text-muted-foreground">{completedCount} de {TOPICS.length} módulos completados</p>
            </div>
            <div className="flex items-center gap-3">
              {progress.courseCompletedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => downloadCertificate({
                    studentName: user.name,
                    totalXP: progress.totalXP,
                    level: progress.level,
                    completedCount,
                    completedAt: progress.courseCompletedAt!,
                  })}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Descargar certificado
                </Button>
              )}
              <span className="text-2xl font-bold font-mono text-primary">{progressPct.toFixed(0)}%</span>
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* ── Learning mode ─────────────────────────────────────────────────── */}
        <div data-tour-id="mode-toggle" className="flex gap-1 p-1 bg-secondary/70 rounded-xl w-fit">
          {([
            { mode: "video",   icon: Video, label: "Videos IA",     iconColor: "text-primary" },
            { mode: "chatbot", icon: Bot,   label: `Chat con ${byteName}`, iconColor: "text-accent"  },
          ] as {mode:string;icon:React.ElementType;label:string;iconColor:string}[]).map(m => {
            const isActive = learningModeLocal === m.mode
            return (
              <button key={m.mode} onClick={() => handleLearningModeChange(m.mode as "video" | "chatbot")}>
                <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                  <m.icon className={`w-4 h-4 ${isActive ? m.iconColor : ""}`} />
                  {m.label}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Learning path (winding SVG trail) ────────────────────────────── */}
        <div data-tour-id="learning-path">
        <LearningPath
          topics={TOPICS}
          difficultyLevels={DIFFICULTY_LEVELS}
          selectedTopic={selectedTopic}
          onSelectTopic={(topicId) => {
            setSelectedTopic(selectedTopic === topicId ? null : topicId)
            setCurrentVideo(null); setVideoError(""); setWatchWarning("")
          }}
          onSelectDifficulty={handleSelectDifficulty}
          onTakeExam={(topic) => setExamTopic(topic)}
          getTopicStatus={getTopicStatus}
          watchedCount={watchedCount}
          isLevelWatched={isLevelWatched}
          loadingVideo={loadingVideo}
          byteColor={(progress.byteColor as any) ?? "azul"}
          byteOutfit={(progress.byteOutfit as any) ?? "ninguno"}
          byteStyle={progress.byteStyle ?? "feliz"}
        />
        </div>
      </main>
    </div>
  )
}
