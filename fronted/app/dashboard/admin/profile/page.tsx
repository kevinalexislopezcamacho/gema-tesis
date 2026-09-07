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
  LogOut, Users, Film, Zap, Play,
  TrendingUp, Save, KeyRound, User, UserCircle,
  Loader2, CheckCircle, AlertCircle,
  BarChart3, Award, BookOpen, CheckCircle2, X, Menu, HelpCircle
} from "lucide-react"
import { useTopics } from "@/hooks/use-topics"
import { useTour } from "@/contexts/tour-context"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

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
  const { topics: TOPICS } = useTopics()
  const { startTour } = useTour()

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
        <div className="p-4 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-8 h-8 border border-amber-500/30 flex-shrink-0">
              <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-amber-600 leading-tight">Docente</p>
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
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border bg-background/60 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold">Mi Perfil — Docente</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Métricas de plataforma y configuración de cuenta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startTour}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ver tutorial</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
              Docente
            </span>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">

          {/* ── Banner (full-bleed) ──────────────────────────────────────── */}
          <div className="h-24 md:h-28 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

          <div className="max-w-4xl mx-auto px-4 md:px-8 pb-16">

            {/* Avatar, overlapping the banner */}
            <div className="-mt-10 mb-5">
              <div className="relative inline-block flex-shrink-0">
                <div className={`w-20 h-20 rounded-2xl ${colorObj.bg} flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-background`}>
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-amber-500">DC</span>
                </div>
              </div>
            </div>

            {/* Name + email */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-0.5">{user.name}</h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-10">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-sm font-medium">
                <Users className="w-3.5 h-3.5" />{students.length} estudiantes
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-sm font-medium">
                <Film className="w-3.5 h-3.5" />{videos.length} videos
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium font-mono">
                <BookOpen className="w-3.5 h-3.5" />{coverageTotal}/{coveragePossible} lecciones
              </span>
            </div>

            {/* ── Stats row — open, no boxes ──────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-t border-b border-border py-6 mb-12">
              {[
                { icon: Users, value: students.length,          label: "ESTUDIANTES",    text: "text-blue-500"   },
                { icon: Film,  value: videos.length,            label: "VIDEOS CREADOS", text: "text-purple-500" },
                { icon: Zap,   value: totalXP.toLocaleString(), label: "XP GENERADO",    text: "text-yellow-500" },
                { icon: Play,  value: totalVideos,              label: "VIDEOS VISTOS",  text: "text-green-500"  },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-1 px-2">
                  <s.icon className={`w-5 h-5 ${s.text}`} />
                  <span className="text-2xl font-bold font-mono text-foreground">{s.value}</span>
                  <span className="text-[10px] tracking-widest text-muted-foreground text-center">{s.label}</span>
                </div>
              ))}
            </div>

            {/* ── Cobertura de contenido ───────────────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-[18px] h-[18px] text-primary" />
                  <h2 className="text-foreground">Cobertura de contenido</h2>
                </div>
                <span className="text-sm text-muted-foreground font-mono">{coverageTotal}/{coveragePossible}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden mb-6">
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
                    <div key={t.id} className="grid grid-cols-4 gap-1 items-center py-1 border-b border-border/60 last:border-b-0">
                      <span className="text-xs text-muted-foreground truncate pr-1">{t.name.split(" ")[0]}</span>
                      {t.niveles.map(n => (
                        <div key={n.nivel} className="flex items-center justify-center">
                          {n.has ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <X className="w-3.5 h-3.5 text-muted-foreground/40" />}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="h-px bg-border mb-12" />

            {/* ── Estadísticas de clase + Ranking ──────────────────────────── */}
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border gap-y-10 mb-12">

              {/* Estadísticas de clase */}
              <div className="md:pr-10">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-[18px] h-[18px] text-primary" />
                  <h2 className="text-foreground">Estadísticas de clase</h2>
                </div>
                {loading ? <Spinner /> : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    {[
                      { label: "Nivel promedio",  value: avgLevel,              color: "text-accent"     },
                      { label: "% completado",    value: `${avgCompletion}%`,   color: "text-primary"    },
                      { label: "XP total",        value: totalXP.toLocaleString(), color: "text-yellow-500" },
                      { label: "Videos vistos",   value: totalVideos,           color: "text-green-500"  },
                    ].map((s, i) => (
                      <div key={i}>
                        <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ranking */}
              <div className="md:pl-10">
                <div className="flex items-center gap-2 mb-5">
                  <Award className="w-[18px] h-[18px] text-yellow-500" />
                  <h2 className="text-foreground">Ranking</h2>
                </div>
                {loading ? <Spinner /> : students.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">No hay estudiantes aún</p>
                ) : (
                  <div className="space-y-1">
                    {topStudents.map((s, i) => (
                      <div key={s.id} className={`flex items-center gap-2.5 py-2 ${i < topStudents.length - 1 ? "border-b border-border/60" : ""}`}>
                        <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? "bg-amber-400/25 text-amber-600" :
                          i === 1 ? "bg-slate-400/25 text-slate-500" :
                          i === 2 ? "bg-orange-400/25 text-orange-600" :
                          "bg-secondary text-muted-foreground"
                        }`}>{i + 1}</span>
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">Nv. {s.progress?.level || 1} · {parseTopics(s.progress?.completedTopics).length}/8</p>
                        </div>
                        <span className="text-xs font-mono text-yellow-500 flex-shrink-0">{(s.progress?.totalXP || 0).toLocaleString()} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-border mb-12" />

            {/* ── Progreso de la clase por módulo ──────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-[18px] h-[18px] text-primary" />
                <h2 className="text-foreground">Progreso de la clase por módulo</h2>
              </div>
              {loading ? <Spinner /> : (
                <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
                  {TOPICS.map(t => {
                    const count = students.filter(s => parseTopics(s.progress?.completedTopics).includes(t.id)).length
                    const pct   = students.length > 0 ? Math.round((count / students.length) * 100) : 0
                    return (
                      <div key={t.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{t.name}</span>
                          <span className="text-muted-foreground font-mono text-xs">{count}/{students.length} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <div className="h-px bg-border mb-12" />

            {/* ── Información personal + Cambiar contraseña ─────────────────── */}
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border gap-y-10">

              {/* Información personal */}
              <div className="md:pr-10">
                <div className="flex items-center gap-2 mb-5">
                  <User className="w-[18px] h-[18px] text-primary" />
                  <h2 className="text-foreground">Información personal</h2>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Nombre</label>
                    <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary/40 border-border h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Email</label>
                    <Input value={user.email} disabled className="bg-secondary/20 border-border opacity-60 h-9 text-sm" />
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
