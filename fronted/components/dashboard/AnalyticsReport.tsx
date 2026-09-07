"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Spinner } from "@/components/ui/spinner"
import {
  ClipboardCheck, Brain, Gauge, Timer, BarChart3, PieChart as PieChartIcon, Radar as RadarIcon, Layers,
} from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis,
  Pie, PieChart, Cell,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadarChart,
} from "recharts"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig,
} from "@/components/ui/chart"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

interface Overview {
  totalStudents: number; studentsCompletedCourse: number; pctCompletedCourse: number
  avgXP: number; avgLevel: number; avgStreak: number; avgVideosWatched: number
  avgChatSessions: number; pctUsedChat: number
}
interface BoxDistribution { min: number; q1: number; median: number; q3: number; max: number }
interface ExamTopic {
  topicId: string; topicName: string; attempts: number; passed: number
  passRate: number; avgAttempts: number; avgBestScore: number; scoreDistribution: BoxDistribution
}
interface ExamStats {
  totalAttempts: number; totalPassed: number; overallPassRate: number
  avgAttemptsToPass: number; pctPassedFirstTry: number; byTopic: ExamTopic[]
}
interface HardestQuestion {
  id: string; enunciado: string; tipoLabel: string; nivel: string
  topicName: string; vecesRespondida: number; errorRate: number
}
interface AccuracyByType { tipo: string; tipoLabel: string; accuracy: number; attempts: number }
interface AccuracyByTopic { topicId: string; topicName: string; accuracy: number; attempts: number }
interface EloTopic { topicId: string; topicName: string; avgElo: number; students: number }
interface FastestStudent { userId: string; name: string; days: number }
interface CompletionSpeed { studentsCompleted: number; avgDays: number; medianDays: number; fastest: FastestStudent[]; distribution: BoxDistribution }
interface ModuleProgress { topicId: string; topicName: string; studentsCompleted: number; pct: number }

interface Report {
  overview: Overview
  examStats: ExamStats
  questionDifficulty: { hardestQuestions: HardestQuestion[]; accuracyByType: AccuracyByType[]; accuracyByTopic: AccuracyByTopic[] }
  topicDifficulty: { byElo: EloTopic[] }
  completionSpeed: CompletionSpeed
  moduleProgress: ModuleProgress[]
}

function Bar_({ pct, colorClass = "from-primary to-accent" }: { pct: number; colorClass?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

// Recharts no trae boxplot — se construye a mano con divs, reutilizando los
// mismos tokens de color del tema (funciona en claro/oscuro sin configurar nada).
function BoxPlotChart({ data, domain, unit = "" }: { data: (BoxDistribution & { label: string })[]; domain: [number, number]; unit?: string }) {
  const [lo, hi] = domain
  const span = hi - lo || 1
  const scale = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100))
  return (
    <div className="space-y-3.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 sm:w-36 flex-shrink-0 text-xs text-muted-foreground truncate" title={d.label}>{d.label}</span>
          <div className="relative flex-1 h-5">
            <div className="absolute inset-y-0 left-0 right-0 my-auto h-px bg-border" />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-px bg-muted-foreground/60"
              style={{ left: `${scale(d.min)}%`, width: `${Math.max(scale(d.max) - scale(d.min), 0)}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-muted-foreground/60"
              style={{ left: `${scale(d.min)}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-muted-foreground/60"
              style={{ left: `${scale(d.max)}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 rounded-[3px] bg-primary/20 border border-primary/70"
              style={{ left: `${scale(d.q1)}%`, width: `${Math.max(scale(d.q3) - scale(d.q1), 1.5)}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary"
              style={{ left: `${scale(d.median)}%` }}
            />
          </div>
          <span className="w-28 sm:w-36 flex-shrink-0 text-[10px] font-mono text-muted-foreground text-right">
            med {d.median}{unit} · [{d.min}–{d.max}{unit}]
          </span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsReport() {
  const { token } = useAuth()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const r = await fetch(`${API}/analytics/report`, { headers: { Authorization: `Bearer ${token}` } })
        const d = await r.json()
        if (d.success) setReport(d.data)
      } catch {}
      setLoading(false)
    })()
  }, [token])

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>
  if (!report) return <p className="text-sm text-muted-foreground py-3">No se pudo cargar el reporte.</p>

  const { overview, examStats, questionDifficulty, topicDifficulty, completionSpeed, moduleProgress } = report

  const examChartConfig: ChartConfig = {
    passRate: { label: "Aprobación %", color: "var(--chart-1)" },
    avgBestScore: { label: "Puntaje prom. %", color: "var(--chart-3)" },
  }
  const examChartData = examStats.byTopic.map(t => ({ name: t.topicName, passRate: t.passRate, avgBestScore: t.avgBestScore }))

  const eloChartConfig: ChartConfig = { avgElo: { label: "Elo promedio", color: "var(--chart-4)" } }
  const eloChartData = topicDifficulty.byElo.map(t => ({ name: t.topicName, avgElo: t.avgElo }))

  const moduleChartConfig: ChartConfig = { pct: { label: "% de estudiantes que lo completó", color: "var(--chart-2)" } }
  const moduleChartData = moduleProgress.map(m => ({ name: m.topicName, pct: m.pct, studentsCompleted: m.studentsCompleted }))

  const typeChartConfig: ChartConfig = Object.fromEntries(
    questionDifficulty.accuracyByType.map((t, i) => [t.tipo, { label: t.tipoLabel, color: `var(--chart-${(i % 5) + 1})` }])
  )
  const typeChartData = questionDifficulty.accuracyByType.map(t => ({ tipo: t.tipo, tipoLabel: t.tipoLabel, attempts: t.attempts }))

  const radarChartConfig: ChartConfig = {
    passRate: { label: "Aprobación examen %", color: "var(--chart-1)" },
    accuracy: { label: "Precisión preguntas %", color: "var(--chart-5)" },
  }
  const radarData = moduleProgress.map(m => {
    const exam = examStats.byTopic.find(t => t.topicId === m.topicId)
    const acc = questionDifficulty.accuracyByTopic.find(t => t.topicId === m.topicId)
    return { topic: m.topicName, passRate: exam?.passRate ?? 0, accuracy: acc?.accuracy ?? 0 }
  })
  const hasRadarData = radarData.some(d => d.passRate > 0 || d.accuracy > 0)

  const scoreBoxData = examStats.byTopic.map(t => ({ label: t.topicName, ...t.scoreDistribution }))
  const daysMax = Math.max(completionSpeed.distribution.max, 1)

  return (
    <div className="space-y-12">

      {/* ── Resumen de avance y participación ─────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Gauge className="w-[18px] h-[18px] text-primary" />
          <h2 className="text-foreground">Avance y participación</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border border-t border-b border-border py-6">
          {[
            { value: `${overview.pctCompletedCourse}%`, label: "COMPLETÓ EL CURSO", color: "text-primary" },
            { value: overview.studentsCompletedCourse,  label: "GRADUADOS",         color: "text-primary" },
            { value: overview.avgStreak,                label: "RACHA PROMEDIO",    color: "text-orange-500" },
            { value: overview.avgVideosWatched,          label: "VIDEOS/ESTUD.",    color: "text-green-500" },
            { value: `${overview.pctUsedChat}%`,         label: "USÓ EL CHAT",      color: "text-blue-500" },
            { value: overview.avgChatSessions,           label: "SESIONES CHAT",    color: "text-blue-500" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-2">
              <span className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</span>
              <span className="text-[9px] tracking-widest text-muted-foreground text-center">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Examen final ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="w-[18px] h-[18px] text-primary" />
          <h2 className="text-foreground">Examen final por módulo</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          {examStats.totalAttempts} intento{examStats.totalAttempts !== 1 ? "s" : ""} registrado{examStats.totalAttempts !== 1 ? "s" : ""} ·
          {" "}{examStats.overallPassRate}% de aprobación general ·{" "}
          {examStats.pctPassedFirstTry}% aprobó al primer intento ·{" "}
          promedio {examStats.avgAttemptsToPass || "—"} intento{examStats.avgAttemptsToPass === 1 ? "" : "s"} para aprobar
        </p>
        {examStats.byTopic.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay intentos de examen registrados.</p>
        ) : (
          <ChartContainer config={examChartConfig} className="h-[260px] w-full">
            <BarChart data={examChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="passRate" fill="var(--color-passRate)" radius={4} />
              <Bar dataKey="avgBestScore" fill="var(--color-avgBestScore)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </section>

      {/* ── Precisión por tipo de pregunta ───────────────────────────────────*/}
      {questionDifficulty.accuracyByType.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Brain className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-foreground">Precisión por tipo de pregunta</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {questionDifficulty.accuracyByType.map(t => (
              <div key={t.tipo}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{t.tipoLabel}</span>
                  <span className="text-muted-foreground font-mono text-xs">{t.accuracy}% · {t.attempts} resp.</span>
                </div>
                <Bar_ pct={t.accuracy} colorClass="from-green-500 to-emerald-400" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Distribución de intentos por tipo de pregunta (pastel) ──────────*/}
      {typeChartData.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <PieChartIcon className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-foreground">Distribución de intentos por tipo de pregunta</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-6">Qué proporción de todas las respuestas registradas corresponde a cada tipo de pregunta.</p>
          <ChartContainer config={typeChartConfig} className="mx-auto aspect-square max-h-[280px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="tipo" hideLabel />} />
              <Pie data={typeChartData} dataKey="attempts" nameKey="tipo" innerRadius={55} strokeWidth={2}>
                {typeChartData.map(entry => <Cell key={entry.tipo} fill={`var(--color-${entry.tipo})`} />)}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="tipo" />} />
            </PieChart>
          </ChartContainer>
        </section>
      )}

      {/* ── Preguntas más difíciles ──────────────────────────────────────────*/}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-[18px] h-[18px] text-destructive" />
          <h2 className="text-foreground">Preguntas con mayor tasa de error</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-5">Solo se cuentan preguntas con 3 o más respuestas registradas (incluye videos y examen final).</p>
        {questionDifficulty.hardestQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay suficientes respuestas registradas.</p>
        ) : (
          <div className="space-y-3">
            {questionDifficulty.hardestQuestions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 py-2 border-b border-border/60 last:border-b-0">
                <span className="w-5 h-5 flex-shrink-0 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{q.enunciado}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{q.topicName} · {q.tipoLabel} · nivel {q.nivel} · {q.vecesRespondida} respuestas</p>
                </div>
                <span className="text-sm font-mono font-bold text-destructive flex-shrink-0">{q.errorRate}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Dificultad por módulo (Elo) ───────────────────────────────────────*/}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="w-[18px] h-[18px] text-primary" />
          <h2 className="text-foreground">Dificultad por módulo</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Según el nivel de habilidad (Elo) adaptativo alcanzado por los estudiantes — menor puntaje indica un módulo más difícil para la clase.</p>
        {topicDifficulty.byElo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay datos de habilidad registrados.</p>
        ) : (
          <ChartContainer config={eloChartConfig} className="h-[260px] w-full">
            <BarChart data={eloChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" domain={[1000, 1600]} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="avgElo" fill="var(--color-avgElo)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </section>

      {/* ── Perfil comparativo por módulo (araña) ────────────────────────────*/}
      {hasRadarData && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <RadarIcon className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-foreground">Perfil comparativo por módulo</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-6">Compara, para cada módulo, la aprobación del examen final contra la precisión en las preguntas de video — una brecha grande entre ambas sugiere que el examen evalúa algo distinto a lo que el video refuerza.</p>
          <ChartContainer config={radarChartConfig} className="mx-auto aspect-square max-h-[380px]">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Radar dataKey="passRate" stroke="var(--color-passRate)" fill="var(--color-passRate)" fillOpacity={0.25} />
              <Radar dataKey="accuracy" stroke="var(--color-accuracy)" fill="var(--color-accuracy)" fillOpacity={0.25} />
              <ChartLegend content={<ChartLegendContent />} />
            </RadarChart>
          </ChartContainer>
        </section>
      )}

      {/* ── Distribución del puntaje de examen por módulo (boxplot) ──────────*/}
      {scoreBoxData.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-foreground">Distribución del puntaje de examen por módulo</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-6">Caja = rango entre el 25% y 75% de los puntajes (mejor puntaje de cada estudiante); línea central = mediana; bigotes = mínimo y máximo.</p>
          <BoxPlotChart data={scoreBoxData} domain={[0, 100]} unit="%" />
        </section>
      )}

      {/* ── Embudo de progreso por módulo ─────────────────────────────────────*/}
      {moduleChartData.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-foreground">Embudo de progreso por módulo</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-6">Porcentaje de estudiantes que ha completado cada módulo, en el orden del plan de estudios — la caída entre barras muestra dónde se abandona más.</p>
          <ChartContainer config={moduleChartConfig} className="h-[280px] w-full">
            <BarChart data={moduleChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="pct" fill="var(--color-pct)" radius={4} />
            </BarChart>
          </ChartContainer>
        </section>
      )}

      {/* ── Ritmo de finalización ─────────────────────────────────────────────*/}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Timer className="w-[18px] h-[18px] text-primary" />
          <h2 className="text-foreground">Ritmo de finalización del curso</h2>
        </div>
        {completionSpeed.studentsCompleted === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía nadie ha completado el curso completo.</p>
        ) : (
          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-y-8 md:gap-x-10">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {[
                  { label: "Días promedio",  value: completionSpeed.avgDays },
                  { label: "Días (mediana)", value: completionSpeed.medianDays },
                ].map((s, i) => (
                  <div key={i}>
                    <p className="text-lg font-bold font-mono text-primary">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-2">Más rápidos en completar</p>
                <div className="space-y-1">
                  {completionSpeed.fastest.map((s, i) => (
                    <div key={s.userId} className={`flex items-center gap-2.5 py-1.5 ${i < completionSpeed.fastest.length - 1 ? "border-b border-border/60" : ""}`}>
                      <span className="w-5 h-5 flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      <span className="text-xs flex-1 truncate">{s.name}</span>
                      <span className="text-xs font-mono text-muted-foreground flex-shrink-0">{s.days} días</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-3">Distribución de días para completar</p>
              <BoxPlotChart data={[{ label: "Días", ...completionSpeed.distribution }]} domain={[0, daysMax]} unit="d" />
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
