import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { ELO_ANCHOR_POR_NIVEL } from '../utils/elo'
import { runCode } from './executeController'
import OpenAI from 'openai'
import path from 'path'
import fs from 'fs'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const VIDEO_OUTPUT_DIR = path.join(process.cwd(), '..', 'video_service', 'output')

const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL || 'http://localhost:8001'
// URL used inside video URLs sent to the browser — must be reachable from
// outside the server (unlike VIDEO_SERVICE_URL, which is only used for
// server-to-server calls and can point at an internal/docker-network address).
const VIDEO_SERVICE_PUBLIC_URL = process.env.VIDEO_SERVICE_PUBLIC_URL || VIDEO_SERVICE_URL

// Videos are stored with whatever host/port the video-service happened to be
// configured with at generation time (VIDEO_SERVICE_BASE_URL) — which has been
// wrong before (e.g. an internal-only port that isn't publicly reachable).
// Always rewrite the host/port at read time to the current public URL,
// keeping only the "/videos/<filename>" tail, so a stale/misconfigured value
// baked into an old row can never surface a broken video to a student.
const normalizeVideoUrl = (url: string) => url.replace(/^.*(?=\/videos\/)/, VIDEO_SERVICE_PUBLIC_URL)

interface SlidePregunta {
  dificultad: 'facil' | 'medio' | 'dificil'
  tipo: 'seleccion_multiple' | 'codigo' | 'abierta'
  enunciado: string
  opciones?: string[]
  respuesta_correcta?: string
  codigo_inicial?: string
  salida_esperada?: string
  respuesta_modelo?: string
  explicacion: string
}

interface SlideData {
  tipo: string
  titulo?: string
  codigo?: string
  inicio_sec?: number
  fin_sec?: number
  preguntas?: SlidePregunta[]
}

// El GPT que redacta salida_esperada a veces confunde "lo que imprime el código
// SIN completar" con "lo que debe imprimir la solución" y termina guardando una
// descripción del error (p.ej. "Error de sintaxis", "NameError: ...") en vez de
// la salida real del programa ya arreglado — eso vuelve la pregunta irresoluble
// para cualquier estudiante, sin importar qué escriba. Detectado en ~29% de las
// preguntas de código generadas antes de este chequeo.
const PARECE_DESCRIPCION_DE_ERROR = /^(\w*(error|exception|excepci[oó]n)\b|no (se puede|est[aá]|hay)\b|falta\b|vac[ií]o$)/i
function salidaEsperadaEsValida(salidaEsperada: string | undefined): boolean {
  if (!salidaEsperada) return false
  return !PARECE_DESCRIPCION_DE_ERROR.test(salidaEsperada.trim())
}

// Cuando el "codigo" del slide solo define una función/estructura sin llamarla ni
// imprimir nada, el GPT a veces copia ese mismo código (sin agregar el llamado)
// como codigo_inicial — entonces NINGUNA solución posible puede producir
// salida_esperada, porque nunca se ejecuta ningún print/cout/console.log, sin
// importar qué escriba el estudiante. Se detecta buscando alguna instrucción de
// salida en el propio codigo_inicial (no necesita estar completa, solo presente).
const PATRON_IMPRESION: Record<string, RegExp> = {
  python:     /print\s*\(/,
  cpp:        /cout\s*<</,
  java:       /System\.out\.print/,
  javascript: /console\.log/,
  typescript: /console\.log/,
}
function tieneInstruccionDeSalida(codigoInicial: string, lenguaje: string): boolean {
  const patron = PATRON_IMPRESION[lenguaje] ?? /print|cout|console\.log/i
  return patron.test(codigoInicial)
}

// En Python, un cuerpo de bloque que solo tiene "# completar aquí" (comentario)
// da IndentationError al ejecutarlo tal cual — por eso el chequeo de "ya
// resuelta tal cual" no lo detecta. Pero eso no prueba que el ejercicio tenga
// sentido: si basta con poner CUALQUIER no-operación (pass) para que ya
// coincida con salida_esperada, es porque el cuerpo del bloque nunca fue
// necesario para el resultado — el estudiante no aprende nada completándolo.
// (Otros lenguajes no aplican: un bloque vacío "{}" ya es sintácticamente
// válido ahí, así que ese caso ya lo cubre el chequeo de "ya resuelta".)
const MARCADOR_COMPLETAR: Partial<Record<string, RegExp>> = {
  python: /#\s*completar aquí/i,
}
const NOOP_POR_LENGUAJE: Partial<Record<string, string>> = {
  python: 'pass',
}
async function marcadorEsTrivial(codigoInicial: string, salidaEsperada: string, lenguaje: string): Promise<boolean> {
  const marcador = MARCADOR_COMPLETAR[lenguaje]
  const noop = NOOP_POR_LENGUAJE[lenguaje]
  if (!marcador || !noop || !marcador.test(codigoInicial)) return false
  const conNoop = codigoInicial.replace(marcador, noop)
  try {
    const result = await runCode(lenguaje, conNoop)
    const salida = result.stdout.trim()
    const esperada = salidaEsperada.trim()
    return salida === esperada || (!!salida && salida.includes(esperada))
  } catch {
    return false
  }
}

// El LLM a veces asume que una función auxiliar (p.ej. "quicksort") ya fue
// definida en un slide anterior del mismo video y la llama sin definirla en
// codigo_inicial — el ejercicio queda roto para SIEMPRE (ni siquiera la
// versión ya resuelta corre) porque nada define esa función en ningún lado.
// Heurística para Python: cualquier llamada a función que no sea un builtin
// conocido y no tenga su propio "def" en el mismo codigo_inicial es sospechosa.
const PYTHON_BUILTINS = new Set([
  'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
  'sum', 'min', 'max', 'sorted', 'abs', 'round', 'enumerate', 'zip', 'map', 'filter',
  'input', 'type', 'isinstance', 'bool', 'open', 'format', 'repr', 'reversed', 'any',
  'all', 'divmod', 'pow', 'hash', 'id', 'iter', 'next', 'vars', 'dir', 'getattr',
  'setattr', 'hasattr', 'callable', 'issubclass', 'super', 'property', 'staticmethod',
  'classmethod', 'frozenset', 'bytes', 'bytearray', 'complex', 'slice', 'object',
  'Exception', 'ValueError', 'TypeError', 'KeyError', 'IndexError', 'StopIteration',
])
// Palabras clave de Python que pueden aparecer seguidas de "(" en código
// válido (p.ej. "if (x):", "not (y)") — no son llamadas a función.
const PYTHON_KEYWORDS = new Set([
  'if', 'elif', 'while', 'for', 'not', 'and', 'or', 'in', 'is', 'return', 'yield',
  'raise', 'assert', 'del', 'lambda', 'with', 'try', 'except', 'finally', 'class',
  'def', 'import', 'from', 'as', 'pass', 'break', 'continue', 'global', 'nonlocal',
  'async', 'await', 'else',
])
function llamaFuncionIndefinida(codigoInicial: string, lenguaje: string): string | null {
  if (lenguaje !== 'python') return null
  const definidas = new Set([...codigoInicial.matchAll(/\bdef\s+(\w+)\s*\(/g)].map(m => m[1]))
  // Un parámetro puede recibir y luego llamar a una función (orden superior,
  // p.ej. "def aplicar(funcion, n): ... funcion(n)") — eso es válido, no una
  // función indefinida, así que cuenta como "conocido" igual que un def.
  for (const m of codigoInicial.matchAll(/\bdef\s+\w+\s*\(([^)]*)\)/g)) {
    m[1].split(',').forEach(param => {
      const nombre = param.trim().split(/[:=]/)[0].trim().replace(/^\*+/, '')
      if (nombre) definidas.add(nombre)
    })
  }
  for (const m of codigoInicial.matchAll(/^\s*from\s+\S+\s+import\s+(.+)$/gm)) {
    m[1].split(',').forEach(n => definidas.add(n.trim().split(' as ').pop()!.trim()))
  }
  for (const m of codigoInicial.matchAll(/^\s*import\s+(.+)$/gm)) {
    m[1].split(',').forEach(n => definidas.add(n.trim().split(' as ').pop()!.trim()))
  }
  for (const m of codigoInicial.matchAll(/(?<!\.)\b([a-zA-Z_]\w*)\s*\(/g)) {
    const nombre = m[1]
    if (PYTHON_KEYWORDS.has(nombre) || definidas.has(nombre) || PYTHON_BUILTINS.has(nombre)) continue
    return nombre
  }
  return null
}

// El guión generado por el video_service en Python trae sus propias preguntas
// "codigo" embebidas, generadas por el mismo prompt pero sin ninguna validación
// de ejecución (a diferencia de generarPreguntasParaSlide más abajo). Antes de
// aceptarlas se ejecuta su codigo_inicial: si produce EXACTAMENTE la salida
// esperada tal cual (sin que el estudiante toque nada), el ejercicio ya está
// resuelto. Ojo: no basta con "no dio error" — el marcador de dificultad
// "dificil" es solo un comentario (p.ej. "# Comienza a programar aquí"), que
// nunca lanza error en Python pero tampoco produce la salida esperada, así
// que comparar la salida real evita falsos positivos en ese caso.
async function preguntasCodigoValidas(preguntas: SlidePregunta[], lenguaje: string): Promise<boolean> {
  for (const p of preguntas) {
    if (p.tipo !== 'codigo' || !p.codigo_inicial) continue
    if (!p.salida_esperada) return false // el modelo no generó ninguna salida esperada — sin eso no hay nada que comparar
    if (!salidaEsperadaEsValida(p.salida_esperada)) return false
    if (llamaFuncionIndefinida(p.codigo_inicial, lenguaje)) return false
    // "dificil" es intencionalmente un lienzo en blanco (solo un comentario) —
    // no aplica este chequeo ahí, solo a facil/medio donde se espera que la
    // mayoría del código (incluyendo el llamado/impresión) ya esté dado.
    if (p.dificultad !== 'dificil' && !tieneInstruccionDeSalida(p.codigo_inicial, lenguaje)) return false
    try {
      const result = await runCode(lenguaje, p.codigo_inicial)
      const salida = result.stdout.trim()
      // No solo coincidencia exacta: si la salida esperada ya aparece completa
      // dentro de lo que imprime el código sin tocar nada (p.ej. porque una
      // línea de llamado ya dada arriba del marcador cubre por sí sola todo lo
      // que se pide), el marcador es decorativo y el ejercicio ya está resuelto.
      if (salida === p.salida_esperada.trim() || (salida && salida.includes(p.salida_esperada.trim()))) return false
    } catch {
      // Infra de ejecución no disponible ahora mismo — no se puede validar, se acepta tal cual.
    }
    if (await marcadorEsTrivial(p.codigo_inicial, p.salida_esperada, lenguaje)) return false
  }
  return true
}

// Orden real en el que se desbloquean los temas en la app (ver TOPICS en el
// frontend y el seed de Topic en server.ts) — determina qué construcciones de
// Python ya son "justas" de usar en un tema dado. Un video de "Operaciones
// Lógicas" no puede usar `if` porque eso se enseña recién en "Condicionales",
// más adelante en el curso.
const ORDEN_TEMAS = [
  'Tipos de Datos', 'Operaciones Lógicas', 'Filtros', 'Condicionales',
  'Bucles', 'Funciones', 'Arreglos', 'Matrices',
]
const INTRODUCE_EN: Record<string, string[]> = {
  'Tipos de Datos': [], 'Operaciones Lógicas': [], 'Filtros': [],
  'Condicionales': ['if'], 'Bucles': ['for', 'while'], 'Funciones': ['def'],
  'Arreglos': [], 'Matrices': [],
}
function palabrasPermitidas(tema: string): Set<string> {
  const idx = ORDEN_TEMAS.indexOf(tema)
  const permitidas = new Set<string>()
  for (let i = 0; i <= idx && i < ORDEN_TEMAS.length; i++) {
    INTRODUCE_EN[ORDEN_TEMAS[i]]?.forEach(kw => permitidas.add(kw))
  }
  return permitidas
}
function violacionesDeOrden(codigo: string, tema: string): string[] {
  const permitidas = palabrasPermitidas(tema)
  const violaciones: string[] = []
  for (const kw of ['if', 'for', 'while', 'def']) {
    if (new RegExp(`\\b${kw}\\b`).test(codigo) && !permitidas.has(kw)) violaciones.push(kw)
  }
  return violaciones
}

// Candidatos diversos para probar si un espacio en blanco "???" realmente
// afecta la salida del programa — la misma técnica usada manualmente durante
// el QA de los 24 videos: si TODAS las sustituciones que corren sin error dan
// exactamente la misma salida, el espacio en blanco no le importa a nadie
// (el estudiante puede escribir cualquier cosa y "pasa" igual).
const CANDIDATOS_BLANCO = ['1', '2', '50', '-3', '0', 'True', 'False', "'a'", "'zz'"]
async function blancoInlineEsTrivial(codigoInicial: string, lenguaje: string): Promise<boolean> {
  if (!codigoInicial.includes('???')) return false
  const salidas = new Set<string>()
  let exitosas = 0
  for (const candidato of CANDIDATOS_BLANCO) {
    const variante = codigoInicial.replace('???', candidato)
    try {
      const result = await runCode(lenguaje, variante)
      if (result.compileErr || result.stderr || !result.stdout) continue
      exitosas++
      salidas.add(result.stdout.trim())
    } catch { /* infra no disponible ahora — no cuenta ni a favor ni en contra */ }
  }
  // Con menos de 3 sustituciones exitosas no hay suficiente evidencia para
  // acusar al espacio en blanco — mejor no bloquear por un falso positivo.
  return exitosas >= 3 && salidas.size === 1
}

interface ResultadoValidacion { valido: boolean; errores: string[] }

// Validación final de coherencia, corrida DESPUÉS de crear el video y sus
// preguntas: revisa exactamente los tres problemas que aparecieron una y otra
// vez durante el QA manual de los 24 videos de este curso — construcciones
// de Python que el tema todavía no enseña, preguntas de código con un
// espacio en blanco que no cambia nada, y un video que terminó sin ninguna
// pregunta de práctica. Si algo falla, generateVideo() borra el video entero
// y le devuelve el detalle exacto al profesor para que ajuste el subtema y
// regenere — nunca se guarda un video roto silenciosamente.
async function validarCoherenciaVideo(tema: string, lenguaje: string, slidesData: SlideData[], videoId: string): Promise<ResultadoValidacion> {
  const errores: string[] = []

  for (const slide of slidesData) {
    if (slide.tipo !== 'codigo' || !slide.codigo) continue
    const violaciones = violacionesDeOrden(slide.codigo, tema)
    if (violaciones.length) {
      errores.push(`El slide "${slide.titulo ?? 'código'}" del video usa ${violaciones.join(', ')}, que todavía no se enseña en "${tema}".`)
    }
  }

  const preguntas = await prisma.question.findMany({ where: { videoId } })

  if (preguntas.length === 0) {
    errores.push('El video se generó sin ninguna pregunta de práctica.')
  }

  for (const q of preguntas) {
    if (q.tipo !== 'codigo' || !q.codigoInicial) continue
    const violaciones = violacionesDeOrden(q.codigoInicial, tema)
    if (violaciones.length) {
      errores.push(`Una pregunta de código (nivel ${q.nivel}) usa ${violaciones.join(', ')}, que todavía no se enseña en "${tema}".`)
    }
    if (await blancoInlineEsTrivial(q.codigoInicial, lenguaje)) {
      errores.push(`Una pregunta de código (nivel ${q.nivel}) tiene un espacio en blanco que no afecta el resultado — cualquier valor produce la misma salida.`)
    }
  }

  return { valido: errores.length === 0, errores }
}

// Crea las filas Question a partir de los slides del guión generado por Python.
// Cada slide-pregunta genera VARIAS filas (una por variante de dificultad) que
// comparten slideIndex/triggerTimeSec — el sistema elige cuál mostrar según el
// Elo del estudiante en ese momento (ver questionController.getQuestionsForVideo).
export async function crearPreguntasDelVideo(videoId: string, tema: string, nivel: string, lenguaje: string, slides: SlideData[]) {
  const topic = await prisma.topic.findFirst({ where: { name: tema } })
  const topicId = topic?.topicId ?? tema

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    if (!slide.preguntas?.length || slide.fin_sec === undefined) continue

    let preguntas = slide.preguntas
    if (!(await preguntasCodigoValidas(preguntas, lenguaje))) {
      console.warn(`Preguntas de código del guión ya resueltas (tema="${tema}", slide ${i}) — regenerando con validación...`)
      const regeneradas = await generarPreguntasParaSlide(slide, tema, lenguaje)
      if (regeneradas.length) preguntas = regeneradas
    }

    for (const p of preguntas) {
      // GPT occasionally drops a required field from one variant's JSON — skip
      // just that broken variant instead of crashing the whole batch insert
      // (which used to abort every remaining slide in the same run).
      if (!p.enunciado) { console.warn(`Pregunta sin enunciado descartada (slide ${i}, dificultad ${p.dificultad})`); continue }

      // Normalize seleccion_multiple: GPT sometimes stores the answer text instead of an index.
      // Convert to index so comparisons in submitAttempt stay simple.
      let rawCorrecta = p.respuesta_correcta ?? ''
      if (p.tipo === 'seleccion_multiple' && p.opciones?.length && !/^\d+$/.test(rawCorrecta.trim())) {
        const idx = p.opciones.findIndex(o => o.toLowerCase().trim() === rawCorrecta.toLowerCase().trim())
        if (idx !== -1) rawCorrecta = String(idx)
      }

      const respuestaCorrecta =
        p.tipo === 'codigo'  ? p.salida_esperada ?? '' :
        p.tipo === 'abierta' ? p.respuesta_modelo ?? '' :
        rawCorrecta

      const dificultadElo = ELO_ANCHOR_POR_NIVEL[p.dificultad?.toLowerCase()] ?? 1200

      await prisma.question.create({
        data: {
          videoId,
          topicId,
          lenguaje,
          nivel:             p.dificultad ?? nivel,
          slideIndex:        i,
          triggerTimeSec:    slide.fin_sec,
          tipo:              p.tipo,
          enunciado:         p.enunciado,
          opciones:          p.opciones ? JSON.stringify(p.opciones) : null,
          respuestaCorrecta,
          codigoInicial:     p.codigo_inicial ?? null,
          explicacion:       p.explicacion || 'Revisa el enunciado y compara tu salida con la esperada.',
          dificultadElo,
        },
      })
    }
  }
}

// POST /api/videos/generate
export const generateVideo = async (req: AuthRequest & Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Solo los docentes pueden generar videos' })
    }

    const { tema, subtema, nivel, lenguaje } = req.body
    if (!tema || !subtema) {
      return res.status(400).json({ success: false, error: 'Tema y subtema son requeridos' })
    }
    const lang = lenguaje || 'python'

    const openaiKey = process.env.OPENAI_API_KEY || ''

    // Llamar al microservicio Python con timeout de 5 minutos
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

    const pyResponse = await fetch(`${VIDEO_SERVICE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tema,
        subtema,
        nivel: nivel || 'medio',
        api_key: openaiKey,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!pyResponse.ok) {
      const err = await pyResponse.json() as { detail?: string }
      return res.status(500).json({ success: false, error: err.detail || 'Error en el servicio de video' })
    }

    const videoData = await pyResponse.json() as {
      success: boolean
      video_url: string
      titulo: string
      duracion_estimada: string
      slides: number
      filename: string
      slides_data?: SlideData[]
    }

    // Cache-busting: el nombre de archivo es determinístico a partir de
    // tema/subtema/nivel, así que regenerar un video reutiliza la misma URL.
    // Sin un parámetro que cambie, el navegador del estudiante sigue
    // sirviendo la copia vieja desde su caché aunque el archivo en el
    // servidor ya se haya corregido.
    const videoUrlConCacheBuster = `${videoData.video_url}?v=${Date.now()}`

    // Guardar en base de datos
    const video = await prisma.video.create({
      data: {
        titulo:           videoData.titulo,
        tema,
        subtema,
        nivel:            nivel || 'medio',
        lenguaje:         lang,
        duracionEstimada: videoData.duracion_estimada,
        filename:         videoData.filename,
        videoUrl:         videoUrlConCacheBuster,
        slides:           videoData.slides,
        status:           'ready',
        createdBy:        req.user.id,
      },
    })

    if (videoData.slides_data?.length) {
      await crearPreguntasDelVideo(video.id, tema, nivel || 'medio', lang, videoData.slides_data)
    }

    // Validación de coherencia final: si el video usa construcciones que el
    // tema todavía no enseña, quedó sin preguntas, o alguna pregunta tiene un
    // espacio en blanco decorativo, no se guarda nada roto — se borra el
    // video (y sus preguntas, en cascada) y los archivos generados, y se le
    // explica al profesor exactamente qué falló para que ajuste el subtema.
    const validacion = await validarCoherenciaVideo(tema, lang, videoData.slides_data ?? [], video.id)
    if (!validacion.valido) {
      await prisma.video.delete({ where: { id: video.id } })
      // El .mp4/.json generado queda huérfano en disco — el backend solo
      // tiene acceso de lectura a ese volumen (video_service es quien
      // escribe ahí), y sin fila en Video nadie lo referencia ni lo sirve,
      // así que dejarlo ahí es inofensivo.
      return res.status(422).json({
        success: false,
        error: 'El video generado no pasó la validación de coherencia y no se guardó.',
        detalles: validacion.errores,
      })
    }

    return res.status(201).json({ success: true, data: video })
  } catch (error: any) {
    console.error('Error generando video:', error)
    if (error.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'La generación del video tardó demasiado (máx. 5 min). Intenta con un tema más simple.',
      })
    }
    if (error.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'El servicio de generación de videos no está disponible. Asegúrate de que el servidor Python está corriendo.',
      })
    }
    return res.status(500).json({ success: false, error: 'Error interno del servidor' })
  }
}

// GET /api/videos
export const getVideos = async (_req: AuthRequest, res: Response) => {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const fixed = videos.map(v => ({
      ...v,
      videoUrl: normalizeVideoUrl(v.videoUrl),
    }))
    return res.status(200).json({ success: true, data: fixed })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener videos' })
  }
}

// GET /api/videos/:id
export const getVideoById = async (req: AuthRequest & Request, res: Response) => {
  try {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } })
    if (!video) return res.status(404).json({ success: false, error: 'Video no encontrado' })
    const fixed = { ...video, videoUrl: normalizeVideoUrl(video.videoUrl) }
    return res.status(200).json({ success: true, data: fixed })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener el video' })
  }
}

// PUT /api/videos/:id
export const updateVideo = async (req: AuthRequest & Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado' })
    }
    const { titulo, subtema, nivel, lenguaje } = req.body
    const video = await prisma.video.update({
      where: { id: req.params.id },
      data: {
        ...(titulo    !== undefined && { titulo }),
        ...(subtema   !== undefined && { subtema }),
        ...(nivel     !== undefined && { nivel }),
        ...(lenguaje  !== undefined && { lenguaje }),
      }
    })
    return res.status(200).json({ success: true, data: video })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al actualizar el video' })
  }
}

// DELETE /api/videos/:id
export const deleteVideo = async (req: AuthRequest & Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado' })
    }
    await prisma.video.delete({ where: { id: req.params.id } })
    return res.status(200).json({ success: true, message: 'Video eliminado' })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar el video' })
  }
}

// ── Estimación de timing a partir de la narración ──────────────────────────────
// Edge TTS en español lee ~150 palabras/minuto + 0.5s de pausa que agrega MoviePy.
export function estimarTiming(slides: SlideData[]): void {
  let cursor = 0
  for (const slide of slides) {
    const narration = (slide as any).narracion || (slide as any).titulo || ''
    const words     = narration.trim().split(/\s+/).length
    const duracion  = (words / 150) * 60 + 0.5
    slide.inicio_sec = parseFloat(cursor.toFixed(2))
    slide.fin_sec    = parseFloat((cursor + duracion).toFixed(2))
    cursor = slide.fin_sec
  }
}

// ── Genera preguntas vía OpenAI para slides que no las traen ──────────────────
function getCodeMarkers(lenguaje: string) {
  const isPython = lenguaje === 'python'
  return {
    facil:   isPython ? '???' : '/* AQUÍ */',
    medio:   isPython ? '# completar aquí'          : '// completar aquí',
    dificil: isPython ? '# Comienza a programar aquí' : '// Comienza a programar aquí',
  }
}

export async function generarPreguntasParaSlide(slide: any, tema: string, lenguaje = 'python'): Promise<SlidePregunta[]> {
  const tipo = slide.tipo as string
  if (!['concepto', 'codigo', 'ejemplo'].includes(tipo)) return []

  const contenido = JSON.stringify({
    tipo:       slide.tipo,
    titulo:     slide.titulo,
    puntos:     slide.puntos,
    cuerpo:     slide.cuerpo,
    codigo:     slide.codigo,
    explicacion: slide.explicacion,
    analogia:   slide.analogia,
  }, null, 2)

  const langName = { python: 'Python', cpp: 'C++', java: 'Java', javascript: 'JavaScript', typescript: 'TypeScript' }[lenguaje] ?? lenguaje
  const markers = getCodeMarkers(lenguaje)

  const instruccionTipo = tipo === 'codigo'
    ? `Las 3 variantes deben ser de tipo "codigo" con los campos: "enunciado", "codigo_inicial", "salida_esperada", "explicacion".
LENGUAJE: ${langName}. Todo el codigo_inicial debe estar en ${langName}.

⚠️ REGLAS CRÍTICAS:

Regla 1 — campo "enunciado":
El enunciado debe ser SOLO una instrucción en texto plano (máximo 2 oraciones cortas).
NO incluyas código en el enunciado. NO uses backticks ni bloques de código.
El enunciado solo dice QUÉ debe hacer el programa o qué debe completar el estudiante.
La corrección compara la salida impresa EXACTA contra salida_esperada, así que el
enunciado DEBE nombrar la variable y la acción exacta esperadas (no una descripción
vaga tipo "que funcione correctamente") — si no, el estudiante puede escribir algo
razonable (como un print de depuración) que nunca modifica la variable evaluada.
Ejemplo bueno: "Completa el código para que imprima el resultado de la suma."
Ejemplo bueno: "Agrega cada par (i, j) a la lista 'resultados' con resultados.append((i, j))."
Ejemplo MALO: "Completa: cout << ??? para que imprima 8."
Ejemplo MALO: "Completa el cuerpo del bucle para que funcione correctamente."

Regla 2 — campo "codigo_inicial":
El codigo_inicial NUNCA puede ser código completo ni funcional. Si se ejecuta tal cual NO debe producir la salida_esperada.
El estudiante TIENE que escribir algo para que el programa funcione.

Escalado de dificultad:
- "facil": Copia el código del slide con exactamente UN valor o expresión reemplazada por el marcador ${markers.facil}.
  El resto del código permanece igual. Al ejecutar tal cual debe producir un error (no la salida esperada).

- "medio": Copia el código con el cuerpo de UNA estructura faltante.
  Pon el marcador ${markers.medio} dentro de la estructura vacía.
  La línea de apertura de la estructura debe estar presente; solo falta su interior.

- "dificil": Pon SOLO el marcador ${markers.dificil} como todo el codigo_inicial
  (puedes agregar máximo 1 línea de contexto si es estrictamente necesaria).

Regla 3 — campo "salida_esperada":
"salida_esperada" es SIEMPRE el stdout real que imprime la versión CORRECTAMENTE
COMPLETADA del código (lo que el estudiante debe lograr escribir) — NUNCA una
descripción de lo que pasa si NO se completa. Aunque codigo_inicial esté diseñado para
fallar/no ejecutarse tal cual, salida_esperada jamás puede ser un texto como "Error",
"Error de sintaxis", "NameError", "no está definido", etc. — eso describe el estado ROTO,
no la solución. Antes de escribirlo, imagina que TÚ resuelves el ejercicio correctamente
y anota EXACTAMENTE lo que ese programa (ya arreglado) imprimiría.

Regla 4 — coherencia con lo que el estudiante ya vio, y llamado/impresión:
El "codigo" del slide a veces SOLO define una función/estructura sin llamarla ni
imprimir nada. Si codigo_inicial se basa en ese slide, DEBE incluir TAMBIÉN las líneas
que llaman a esa función/estructura y la imprimen — si no, no hay forma de que exista
ninguna salida que comparar, sin importar qué escriba el estudiante. Esas líneas de
llamado/impresión SIEMPRE deben estar completas y visibles en codigo_inicial (nunca
detrás del marcador de dificultad) porque el estudiante nunca vio cómo se llama esa
función/estructura en este video — no puede intuir esa sintaxis por su cuenta.

Regla 5 — nunca asumas funciones de otro slide:
codigo_inicial debe ser 100% autocontenido. Si llama a una función (p.ej. "quicksort(arr)"),
esa función DEBE estar definida (con su propio "def") dentro del MISMO codigo_inicial —
nunca asumas que ya fue definida en un slide anterior del video; ese contexto no existe al
ejecutar esta pregunta de forma aislada, y el ejercicio quedaría roto sin ninguna solución
posible, ni siquiera completándolo del todo.`
    : `Las 3 variantes deben ser de tipo "seleccion_multiple" con los campos: "enunciado", "opciones" (exactamente 4 opciones), "respuesta_correcta" (índice "0"-"3"), "explicacion".`

  const prompt = `Crea 3 variantes de pregunta (facil/medio/dificil) para este slide de un video educativo de Fundamentos de Programación sobre "${tema}" en ${langName}.

CONTEXTO DEL ESTUDIANTE: Son de PRIMER SEMESTRE universitario, sin experiencia previa en programación.
Calibración obligatoria:
- "facil": La respuesta es directa y visible en el slide. Un estudiante que escuchó la explicación
  puede responderla en 5 segundos. No pide razonamiento, solo reconocimiento.
- "medio": Requiere entender el concepto y aplicarlo de forma obvia. Solo un paso de razonamiento.
  No uses conceptos que no estén en el slide.
- "dificil": Aplica el concepto a un caso nuevo, pero usando SOLO lo explicado en el slide.
  Sin jerga avanzada, sin trucos, sin conceptos adicionales.

Slide:
${contenido}

${instruccionTipo}

Devuelve ÚNICAMENTE un array JSON válido sin markdown ni texto extra:
{
  "preguntas": [
    { "dificultad": "facil",   "tipo": "...", "enunciado": "...", "explicacion": "..." },
    { "dificultad": "medio",   "tipo": "...", "enunciado": "...", "explicacion": "..." },
    { "dificultad": "dificil", "tipo": "...", "enunciado": "...", "explicacion": "..." }
  ]
}`

  const pedirPreguntas = async (promptExtra: string): Promise<SlidePregunta[]> => {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt + promptExtra }],
        temperature: 0.7,
        max_tokens: 1500,
      })
      let raw = completion.choices[0].message.content?.trim() ?? '{}'
      if (raw.startsWith('```')) raw = raw.split('```')[1].replace(/^json/, '').trim()
      return JSON.parse(raw).preguntas ?? []
    } catch {
      return []
    }
  }

  let preguntas = await pedirPreguntas('')
  if (tipo !== 'codigo') return preguntas

  // Sanity-check "codigo" questions by actually running codigo_inicial — an
  // LLM occasionally leaves the "// completar aquí" marker as decoration next
  // to code that already works unmodified (e.g. a declared-but-unassigned C++
  // variable, which silently defaults instead of erroring), so the exercise
  // is already "done" the moment the student opens it. The real signal is
  // whether it already prints salida_esperada verbatim — NOT merely "ran
  // without error": the "dificil" marker is just a bare comment, which is
  // always valid syntax (never errors) but also never matches the expected
  // output, so checking for errors alone would flag every "dificil" variant
  // as a false positive.
  for (let intento = 0; intento < 3; intento++) {
    const rotos: string[] = []
    for (const p of preguntas) {
      if (p.tipo !== 'codigo' || !p.codigo_inicial) continue
      if (!p.salida_esperada) {
        rotos.push(`- Dificultad "${p.dificultad}": no generaste salida_esperada — está mal.`)
        continue
      }
      if (!salidaEsperadaEsValida(p.salida_esperada)) {
        rotos.push(`- Dificultad "${p.dificultad}": salida_esperada ("${p.salida_esperada}") es una descripción de error, no la salida real de la solución — está mal.`)
        continue
      }
      const funcionIndefinida = llamaFuncionIndefinida(p.codigo_inicial, lenguaje)
      if (funcionIndefinida) {
        rotos.push(`- Dificultad "${p.dificultad}": llama a "${funcionIndefinida}(...)" pero esa función no está definida en codigo_inicial ni es un builtin — nunca podría ejecutarse, ni siquiera ya resuelto:\n${p.codigo_inicial}`)
        continue
      }
      if (p.dificultad !== 'dificil' && !tieneInstruccionDeSalida(p.codigo_inicial, lenguaje)) {
        rotos.push(`- Dificultad "${p.dificultad}": codigo_inicial no tiene ninguna instrucción de impresión (print/cout/console.log), o sea que ninguna solución podría producir salida_esperada — está mal:\n${p.codigo_inicial}`)
        continue
      }
      try {
        const result = await runCode(lenguaje, p.codigo_inicial)
        const salida = result.stdout.trim()
        if (salida === p.salida_esperada.trim() || (salida && salida.includes(p.salida_esperada.trim()))) {
          rotos.push(`- Dificultad "${p.dificultad}": este codigo_inicial ya produce (o ya contiene) la salida esperada tal cual, o sea que ya está completo — está mal:\n${p.codigo_inicial}`)
        }
      } catch {
        // Execution infra itself unavailable — can't validate right now, accept as-is.
      }
      if (await marcadorEsTrivial(p.codigo_inicial, p.salida_esperada, lenguaje)) {
        rotos.push(`- Dificultad "${p.dificultad}": basta con un no-op (pass) en el marcador para ya obtener salida_esperada, o sea que el cuerpo del bloque no es realmente necesario — está mal:\n${p.codigo_inicial}`)
      }
    }
    if (rotos.length === 0) break
    if (intento === 2) {
      console.warn(`Preguntas de código posiblemente ya resueltas (tema="${tema}", lenguaje="${lenguaje}") — revisar manualmente:\n${rotos.join('\n')}`)
      break
    }
    preguntas = await pedirPreguntas(`\n\nTu intento anterior violó las Reglas 2/3/4:\n${rotos.join('\n')}\n\nCorrige esto: salida_esperada SIEMPRE es la salida real de la solución correcta (nunca una descripción de error); codigo_inicial NO debe producir esa salida_esperada sin modificarlo (puede fallar al compilar/ejecutar, o simplemente producir una salida distinta/vacía — ambos son válidos, lo único inaceptable es que coincida con salida_esperada); (salvo en "dificil") codigo_inicial DEBE incluir las líneas que llaman a la función/estructura y la imprimen, completas y visibles, no detrás del marcador; y TODA función que codigo_inicial llame (incluida en "dificil") debe estar definida ahí mismo con su propio "def" — nunca asumas que una función de un slide anterior (como una previamente mostrada en el video) ya existe en el entorno de ejecución de esta pregunta, porque no es así.`)
  }
  return preguntas
}

// POST /api/videos/import-questions[?force=true]
// Importa/regenera preguntas para los videos.
// force=false (default): salta videos que ya tienen preguntas; usa preguntas del JSON si existen.
// force=true: borra preguntas existentes y regenera TODAS vía OpenAI (ignora JSON embebido).
export const importQuestionsForAllVideos = async (req: AuthRequest & Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Solo los docentes pueden hacer esto' })
    }

    const force = req.query.force === 'true'

    const videos = await prisma.video.findMany({
      include: { _count: { select: { questions: true } } },
    })

    let imported = 0, skipped = 0
    const errors: string[] = []

    for (const video of videos) {
      if (!force && video._count.questions > 0) { skipped++; continue }

      const jsonPath = path.join(VIDEO_OUTPUT_DIR, video.filename.replace('.mp4', '.json'))
      if (!fs.existsSync(jsonPath)) {
        errors.push(`${video.filename}: JSON no encontrado`)
        continue
      }

      try {
        // Borrar preguntas existentes si forzamos regeneración
        if (force && video._count.questions > 0) {
          await prisma.question.deleteMany({ where: { videoId: video.id } })
        }

        const guion  = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
        const slides = (guion.slides ?? []) as SlideData[]

        if (!slides[0]?.fin_sec) estimarTiming(slides)

        // En modo force: siempre regenerar vía OpenAI (ignora preguntas del JSON)
        // En modo normal: solo genera para slides sin preguntas
        for (const slide of slides) {
          const s = slide as any
          if (['concepto', 'codigo', 'ejemplo'].includes(s.tipo)) {
            if (force || !s.preguntas?.length) {
              s.preguntas = await generarPreguntasParaSlide(s, video.tema, video.lenguaje ?? 'python')
            }
          }
        }

        await crearPreguntasDelVideo(video.id, video.tema, video.nivel, video.lenguaje ?? 'python', slides)
        imported++
      } catch (err: any) {
        errors.push(`${video.filename}: ${err.message}`)
      }
    }

    return res.status(200).json({ success: true, data: { imported, skipped, errors } })
  } catch (error) {
    console.error('Error importando preguntas:', error)
    return res.status(500).json({ success: false, error: 'Error interno del servidor' })
  }
}
