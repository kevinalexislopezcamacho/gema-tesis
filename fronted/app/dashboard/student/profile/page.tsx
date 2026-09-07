"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  LogOut, Zap, Trophy, Flame, Video, MessageSquare,
  BookOpen, CheckCircle2, Lock, Save, KeyRound, UserCircle,
  Loader2, CheckCircle, AlertCircle, Palette, ChevronRight, HelpCircle,
  Gauge, Menu, ShoppingBag,
  Target, Dumbbell, MessageCircle, Clapperboard, GraduationCap, Crown,
  type LucideIcon,
} from "lucide-react"
import { ByteMascot } from "@/components/byte/ByteMascot"
import { useTour } from "@/contexts/tour-context"
import { useChat } from "@/contexts/chat-context"
import { getEloTier, getNextEloTier, ELO_TIERS } from "@/lib/utils"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

const TOPICS = [
  { id: "datos",               name: "Tipos de Datos"      },
  { id: "operaciones-logicas", name: "Operaciones Lógicas" },
  { id: "filtros",             name: "Filtros"             },
  { id: "condicionales",       name: "Condicionales"       },
  { id: "bucles",              name: "Bucles"              },
  { id: "funciones",           name: "Funciones"           },
  { id: "arreglos",            name: "Arreglos"            },
  { id: "matrices",            name: "Matrices"            },
]

const AVATAR_COLORS = [
  { id: "violet", bg: "bg-violet-600",  ring: "ring-violet-400"  },
  { id: "blue",   bg: "bg-blue-600",    ring: "ring-blue-400"    },
  { id: "cyan",   bg: "bg-cyan-600",    ring: "ring-cyan-400"    },
  { id: "green",  bg: "bg-emerald-600", ring: "ring-emerald-400" },
  { id: "orange", bg: "bg-orange-500",  ring: "ring-orange-400"  },
  { id: "pink",   bg: "bg-pink-600",    ring: "ring-pink-400"    },
]

const ACHIEVEMENTS: { id: string; icon: LucideIcon; title: string; desc: string; check: (v: number, s?: number, x?: number, t?: number, c?: number) => boolean }[] = [
  { id: "first_video", icon: Target,        title: "Primer Paso",   desc: "Ve tu primer video",       check: (v: number) => v >= 1                                                    },
  { id: "streak_3",    icon: Flame,         title: "En Racha",      desc: "3 días consecutivos",      check: (_v: number, s: number = 0) => s >= 3                                    },
  { id: "streak_7",    icon: Dumbbell,      title: "Constante",     desc: "7 días seguidos",          check: (_v: number, s: number = 0) => s >= 7                                    },
  { id: "xp_500",      icon: Zap,           title: "Acumulador",    desc: "Alcanza 500 XP",           check: (_v: number, _s: number = 0, x: number = 0) => x >= 500                 },
  { id: "xp_1000",     icon: Trophy,        title: "Élite",         desc: "Alcanza 1000 XP",          check: (_v: number, _s: number = 0, x: number = 0) => x >= 1000                },
  { id: "topics_2",    icon: BookOpen,      title: "Explorador",    desc: "Completa 2 módulos",       check: (_v: number, _s: number = 0, _x: number = 0, t: number = 0) => t >= 2   },
  { id: "topics_4",    icon: GraduationCap, title: "Avanzado",      desc: "Completa 4 módulos",       check: (_v: number, _s: number = 0, _x: number = 0, t: number = 0) => t >= 4   },
  { id: "topics_8",    icon: Crown,         title: "Graduado",      desc: "Completa el curso",        check: (_v: number, _s: number = 0, _x: number = 0, t: number = 0) => t >= 8   },
  { id: "chat_5",      icon: MessageCircle, title: "Conversador",   desc: "5 sesiones de chatbot",    check: (_v: number, _s: number = 0, _x: number = 0, _t: number = 0, c: number = 0) => c >= 5 },
  { id: "videos_10",   icon: Clapperboard,  title: "Cinéfilo",      desc: "Ve 10 videos",             check: (v: number) => v >= 10                                                   },
]

export default function StudentProfile() {
  const router = useRouter()
  const { user, token, isLoading, refreshProgress, logout } = useAuth()
  const { startTour } = useTour()
  const chat = useChat()

  const [sidebarOpen,     setSidebarOpen]     = useState(false)
  const [avatarColor,     setAvatarColor]     = useState("violet")
  const [showColorPicker, setShowColorPicker] = useState(false)

  const [name,       setName]       = useState("")
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg,    setInfoMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  const [curPw,     setCurPw]     = useState("")
  const [newPw,     setNewPw]     = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [savingPw,  setSavingPw]  = useState(false)
  const [pwMsg,     setPwMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const [skills, setSkills] = useState<{ topicId: string; elo: number }[]>([])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.push("/login")
    if (user) {
      setName(user.name)
      setAvatarColor(user.avatar || "violet")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user || !token) return
    fetch(`${API}/students/${user.id}/skills`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setSkills(d.data) })
      .catch(() => {})
  }, [user, token])

  if (isLoading || !user || user.role !== "student" || !user.progress) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner /></div>
  }

  const progress       = user.progress!
  const byteName       = progress.byteName || "Byte"
  const completedCount = progress.completedTopics.length
  const xpInLevel      = progress.totalXP % 500
  const xpPct          = (xpInLevel / 500) * 100
  const colorObj       = AVATAR_COLORS.find(c => c.id === avatarColor) ?? AVATAR_COLORS[0]
  const initials       = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

  const handleSaveInfo = async () => {
    if (!name.trim()) return
    setSavingInfo(true); setInfoMsg(null)
    try {
      const r = await fetch(`${API}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), avatar: avatarColor }),
      })
      const d = await r.json()
      if (d.success) {
        await refreshProgress()
        setInfoMsg({ ok: true, text: "Perfil actualizado correctamente" })
      } else {
        setInfoMsg({ ok: false, text: d.error || "Error al guardar" })
      }
    } catch {
      setInfoMsg({ ok: false, text: "Error de conexión" })
    }
    setSavingInfo(false)
    setTimeout(() => setInfoMsg(null), 3500)
  }

  const handleChangePw = async () => {
    if (!curPw || !newPw || !confirmPw) { setPwMsg({ ok: false, text: "Completa todos los campos" }); return }
    if (newPw !== confirmPw)             { setPwMsg({ ok: false, text: "Las contraseñas no coinciden" }); return }
    if (newPw.length < 6)               { setPwMsg({ ok: false, text: "Mínimo 6 caracteres" }); return }
    setSavingPw(true); setPwMsg(null)
    try {
      const r = await fetch(`${API}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      })
      const d = await r.json()
      if (d.success) {
        setPwMsg({ ok: true, text: "Contraseña actualizada" })
        setCurPw(""); setNewPw(""); setConfirmPw("")
      } else {
        setPwMsg({ ok: false, text: d.error || "Error al cambiar contraseña" })
      }
    } catch {
      setPwMsg({ ok: false, text: "Error de conexión" })
    }
    setSavingPw(false)
    setTimeout(() => setPwMsg(null), 3500)
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`
        fixed md:static z-50 md:z-auto inset-y-0 left-0
        w-60 flex-shrink-0 flex flex-col
        bg-muted/50 border-r border-border
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/logo-icon.png" alt="GEMA" className="w-8 h-8 object-contain" />
            <span className="font-bold tracking-tight text-sm">GEMA</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-3 mb-3">Aprender</p>
          <Link href="/dashboard/student" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
            <BookOpen className="w-4 h-4 flex-shrink-0" />Mi Aprendizaje
          </Link>
          <Link href="/dashboard/student/achievements" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
            <Trophy className="w-4 h-4 flex-shrink-0" />Logros
          </Link>
          <Link href="/dashboard/student/store" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
            <ShoppingBag className="w-4 h-4 flex-shrink-0" />Tienda
          </Link>
          <button onClick={() => { setSidebarOpen(false); chat.openChat() }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all text-left">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />Chat con {byteName}
          </button>
          <Link href="/dashboard/student/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary/15 text-primary border border-primary/20">
            <UserCircle className="w-4 h-4 flex-shrink-0" />Mi Perfil
          </Link>
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-border space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${colorObj.bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>
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
              <span className="font-mono">{xpInLevel} XP</span>
              <span>/ 500 próx. nivel</span>
            </div>
            <div className="h-1.5 bg-secondary/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border bg-background/60 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold">Mi Perfil</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Gestiona tu información y seguimiento de progreso</p>
            </div>
          </div>
          <button
            onClick={startTour}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ver tutorial</span>
          </button>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">

          {/* ── Banner (full-bleed) ──────────────────────────────────────── */}
          <div className="h-24 md:h-28 w-full bg-gradient-to-r from-primary via-accent to-primary/70" />

          <div className="max-w-4xl mx-auto px-4 md:px-8 pb-16">

            {/* Avatar + mascot row, overlapping the banner */}
            <div className="flex items-end justify-between -mt-10 mb-5">
              <div className="relative flex-shrink-0">
                <div className={`w-20 h-20 rounded-2xl ${colorObj.bg} flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-background`}>
                  {initials}
                </div>
                <button
                  onClick={() => setShowColorPicker(v => !v)}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors shadow-sm"
                >
                  <Palette className="w-3 h-3 text-muted-foreground" />
                </button>
                {showColorPicker && (
                  <div className="absolute top-full left-0 mt-3 z-10 bg-card border border-border rounded-xl p-3 shadow-xl flex gap-2">
                    {AVATAR_COLORS.map(c => (
                      <button key={c.id} onClick={() => { setAvatarColor(c.id); setShowColorPicker(false) }}
                        className={`w-6 h-6 rounded-full ${c.bg} ${avatarColor === c.id ? `ring-2 ${c.ring} ring-offset-1 ring-offset-card` : ""} hover:scale-110 transition-all`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden lg:block flex-shrink-0 -mb-1">
                <ByteMascot expression="happy" size={64} />
              </div>
            </div>

            {/* Name + email */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-0.5">{user.name}</h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Zap className="w-3.5 h-3.5" />Nivel {progress.level}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-sm font-medium font-mono">
                <Zap className="w-3.5 h-3.5" />{progress.totalXP.toLocaleString()} XP
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium">
                <Flame className="w-3.5 h-3.5" />{progress.streak} días
              </span>
            </div>

            {/* Level progress */}
            <div className="mb-10">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Nv. {progress.level}</span>
                <span>{xpInLevel}/500 → Nv. {progress.level + 1}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${xpPct}%` }} />
              </div>
            </div>

            {/* ── Stats row — open, no boxes ──────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-t border-b border-border py-6 mb-12">
              {[
                { icon: Zap,           value: progress.totalXP.toLocaleString(), label: "XP TOTAL",     text: "text-primary"    },
                { icon: Video,         value: progress.videosWatched,            label: "VIDEOS",        text: "text-blue-500"   },
                { icon: Flame,         value: progress.streak,                   label: "RACHA (DÍAS)",  text: "text-orange-500" },
                { icon: MessageSquare, value: progress.chatbotSessions,          label: "SESIONES CHAT", text: "text-purple-500" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-1 px-2">
                  <s.icon className={`w-5 h-5 ${s.text}`} />
                  <span className="text-2xl font-bold font-mono text-foreground">{s.value}</span>
                  <span className="text-[10px] tracking-widest text-muted-foreground text-center">{s.label}</span>
                </div>
              ))}
            </div>

            {/* ── Curso ────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-[18px] h-[18px] text-primary" />
                  <h2 className="text-foreground">Curso</h2>
                </div>
                <span className="text-sm text-muted-foreground">{completedCount}/8</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 mb-6 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${(completedCount / 8) * 100}%` }} />
              </div>
              <div className="space-y-1">
                {TOPICS.map((t, i) => {
                  const done    = progress.completedTopics.includes(t.id)
                  const current = progress.currentTopic === t.id
                  const locked  = !done && i > 0 && !progress.completedTopics.includes(TOPICS[i - 1].id)
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between py-2.5 ${i < TOPICS.length - 1 ? "border-b border-border/60" : ""} ${
                        current ? "text-primary" : locked ? "text-muted-foreground/50" : "text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {locked
                          ? <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
                          : current
                            ? <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">{i + 1}</span>
                            : <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        }
                        <span className="text-sm">{t.name}</span>
                      </div>
                      {current && !done && <span className="text-[10px] text-primary tracking-widest font-semibold">ACTIVO</span>}
                    </div>
                  )
                })}
              </div>
            </section>

            <div className="h-px bg-border mb-12" />

            {/* ── Logros ───────────────────────────────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Trophy className="w-[18px] h-[18px] text-yellow-500" />
                  <h2 className="text-foreground">Logros</h2>
                </div>
                <Link href="/dashboard/student/achievements" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                  Ver todos <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {(() => {
                const unlocked = ACHIEVEMENTS.filter(a => a.check(
                  progress.videosWatched, progress.streak, progress.totalXP,
                  completedCount, progress.chatbotSessions
                ))
                const locked = ACHIEVEMENTS.filter(a => !a.check(
                  progress.videosWatched, progress.streak, progress.totalXP,
                  completedCount, progress.chatbotSessions
                ))
                const shown = [...unlocked.slice(0, 4), ...locked.slice(0, Math.max(0, 6 - Math.min(unlocked.length, 4)))]
                return (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                      {shown.slice(0, 6).map(a => {
                        const isUnlocked = unlocked.some(u => u.id === a.id)
                        return (
                          <div key={a.id} className={`p-2.5 rounded-xl border text-center transition-all ${
                            isUnlocked ? "bg-primary/10 border-primary/30" : "bg-secondary/30 border-border/30 opacity-40 grayscale"
                          }`}>
                            <div className="mb-0.5 flex justify-center"><a.icon className={`w-5 h-5 ${isUnlocked ? "text-primary" : "text-muted-foreground"}`} /></div>
                            <p className="text-xs font-semibold leading-tight truncate">{a.title}</p>
                            {isUnlocked && <CheckCircle2 className="w-3 h-3 text-primary mx-auto mt-1" />}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {unlocked.length} / 40 logros desbloqueados
                    </p>
                  </>
                )
              })()}
            </section>

            <div className="h-px bg-border mb-12" />

            {/* ── Nivel de habilidad ───────────────────────────────────────── */}
            {skills.length > 0 && (
              <>
                <section className="mb-12">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-[18px] h-[18px] text-primary" />
                      <h2 className="text-foreground">Nivel de habilidad</h2>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end max-w-[180px]">
                      {ELO_TIERS.map(t => (
                        <span key={t.label} title={`${t.label}: ${t.min === 0 ? "hasta" : t.min}–${t.max === 9999 ? "+" : t.max}`}
                          className={`${t.textColor} cursor-default select-none`}>
                          <t.icon className="w-3 h-3" />
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-7">Se calibra con tus respuestas en cada video</p>

                  <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border gap-y-6">
                    {skills.map((s, i) => {
                      const topic     = TOPICS.find(t => t.id === s.topicId)
                      const tier      = getEloTier(s.elo)
                      const nextTier  = getNextEloTier(s.elo)
                      const rangeSize = tier.max === 9999 ? 400 : (tier.max - tier.min + 1)
                      const pct       = tier.max === 9999 ? 100 : Math.min(100, ((s.elo - tier.min) / rangeSize) * 100)
                      const ptsLeft   = nextTier ? Math.ceil(nextTier.min - s.elo) : 0

                      return (
                        <div key={s.topicId} className={`${i % 2 === 0 ? "sm:pr-10" : "sm:pl-10"} ${i > 0 ? "pt-6 sm:pt-0" : ""}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-foreground font-medium">{topic?.name ?? s.topicId}</span>
                            <span className={`text-xs ${tier.textColor} flex items-center gap-1 font-semibold`}>
                              <tier.icon className="w-3.5 h-3.5" />
                              {tier.label}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden mb-1">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: `linear-gradient(to right, ${tier.barFrom}, ${tier.barTo})` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className={`${tier.textColor} font-medium font-mono`}>{Math.round(s.elo)} Elo</span>
                            {nextTier
                              ? <span className="inline-flex items-center gap-1">{ptsLeft} pts → <nextTier.icon className="w-3 h-3" /> {nextTier.label}</span>
                              : <span className={`${tier.textColor} font-semibold`}>Rango máximo</span>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <div className="h-px bg-border mb-12" />
              </>
            )}

            {/* ── Información personal + Cambiar contraseña ─────────────────── */}
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border gap-y-10">

              {/* Información personal */}
              <div className="md:pr-10">
                <div className="flex items-center gap-2 mb-5">
                  <UserCircle className="w-[18px] h-[18px] text-primary" />
                  <h2 className="text-foreground">Información personal</h2>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Nombre</label>
                    <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary/40 border-border h-9 text-sm" placeholder="Tu nombre" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Email</label>
                    <Input value={user.email} disabled className="bg-secondary/20 border-border opacity-60 h-9 text-sm" />
                    <p className="text-[10px] text-muted-foreground">El email no se puede modificar</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Color del avatar</label>
                    <div className="flex gap-2">
                      {AVATAR_COLORS.map(c => (
                        <button key={c.id} onClick={() => setAvatarColor(c.id)}
                          className={`w-6 h-6 rounded-full ${c.bg} ${avatarColor === c.id ? `ring-2 ${c.ring} ring-offset-2 ring-offset-background` : ""} hover:scale-110 transition-all`}
                        />
                      ))}
                    </div>
                  </div>
                  {infoMsg && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      infoMsg.ok
                        ? "bg-green-500/10 border border-green-500/20 text-green-400"
                        : "bg-destructive/10 border border-destructive/20 text-destructive"
                    }`}>
                      {infoMsg.ok ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                      {infoMsg.text}
                    </div>
                  )}
                  <Button onClick={handleSaveInfo} disabled={savingInfo} className="w-full bg-primary hover:bg-primary/90 gap-2 h-9 text-sm">
                    {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar cambios
                  </Button>
                </div>
              </div>

              {/* Cambiar contraseña */}
              <div className="md:pl-10">
                <div className="flex items-center gap-2 mb-5">
                  <KeyRound className="w-[18px] h-[18px] text-primary" />
                  <h2 className="text-foreground">Cambiar contraseña</h2>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Contraseña actual", val: curPw,     set: setCurPw,     ph: "••••••••"            },
                    { label: "Nueva contraseña",  val: newPw,     set: setNewPw,     ph: "Mínimo 6 caracteres" },
                    { label: "Confirmar nueva",   val: confirmPw, set: setConfirmPw, ph: "Repite la nueva"     },
                  ].map(f => (
                    <div key={f.label} className="space-y-1.5">
                      <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{f.label}</label>
                      <Input type="password" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="bg-secondary/40 border-border h-9 text-sm" />
                    </div>
                  ))}
                  {pwMsg && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      pwMsg.ok
                        ? "bg-green-500/10 border border-green-500/20 text-green-400"
                        : "bg-destructive/10 border border-destructive/20 text-destructive"
                    }`}>
                      {pwMsg.ok ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                      {pwMsg.text}
                    </div>
                  )}
                  <Button onClick={handleChangePw} disabled={savingPw} className="w-full bg-primary hover:bg-primary/90 gap-2 h-9 text-sm">
                    {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}Cambiar contraseña
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
