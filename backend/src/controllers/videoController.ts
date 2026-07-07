import { prisma } from '../lib/prisma'
import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { ELO_ANCHOR_POR_NIVEL } from '../utils/elo'

const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL || 'http://localhost:8001'

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
  inicio_sec?: number
  fin_sec?: number
  preguntas?: SlidePregunta[]
}

// Crea las filas Question a partir de los slides del guión generado por Python.
// Cada slide-pregunta genera VARIAS filas (una por variante de dificultad) que
// comparten slideIndex/triggerTimeSec — el sistema elige cuál mostrar según el
// Elo del estudiante en ese momento (ver questionController.getQuestionsForVideo).
async function crearPreguntasDelVideo(videoId: string, tema: string, nivel: string, slides: SlideData[]) {
  const topic = await prisma.topic.findFirst({ where: { name: tema } })
  const topicId = topic?.topicId ?? tema

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    if (!slide.preguntas?.length || slide.fin_sec === undefined) continue

    for (const p of slide.preguntas) {
      const respuestaCorrecta =
        p.tipo === 'codigo'  ? p.salida_esperada ?? '' :
        p.tipo === 'abierta' ? p.respuesta_modelo ?? '' :
        p.respuesta_correcta ?? ''

      const dificultadElo = ELO_ANCHOR_POR_NIVEL[p.dificultad?.toLowerCase()] ?? 1200

      await prisma.question.create({
        data: {
          videoId,
          topicId,
          nivel:             p.dificultad ?? nivel,
          slideIndex:        i,
          triggerTimeSec:    slide.fin_sec,
          tipo:              p.tipo,
          enunciado:         p.enunciado,
          opciones:          p.opciones ? JSON.stringify(p.opciones) : null,
          respuestaCorrecta,
          codigoInicial:     p.codigo_inicial ?? null,
          explicacion:       p.explicacion,
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

    const { tema, subtema, nivel } = req.body
    if (!tema || !subtema) {
      return res.status(400).json({ success: false, error: 'Tema y subtema son requeridos' })
    }

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

    // Guardar en base de datos
    const video = await prisma.video.create({
      data: {
        titulo:           videoData.titulo,
        tema,
        subtema,
        nivel:            nivel || 'medio',
        duracionEstimada: videoData.duracion_estimada,
        filename:         videoData.filename,
        videoUrl:         videoData.video_url,
        slides:           videoData.slides,
        status:           'ready',
        createdBy:        req.user.id,
      },
    })

    if (videoData.slides_data?.length) {
      await crearPreguntasDelVideo(video.id, tema, nivel || 'medio', videoData.slides_data)
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
      videoUrl: v.videoUrl.replace(/^\{BASE_URL\}/, VIDEO_SERVICE_URL),
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
    const fixed = { ...video, videoUrl: video.videoUrl.replace(/^\{BASE_URL\}/, VIDEO_SERVICE_URL) }
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
    const { titulo, subtema, nivel } = req.body
    const video = await prisma.video.update({
      where: { id: req.params.id },
      data: {
        ...(titulo   !== undefined && { titulo }),
        ...(subtema  !== undefined && { subtema }),
        ...(nivel    !== undefined && { nivel }),
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
