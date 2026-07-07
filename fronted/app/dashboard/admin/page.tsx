"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Terminal, LogOut, Users, Video, BarChart3, Trash2, Search,
  Sparkles, Play, Clock, AlertCircle, Loader2,
  BookOpen, Zap, TrendingUp, Film, Pause, Pencil, X, UserCircle, Gauge, Menu
} from "lucide-react"
import { eloLabel } from "@/lib/utils"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

const TOPICS = [
  { id: "datos",               name: "Tipos de Datos"       },
  { id: "operaciones-logicas", name: "Operaciones LÃ³gicas"  },
  { id: "filtros",             name: "Filtros"              },
  { id: "condicionales",       name: "Condicionales"        },
  { id: "bucles",              name: "Bucles"               },
  { id: "funciones",           name: "Funciones"            },
  { id: "arreglos",            name: "Arreglos"             },
  { id: "matrices",            name: "Matrices"             },
]

const NIVELES = [
  { id: "fÃ¡cil",    label: "FÃ¡cil",    color: "bg-green-500/20 text-green-400 border-green-500/30"   },
  { id: "medio",    label: "Medio",    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: "avanzado", label: "Avanzado", color: "bg-red-500/20 text-red-400 border-red-500/30"         },
]

interface Student {
  id: string; name: string; email: string; role: string
  progress?: { totalXP: number; level: number; streak: number; videosWatched: number; completedTopics: string | string[]; chatbotSessions: number; currentTopic: string | null }
  topicSkills?: { topicId: string; elo: number }[]
}

interface VideoItem {
  id: string; titulo: string; tema: string; subtema: string
  nivel: string; duracionEstimada: string; videoUrl: string
  slides: number; status: string; createdAt: string
}

function parseTopics(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

export default function AdminDashboard() {
  const router   = useRouter()
  const { user, token, logout, isLoading } = useAuth()

  const [students,    setStudents]    = useState<Student[]>([])
  const [videos,      setVideos]      = useState<VideoItem[]>([])
  const [search,      setSearch]      = useState("")
  const [loadingData, setLoadingData] = useState(true)
  const [playingId,   setPlayingId]   = useState<string | null>(null)

  // Generate video form
  const [genTema,    setGenTema]    = useState("")
  const [genSubtema, setGenSubtema] = useState("")
  const [genNivel,   setGenNivel]   = useState("medio")
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState("")
  const [genSuccess, setGenSuccess] = useState("")
  const [genOpen,    setGenOpen]    = useState(false)

  // Edit video
  const [editVideo,    setEditVideo]    = useState<VideoItem | null>(null)
  const [editTitulo,   setEditTitulo]   = useState("")
  const [editSubtema,  setEditSubtema]  = useState("")
  const [editNivel,    setEditNivel]    = useState("medio")
  const [editSaving,   setEditSaving]   = useState(false)
  const [editError,    setEditError]    = useState("")

  // Student profile
  const [profileStudent, setProfileStudent] = useState<Student | null>(null)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) router.push("/login")
  }, [isLoading, user, router])

  useEffect(() => {
    if (user && token) { fetchStudents(); fetchVideos() }
  }, [user, token])

  const fetchStudents = async () => {
    try {
      const r = await fetch(`${API}/students`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (d.success) setStudents(d.data)
    } catch {}
    setLoadingData(false)
  }

  const fetchVideos = async () => {
    try {
      const r = await fetch(`${API}/videos`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (d.success) setVideos(d.data)
    } catch {}
  }

  const handleGenerateVideo = async () => {
    if (!genTema || !genSubtema) { setGenError("Selecciona un tema y escribe el subtema"); return }
    setGenerating(true); setGenError(""); setGenSuccess("")
    try {
      const r = await fetch(`${API}/videos/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tema: genTema, subtema: genSubtema, nivel: genNivel }),
      })
      const d = await r.json()
      if (d.success) {
        setGenSuccess(`âœ… Video "${d.data.titulo}" generado exitosamente`)
        fetchVideos()
        setGenTema(""); setGenSubtema(""); setGenNivel("medio")
        setTimeout(() => { setGenOpen(false); setGenSuccess("") }, 2500)
      } else {
        setGenError(d.error || "Error al generar el video")
      }
    } catch {
      setGenError("No se pudo conectar. Â¿EstÃ¡ corriendo el servicio Python?")
    }
    setGenerating(false)
  }

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Â¿Eliminar este video?")) return
    await fetch(`${API}/videos/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    if (playingId === id) setPlayingId(null)
    fetchVideos()
  }

  const openEditModal = (v: VideoItem) => {
    setEditVideo(v)
    setEditTitulo(v.titulo)
    setEditSubtema(v.subtema)
    setEditNivel(v.nivel)
    setEditError("")
  }

  const handleUpdateVideo = async () => {
    if (!editVideo) return
    setEditSaving(true); setEditError("")
    try {
      const r = await fetch(`${API}/videos/${editVideo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ titulo: editTitulo, subtema: editSubtema, nivel: editNivel }),
      })
      const d = await r.json()
      if (d.success) {
        setEditVideo(null)
        fetchVideos()
      } else {
        setEditError(d.error || "Error al guardar")
      }
    } catch {
      setEditError("Error de conexiÃ³n")
    }
    setEditSaving(false)
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  const statsCards = [
    { label: "Estudiantes",    value: students.length,                                                            icon: Users, color: "text-blue-400"   },
    { label: "Videos creados", value: videos.length,                                                              icon: Video, color: "text-purple-400" },
    { label: "XP total",       value: students.reduce((a, s) => a + (s.progress?.totalXP || 0), 0),              icon: Zap,   color: "text-yellow-400" },
    { label: "Videos vistos",  value: students.reduce((a, s) => a + (s.progress?.videosWatched || 0), 0),        icon: Play,  color: "text-green-400"  },
  ]

  if (isLoading || !user) return (
    <div className="min-h-screen bg-background flex items-center justify-center"><Spinner /></div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <aside className={`fixed md:static z-50 md:z-auto inset-y-0 left-0 w-60 flex-shrink-0 flex flex-col bg-[oklch(0.10_0.025_240)] border-r border-border/50 transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border/40 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold tracking-tight text-sm">CodePath<span className="text-primary">AI</span></span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-3 mb-3">Docente</p>
          <Link href="/dashboard/admin" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary/15 text-primary border border-primary/20">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />Panel
          </Link>
          <Link href="/dashboard/admin/profile" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
            <UserCircle className="w-4 h-4 flex-shrink-0" />Mi Perfil
          </Link>
        </nav>
        <div className="p-4 border-t border-border/40 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-8 h-8 border border-amber-500/30 flex-shrink-0">
              <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-bold">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-amber-400/70 leading-tight">Docente</p>
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0 text-muted-foreground" onClick={logout}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* â”€â”€ Main area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border/40 bg-background/60 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm font-semibold">Panel del Docente</span>
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">Docente</Badge>
            </div>
          </div>
          <Link href="/dashboard/admin/profile">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-bold">{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block">{user.name}</span>
            </button>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {statsCards.map((s, i) => (
              <div key={i} className={`border border-border/40 border-l-2 rounded-2xl p-4 flex items-center gap-3 ${["border-l-blue-400 bg-blue-500/5","border-l-violet-400 bg-violet-500/5","border-l-yellow-400 bg-yellow-500/5","border-l-green-400 bg-green-500/5"][i]}`}>
                <s.icon className={`w-4 h-4 flex-shrink-0 ${s.color}`} />
                <div>
                  <p className={`text-xl font-bold font-mono leading-tight ${s.color}`}>{s.value.toLocaleString()}</p>
                  <p className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="videos">
            <TabsList className="bg-secondary/40 border border-border/30 p-1 rounded-xl">
              <TabsTrigger value="videos"    className="rounded-lg gap-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"><Film className="w-4 h-4" />Videos</TabsTrigger>
              <TabsTrigger value="students"  className="rounded-lg gap-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"><Users className="w-4 h-4" />Estudiantes</TabsTrigger>
              <TabsTrigger value="analytics" className="rounded-lg gap-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"><BarChart3 className="w-4 h-4" />AnalÃ­ticas</TabsTrigger>
            </TabsList>

            {/* Videos */}
            <TabsContent value="videos" className="mt-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold">Biblioteca de videos</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{videos.length} video{videos.length !== 1 ? "s" : ""} generado{videos.length !== 1 ? "s" : ""}</p>
                </div>
                <Dialog open={genOpen} onOpenChange={setGenOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white border-0 shadow-lg shadow-primary/20">
                      <Sparkles className="w-4 h-4" />Generar con IA
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2"><Film className="w-5 h-5 text-primary" />Crear nuevo video educativo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 pt-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tema del mÃ³dulo</label>
                        <Select value={genTema} onValueChange={setGenTema}>
                          <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Selecciona el tema..." /></SelectTrigger>
                          <SelectContent>{TOPICS.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Subtema especÃ­fico</label>
                        <Input placeholder="Ej: if, else y elif en Python" value={genSubtema} onChange={e => setGenSubtema(e.target.value)} className="bg-secondary/50 border-border" disabled={generating} />
                        <p className="text-xs text-muted-foreground">SÃ© especÃ­fico para mejores resultados</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nivel de dificultad</label>
                        <div className="grid grid-cols-3 gap-2">
                          {NIVELES.map(n => (
                            <button key={n.id} onClick={() => setGenNivel(n.id)} disabled={generating}
                              className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${genNivel === n.id ? n.color + " border-current" : "border-border/50 text-muted-foreground hover:border-primary/50"}`}>
                              {n.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {genError && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{genError}</div>}
                      {genSuccess && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">{genSuccess}</div>}
                      {!generating && !genSuccess && (
                        <div className="p-3 rounded-xl bg-secondary/40 border border-border/30 text-xs text-muted-foreground flex gap-2">
                          <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary" />La generaciÃ³n tarda entre 1 y 3 minutos. No cierres esta ventana.
                        </div>
                      )}
                      {generating && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-primary"><Loader2 className="w-4 h-4 animate-spin" />Generando guiÃ³n, slides y audio...</div>
                          <Progress className="h-1 animate-pulse" />
                        </div>
                      )}
                      <Button onClick={handleGenerateVideo} disabled={generating || !!genSuccess} className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white border-0 gap-2">
                        {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</> : <><Sparkles className="w-4 h-4" />Generar video</>}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {videos.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border/40 rounded-2xl">
                  <Film className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground">No hay videos generados aÃºn</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map(v => (
                    <div key={v.id} className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden hover:border-primary/30 transition-all group">
                      <div className="relative aspect-video bg-secondary/50">
                        {playingId === v.id ? (
                          <video src={v.videoUrl} controls autoPlay className="w-full h-full object-cover" onEnded={() => setPlayingId(null)} />
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center">
                              <Film className="w-10 h-10 text-primary/30" />
                            </div>
                            <button onClick={() => setPlayingId(v.id)} className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-110">
                                <Play className="w-5 h-5 text-white ml-0.5" />
                              </div>
                            </button>
                            <div className="absolute top-2 right-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${NIVELES.find(n => n.id === v.nivel)?.color || "bg-secondary text-muted-foreground border-border"}`}>{v.nivel}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-sm mb-1 line-clamp-2 leading-snug">{v.titulo}</h3>
                        <p className="text-xs text-muted-foreground mb-3">{v.subtema}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.duracionEstimada}</span>
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{v.slides} slides</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs border-border/50 hover:border-primary/40" onClick={() => setPlayingId(playingId === v.id ? null : v.id)}>
                            {playingId === v.id ? <><Pause className="w-3 h-3" />Cerrar</> : <><Play className="w-3 h-3" />Ver</>}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-xs border-border/50 hover:border-primary/40" onClick={() => openEditModal(v)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="outline" className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteVideo(v.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Estudiantes */}
            <TabsContent value="students" className="mt-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold">Estudiantes</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{students.length} registrado{students.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50 rounded-xl h-9 text-sm" />
                </div>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/30 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-xs font-semibold tracking-wide">Estudiante</TableHead>
                      <TableHead className="text-xs font-semibold tracking-wide">Nivel</TableHead>
                      <TableHead className="text-xs font-semibold tracking-wide">XP</TableHead>
                      <TableHead className="text-xs font-semibold tracking-wide">Videos</TableHead>
                      <TableHead className="text-xs font-semibold tracking-wide">Racha</TableHead>
                      <TableHead className="text-xs font-semibold tracking-wide">Progreso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingData ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8"><Spinner /></TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No hay estudiantes</TableCell></TableRow>
                    ) : filtered.map(s => {
                      const completed = parseTopics(s.progress?.completedTopics).length
                      return (
                        <TableRow key={s.id} className="border-border/30 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setProfileStudent(s)}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-8 h-8 flex-shrink-0"><AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{s.name.charAt(0)}</AvatarFallback></Avatar>
                              <div>
                                <p className="font-medium text-sm">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs border-border/50">Nv. {s.progress?.level || 1}</Badge></TableCell>
                          <TableCell className="font-mono text-sm text-yellow-400">{(s.progress?.totalXP || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.progress?.videosWatched || 0}</TableCell>
                          <TableCell className="text-sm">ðŸ”¥ {s.progress?.streak || 0}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 w-28">
                              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${(completed / 8) * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{completed}/8</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* AnalÃ­ticas */}
            <TabsContent value="analytics" className="mt-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Progreso por mÃ³dulo</h3>
                  <div className="space-y-3">
                    {TOPICS.map(t => {
                      const count = students.filter(s => parseTopics(s.progress?.completedTopics).includes(t.id)).length
                      const pct   = students.length > 0 ? Math.round((count / students.length) * 100) : 0
                      return (
                        <div key={t.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{t.name}</span>
                            <span className="font-mono text-muted-foreground">{count}/{students.length}</span>
                          </div>
                          <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />Top 5 estudiantes</h3>
                  <div className="space-y-3">
                    {[...students].sort((a, b) => (b.progress?.totalXP || 0) - (a.progress?.totalXP || 0)).slice(0, 5).map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="text-base w-5 flex-shrink-0">{["ðŸ¥‡","ðŸ¥ˆ","ðŸ¥‰","4ï¸âƒ£","5ï¸âƒ£"][i]}</span>
                        <Avatar className="w-7 h-7 flex-shrink-0"><AvatarFallback className="bg-primary/20 text-primary text-xs">{s.name.charAt(0)}</AvatarFallback></Avatar>
                        <span className="flex-1 text-sm truncate">{s.name}</span>
                        <span className="text-sm font-mono text-yellow-400 flex-shrink-0">{(s.progress?.totalXP || 0).toLocaleString()} XP</span>
                      </div>
                    ))}
                    {students.length === 0 && <p className="text-sm text-muted-foreground">No hay datos aÃºn</p>}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* â”€â”€ Modal ediciÃ³n de video â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {editVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Editar video</h2>
              <button onClick={() => setEditVideo(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">TÃ­tulo</label>
                <Input value={editTitulo} onChange={e => setEditTitulo(e.target.value)} className="bg-secondary/50 border-border/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subtema</label>
                <Input value={editSubtema} onChange={e => setEditSubtema(e.target.value)} className="bg-secondary/50 border-border/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nivel</label>
                <div className="grid grid-cols-3 gap-2">
                  {NIVELES.map(n => (
                    <button key={n.id} onClick={() => setEditNivel(n.id)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${editNivel === n.id ? n.color + " border-current" : "border-border/50 text-muted-foreground hover:border-primary/50"}`}>
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 border-border/50" onClick={() => setEditVideo(null)}>Cancelar</Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleUpdateVideo} disabled={editSaving}>
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Modal perfil de estudiante â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {profileStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-5 border-b border-border/40 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14 border border-primary/30">
                  <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">{profileStudent.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-lg leading-tight">{profileStudent.name}</p>
                  <p className="text-sm text-muted-foreground">{profileStudent.email}</p>
                  <Badge variant="outline" className="mt-1.5 text-xs border-border/50">Nivel {profileStudent.progress?.level || 1}</Badge>
                </div>
              </div>
              <button onClick={() => setProfileStudent(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "XP Total",       value: (profileStudent.progress?.totalXP || 0).toLocaleString(), color: "text-yellow-400" },
                  { label: "Videos vistos",  value: profileStudent.progress?.videosWatched || 0,              color: "text-blue-400"   },
                  { label: "Racha",          value: `${profileStudent.progress?.streak || 0} dÃ­as`,           color: "text-orange-400" },
                  { label: "Sesiones chat",  value: profileStudent.progress?.chatbotSessions || 0,            color: "text-violet-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-secondary/30 rounded-xl p-3 border border-border/30">
                    <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold mb-3">Progreso por mÃ³dulo</p>
                <div className="space-y-2">
                  {TOPICS.map(t => {
                    const done = parseTopics(profileStudent.progress?.completedTopics).includes(t.id)
                    const isCurrent = profileStudent.progress?.currentTopic === t.id
                    return (
                      <div key={t.id} className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${done ? "bg-primary" : isCurrent ? "bg-accent" : "bg-border"}`} />
                        <span className={`text-sm flex-1 ${done ? "text-foreground" : "text-muted-foreground"}`}>{t.name}</span>
                        {done && <span className="text-xs text-primary font-semibold">âœ“</span>}
                        {isCurrent && !done && <span className="text-xs text-accent">Activo</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
              {profileStudent.topicSkills && profileStudent.topicSkills.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />Nivel de habilidad (Elo)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {profileStudent.topicSkills.map(s => {
                      const topic = TOPICS.find(t => t.id === s.topicId)
                      const { label, className } = eloLabel(s.elo)
                      return (
                        <div key={s.topicId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-secondary/30 border border-border/30">
                          <span className="text-xs truncate">{topic?.name ?? s.topicId}</span>
                          <Badge variant="outline" className={`text-xs flex-shrink-0 ${className}`}>{label}</Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
