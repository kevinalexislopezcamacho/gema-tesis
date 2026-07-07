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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeft, Users, Video, Zap, Play, Film,
  TrendingUp, Save, KeyRound, User,
  Loader2, CheckCircle, AlertCircle,
  BarChart3, Award, BookOpen, CheckCircle2, X
} from "lucide-react"

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

const NIVELES = ["fácil", "medio", "avanzado"] as const

const AVATAR_COLORS = [
  { id: "amber",  bg: "bg-amber-600",   ring: "ring-amber-400"   },
  { id: "violet", bg: "bg-violet-600",  ring: "ring-violet-400"  },
  { id: "blue",   bg: "bg-blue-600",    ring: "ring-blue-400"    },
  { id: "teal",   bg: "bg-teal-600",    ring: "ring-teal-400"    },
  { id: "rose",   bg: "bg-rose-600",    ring: "ring-rose-400"    },
  { id: "slate",  bg: "bg-slate-600",   ring: "ring-slate-400"   },
]

interface Student {
  id: string; name: string; email: string
  progress?: { totalXP: number; level: number; streak: number; videosWatched: number; completedTopics: string | string[]; chatbotSessions: number }
}

interface VideoItem {
  id: string; titulo: string; tema: string; subtema: string; nivel: string; createdAt: string
}

function parseTopics(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

export default function AdminProfile() {
  const router = useRouter()
  const { user, token, isLoading, refreshProgress } = useAuth()

  const [students, setStudents] = useState<Student[]>([])
  const [videos,   setVideos]   = useState<VideoItem[]>([])
  const [loading,  setLoading]  = useState(true)

  const [avatarColor, setAvatarColor] = useState("amber")

  // Edit info
  const [name,       setName]       = useState("")
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg,    setInfoMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  // Change password
  const [curPw,     setCurPw]     = useState("")
  const [newPw,     setNewPw]     = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [savingPw,  setSavingPw]  = useState(false)
  const [pwMsg,     setPwMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) router.push("/login")
    if (user) { setName(user.name); setAvatarColor(user.avatar || "amber") }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user && token) fetchData()
  }, [user, token])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sr, vr] = await Promise.all([
        fetch(`${API}/students`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/videos`,   { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [sd, vd] = await Promise.all([sr.json(), vr.json()])
      if (sd.success) setStudents(sd.data)
      if (vd.success) setVideos(vd.data)
    } catch {}
    setLoading(false)
  }

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

  if (isLoading || !user) return (
    <div className="min-h-screen bg-background flex items-center justify-center"><Spinner /></div>
  )

  const initials   = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const colorObj   = AVATAR_COLORS.find(c => c.id === avatarColor) ?? AVATAR_COLORS[0]

  // Platform stats
  const totalXP       = students.reduce((a, s) => a + (s.progress?.totalXP || 0), 0)
  const totalVideos   = students.reduce((a, s) => a + (s.progress?.videosWatched || 0), 0)
  const avgLevel      = students.length > 0
    ? (students.reduce((a, s) => a + (s.progress?.level || 1), 0) / students.length).toFixed(1)
    : "—"
  const avgCompletion = students.length > 0
    ? Math.round(students.reduce((a, s) => a + parseTopics(s.progress?.completedTopics).length, 0) / (students.length * 8) * 100)
    : 0

  // Coverage matrix: topic × nivel → has video?
  const coverage = TOPICS.map(t => ({
    ...t,
    niveles: NIVELES.map(n => ({
      nivel: n,
      has: videos.some(v =>
        (v.tema.toLowerCase().includes(t.name.toLowerCase()) ||
         t.name.toLowerCase().includes(v.tema.toLowerCase())) &&
        v.nivel.toLowerCase() === n.toLowerCase()
      )
    }))
  }))

  const coverageTotal   = coverage.reduce((a, t) => a + t.niveles.filter(n => n.has).length, 0)
  const coveragePossible = TOPICS.length * NIVELES.length

  // Top students
  const topStudents = [...students]
    .sort((a, b) => (b.progress?.totalXP || 0) - (a.progress?.totalXP || 0))
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />Volver
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">Mi Perfil — Docente</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-amber-500/15 via-primary/5 to-background border border-border/50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
          <div className="relative p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative flex-shrink-0">
              <div className={`w-24 h-24 rounded-2xl ${colorObj.bg} flex items-center justify-center text-white text-3xl font-bold shadow-lg`}>
                {initials}
              </div>
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Docente</Badge>
              </div>
              <p className="text-muted-foreground text-sm mb-4">{user.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <Badge variant="outline" className="border-border gap-1">
                  <Users className="w-3 h-3" />{students.length} estudiantes
                </Badge>
                <Badge variant="outline" className="border-border gap-1">
                  <Film className="w-3 h-3" />{videos.length} videos creados
                </Badge>
                <Badge variant="outline" className="border-border gap-1">
                  <BookOpen className="w-3 h-3" />{coverageTotal}/{coveragePossible} lecciones cubiertas
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats de plataforma ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Users,    value: students.length,         label: "Estudiantes",       color: "text-blue-400",    bg: "bg-blue-500/10"    },
            { icon: Film,     value: videos.length,           label: "Videos creados",    color: "text-purple-400",  bg: "bg-purple-500/10"  },
            { icon: Zap,      value: totalXP.toLocaleString(),label: "XP total generado", color: "text-yellow-400",  bg: "bg-yellow-500/10"  },
            { icon: Play,     value: totalVideos,             label: "Videos vistos",     color: "text-green-400",   bg: "bg-green-500/10"   },
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

          {/* ── Cobertura de contenido ────────────────────────────────────── */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />Cobertura de contenido
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {coverageTotal}/{coveragePossible}
                </Badge>
              </div>
              <Progress value={(coverageTotal / coveragePossible) * 100} className="h-1.5 mt-2" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
                <div className="space-y-1">
                  {/* Header row */}
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    <div />
                    {NIVELES.map(n => (
                      <div key={n} className="text-center text-xs font-medium text-muted-foreground capitalize">{n}</div>
                    ))}
                  </div>
                  {coverage.map(t => (
                    <div key={t.id} className="grid grid-cols-4 gap-1 items-center">
                      <span className="text-xs text-muted-foreground truncate pr-1">{t.name.split(" ")[0]}</span>
                      {t.niveles.map(n => (
                        <div key={n.nivel} className={`h-8 rounded-md flex items-center justify-center text-sm ${
                          n.has
                            ? "bg-primary/20 border border-primary/30 text-primary"
                            : "bg-secondary/40 border border-border/30 text-muted-foreground/40"
                        }`}>
                          {n.has ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Rendimiento de estudiantes ───────────────────────────────── */}
          <div className="space-y-4">

            {/* Estadísticas de clase */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />Estadísticas de clase
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Spinner /> : (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Nivel promedio", value: avgLevel,         color: "text-accent"     },
                      { label: "% completado",   value: `${avgCompletion}%`, color: "text-primary" },
                      { label: "XP total",       value: totalXP.toLocaleString(), color: "text-yellow-400" },
                      { label: "Videos vistos",  value: totalVideos,     color: "text-green-400"  },
                    ].map((s, i) => (
                      <div key={i} className="bg-secondary/40 rounded-xl p-3">
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ranking */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-400" />Ranking de estudiantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Spinner /> : students.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No hay estudiantes aún</p>
                ) : (
                  <div className="space-y-2">
                    {topStudents.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                        <span className="text-base w-5 text-center">{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">Nv. {s.progress?.level || 1} · {parseTopics(s.progress?.completedTopics).length}/8 módulos</p>
                        </div>
                        <span className="text-sm font-mono text-yellow-400 flex-shrink-0">{(s.progress?.totalXP || 0).toLocaleString()} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Progreso por tema (todos los estudiantes) ───────────────────── */}
        <Card className="bg-card/50 border-border/50 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />Progreso de la clase por módulo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Spinner /> : (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {TOPICS.map(t => {
                  const count = students.filter(s => parseTopics(s.progress?.completedTopics).includes(t.id)).length
                  const pct   = students.length > 0 ? Math.round((count / students.length) * 100) : 0
                  return (
                    <div key={t.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-sm">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{count}/{students.length} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">

          {/* ── Información personal ──────────────────────────────────────── */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />Información personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input value={user.email} disabled className="bg-secondary/30 border-border opacity-60" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color del avatar</label>
                <div className="flex gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setAvatarColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.bg} ${avatarColor === c.id ? `ring-2 ${c.ring} ring-offset-2 ring-offset-card` : ""} transition-all hover:scale-110`}
                    />
                  ))}
                </div>
              </div>

              {infoMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                  infoMsg.ok
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : "bg-destructive/10 border border-destructive/20 text-destructive"
                }`}>
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

          {/* ── Cambiar contraseña ────────────────────────────────────────── */}
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
                  <Input
                    type="password"
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="bg-secondary/50 border-border"
                  />
                </div>
              ))}

              {pwMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                  pwMsg.ok
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : "bg-destructive/10 border border-destructive/20 text-destructive"
                }`}>
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
