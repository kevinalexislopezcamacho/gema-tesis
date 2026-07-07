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
  BookOpen, Zap, TrendingUp, Film, Pause, Pencil, X, UserCircle, Gauge
} from "lucide-react"
import { eloLabel } from "@/lib/utils"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

const TOPICS = [
  { id: "datos",               name: "Tipos de Datos"       },
  { id: "operaciones-logicas", name: "Operaciones Lógicas"  },
  { id: "filtros",             name: "Filtros"              },
  { id: "condicionales",       name: "Condicionales"        },
  { id: "bucles",              name: "Bucles"               },
  { id: "funciones",           name: "Funciones"            },
  { id: "arreglos",            name: "Arreglos"             },
  { id: "matrices",            name: "Matrices"             },
]

const NIVELES = [
  { id: "fácil",    label: "Fácil",    color: "bg-green-500/20 text-green-400 border-green-500/30"   },
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
        setGenSuccess(`✅ Video "${d.data.titulo}" generado exitosamente`)
        fetchVideos()
        setGenTema(""); setGenSubtema(""); setGenNivel("medio")
        setTimeout(() => { setGenOpen(false); setGenSuccess("") }, 2500)
      } else {
        setGenError(d.error || "Error al generar el video")
      }
    } catch {
      setGenError("No se pudo conectar. ¿Está corriendo el servicio Python?")
    }
    setGenerating(false)
  }

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("¿Eliminar este video?")) return
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
      setEditError("Error de conexión")
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold">CodePath<span className="text-primary">AI</span></span>
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">Docente</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/profile">
              <Avatar className="w-8 h-8 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="hidden md:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground leading-tight">Docente</p>
            </div>
            <Link href="/dashboard/admin/profile">
              <Button variant="ghost" size="icon" className="hidden md:flex" title="Mi perfil">
                <UserCircle className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsCards.map((s, i) => (
            <Card key={i} className="bg-card/50 border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="videos">
          <TabsList className="mb-6 bg-secondary/50">
            <TabsTrigger value="videos"    className="gap-2"><Film className="w-4 h-4" />Videos</TabsTrigger>
            <TabsTrigger value="students"  className="gap-2"><Users className="w-4 h-4" />Estudiantes</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="w-4 h-4" />Analíticas</TabsTrigger>
          </TabsList>

          {/* ── VIDEOS ─────────────────────────────────────────────────────── */}
          <TabsContent value="videos">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Biblioteca de videos</h2>
                <p className="text-sm text-muted-foreground">
                  {videos.length} video{videos.length !== 1 ? "s" : ""} generado{videos.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Modal generación */}
              <Dialog open={genOpen} onOpenChange={setGenOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-primary hover:bg-primary/90">
                    <Sparkles className="w-4 h-4" />Generar video con IA
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Film className="w-5 h-5 text-primary" />Crear nuevo video educativo
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-5 pt-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tema del módulo</label>
                      <Select value={genTema} onValueChange={setGenTema}>
                        <SelectTrigger className="bg-secondary/50 border-border">
                          <SelectValue placeholder="Selecciona el tema..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TOPICS.map(t => (
                            <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subtema específico</label>
                      <Input
                        placeholder="Ej: if, else y elif en Python"
                        value={genSubtema}
                        onChange={e => setGenSubtema(e.target.value)}
                        className="bg-secondary/50 border-border"
                        disabled={generating}
                      />
                      <p className="text-xs text-muted-foreground">Sé específico para obtener mejores resultados</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nivel de dificultad</label>
                      <div className="grid grid-cols-3 gap-2">
                        {NIVELES.map(n => (
                          <button
                            key={n.id}
                            onClick={() => setGenNivel(n.id)}
                            disabled={generating}
                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                              genNivel === n.id
                                ? n.color + " border-current"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {genError && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{genError}
                      </div>
                    )}
                    {genSuccess && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">{genSuccess}</div>
                    )}
                    {!generating && !genSuccess && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground flex gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                        La generación tarda entre 1 y 3 minutos. No cierres esta ventana.
                      </div>
                    )}
                    {generating && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <Loader2 className="w-4 h-4 animate-spin" />Generando guión, slides y audio...
                        </div>
                        <Progress className="h-1.5 animate-pulse" />
                      </div>
                    )}

                    <Button
                      onClick={handleGenerateVideo}
                      disabled={generating || !!genSuccess}
                      className="w-full bg-primary hover:bg-primary/90 gap-2"
                    >
                      {generating
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Generando video...</>
                        : <><Sparkles className="w-4 h-4" />Generar video</>
                      }
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Grid de videos */}
            {videos.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border rounded-2xl">
                <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No hay videos generados aún</p>
                <p className="text-sm text-muted-foreground mt-1">Usa el botón "Generar video con IA" para crear el primero</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map(v => (
                  <Card key={v.id} className="bg-card/50 border-border hover:border-primary/30 transition-all overflow-hidden">
                    <div className="relative aspect-video bg-secondary">
                      {playingId === v.id ? (
                        <video
                          src={v.videoUrl}
                          controls
                          autoPlay
                          className="w-full h-full object-cover"
                          onEnded={() => setPlayingId(null)}
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                            <Film className="w-12 h-12 text-primary/40" />
                          </div>
                          <button
                            onClick={() => setPlayingId(v.id)}
                            className="absolute inset-0 flex items-center justify-center group"
                          >
                            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-110">
                              <Play className="w-6 h-6 text-white ml-1" />
                            </div>
                          </button>
                          <div className="absolute top-2 right-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              NIVELES.find(n => n.id === v.nivel)?.color || "bg-secondary text-muted-foreground border-border"
                            }`}>
                              {v.nivel}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{v.titulo}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{v.subtema}</p>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.duracionEstimada}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{v.slides} slides</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs border-border"
                          onClick={() => setPlayingId(playingId === v.id ? null : v.id)}
                        >
                          {playingId === v.id
                            ? <><Pause className="w-3 h-3" />Cerrar</>
                            : <><Play className="w-3 h-3" />Ver</>
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs border-border hover:border-primary/50"
                          onClick={() => openEditModal(v)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteVideo(v.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── ESTUDIANTES ──────────────────────────────────────────────────── */}
          <TabsContent value="students">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Estudiantes</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar estudiante..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-secondary/50 border-border"
                />
              </div>
            </div>

            <Card className="bg-card/50 border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>Videos</TableHead>
                    <TableHead>Racha</TableHead>
                    <TableHead>Progreso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Spinner /></TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay estudiantes</TableCell></TableRow>
                  ) : filtered.map(s => {
                    const completed = parseTopics(s.progress?.completedTopics).length
                    return (
                      <TableRow
                        key={s.id}
                        className="border-border cursor-pointer hover:bg-secondary/30 transition-colors"
                        onClick={() => setProfileStudent(s)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-primary/20 text-primary text-xs">{s.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">Nv. {s.progress?.level || 1}</Badge></TableCell>
                        <TableCell className="font-mono text-sm text-yellow-400">{(s.progress?.totalXP || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{s.progress?.videosWatched || 0}</TableCell>
                        <TableCell className="text-sm">🔥 {s.progress?.streak || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 w-32">
                            <Progress value={(completed / 8) * 100} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground">{completed}/8</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ── ANALÍTICAS ───────────────────────────────────────────────────── */}
          <TabsContent value="analytics">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-card/50 border-border p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />Progreso general
                </h3>
                <div className="space-y-4">
                  {TOPICS.map(t => {
                    const count = students.filter(s =>
                      parseTopics(s.progress?.completedTopics).includes(t.id)
                    ).length
                    const pct = students.length > 0 ? Math.round((count / students.length) * 100) : 0
                    return (
                      <div key={t.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{t.name}</span>
                          <span className="text-muted-foreground">{count}/{students.length}</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card className="bg-card/50 border-border p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />Ranking de estudiantes
                </h3>
                <div className="space-y-3">
                  {[...students]
                    .sort((a, b) => (b.progress?.totalXP || 0) - (a.progress?.totalXP || 0))
                    .slice(0, 5)
                    .map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="text-lg w-6">{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm">{s.name}</span>
                        <span className="text-sm font-mono text-yellow-400">{(s.progress?.totalXP || 0).toLocaleString()} XP</span>
                      </div>
                    ))}
                  {students.length === 0 && <p className="text-sm text-muted-foreground">No hay datos aún</p>}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Modal edición de video ───────────────────────────────────────── */}
      {editVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />Editar video
              </h2>
              <button onClick={() => setEditVideo(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Título</label>
                <Input
                  value={editTitulo}
                  onChange={e => setEditTitulo(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subtema</label>
                <Input
                  value={editSubtema}
                  onChange={e => setEditSubtema(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nivel</label>
                <div className="grid grid-cols-3 gap-2">
                  {NIVELES.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setEditNivel(n.id)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                        editNivel === n.id
                          ? n.color + " border-current"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>

              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditVideo(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleUpdateVideo} disabled={editSaving}>
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal perfil de estudiante ───────────────────────────────────── */}
      {profileStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Perfil del estudiante</h2>
              <button onClick={() => setProfileStudent(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-14 h-14 border border-primary/30">
                <AvatarFallback className="bg-primary/20 text-primary text-xl">
                  {profileStudent.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-lg">{profileStudent.name}</p>
                <p className="text-sm text-muted-foreground">{profileStudent.email}</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  Nivel {profileStudent.progress?.level || 1}
                </Badge>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "XP Total",       value: (profileStudent.progress?.totalXP || 0).toLocaleString(), color: "text-yellow-400" },
                { label: "Videos vistos",  value: profileStudent.progress?.videosWatched || 0,              color: "text-blue-400"   },
                { label: "Racha",          value: `${profileStudent.progress?.streak || 0} días`,           color: "text-orange-400" },
                { label: "Sesiones chat",  value: profileStudent.progress?.chatbotSessions || 0,            color: "text-purple-400" },
              ].map((s, i) => (
                <div key={i} className="bg-secondary/50 rounded-xl p-3">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Topic progress */}
            <div>
              <p className="text-sm font-medium mb-3">Progreso por módulo</p>
              <div className="space-y-2">
                {TOPICS.map(t => {
                  const done = parseTopics(profileStudent.progress?.completedTopics).includes(t.id)
                  const isCurrent = profileStudent.progress?.currentTopic === t.id
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        done ? "bg-primary" : isCurrent ? "bg-accent" : "bg-border"
                      }`} />
                      <span className={`text-sm flex-1 ${done ? "text-foreground" : "text-muted-foreground"}`}>
                        {t.name}
                      </span>
                      {done && <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">✓</Badge>}
                      {isCurrent && !done && <Badge variant="secondary" className="text-xs bg-accent/20 text-accent border-0">En progreso</Badge>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Nivel de habilidad (Elo adaptativo) */}
            {profileStudent.topicSkills && profileStudent.topicSkills.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />Nivel de habilidad (Elo)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {profileStudent.topicSkills.map(s => {
                    const topic = TOPICS.find(t => t.id === s.topicId)
                    const { label, className } = eloLabel(s.elo)
                    return (
                      <div key={s.topicId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/30">
                        <span className="text-xs">{topic?.name ?? s.topicId}</span>
                        <Badge variant="outline" className={`text-xs ${className}`}>{label}</Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
