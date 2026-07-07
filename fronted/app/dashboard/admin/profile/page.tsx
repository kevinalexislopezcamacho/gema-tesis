"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import {
  Terminal, LogOut, Users, Film, Zap, Play,
  TrendingUp, Save, KeyRound, User, UserCircle,
  Loader2, CheckCircle, AlertCircle,
  BarChart3, Award, BookOpen, CheckCircle2, X, Menu
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
  { id: "amber",  bg: "bg-amber-600",  ring: "ring-amber-400"  },
  { id: "violet", bg: "bg-violet-600", ring: "ring-violet-400" },
  { id: "blue",   bg: "bg-blue-600",   ring: "ring-blue-400"   },
  { id: "teal",   bg: "bg-teal-600",   ring: "ring-teal-400"   },
  { id: "rose",   bg: "bg-rose-600",   ring: "ring-rose-400"   },
  { id: "slate",  bg: "bg-slate-600",  ring: "ring-slate-400"  },
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
  const { user, token, isLoading, refreshProgress, logout } = useAuth()

  const [students,    setStudents]    = useState<Student[]>([])
  const [videos,      setVideos]      = useState<VideoItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarColor, setAvatarColor] = useState("amber")

  const [name,       setName]       = useState("")
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg,    setInfoMsg]    = useState<{ ok: boolean; text: string } | null>(null)

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

  const initials  = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const colorObj  = AVATAR_COLORS.find(c => c.id === avatarColor) ?? AVATAR_COLORS[0]

  const totalXP       = students.reduce((a, s) => a + (s.progress?.totalXP || 0), 0)
  const totalVideos   = students.reduce((a, s) => a + (s.progress?.videosWatched || 0), 0)
  const avgLevel      = students.length > 0
    ? (students.reduce((a, s) => a + (s.progress?.level || 1), 0) / students.length).toFixed(1)
    : "—"
  const avgCompletion = students.length > 0
    ? Math.round(students.reduce((a, s) => a + parseTopics(s.progress?.completedTopics).length, 0) / (students.length * 8) * 100)
    : 0

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
  const coverageTotal    = coverage.reduce((a, t) => a + t.niveles.filter(n => n.has).length, 0)
  const coveragePossible = TOPICS.length * NIVELES.length

  const topStudents = [...students]
    .sort((a, b) => (b.progress?.totalXP || 0) - (a.progress?.totalXP || 0))
    .slice(0, 5)

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
        bg-[oklch(0.10_0.025_240)] border-r border-border/50
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border/40 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold tracking-tight text-sm">CodePath<span className="text-primary">AI</span></span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-3 mb-3">Docente</p>
          <Link href="/dashboard/admin" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />Panel
          </Link>
          <Link href="/dashboard/admin/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary/15 text-primary border border-primary/20">
            <UserCircle className="w-4 h-4 flex-shrink-0" />Mi Perfil
          </Link>
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-border/40 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-8 h-8 border border-amber-500/30 flex-shrink-0">
              <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-amber-400/70 leading-tight">Docente</p>
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0 text-muted-foreground" onClick={() => { logout(); router.push("/") }}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border/40 bg-background/60 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold">Mi Perfil — Docente</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Métricas de plataforma y configuración de cuenta</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
            Docente
          </span>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5">

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/40 bg-[oklch(0.10_0.025_240)] p-5 md:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-20 h-20 rounded-2xl ${colorObj.bg} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                {initials}
              </div>
              <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <span className="text-[8px] font-bold text-amber-400">DC</span>
              </div>
            </div>

            {/* Info */}
            <div className="text-center sm:text-left flex-1 min-w-0">
              <h2 className="text-xl font-bold mb-0.5">{user.name}</h2>
              <p className="text-muted-foreground text-sm mb-3">{user.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-semibold">
                  <Users className="w-3 h-3" />{students.length} estudiantes
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-semibold">
                  <Film className="w-3 h-3" />{videos.length} videos
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold font-mono">
                  <BookOpen className="w-3 h-3" />{coverageTotal}/{coveragePossible} lecciones
                </span>
              </div>
            </div>
          </div>

          {/* ── Stats tiles ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Users, value: students.length,          label: "ESTUDIANTES",    bg: "bg-blue-500/10",   border: "border-l-blue-500",   text: "text-blue-400"   },
              { icon: Film,  value: videos.length,            label: "VIDEOS CREADOS", bg: "bg-purple-500/10", border: "border-l-purple-500", text: "text-purple-400" },
              { icon: Zap,   value: totalXP.toLocaleString(), label: "XP GENERADO",    bg: "bg-yellow-500/10", border: "border-l-yellow-500", text: "text-yellow-400" },
              { icon: Play,  value: totalVideos,              label: "VIDEOS VISTOS",  bg: "bg-green-500/10",  border: "border-l-green-500",  text: "text-green-400"  },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} border border-border/40 border-l-2 ${s.border} rounded-2xl p-4 flex items-center gap-3`}>
                <s.icon className={`w-4 h-4 ${s.text} flex-shrink-0`} />
                <div>
                  <p className={`text-xl font-bold font-mono leading-tight ${s.text}`}>{s.value}</p>
                  <p className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── 2-col: Cobertura + Estadísticas de clase ─────────────────── */}
          <div className="grid md:grid-cols-2 gap-4">

            {/* Cobertura de contenido */}
            <div className="rounded-2xl border border-border/40 bg-card/40 p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />Cobertura de contenido
                </h3>
                <span className="text-xs font-mono text-muted-foreground">{coverageTotal}/{coveragePossible}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden mb-4">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${(coverageTotal / coveragePossible) * 100}%` }} />
              </div>
              {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
                <div className="space-y-1">
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    <div />
                    {NIVELES.map(n => (
                      <div key={n} className="text-center text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">{n}</div>
                    ))}
                  </div>
                  {coverage.map(t => (
                    <div key={t.id} className="grid grid-cols-4 gap-1 items-center">
                      <span className="text-[10px] text-muted-foreground truncate pr-1">{t.name.split(" ")[0]}</span>
                      {t.niveles.map(n => (
                        <div key={n.nivel} className={`h-8 rounded-lg flex items-center justify-center text-sm ${
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
            </div>

            {/* Derecha: stats de clase + ranking */}
            <div className="space-y-4">

              {/* Estadísticas de clase */}
              <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />Estadísticas de clase
                </h3>
                {loading ? <Spinner /> : (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Nivel promedio",  value: avgLevel,              color: "text-accent"      },
                      { label: "% completado",    value: `${avgCompletion}%`,   color: "text-primary"     },
                      { label: "XP total",        value: totalXP.toLocaleString(), color: "text-yellow-400" },
                      { label: "Videos vistos",   value: totalVideos,           color: "text-green-400"   },
                    ].map((s, i) => (
                      <div key={i} className="bg-secondary/40 rounded-xl p-3">
                        <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ranking */}
              <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-yellow-400" />Ranking
                </h3>
                {loading ? <Spinner /> : students.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No hay estudiantes aún</p>
                ) : (
                  <div className="space-y-2">
                    {topStudents.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                        <span className="text-sm w-5 text-center">{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">Nv. {s.progress?.level || 1} · {parseTopics(s.progress?.completedTopics).length}/8</p>
                        </div>
                        <span className="text-xs font-mono text-yellow-400 flex-shrink-0">{(s.progress?.totalXP || 0).toLocaleString()} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Progreso de la clase por módulo ──────────────────────────── */}
          <div className="rounded-2xl border border-border/40 bg-card/40 p-4 md:p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />Progreso de la clase por módulo
            </h3>
            {loading ? <Spinner /> : (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {TOPICS.map(t => {
                  const count = students.filter(s => parseTopics(s.progress?.completedTopics).includes(t.id)).length
                  const pct   = students.length > 0 ? Math.round((count / students.length) * 100) : 0
                  return (
                    <div key={t.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{t.name}</span>
                        <span className="text-muted-foreground font-mono">{count}/{students.length} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 2-col: Editar info + Cambiar contraseña ──────────────────── */}
          <div className="grid md:grid-cols-2 gap-4 pb-6">

            {/* Información personal */}
            <div className="rounded-2xl border border-border/40 bg-card/40 p-4 md:p-5">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-primary" />Información personal
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Nombre</label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary/50 border-border h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Email</label>
                  <Input value={user.email} disabled className="bg-secondary/30 border-border opacity-60 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Color del avatar</label>
                  <div className="flex gap-2">
                    {AVATAR_COLORS.map(c => (
                      <button key={c.id} onClick={() => setAvatarColor(c.id)}
                        className={`w-6 h-6 rounded-full ${c.bg} ${avatarColor === c.id ? `ring-2 ${c.ring} ring-offset-2 ring-offset-card` : ""} hover:scale-110 transition-all`}
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
            <div className="rounded-2xl border border-border/40 bg-card/40 p-4 md:p-5">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <KeyRound className="w-4 h-4 text-primary" />Cambiar contraseña
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Contraseña actual", val: curPw,     set: setCurPw,     ph: "••••••••"            },
                  { label: "Nueva contraseña",  val: newPw,     set: setNewPw,     ph: "Mínimo 6 caracteres" },
                  { label: "Confirmar nueva",   val: confirmPw, set: setConfirmPw, ph: "Repite la nueva"     },
                ].map(f => (
                  <div key={f.label} className="space-y-1.5">
                    <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{f.label}</label>
                    <Input type="password" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="bg-secondary/50 border-border h-9 text-sm" />
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
        </main>
      </div>
    </div>
  )
}
