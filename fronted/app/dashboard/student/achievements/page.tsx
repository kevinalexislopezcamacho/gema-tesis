"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeft, Lock, CheckCircle2, Trophy, Zap, ChevronRight,
  Target, Flame, MessageCircle, BookOpen, Clapperboard, Key, Dumbbell,
  Gamepad2, PenLine, ArrowUp, Sprout, Leaf, Video, Rocket, Lightbulb, Star,
  BookMarked, Crown, GraduationCap, Sparkles, Medal, Bot, Coins,
  type LucideIcon,
} from "lucide-react"
import { useTopics } from "@/hooks/use-topics"
import { useChat } from "@/contexts/chat-context"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

// ── Achievement definitions ───────────────────────────────────────────────

interface AchievementDef {
  id: string
  icon: LucideIcon
  title: string
  description: string          // What to do
  rewardText: string           // What you get
  rewardXP: number
  coinReward: number           // Coins credited once claimed (server-verified)
  href: string                 // Where to go to complete it
  hrefLabel: string
  tier: 1 | 2
  check: (s: Stats) => boolean
  progressCurrent?: (s: Stats) => number
  progressTarget?: number
}

interface Stats {
  totalXP: number
  level: number
  streak: number
  videosWatched: number
  chatbotSessions: number
  completedCount: number        // completedTopics.length
  fullyWatchedTopics: number    // topics with all 3 levels watched
  tier1Unlocked?: number        // populated after computing tier1
  totalTopics: number           // live count from GET /api/topics — the teacher's module CRUD can change this
}

// Achievements whose target is "the whole course" rather than a fixed
// number — their check/progress read live totalTopics instead of a literal
// 8, since the teacher's module CRUD can add/remove modules over time.
const DYNAMIC_TOTAL_IDS = new Set(["t2_8_modules", "t2_graduate"])

type WatchedMap = Record<string, Set<string>>
interface WatchEntry { videoId: string; topicId: string; nivel: string }

const ACHIEVEMENTS: AchievementDef[] = [
  // ── TIER 1 — PRINCIPIANTE ──────────────────────────────────────────────

  {
    id: "t1_first_video",
    icon: Target, title: "Primer Paso",
    description: "Ve tu primer video completo (mínimo 85% del video).",
    rewardText: "Insignia de Iniciado", rewardXP: 0, coinReward: 10,
    href: "/dashboard/student", hrefLabel: "Ver videos", tier: 1,
    check: s => s.videosWatched >= 1,
    progressCurrent: s => Math.min(s.videosWatched, 1), progressTarget: 1,
  },
  {
    id: "t1_streak_2",
    icon: Flame, title: "Chispa",
    description: "Mantén una racha de actividad de 2 días consecutivos.",
    rewardText: "Insignia de Constancia", rewardXP: 30, coinReward: 6,
    href: "/dashboard/student", hrefLabel: "Ir al inicio", tier: 1,
    check: s => s.streak >= 2,
    progressCurrent: s => Math.min(s.streak, 2), progressTarget: 2,
  },
  {
    id: "t1_first_chat",
    icon: MessageCircle, title: "Rompehielos",
    description: "Inicia tu primera sesión de chat.",
    rewardText: "Acceso completo al chat", rewardXP: 20, coinReward: 5,
    href: "/dashboard/student/chat", hrefLabel: "Abrir chat", tier: 1,
    check: s => s.chatbotSessions >= 1,
    progressCurrent: s => Math.min(s.chatbotSessions, 1), progressTarget: 1,
  },
  {
    id: "t1_first_module",
    icon: BookOpen, title: "Aprendiz de Código",
    description: "Completa tu primer módulo viendo los 3 niveles de dificultad.",
    rewardText: "Título: Aprendiz", rewardXP: 100, coinReward: 20,
    href: "/dashboard/student", hrefLabel: "Ver módulos", tier: 1,
    check: s => s.completedCount >= 1,
    progressCurrent: s => Math.min(s.completedCount, 1), progressTarget: 1,
  },
  {
    id: "t1_xp_100",
    icon: Zap, title: "Coleccionista de XP",
    description: "Acumula 100 XP completando videos y módulos.",
    rewardText: "+50 XP bonus", rewardXP: 50, coinReward: 10,
    href: "/dashboard/student", hrefLabel: "Ganar XP", tier: 1,
    check: s => s.totalXP >= 100,
    progressCurrent: s => Math.min(s.totalXP, 100), progressTarget: 100,
  },
  {
    id: "t1_3_videos",
    icon: Clapperboard, title: "Mini Maratón",
    description: "Ve 3 videos completos en total.",
    rewardText: "Insignia de Espectador", rewardXP: 40, coinReward: 8,
    href: "/dashboard/student", hrefLabel: "Ver videos", tier: 1,
    check: s => s.videosWatched >= 3,
    progressCurrent: s => Math.min(s.videosWatched, 3), progressTarget: 3,
  },
  {
    id: "t1_2_modules",
    icon: Key, title: "Desbloqueador",
    description: "Completa 2 módulos y desbloquea más contenido del curso.",
    rewardText: "Acceso a más módulos", rewardXP: 80, coinReward: 16,
    href: "/dashboard/student", hrefLabel: "Completar módulos", tier: 1,
    check: s => s.completedCount >= 2,
    progressCurrent: s => Math.min(s.completedCount, 2), progressTarget: 2,
  },
  {
    id: "t1_streak_3",
    icon: Dumbbell, title: "Constancia Inicial",
    description: "Mantén una racha de actividad de 3 días seguidos.",
    rewardText: "+60 XP bonus", rewardXP: 60, coinReward: 12,
    href: "/dashboard/student", hrefLabel: "Ir al inicio", tier: 1,
    check: s => s.streak >= 3,
    progressCurrent: s => Math.min(s.streak, 3), progressTarget: 3,
  },
  {
    id: "t1_triple_threat",
    icon: Gamepad2, title: "Triple Amenaza",
    description: "Ve los 3 niveles (fácil, medio, avanzado) de un mismo módulo.",
    rewardText: "Insignia de Completista", rewardXP: 150, coinReward: 30,
    href: "/dashboard/student", hrefLabel: "Ver niveles", tier: 1,
    check: s => s.fullyWatchedTopics >= 1,
    progressCurrent: s => Math.min(s.fullyWatchedTopics, 1), progressTarget: 1,
  },
  {
    id: "t1_5_chats",
    icon: PenLine, title: "Preguntón",
    description: "Abre 3 sesiones de chat distintas.",
    rewardText: "Título: Curioso Digital", rewardXP: 40, coinReward: 8,
    href: "/dashboard/student/chat", hrefLabel: "Abrir chat", tier: 1,
    check: s => s.chatbotSessions >= 3,
    progressCurrent: s => Math.min(s.chatbotSessions, 3), progressTarget: 3,
  },
  {
    id: "t1_level_2",
    icon: ArrowUp, title: "Subir de Nivel",
    description: "Alcanza el nivel 2 acumulando XP.",
    rewardText: "+50 XP bonus", rewardXP: 50, coinReward: 10,
    href: "/dashboard/student", hrefLabel: "Ganar XP", tier: 1,
    check: s => s.level >= 2,
    progressCurrent: s => Math.min(s.level, 2), progressTarget: 2,
  },
  {
    id: "t1_xp_200",
    icon: Sprout, title: "Raíces Fuertes",
    description: "Acumula 200 XP demostrando dedicación al aprendizaje.",
    rewardText: "+70 XP bonus", rewardXP: 70, coinReward: 14,
    href: "/dashboard/student", hrefLabel: "Ganar XP", tier: 1,
    check: s => s.totalXP >= 200,
    progressCurrent: s => Math.min(s.totalXP, 200), progressTarget: 200,
  },
  {
    id: "t1_3_modules",
    icon: Leaf, title: "En Crecimiento",
    description: "Completa 3 módulos del curso.",
    rewardText: "+150 XP bonus", rewardXP: 150, coinReward: 30,
    href: "/dashboard/student", hrefLabel: "Completar módulos", tier: 1,
    check: s => s.completedCount >= 3,
    progressCurrent: s => Math.min(s.completedCount, 3), progressTarget: 3,
  },
  {
    id: "t1_5_videos",
    icon: Video, title: "Cinéfilo Básico",
    description: "Ve 5 videos completos en total.",
    rewardText: "Insignia de Video", rewardXP: 60, coinReward: 12,
    href: "/dashboard/student", hrefLabel: "Ver videos", tier: 1,
    check: s => s.videosWatched >= 5,
    progressCurrent: s => Math.min(s.videosWatched, 5), progressTarget: 5,
  },
  {
    id: "t1_xp_500",
    icon: Rocket, title: "Despegue",
    description: "Acumula 500 XP — ¡estás despegando!",
    rewardText: "+100 XP bonus", rewardXP: 100, coinReward: 20,
    href: "/dashboard/student", hrefLabel: "Ganar XP", tier: 1,
    check: s => s.totalXP >= 500,
    progressCurrent: s => Math.min(s.totalXP, 500), progressTarget: 500,
  },
  {
    id: "t1_chat_5",
    icon: Lightbulb, title: "Curioso Digital",
    description: "Abre 5 sesiones de chat.",
    rewardText: "Título: Analítico", rewardXP: 75, coinReward: 15,
    href: "/dashboard/student/chat", hrefLabel: "Abrir chat", tier: 1,
    check: s => s.chatbotSessions >= 5,
    progressCurrent: s => Math.min(s.chatbotSessions, 5), progressTarget: 5,
  },
  {
    id: "t1_10_videos",
    icon: Clapperboard, title: "Cinéfilo",
    description: "Ve 10 videos completos en total.",
    rewardText: "+80 XP bonus", rewardXP: 80, coinReward: 16,
    href: "/dashboard/student", hrefLabel: "Ver videos", tier: 1,
    check: s => s.videosWatched >= 10,
    progressCurrent: s => Math.min(s.videosWatched, 10), progressTarget: 10,
  },
  {
    id: "t1_2_full_topics",
    icon: Star, title: "Explorador",
    description: "Ve los 3 niveles completos de 2 módulos diferentes.",
    rewardText: "Insignia de Explorador", rewardXP: 120, coinReward: 24,
    href: "/dashboard/student", hrefLabel: "Explorar módulos", tier: 1,
    check: s => s.fullyWatchedTopics >= 2,
    progressCurrent: s => Math.min(s.fullyWatchedTopics, 2), progressTarget: 2,
  },
  {
    id: "t1_4_modules",
    icon: BookMarked, title: "Mitad del Camino",
    description: "Completa 4 módulos — ya vas por la mitad del curso.",
    rewardText: "+200 XP bonus", rewardXP: 200, coinReward: 40,
    href: "/dashboard/student", hrefLabel: "Completar módulos", tier: 1,
    check: s => s.completedCount >= 4,
    progressCurrent: s => Math.min(s.completedCount, 4), progressTarget: 4,
  },
  {
    id: "t1_streak_5",
    icon: Flame, title: "Llama Viva",
    description: "Mantén una racha de 5 días consecutivos de actividad.",
    rewardText: "+120 XP bonus", rewardXP: 120, coinReward: 24,
    href: "/dashboard/student", hrefLabel: "Mantener racha", tier: 1,
    check: s => s.streak >= 5,
    progressCurrent: s => Math.min(s.streak, 5), progressTarget: 5,
  },

  // ── TIER 2 — AVANZADO (blurred until 8+ tier1 unlocked) ───────────────

  {
    id: "t2_xp_1000",
    icon: Trophy, title: "Élite",
    description: "Acumula 1000 XP demostrando excelencia.",
    rewardText: "Título: Élite + 200 XP bonus", rewardXP: 200, coinReward: 40,
    href: "/dashboard/student", hrefLabel: "Ganar XP", tier: 2,
    check: s => s.totalXP >= 1000,
    progressCurrent: s => Math.min(s.totalXP, 1000), progressTarget: 1000,
  },
  {
    id: "t2_streak_7",
    icon: Flame, title: "Racha de Fuego",
    description: "Mantén una racha imparable de 7 días seguidos.",
    rewardText: "+180 XP bonus", rewardXP: 180, coinReward: 36,
    href: "/dashboard/student", hrefLabel: "Mantener racha", tier: 2,
    check: s => s.streak >= 7,
    progressCurrent: s => Math.min(s.streak, 7), progressTarget: 7,
  },
  {
    id: "t2_5_modules",
    icon: Crown, title: "Maestro en Progreso",
    description: "Completa 5 módulos del curso.",
    rewardText: "Título: Maestro + 250 XP", rewardXP: 250, coinReward: 50,
    href: "/dashboard/student", hrefLabel: "Completar módulos", tier: 2,
    check: s => s.completedCount >= 5,
    progressCurrent: s => Math.min(s.completedCount, 5), progressTarget: 5,
  },
  {
    id: "t2_15_videos",
    icon: GraduationCap, title: "Estudiante Avanzado",
    description: "Ve 15 videos completos en total.",
    rewardText: "+150 XP bonus", rewardXP: 150, coinReward: 30,
    href: "/dashboard/student", hrefLabel: "Ver videos", tier: 2,
    check: s => s.videosWatched >= 15,
    progressCurrent: s => Math.min(s.videosWatched, 15), progressTarget: 15,
  },
  {
    id: "t2_level_3",
    icon: ArrowUp, title: "Experto",
    description: "Alcanza el nivel 3 — ya eres un experto.",
    rewardText: "+200 XP bonus", rewardXP: 200, coinReward: 40,
    href: "/dashboard/student", hrefLabel: "Subir nivel", tier: 2,
    check: s => s.level >= 3,
    progressCurrent: s => Math.min(s.level, 3), progressTarget: 3,
  },
  {
    id: "t2_chat_10",
    icon: MessageCircle, title: "Conversador",
    description: "Abre 10 sesiones de chat.",
    rewardText: "Título: Orador + 100 XP", rewardXP: 100, coinReward: 20,
    href: "/dashboard/student/chat", hrefLabel: "Abrir chat", tier: 2,
    check: s => s.chatbotSessions >= 10,
    progressCurrent: s => Math.min(s.chatbotSessions, 10), progressTarget: 10,
  },
  {
    id: "t2_4_full_topics",
    icon: Star, title: "Maestro de Videos",
    description: "Ve los 3 niveles completos de 4 módulos distintos.",
    rewardText: "+220 XP bonus", rewardXP: 220, coinReward: 44,
    href: "/dashboard/student", hrefLabel: "Ver módulos", tier: 2,
    check: s => s.fullyWatchedTopics >= 4,
    progressCurrent: s => Math.min(s.fullyWatchedTopics, 4), progressTarget: 4,
  },
  {
    id: "t2_6_modules",
    icon: Sparkles, title: "Avanzado",
    description: "Completa 6 módulos del curso.",
    rewardText: "+280 XP bonus", rewardXP: 280, coinReward: 56,
    href: "/dashboard/student", hrefLabel: "Completar módulos", tier: 2,
    check: s => s.completedCount >= 6,
    progressCurrent: s => Math.min(s.completedCount, 6), progressTarget: 6,
  },
  {
    id: "t2_3_full_topics",
    icon: Gamepad2, title: "Speedrunner",
    description: "Ve los 3 niveles completos de 3 módulos distintos.",
    rewardText: "+175 XP bonus", rewardXP: 175, coinReward: 35,
    href: "/dashboard/student", hrefLabel: "Ver módulos", tier: 2,
    check: s => s.fullyWatchedTopics >= 3,
    progressCurrent: s => Math.min(s.fullyWatchedTopics, 3), progressTarget: 3,
  },
  {
    id: "t2_streak_14",
    icon: Dumbbell, title: "Dos Semanas",
    description: "Mantén una racha de 14 días consecutivos sin parar.",
    rewardText: "Título: Invicto + 350 XP", rewardXP: 350, coinReward: 70,
    href: "/dashboard/student", hrefLabel: "Mantener racha", tier: 2,
    check: s => s.streak >= 14,
    progressCurrent: s => Math.min(s.streak, 14), progressTarget: 14,
  },
  {
    id: "t2_20_videos",
    icon: Clapperboard, title: "Maratonista",
    description: "Ve 20 videos completos en total.",
    rewardText: "+200 XP bonus", rewardXP: 200, coinReward: 40,
    href: "/dashboard/student", hrefLabel: "Ver videos", tier: 2,
    check: s => s.videosWatched >= 20,
    progressCurrent: s => Math.min(s.videosWatched, 20), progressTarget: 20,
  },
  {
    id: "t2_xp_1500",
    icon: Zap, title: "Potencia",
    description: "Acumula 1500 XP — estás en la cima.",
    rewardText: "+300 XP bonus", rewardXP: 300, coinReward: 60,
    href: "/dashboard/student", hrefLabel: "Ganar XP", tier: 2,
    check: s => s.totalXP >= 1500,
    progressCurrent: s => Math.min(s.totalXP, 1500), progressTarget: 1500,
  },
  {
    id: "t2_15_basic",
    icon: Medal, title: "Coleccionista",
    description: "Desbloquea 15 logros del nivel Principiante.",
    rewardText: "+150 XP bonus", rewardXP: 150, coinReward: 30,
    href: "/dashboard/student/achievements", hrefLabel: "Ver logros", tier: 2,
    check: s => (s.tier1Unlocked ?? 0) >= 15,
    progressCurrent: s => Math.min(s.tier1Unlocked ?? 0, 15), progressTarget: 15,
  },
  {
    id: "t2_7_modules",
    icon: BookOpen, title: "Casi Graduado",
    description: "Completa 7 módulos — solo te falta uno.",
    rewardText: "+350 XP bonus", rewardXP: 350, coinReward: 70,
    href: "/dashboard/student", hrefLabel: "Completar módulos", tier: 2,
    check: s => s.completedCount >= 7,
    progressCurrent: s => Math.min(s.completedCount, 7), progressTarget: 7,
  },
  {
    id: "t2_8_modules",
    icon: Key, title: "Maestro de las Llaves",
    description: "Completa todos los módulos del curso.",
    rewardText: "Título: Maestro + 500 XP", rewardXP: 500, coinReward: 100,
    href: "/dashboard/student", hrefLabel: "Completar módulos", tier: 2,
    check: s => s.completedCount >= s.totalTopics,
    progressCurrent: s => Math.min(s.completedCount, s.totalTopics),
  },
  {
    id: "t2_chat_20",
    icon: Lightbulb, title: "Enciclopedia",
    description: "Abre 20 sesiones de chat.",
    rewardText: "Título: Enciclopedia + 200 XP", rewardXP: 200, coinReward: 40,
    href: "/dashboard/student/chat", hrefLabel: "Abrir chat", tier: 2,
    check: s => s.chatbotSessions >= 20,
    progressCurrent: s => Math.min(s.chatbotSessions, 20), progressTarget: 20,
  },
  {
    id: "t2_level_4",
    icon: ArrowUp, title: "Nivel Supremo",
    description: "Alcanza el nivel 4 — ya eres de los mejores.",
    rewardText: "+250 XP bonus", rewardXP: 250, coinReward: 50,
    href: "/dashboard/student", hrefLabel: "Subir nivel", tier: 2,
    check: s => s.level >= 4,
    progressCurrent: s => Math.min(s.level, 4), progressTarget: 4,
  },
  {
    id: "t2_xp_2000",
    icon: Star, title: "Leyenda",
    description: "Acumula 2000 XP — ¡leyenda viviente del código!",
    rewardText: "Título: Leyenda + 400 XP", rewardXP: 400, coinReward: 80,
    href: "/dashboard/student", hrefLabel: "Ganar XP", tier: 2,
    check: s => s.totalXP >= 2000,
    progressCurrent: s => Math.min(s.totalXP, 2000), progressTarget: 2000,
  },
  {
    id: "t2_streak_30",
    icon: Flame, title: "Racha Legendaria",
    description: "Mantén una racha de 30 días consecutivos sin fallar.",
    rewardText: "Título: Leyenda de la Racha + 500 XP", rewardXP: 500, coinReward: 100,
    href: "/dashboard/student", hrefLabel: "Mantener racha", tier: 2,
    check: s => s.streak >= 30,
    progressCurrent: s => Math.min(s.streak, 30), progressTarget: 30,
  },
  {
    id: "t2_graduate",
    icon: Bot, title: "Graduado Digital",
    description: "Completa el curso completo y alcanza el nivel 3.",
    rewardText: "Título: Graduado Digital + 1000 XP", rewardXP: 1000, coinReward: 200,
    href: "/dashboard/student", hrefLabel: "Completar el curso", tier: 2,
    check: s => s.completedCount >= s.totalTopics && s.level >= 3,
    progressCurrent: s => Math.min(s.completedCount, s.totalTopics),
  },
]

const TIER1 = ACHIEVEMENTS.filter(a => a.tier === 1)
const TIER2 = ACHIEVEMENTS.filter(a => a.tier === 2)

// ── Component ─────────────────────────────────────────────────────────────
export default function AchievementsPage() {
  const router = useRouter()
  const { user, token, isLoading, claimAchievement } = useAuth()
  const { topics } = useTopics()
  const [watchedMap, setWatchedMap] = useState<WatchedMap>({})
  const [loading,    setLoading]    = useState(true)
  const [claiming,   setClaiming]   = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.push("/login")
  }, [user, isLoading, router])

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
      .finally(() => setLoading(false))
  }, [user, token])

  if (isLoading || !user || user.role !== "student" || !user.progress) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner /></div>
  }

  const p = user.progress!

  const fullyWatched = Object.values(watchedMap).filter(
    s => s.has('fácil') && s.has('medio') && s.has('avanzado')
  ).length

  const baseStats: Omit<Stats, 'tier1Unlocked'> = {
    totalXP:           p.totalXP,
    level:             p.level,
    streak:            p.streak,
    videosWatched:     p.videosWatched,
    chatbotSessions:   p.chatbotSessions,
    completedCount:    p.completedTopics.length,
    fullyWatchedTopics: fullyWatched,
    totalTopics:       topics.length,
  }

  const tier1Unlocked = TIER1.filter(a => a.check(baseStats as Stats)).length

  const stats: Stats = { ...baseStats, tier1Unlocked }

  const tier2Visible = tier1Unlocked >= 5   // unlock Tier 2 view after 5 basics
  const totalUnlocked = ACHIEVEMENTS.filter(a => a.check(stats)).length
  const claimedSet = new Set(p.claimedAchievements ?? [])

  const handleClaim = async (achievementId: string) => {
    setClaiming(achievementId)
    await claimAchievement(achievementId)
    setClaiming(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard/student">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />Volver
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium">Mis Logros</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* ── Progress summary ───────────────────────────────────────────── */}
        <div data-tour-id="achievements-progress" className="relative rounded-2xl overflow-hidden mb-10 bg-gradient-to-br from-yellow-500/15 via-primary/5 to-background border border-border/50 p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent" />
          <div className="relative flex flex-col md:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-10 h-10 text-yellow-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold mb-1">Mis Logros</h1>
              <p className="text-muted-foreground mb-4">
                Has desbloqueado <span className="text-yellow-400 font-bold">{totalUnlocked}</span> de <span className="font-bold">40</span> logros
              </p>
              <div className="max-w-sm">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Progreso total</span>
                  <span>{Math.round((totalUnlocked / 40) * 100)}%</span>
                </div>
                <Progress value={(totalUnlocked / 40) * 100} className="h-3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              {[
                { label: "Básicos", val: `${tier1Unlocked}/20`,    color: "text-primary"    },
                { label: "Avanzados", val: tier2Visible ? `${totalUnlocked - tier1Unlocked}/20` : "???", color: "text-purple-400" },
              ].map(s => (
                <div key={s.label} className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TIER 1 ────────────────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-sm font-semibold text-primary">Logros Básicos</span>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">{tier1Unlocked}/20</Badge>
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIER1.map(a => (
              <AchievementCard
                key={a.id} a={a} stats={stats} loading={loading}
                claimed={claimedSet.has(a.id)} claiming={claiming === a.id} onClaim={handleClaim}
              />
            ))}
          </div>
        </section>

        {/* ── TIER 2 ────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <span className="text-sm font-semibold text-purple-400">Logros Avanzados</span>
              {tier2Visible
                ? <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">{totalUnlocked - tier1Unlocked}/20</Badge>
                : <Lock className="w-3 h-3 text-purple-400" />
              }
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>

          {!tier2Visible && (
            <div className="text-center py-8 mb-6 border border-dashed border-border rounded-2xl">
              <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">Desbloquea 5 logros básicos para revelar esta sección</p>
              <p className="text-sm text-muted-foreground mt-1">Te faltan {Math.max(0, 5 - tier1Unlocked)} logros básicos más</p>
            </div>
          )}

          <div className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-4 ${!tier2Visible ? "opacity-30 pointer-events-none select-none blur-sm" : ""}`}>
            {TIER2.map(a => (
              <AchievementCard
                key={a.id} a={a} stats={stats} loading={loading} locked={!tier2Visible}
                claimed={claimedSet.has(a.id)} claiming={claiming === a.id} onClaim={handleClaim}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

// ── Achievement Card ──────────────────────────────────────────────────────

function AchievementCard({
  a, stats, loading, locked = false, claimed, claiming, onClaim,
}: {
  a: AchievementDef
  stats: Stats
  loading: boolean
  claimed: boolean
  claiming: boolean
  onClaim: (id: string) => void
  locked?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const chat = useChat()
  const unlocked = !locked && a.check(stats)
  // The two "whole course" achievements have no fixed progressTarget (the
  // teacher's module CRUD can change the total) — fall back to the live count.
  const target = a.progressTarget ?? (DYNAMIC_TOTAL_IDS.has(a.id) ? stats.totalTopics : undefined)
  const pct = (a.progressCurrent && target)
    ? Math.round((a.progressCurrent(stats) / target) * 100)
    : 0
  const inProgress = !unlocked && !locked && pct > 0

  return (
    <div
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onClick={() => setRevealed(v => !v)}
      className={`relative rounded-2xl border p-4 flex flex-col cursor-default transition-all duration-300 ${
        unlocked
          ? "bg-primary/10 border-primary/40"
          : inProgress
          ? "bg-card/60 border-border"
          : "bg-card/30 border-border/50 opacity-70"
      } ${revealed ? "shadow-[0_0_20px_-5px] shadow-primary/20" : ""}`}
    >
      {/* Unlocked overlay badge */}
      {unlocked && (
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      )}
      {locked && (
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}

      {/* Icon + title — always visible */}
      <div className="flex items-start gap-2">
        <span className={`transition-all ${!unlocked && !inProgress ? "opacity-40" : ""}`}>
          {a.id === "t2_graduate" ? (
            <img src="/byte/byte-graduate-2.png" alt="" className="w-7 h-7 rounded-md object-cover" />
          ) : (
            <a.icon className={`w-6 h-6 ${unlocked ? "text-primary" : "text-muted-foreground"}`} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm leading-tight ${unlocked ? "text-primary" : ""}`}>{a.title}</p>
          {a.tier === 2 && (
            <span className="text-xs text-purple-400 font-medium">Avanzado</span>
          )}
        </div>
      </div>

      {/* Revealed on hover (or tap, for touch devices) */}
      <div className={`grid transition-all duration-300 ease-in-out ${
        revealed ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0 mt-0"
      }`}>
        <div className="overflow-hidden space-y-3">
          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>

          {/* Reward */}
          <div className="flex items-center gap-1.5 text-xs">
            <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0" />
            <span className="text-yellow-400 font-medium">{a.rewardText}</span>
          </div>

          {/* Progress bar (only when in progress) */}
          {!unlocked && !locked && target && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progreso</span>
                <span>{a.progressCurrent?.(stats) ?? 0}/{target}</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          )}

          {/* CTA button */}
          {!unlocked && !locked && (
            a.href === "/dashboard/student/chat" ? (
              <Button size="sm" variant="outline" onClick={() => chat.openChat()}
                className="w-full text-xs gap-1 border-border hover:border-primary/50 hover:bg-primary/5">
                {a.hrefLabel}
                <ChevronRight className="w-3 h-3" />
              </Button>
            ) : (
              <Link href={a.href}>
                <Button size="sm" variant="outline"
                  className="w-full text-xs gap-1 border-border hover:border-primary/50 hover:bg-primary/5">
                  {a.hrefLabel}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            )
          )}

          {/* Unlocked, not yet claimed → claim button */}
          {unlocked && !claimed && (
            <Button
              size="sm"
              disabled={claiming}
              onClick={(e) => { e.stopPropagation(); onClaim(a.id) }}
              className="w-full text-xs gap-1"
            >
              <Coins className="h-3.5 w-3.5" /> {claiming ? "Reclamando..." : `Reclamar ${a.coinReward}`}
            </Button>
          )}

          {/* Claimed state */}
          {unlocked && claimed && (
            <div className="text-xs text-primary font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ¡Logro reclamado!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
