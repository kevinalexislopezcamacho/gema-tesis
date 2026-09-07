"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
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
  LogOut, Users, Video, BarChart3, Trash2, Search,
  Sparkles, Play, Clock, AlertCircle, Loader2,
  BookOpen, Zap, TrendingUp, Film, Pause, Pencil, X, UserCircle, Gauge, Check, Flame, UserPlus, ClipboardList
} from "lucide-react"
import { eloLabel } from "@/lib/utils"
import { AnalyticsReport } from "@/components/dashboard/AnalyticsReport"
import { useTopics } from "@/hooks/use-topics"
import { useTour } from "@/contexts/tour-context"
import type { AdminTab } from "@/lib/tour/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

const NIVELES = [
  { id: "fácil",    label: "Fácil",    color: "bg-green-500/15 text-green-700 border-green-500/30"   },
  { id: "medio",    label: "Medio",    color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
  { id: "avanzado", label: "Avanzado", color: "bg-red-500/15 text-red-700 border-red-500/30"         },
]

interface Student {
  id: string; name: string; email: string; role: string
  progress?: { totalXP: number; level: number; streak: number; videosWatched: number; completedTopics: string | string[]; chatbotSessions: number; currentTopic: string | null }
  topicSkills?: { topicId: string; elo: number }[]
}

interface VideoItem {
  id: string; titulo: string; tema: string; subtema: string
  nivel: string; lenguaje: string; duracionEstimada: string; videoUrl: string
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
  const { topics: TOPICS, loading: topicsLoading, refresh: refreshTopics } = useTopics()
  const { registerAdminTabSetter } = useTour()
  const [activeTab, setActiveTab] = useState<AdminTab>("videos")

  useEffect(() => {
    registerAdminTabSetter(setActiveTab)
  }, [registerAdminTabSetter])

  const [students,    setStudents]    = useState<Student[]>([])
  const [videos,      setVideos]      = useState<VideoItem[]>([])
  const [search,      setSearch]      = useState("")
  const [loadingData, setLoadingData] = useState(true)
  const [playingId,   setPlayingId]   = useState<string | null>(null)

  const [genTema,     setGenTema]     = useState("")
  const [genSubtema,  setGenSubtema]  = useState("")
  const [genNivel,    setGenNivel]    = useState("medio")
  const [genLenguaje, setGenLenguaje] = useState("python")
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState("")
  const [genSuccess, setGenSuccess] = useState("")
  const [genOpen,    setGenOpen]    = useState(false)

  const [filterNivel,      setFilterNivel]      = useState("todos")
  const [filterTema,       setFilterTema]       = useState("todos")
  const [importingQ,       setImportingQ]       = useState(false)
  const [regeneratingQ,    setRegeneratingQ]    = useState(false)
  const [importMsg,        setImportMsg]        = useState<{ ok: boolean; text: string } | null>(null)

  const [editVideo,     setEditVideo]     = useState<VideoItem | null>(null)
  const [editTitulo,    setEditTitulo]    = useState("")
  const [editSubtema,   setEditSubtema]   = useState("")
  const [editNivel,     setEditNivel]     = useState("medio")
  const [editLenguaje,  setEditLenguaje]  = useState("python")
  const [editSaving,    setEditSaving]    = useState(false)
  const [editError,     setEditError]     = useState("")

  const [profileStudent, setProfileStudent] = useState<Student | null>(null)

  // ── Estudiantes (CRUD) ──────────────────────────────────────────────
  const [studentModal, setStudentModal] = useState<{ mode: "create" | "edit"; studentId: string } | null>(null)
  const [stuName,      setStuName]      = useState("")
  const [stuEmail,     setStuEmail]     = useState("")
  const [stuPassword,  setStuPassword]  = useState("")
  const [stuSaving,    setStuSaving]    = useState(false)
  const [stuError,     setStuError]     = useState("")

  // ── Módulos (Topic CRUD) ──────────────────────────────────────────────
  const [moduleModal,   setModuleModal]   = useState<{ mode: "create" | "edit"; topicId: string } | null>(null)
  const [modId,         setModId]         = useState("")
  const [modName,       setModName]       = useState("")
  const [modIcon,       setModIcon]       = useState("")
  const [modDesc,       setModDesc]       = useState("")
  const [modSaving,     setModSaving]     = useState(false)
  const [modError,      setModError]      = useState("")
  const [modConfirm,    setModConfirm]    = useState<{ action: () => void; message: string } | null>(null)

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
        body: JSON.stringify({ tema: genTema, subtema: genSubtema, nivel: genNivel, lenguaje: genLenguaje }),
      })
      const d = await r.json()
      if (d.success) {
        setGenSuccess(`Video "${d.data.titulo}" generado exitosamente`)
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
    setEditLenguaje(v.lenguaje || "python")
    setEditError("")
  }

  const handleUpdateVideo = async () => {
    if (!editVideo) return
    setEditSaving(true); setEditError("")
    try {
      const r = await fetch(`${API}/videos/${editVideo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ titulo: editTitulo, subtema: editSubtema, nivel: editNivel, lenguaje: editLenguaje }),
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

  const handleImportQuestions = async (force = false) => {
    if (force) { setRegeneratingQ(true) } else { setImportingQ(true) }
    setImportMsg(null)
    try {
      const url = force ? `${API}/videos/import-questions?force=true` : `${API}/videos/import-questions`
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await r.json()
      if (d.success) {
        const { imported, skipped, errors } = d.data
        const msg = force
          ? `${imported} videos regenerados con preguntas nuevas${errors.length ? ` (${errors.length} errores)` : ""}`
          : `${imported} videos actualizados, ${skipped} ya tenían preguntas${errors.length ? ` (${errors.length} errores)` : ""}`
        setImportMsg({ ok: true, text: msg })
      } else {
        setImportMsg({ ok: false, text: d.error || "Error al importar" })
      }
    } catch {
      setImportMsg({ ok: false, text: "Error de conexión" })
    }
    if (force) { setRegeneratingQ(false) } else { setImportingQ(false) }
    setTimeout(() => setImportMsg(null), 8000)
  }

  // ── Módulos (Topic CRUD) ──────────────────────────────────────────────
  const videosForTopicName = (name: string) => videos.filter(v => v.tema === name)

  const openCreateModule = () => {
    setModId(""); setModName(""); setModIcon(""); setModDesc("")
    setModError("")
    setModuleModal({ mode: "create", topicId: "" })
  }

  const openEditModule = (t: { id: string; name: string; icon: string; description: string }) => {
    setModId(t.id); setModName(t.name); setModIcon(t.icon); setModDesc(t.description)
    setModError("")
    setModuleModal({ mode: "edit", topicId: t.id })
  }

  const saveModule = async () => {
    if (!modId || !modName || !modIcon || !modDesc) {
      setModError("Completa todos los campos"); return
    }
    setModSaving(true); setModError("")
    try {
      const isCreate = moduleModal?.mode === "create"
      const r = await fetch(`${API}/topics${isCreate ? "" : `/${moduleModal!.topicId}`}`, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          isCreate
            ? { id: modId, name: modName, icon: modIcon, description: modDesc }
            : { name: modName, icon: modIcon, description: modDesc }
        ),
      })
      const d = await r.json()
      if (d.success) {
        setModuleModal(null)
        refreshTopics()
      } else {
        setModError(d.error || "Error al guardar el módulo")
      }
    } catch {
      setModError("Error de conexión")
    }
    setModSaving(false)
  }

  const handleSaveModule = () => {
    const original = TOPICS.find(t => t.id === modId)
    const renaming = moduleModal?.mode === "edit" && original && original.name !== modName
    const affected = renaming ? videosForTopicName(original!.name) : []
    if (affected.length > 0) {
      setModConfirm({
        message: `Este módulo tiene ${affected.length} video${affected.length !== 1 ? "s" : ""} generado${affected.length !== 1 ? "s" : ""} con el nombre "${original!.name}". Si lo renombras, esos videos ya no aparecerán para los estudiantes (seguirán existiendo, pero no se podrán encontrar bajo el nuevo nombre). ¿Continuar?`,
        action: saveModule,
      })
    } else {
      saveModule()
    }
  }

  const handleDeleteModule = (t: { id: string; name: string }) => {
    const affected = videosForTopicName(t.name)
    const doDelete = async () => {
      await fetch(`${API}/topics/${t.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      refreshTopics()
    }
    if (affected.length > 0) {
      setModConfirm({
        message: `Este módulo tiene ${affected.length} video${affected.length !== 1 ? "s" : ""} generado${affected.length !== 1 ? "s" : ""}. Si lo eliminas, esos videos dejarán de aparecer para los estudiantes. ¿Eliminar de todas formas?`,
        action: doDelete,
      })
    } else {
      doDelete()
    }
  }

  // ── Estudiantes (CRUD) ──────────────────────────────────────────────
  const openCreateStudent = () => {
    setStuName(""); setStuEmail(""); setStuPassword("")
    setStuError("")
    setStudentModal({ mode: "create", studentId: "" })
  }

  const openEditStudent = (s: Student) => {
    setStuName(s.name); setStuEmail(s.email); setStuPassword("")
    setStuError("")
    setStudentModal({ mode: "edit", studentId: s.id })
  }

  const saveStudent = async () => {
    const isCreate = studentModal?.mode === "create"
    if (!stuName.trim() || !stuEmail.trim() || (isCreate && !stuPassword)) {
      setStuError("Completa nombre, email y contraseña"); return
    }
    setStuSaving(true); setStuError("")
    try {
      const body: Record<string, string> = { name: stuName.trim(), email: stuEmail.trim() }
      if (stuPassword) body.password = stuPassword
      const r = await fetch(`${API}/students${isCreate ? "" : `/${studentModal!.studentId}`}`, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.success) {
        setStudentModal(null)
        fetchStudents()
      } else {
        setStuError(d.error || "Error al guardar el estudiante")
      }
    } catch {
      setStuError("Error de conexión")
    }
    setStuSaving(false)
  }

  const handleDeleteStudent = (s: Student) => {
    const doDelete = async () => {
      await fetch(`${API}/students/${s.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      fetchStudents()
    }
    setModConfirm({
      message: `Vas a eliminar la cuenta de "${s.name}". Se borrará también todo su progreso, videos vistos, intentos de preguntas y chat. Esta acción no se puede deshacer. ¿Eliminar de todas formas?`,
      action: doDelete,
    })
  }

  const statsCards = [
    { label: "Estudiantes",    value: students.length,                                                            icon: Users, color: "text-blue-600"   },
    { label: "Videos creados", value: videos.length,                                                              icon: Video, color: "text-violet-600" },
    { label: "XP total",       value: students.reduce((a, s) => a + (s.progress?.totalXP || 0), 0),              icon: Zap,   color: "text-amber-600" },
    { label: "Videos vistos",  value: students.reduce((a, s) => a + (s.progress?.videosWatched || 0), 0),        icon: Play,  color: "text-emerald-600"  },
  ]

  if (isLoading || !user) return (
    <div className="min-h-screen bg-background flex items-center justify-center"><Spinner /></div>
  )

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top header (replaces the sidebar) ──────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo-icon.png" alt="GEMA" className="w-8 h-8 object-contain" />
              <span className="font-bold text-sm tracking-tight hidden sm:inline">GEMA</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/dashboard/admin" className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold bg-primary/10 text-primary">
                <BarChart3 className="w-3.5 h-3.5" />Panel
              </Link>
              <Link href="/dashboard/admin/profile" className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <UserCircle className="w-3.5 h-3.5" />Mi Perfil
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-700 hidden sm:inline-flex">Docente</Badge>
            <Avatar className="w-9 h-9 border border-amber-500/25">
              <AvatarFallback className="bg-amber-500/15 text-amber-700 text-xs font-bold">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={logout}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Stats (inline) */}
        <div className="flex items-center gap-8 flex-wrap">
          {statsCards.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <s.icon className={`w-4 h-4 flex-shrink-0 ${s.color}`} />
              <div>
                <p className={`text-lg font-bold font-mono leading-tight ${s.color}`}>{s.value.toLocaleString()}</p>
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as AdminTab)}>
          <TabsList className="bg-secondary/70 p-1 rounded-xl max-w-full overflow-x-auto justify-start">
            <TabsTrigger value="videos"    data-tour-id="tab-videos"    className="rounded-lg gap-2 text-sm flex-shrink-0 data-[state=active]:bg-card data-[state=active]:shadow-sm"><Film className="w-4 h-4" />Videos</TabsTrigger>
            <TabsTrigger value="students"  data-tour-id="tab-students"  className="rounded-lg gap-2 text-sm flex-shrink-0 data-[state=active]:bg-card data-[state=active]:shadow-sm"><Users className="w-4 h-4" />Estudiantes</TabsTrigger>
            <TabsTrigger value="analytics" data-tour-id="tab-analytics" className="rounded-lg gap-2 text-sm flex-shrink-0 data-[state=active]:bg-card data-[state=active]:shadow-sm"><BarChart3 className="w-4 h-4" />Analíticas</TabsTrigger>
            <TabsTrigger value="modules"   data-tour-id="tab-modules"   className="rounded-lg gap-2 text-sm flex-shrink-0 data-[state=active]:bg-card data-[state=active]:shadow-sm"><BookOpen className="w-4 h-4" />Módulos</TabsTrigger>
            <TabsTrigger value="report"    data-tour-id="tab-report"    className="rounded-lg gap-2 text-sm flex-shrink-0 data-[state=active]:bg-card data-[state=active]:shadow-sm"><ClipboardList className="w-4 h-4" />Reporte</TabsTrigger>
          </TabsList>

          {/* Videos */}
          <TabsContent value="videos" data-tour-id="video-grid" className="mt-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold">Biblioteca de videos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{videos.length} video{videos.length !== 1 ? "s" : ""} generado{videos.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => handleImportQuestions(false)} disabled={importingQ || regeneratingQ} className="gap-2 text-xs">
                  {importingQ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {importingQ ? "Generando..." : "Activar preguntas IA"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleImportQuestions(true)} disabled={importingQ || regeneratingQ} className="gap-2 text-xs border-orange-500/30 text-orange-600 hover:bg-orange-500/10">
                  {regeneratingQ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {regeneratingQ ? "Regenerando..." : "Regenerar preguntas"}
                </Button>
                <Dialog open={genOpen} onOpenChange={setGenOpen}>
                <DialogTrigger asChild>
                  <Button data-tour-id="btn-generate-video" className="scroll-mt-24 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                    <Sparkles className="w-4 h-4" />Generar con IA
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Film className="w-5 h-5 text-primary" />Crear nuevo video educativo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 pt-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tema del módulo</label>
                      <Select value={genTema} onValueChange={setGenTema}>
                        <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Selecciona el tema..." /></SelectTrigger>
                        <SelectContent>{TOPICS.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subtema específico</label>
                      <Input placeholder="Ej: if, else y elif en Python" value={genSubtema} onChange={e => setGenSubtema(e.target.value)} className="bg-secondary/50 border-border" disabled={generating} />
                      <p className="text-xs text-muted-foreground">Sé específico para mejores resultados</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nivel de dificultad</label>
                      <div className="grid grid-cols-3 gap-2">
                        {NIVELES.map(n => (
                          <button key={n.id} onClick={() => setGenNivel(n.id)} disabled={generating}
                            className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${genNivel === n.id ? n.color + " border-current" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Lenguaje de programación</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "python",     label: "Python",     color: "text-blue-600 bg-blue-500/15 border-blue-500/40"   },
                          { id: "cpp",        label: "C++",        color: "text-cyan-600 bg-cyan-500/15 border-cyan-500/40"   },
                          { id: "java",       label: "Java",       color: "text-orange-600 bg-orange-500/15 border-orange-500/40" },
                          { id: "javascript", label: "JavaScript", color: "text-yellow-600 bg-yellow-500/15 border-yellow-500/40" },
                        ].map(l => (
                          <button key={l.id} onClick={() => setGenLenguaje(l.id)} disabled={generating}
                            className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${genLenguaje === l.id ? l.color + " border-current" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {genError && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{genError}</div>}
                    {genSuccess && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25 text-green-700 text-sm">{genSuccess}</div>}
                    {!generating && !genSuccess && (
                      <div className="p-3 rounded-xl bg-secondary/60 text-xs text-muted-foreground flex gap-2">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary" />La generación tarda entre 1 y 3 minutos. No cierres esta ventana.
                      </div>
                    )}
                    {generating && (
                      <div className="space-y-2">
                        <div className="rounded-2xl overflow-hidden bg-secondary/60 flex justify-center">
                          <video autoPlay loop muted playsInline preload="auto" className="w-28 h-28">
                            <source src="/byte/byte-generating.webm" type="video/webm" />
                            <source src="/byte/byte-generating.mp4" type="video/mp4" />
                          </video>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-primary"><Loader2 className="w-4 h-4 animate-spin" />Generando guión, slides y audio...</div>
                        <Progress className="h-1 animate-pulse" />
                      </div>
                    )}
                    <Button onClick={handleGenerateVideo} disabled={generating || !!genSuccess} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                      {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</> : <><Sparkles className="w-4 h-4" />Generar video</>}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            {importMsg && (
              <div className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
                importMsg.ok ? "bg-green-500/10 border-green-500/20 text-green-700" : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}>
                {importMsg.text}
              </div>
            )}

            {/* Filtros: módulo y dificultad */}
            {videos.length > 0 && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Select value={filterTema} onValueChange={setFilterTema}>
                  <SelectTrigger className="w-56 bg-secondary/50 border-border h-8 text-xs">
                    <SelectValue placeholder="Todos los módulos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los módulos</SelectItem>
                    {TOPICS.map(t => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 flex-wrap">
                  {[{ id: "todos", label: "Todos" }, ...NIVELES].map(n => (
                    <button
                      key={n.id}
                      onClick={() => setFilterNivel(n.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        filterNivel === n.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const filteredVideos = videos
                .filter(v => filterNivel === "todos" || v.nivel.toLowerCase() === filterNivel)
                .filter(v => filterTema === "todos" || v.tema === filterTema)
              return filteredVideos.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border rounded-2xl">
                <Film className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">{videos.length === 0 ? "No hay videos generados aún" : "No hay videos que coincidan con este filtro"}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredVideos.map(v => (
                  <div key={v.id} className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all group">
                    <div className="relative aspect-video bg-secondary">
                      {playingId === v.id ? (
                        <video src={v.videoUrl} controls autoPlay className="w-full h-full object-cover" onEnded={() => setPlayingId(null)} />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center">
                            <Film className="w-10 h-10 text-primary/30" />
                          </div>
                          <button onClick={() => setPlayingId(v.id)} className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/70 border border-border backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-all shadow">
                              <Play className="w-5 h-5 text-primary ml-0.5" />
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
                      <p className="text-xs text-muted-foreground mb-3">{v.tema}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.duracionEstimada}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{v.slides} slides</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs border-border hover:border-primary/40" onClick={() => setPlayingId(playingId === v.id ? null : v.id)}>
                          {playingId === v.id ? <><Pause className="w-3 h-3" />Cerrar</> : <><Play className="w-3 h-3" />Ver</>}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs border-border hover:border-primary/40" onClick={() => openEditModal(v)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteVideo(v.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )})()}
          </TabsContent>

          {/* Estudiantes */}
          <TabsContent value="students" className="mt-6">
            <div data-tour-id="students-table" className="scroll-mt-24 flex items-center justify-between flex-wrap gap-3 mb-6">
              <div>
                <h2 className="font-semibold">Estudiantes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{students.length} registrado{students.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border rounded-xl h-9 text-sm" />
                </div>
                <Button onClick={openCreateStudent} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0">
                  <UserPlus className="w-4 h-4" />Nuevo estudiante
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-semibold tracking-wide">Estudiante</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide">Nivel</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide">XP</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide">Videos</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide">Racha</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide">Progreso</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Spinner /></TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No hay estudiantes</TableCell></TableRow>
                  ) : filtered.map(s => {
                    const completed = parseTopics(s.progress?.completedTopics).length
                    return (
                      <TableRow key={s.id} className="border-border cursor-pointer hover:bg-secondary/40 transition-colors" onClick={() => setProfileStudent(s)}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-8 h-8 flex-shrink-0"><AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{s.name.charAt(0)}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium text-sm">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs border-border">Nv. {s.progress?.level || 1}</Badge></TableCell>
                        <TableCell className="font-mono text-sm text-amber-600">{(s.progress?.totalXP || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.progress?.videosWatched || 0}</TableCell>
                        <TableCell className="text-sm flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-500" /> {s.progress?.streak || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 w-28">
                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${(completed / 8) * 100}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{completed}/8</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" className="gap-1 text-xs border-border hover:border-primary/40" onClick={e => { e.stopPropagation(); openEditStudent(s) }}><Pencil className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={e => { e.stopPropagation(); handleDeleteStudent(s) }}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Analíticas */}
          <TabsContent value="analytics" className="mt-6">
            <div className="relative grid md:grid-cols-2 gap-10">
              {/* Marcador invisible para el tour: cubre solo la fila de los
                  dos encabezados, no las listas completas (que crecen con
                  la cantidad real de estudiantes/módulos y rompían el
                  posicionamiento del tooltip con cuentas con muchos datos). */}
              <div data-tour-id="analytics-charts" className="absolute inset-x-0 top-0 h-11 scroll-mt-24 pointer-events-none" />
              <div>
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Progreso por módulo</h3>
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
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" />Top 5 estudiantes</h3>
                <div className="space-y-3">
                  {[...students].sort((a, b) => (b.progress?.totalXP || 0) - (a.progress?.totalXP || 0)).slice(0, 5).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? "bg-amber-400/25 text-amber-600" :
                        i === 1 ? "bg-slate-400/25 text-slate-500" :
                        i === 2 ? "bg-orange-400/25 text-orange-600" :
                        "bg-secondary text-muted-foreground"
                      }`}>{i + 1}</span>
                      <Avatar className="w-7 h-7 flex-shrink-0"><AvatarFallback className="bg-primary/15 text-primary text-xs">{s.name.charAt(0)}</AvatarFallback></Avatar>
                      <span className="flex-1 text-sm truncate">{s.name}</span>
                      <span className="text-sm font-mono text-amber-600 flex-shrink-0">{(s.progress?.totalXP || 0).toLocaleString()} XP</span>
                    </div>
                  ))}
                  {students.length === 0 && <p className="text-sm text-muted-foreground">No hay datos aún</p>}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Módulos */}
          <TabsContent value="modules" className="mt-6">
            <div data-tour-id="modules-table" className="scroll-mt-24 flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold">Módulos del curso</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{TOPICS.length} módulo{TOPICS.length !== 1 ? "s" : ""}</p>
              </div>
              <Button onClick={openCreateModule} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <BookOpen className="w-4 h-4" />Crear módulo
              </Button>
            </div>

            {topicsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : TOPICS.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border rounded-2xl">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No hay módulos creados aún</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Videos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TOPICS.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary">{t.icon}</span>
                          {t.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{t.description}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{videosForTopicName(t.name).length}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1 text-xs border-border hover:border-primary/40" onClick={() => openEditModule(t)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="outline" className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteModule(t)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Reporte de resultados */}
          <TabsContent value="report" className="mt-6">
            <div className="mb-6">
              <h2 className="font-semibold">Reporte de resultados</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Métricas de la clase: exámenes, dificultad de contenido y ritmo de avance</p>
            </div>
            <AnalyticsReport />
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Modal edición de video ────────────────────────────────────────── */}
      {editVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Editar video</h2>
              <button onClick={() => setEditVideo(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Título</label>
                <Input value={editTitulo} onChange={e => setEditTitulo(e.target.value)} className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subtema</label>
                <Input value={editSubtema} onChange={e => setEditSubtema(e.target.value)} className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nivel</label>
                <div className="grid grid-cols-3 gap-2">
                  {NIVELES.map(n => (
                    <button key={n.id} onClick={() => setEditNivel(n.id)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${editNivel === n.id ? n.color + " border-current" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Lenguaje de programación</label>
                <p className="text-xs text-muted-foreground -mt-0.5">Afecta las preguntas de código generadas para este video.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "python",     label: "Python",     color: "text-blue-600 bg-blue-500/15 border-blue-500/40"       },
                    { id: "cpp",        label: "C++",        color: "text-cyan-600 bg-cyan-500/15 border-cyan-500/40"       },
                    { id: "java",       label: "Java",       color: "text-orange-600 bg-orange-500/15 border-orange-500/40" },
                    { id: "javascript", label: "JavaScript", color: "text-yellow-600 bg-yellow-500/15 border-yellow-500/40" },
                  ].map(l => (
                    <button key={l.id} onClick={() => setEditLenguaje(l.id)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${editLenguaje === l.id ? l.color + " border-current" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setEditVideo(null)}>Cancelar</Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleUpdateVideo} disabled={editSaving}>
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal perfil de estudiante ────────────────────────────────────── */}
      {profileStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-5 border-b border-border flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14 border border-primary/25">
                  <AvatarFallback className="bg-primary/15 text-primary text-xl font-bold">{profileStudent.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-lg leading-tight">{profileStudent.name}</p>
                  <p className="text-sm text-muted-foreground">{profileStudent.email}</p>
                  <Badge variant="outline" className="mt-1.5 text-xs border-border">Nivel {profileStudent.progress?.level || 1}</Badge>
                </div>
              </div>
              <button onClick={() => setProfileStudent(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "XP Total",       value: (profileStudent.progress?.totalXP || 0).toLocaleString(), color: "text-amber-600" },
                  { label: "Videos vistos",  value: profileStudent.progress?.videosWatched || 0,              color: "text-blue-600"   },
                  { label: "Racha",          value: `${profileStudent.progress?.streak || 0} días`,           color: "text-orange-600" },
                  { label: "Sesiones chat",  value: profileStudent.progress?.chatbotSessions || 0,            color: "text-violet-600" },
                ].map((s, i) => (
                  <div key={i} className="bg-secondary/40 rounded-xl p-3">
                    <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold mb-3">Progreso por módulo</p>
                <div className="space-y-2">
                  {TOPICS.map(t => {
                    const done = parseTopics(profileStudent.progress?.completedTopics).includes(t.id)
                    const isCurrent = profileStudent.progress?.currentTopic === t.id
                    return (
                      <div key={t.id} className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${done ? "bg-primary" : isCurrent ? "bg-accent" : "bg-border"}`} />
                        <span className={`text-sm flex-1 ${done ? "text-foreground" : "text-muted-foreground"}`}>{t.name}</span>
                        {done && <Check className="w-3.5 h-3.5 text-primary" />}
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
                        <div key={s.topicId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-secondary/40">
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

      {/* ── Modal crear/editar estudiante ─────────────────────────────────── */}
      {studentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                {studentModal.mode === "create" ? "Nuevo estudiante" : "Editar estudiante"}
              </h2>
              <button onClick={() => setStudentModal(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre</label>
                <Input value={stuName} onChange={e => setStuName(e.target.value)} placeholder="ej: Ana Torres" className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={stuEmail} onChange={e => setStuEmail(e.target.value)} placeholder="ej: ana@correo.com" className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {studentModal.mode === "create" ? "Contraseña" : "Nueva contraseña (opcional)"}
                </label>
                <Input
                  type="password"
                  value={stuPassword}
                  onChange={e => setStuPassword(e.target.value)}
                  placeholder={studentModal.mode === "create" ? "Mínimo 8 caracteres, 1 mayúscula, 1 número" : "Dejar vacío para no cambiarla"}
                  className="bg-secondary/50 border-border"
                />
              </div>
              {stuError && <p className="text-sm text-destructive">{stuError}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setStudentModal(null)}>Cancelar</Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={saveStudent} disabled={stuSaving}>
                  {stuSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal crear/editar módulo ─────────────────────────────────────── */}
      {moduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                {moduleModal.mode === "create" ? "Crear módulo" : "Editar módulo"}
              </h2>
              <button onClick={() => setModuleModal(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              {moduleModal.mode === "create" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">ID (slug único)</label>
                  <Input value={modId} onChange={e => setModId(e.target.value.trim().toLowerCase().replace(/\s+/g, "-"))} placeholder="ej: recursividad" className="bg-secondary/50 border-border font-mono text-sm" />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre</label>
                <Input value={modName} onChange={e => setModName(e.target.value)} placeholder="ej: Recursividad" className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ícono (texto corto)</label>
                <Input value={modIcon} onChange={e => setModIcon(e.target.value)} placeholder="ej: f(f)" className="bg-secondary/50 border-border font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descripción</label>
                <Input value={modDesc} onChange={e => setModDesc(e.target.value)} placeholder="ej: Funciones que se llaman a sí mismas" className="bg-secondary/50 border-border" />
              </div>
              {modError && <p className="text-sm text-destructive">{modError}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setModuleModal(null)}>Cancelar</Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSaveModule} disabled={modSaving}>
                  {modSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación de riesgo (renombrar/eliminar módulo con videos) ──── */}
      {modConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-destructive/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <h2 className="font-bold">Atención</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{modConfirm.message}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setModConfirm(null)}>Cancelar</Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                onClick={() => { const action = modConfirm.action; setModConfirm(null); action() }}
              >
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
