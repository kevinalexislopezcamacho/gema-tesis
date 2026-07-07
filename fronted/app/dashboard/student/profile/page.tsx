"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeft, Zap, Trophy, Flame, Video, MessageSquare,
  BookOpen, CheckCircle2, Lock, Save, KeyRound, User,
  Loader2, CheckCircle, AlertCircle, Palette, ChevronRight, HelpCircle,
  Gauge
} from "lucide-react"
import { ByteMascot } from "@/components/byte/ByteMascot"
import { OnboardingTutorial } from "@/components/byte/OnboardingTutorial"
import { eloLabel } from "@/lib/utils"

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
  { id: "violet", bg: "bg-violet-600",  ring: "ring-violet-400" },
  { id: "blue",   bg: "bg-blue-600",    ring: "ring-blue-400"   },
  { id: "cyan",   bg: "bg-cyan-600",    ring: "ring-cyan-400"   },
  { id: "green",  bg: "bg-emerald-600", ring: "ring-emerald-400"},
  { id: "orange", bg: "bg-orange-500",  ring: "ring-orange-400" },
  { id: "pink",   bg: "bg-pink-600",    ring: "ring-pink-400"   },
]

const ACHIEVEMENTS = [
  { id: "first_video", icon: "🎯", title: "Primer Paso",   desc: "Ve tu primer video",       check: (v: number) => v >= 1                                                    },
  { id: "streak_3",    icon: "🔥", title: "En Racha",      desc: "3 días consecutivos",      check: (_v: number, s: number) => s >= 3                                        },
  { id: "streak_7",    icon: "💪", title: "Constante",     desc: "7 días seguidos",          check: (_v: number, s: number) => s >= 7                                        },
  { id: "xp_500",      icon: "⚡", title: "Acumulador",    desc: "Alcanza 500 XP",           check: (_v: number, _s: number, x: number) => x >= 500                         },
  { id: "xp_1000",     icon: "🏆", title: "Élite",         desc: "Alcanza 1000 XP",          check: (_v: number, _s: number, x: number) => x >= 1000                        },
  { id: "topics_2",    icon: "📚", title: "Explorador",    desc: "Completa 2 módulos",       check: (_v: number, _s: number, _x: number, t: number) => t >= 2               },
  { id: "topics_4",    icon: "🎓", title: "Avanzado",      desc: "Completa 4 módulos",       check: (_v: number, _s: number, _x: number, t: number) => t >= 4               },
  { id: "topics_8",    icon: "👑", title: "Graduado",      desc: "Completa el curso",        check: (_v: number, _s: number, _x: number, t: number) => t >= 8               },
  { id: "chat_5",      icon: "💬", title: "Conversador",   desc: "5 sesiones de chatbot",    check: (_v: number, _s: number, _x: number, _t: number, c: number) => c >= 5   },
  { id: "videos_10",   icon: "🎬", title: "Cinéfilo",      desc: "Ve 10 videos",             check: (v: number) => v >= 10                                                   },
]

export default function StudentProfile() {
  const router = useRouter()
  const { user, token, isLoading, refreshProgress } = useAuth()

  const [showTutorial, setShowTutorial] = useState(false)
  const [avatarColor,  setAvatarColor]  = useState("violet")
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

  if (isLoading || !user || user.role !== "student") {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner /></div>
  }

  const progress       = user.progress!
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
    <div className="min-h-screen bg-background">
      {showTutorial && (
        <OnboardingTutorial userId={user.id} onClose={() => setShowTutorial(false)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard/student">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />Volver
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">Mi Perfil</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-primary/20 via-primary/5 to-background border border-border/50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          <div className="relative p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-24 h-24 rounded-2xl ${colorObj.bg} flex items-center justify-center text-white text-3xl font-bold shadow-lg`}>
                {initials}
              </div>
              <button
                onClick={() => setShowColorPicker(v => !v)}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {showColorPicker && (
                <div className="absolute top-full mt-3 left-0 bg-card border border-border rounded-xl p-3 shadow-xl z-10 flex gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setAvatarColor(c.id); setShowColorPicker(false) }}
                      className={`w-7 h-7 rounded-full ${c.bg} ${avatarColor === c.id ? `ring-2 ${c.ring} ring-offset-2 ring-offset-card` : ""} transition-all hover:scale-110`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
              <p className="text-muted-foreground text-sm mb-3">{user.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-4">
                <Badge className="bg-primary/20 text-primary border-0">Nivel {progress.level}</Badge>
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">{progress.totalXP.toLocaleString()} XP</Badge>
                <Badge variant="outline" className="border-orange-500/30 text-orange-400">🔥 {progress.streak} días</Badge>
              </div>
              <div className="max-w-xs mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Nivel {progress.level}</span>
                  <span>{xpInLevel}/500 XP → Nivel {progress.level + 1}</span>
                </div>
                <Progress value={xpPct} className="h-2" />
              </div>

              {/* Tutorial button — always visible */}
              <button
                onClick={() => setShowTutorial(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Ver tutorial de la plataforma
              </button>
            </div>

            {/* Byte decoration */}
            <div className="hidden lg:block flex-shrink-0">
              <ByteMascot expression="happy" size={110} />
            </div>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Zap,           value: progress.totalXP,         label: "XP Total",       color: "text-primary",    bg: "bg-primary/10"    },
            { icon: Video,         value: progress.videosWatched,   label: "Videos vistos",  color: "text-blue-400",   bg: "bg-blue-500/10"   },
            { icon: Flame,         value: progress.streak,          label: "Racha (días)",   color: "text-orange-400", bg: "bg-orange-500/10" },
            { icon: MessageSquare, value: progress.chatbotSessions, label: "Sesiones chat",  color: "text-purple-400", bg: "bg-purple-500/10" },
          ].map((s, i) => (
            <Card key={i} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">

          {/* ── Logros preview ────────────────────────────────────────── */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />Logros
                </CardTitle>
                <Link href="/dashboard/student/achievements">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary">
                    Ver todos <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
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
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {shown.slice(0, 6).map(a => {
                        const isUnlocked = unlocked.some(u => u.id === a.id)
                        return (
                          <div key={a.id} className={`p-2.5 rounded-xl border text-center transition-all ${
                            isUnlocked ? "bg-primary/10 border-primary/30" : "bg-secondary/30 border-border/30 opacity-40 grayscale"
                          }`}>
                            <div className="text-lg mb-0.5">{a.icon}</div>
                            <p className="text-xs font-semibold leading-tight truncate">{a.title}</p>
                            {isUnlocked && <CheckCircle2 className="w-3 h-3 text-primary mx-auto mt-1" />}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {unlocked.length} / 40 logros desbloqueados
                    </p>
                  </>
                )
              })()}
            </CardContent>
          </Card>

          {/* ── Progreso del curso ────────────────────────────────────── */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />Progreso del curso
                </CardTitle>
                <span className="text-sm font-mono text-primary">{completedCount}/8</span>
              </div>
              <Progress value={(completedCount / 8) * 100} className="h-2 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {TOPICS.map((t, i) => {
                  const done    = progress.completedTopics.includes(t.id)
                  const current = progress.currentTopic === t.id
                  const locked  = !done && i > 0 && !progress.completedTopics.includes(TOPICS[i - 1].id)
                  return (
                    <div key={t.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${
                      done ? "bg-primary/10" : current ? "bg-accent/10" : "bg-secondary/20"
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        done ? "bg-primary/30 text-primary" : current ? "bg-accent/30 text-accent" : "bg-secondary text-muted-foreground"
                      }`}>
                        {done    ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : locked ? <Lock className="w-3 h-3" />
                        : <span className="text-xs font-bold">{i + 1}</span>}
                      </div>
                      <span className={`text-sm flex-1 ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {t.name}
                      </span>
                      {done    && <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">✓</Badge>}
                      {current && !done && <Badge variant="secondary" className="text-xs bg-accent/20 text-accent border-0">Activo</Badge>}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Nivel de habilidad por tema (Elo adaptativo) ──────────────── */}
        {skills.length > 0 && (
          <Card className="bg-card/50 border-border/50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />Tu nivel de habilidad
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Se ajusta automáticamente según cómo respondes las preguntas dentro de los videos.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-2">
                {skills.map(s => {
                  const topic = TOPICS.find(t => t.id === s.topicId)
                  const { label, className } = eloLabel(s.elo)
                  return (
                    <div key={s.topicId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/30">
                      <span className="text-sm">{topic?.name ?? s.topicId}</span>
                      <Badge variant="outline" className={`text-xs ${className}`}>{label}</Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">

          {/* ── Información personal ───────────────────────────────── */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />Información personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre</label>
                <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary/50 border-border" placeholder="Tu nombre" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input value={user.email} disabled className="bg-secondary/30 border-border opacity-60" />
                <p className="text-xs text-muted-foreground">El email no se puede modificar</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color del avatar</label>
                <div className="flex gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button key={c.id} onClick={() => setAvatarColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.bg} ${avatarColor === c.id ? `ring-2 ${c.ring} ring-offset-2 ring-offset-card` : ""} transition-all hover:scale-110`}
                    />
                  ))}
                </div>
              </div>
              {infoMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${infoMsg.ok ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
                  {infoMsg.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {infoMsg.text}
                </div>
              )}
              <Button onClick={handleSaveInfo} disabled={savingInfo} className="w-full bg-primary hover:bg-primary/90 gap-2">
                {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar cambios
              </Button>
            </CardContent>
          </Card>

          {/* ── Cambiar contraseña ─────────────────────────────────── */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />Cambiar contraseña
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Contraseña actual", val: curPw,     set: setCurPw,     ph: "••••••••"                  },
                { label: "Nueva contraseña",  val: newPw,     set: setNewPw,     ph: "Mínimo 6 caracteres"       },
                { label: "Confirmar nueva",   val: confirmPw, set: setConfirmPw, ph: "Repite la nueva contraseña"},
              ].map(f => (
                <div key={f.label} className="space-y-1.5">
                  <label className="text-sm font-medium">{f.label}</label>
                  <Input type="password" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="bg-secondary/50 border-border" />
                </div>
              ))}
              {pwMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${pwMsg.ok ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
                  {pwMsg.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {pwMsg.text}
                </div>
              )}
              <Button onClick={handleChangePw} disabled={savingPw} className="w-full bg-primary hover:bg-primary/90 gap-2">
                {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Cambiar contraseña
              </Button>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}
