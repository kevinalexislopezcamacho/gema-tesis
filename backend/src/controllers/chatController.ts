import { prisma } from '../lib/prisma'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TOPIC_NAMES: Record<string, string> = {
  'datos':               'Tipos de Datos',
  'operaciones-logicas': 'Operaciones Lógicas',
  'filtros':             'Filtros',
  'condicionales':       'Condicionales',
  'bucles':              'Bucles',
  'funciones':           'Funciones',
  'arreglos':            'Arreglos',
  'matrices':            'Matrices',
}

const ALL_TOPICS = Object.values(TOPIC_NAMES)

const HISTORY_LIMIT = 20   // mensajes previos que se envían como contexto
const MAX_TOKENS    = 700  // tokens máximos en la respuesta

function buildSystemPrompt(
  name: string,
  level: number,
  totalXP: number,
  streak: number,
  videosWatched: number,
  completedTopicIds: string[]
): string {
  const completed = completedTopicIds.map(id => TOPIC_NAMES[id] || id)
  const remaining = ALL_TOPICS.filter(t => !completed.includes(t))

  return `Eres **CodeBot**, el asistente de IA educativo de **CodePathAI**, una plataforma de micro-aprendizaje de fundamentos de programación.

## Tu personalidad
- Amigable, motivador y paciente con los estudiantes
- Usas ejemplos prácticos en Python 3
- Respondes siempre en español
- Usas emojis ocasionalmente para hacer la conversación más dinámica
- Respuestas concisas pero completas (máx. 350 palabras, excepto cuando pidan código extenso)

## Curso: Fundamentos de Programación
Los 8 módulos del curso en orden progresivo:

1. **Tipos de Datos** — Variables, constantes, int, float, str, bool, None, conversión de tipos
2. **Operaciones Lógicas** — AND, OR, NOT, operadores de comparación (==, !=, <, >), tablas de verdad
3. **Filtros** — filter(), list comprehensions, expresiones lambda, validaciones de datos
4. **Condicionales** — if, elif, else, operador ternario, match/case (Python 3.10+)
5. **Bucles** — for, while, range(), enumerate(), break, continue, bucles anidados
6. **Funciones** — def, parámetros, return, *args, **kwargs, funciones lambda, scope local/global
7. **Arreglos** — Listas, indexing, slicing, append/pop/sort/len/index, listas anidadas
8. **Matrices** — Listas de listas, acceso [fila][col], recorrido con doble for, operaciones 2D

## Sobre la plataforma CodePathAI
- Los estudiantes aprenden con **videos generados por IA** o **chateando contigo (CodeBot)**
- Cada módulo tiene 3 niveles: fácil (50 XP), medio (100 XP), avanzado (200 XP)
- Los niveles de usuario suben cada 500 XP acumulados
- Los módulos se desbloquean en orden — hay que completar uno para pasar al siguiente
- El docente genera los videos desde su panel de administración
- Para completar un módulo el estudiante ve el video del nivel que elija

## Perfil del estudiante actual
- **Nombre:** ${name}
- **Nivel de usuario:** ${level}
- **XP total acumulado:** ${totalXP} XP
- **Racha:** ${streak} días consecutivos activo
- **Videos vistos:** ${videosWatched}
- **Módulos completados (${completed.length}/8):** ${completed.length > 0 ? completed.join(', ') : 'ninguno todavía'}
- **Módulos pendientes (${remaining.length}):** ${remaining.length > 0 ? remaining.join(', ') : '¡Curso completado! 🎉'}

## Reglas de comportamiento
- Si preguntan qué les falta, menciona exactamente los módulos pendientes con su nombre
- Si preguntan su XP/nivel/racha, usa los datos reales del perfil de arriba
- Siempre incluye código Python cuando expliques conceptos técnicos
- Si el estudiante parece frustrado, anímalo y sugiere un enfoque más simple
- Si preguntan cómo funciona la plataforma, explica usando la información de arriba
- No inventes datos del progreso del estudiante — usa solo los datos proporcionados`
}

// POST /api/chat/message
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'No autorizado' })

    const { message } = req.body
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'Mensaje vacío' })

    const [user, progress, history] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id } }),
      prisma.studentProgress.findUnique({ where: { userId: req.user.id } }),
      prisma.chatMessage.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'asc' },
        take: HISTORY_LIMIT,
      }),
    ])

    const completedIds: string[] = progress ? JSON.parse(progress.completedTopics) : []

    // Increment chatbotSessions when first message of a new day
    if (progress) {
      const lastAt   = progress.lastActivityAt
      const today    = new Date()
      const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const isNew    = !lastAt || new Date(lastAt) < todayDay || history.length === 0

      if (isNew) {
        await prisma.studentProgress.update({
          where: { userId: req.user.id },
          data: { chatbotSessions: { increment: 1 }, lastActivityAt: new Date() },
        })
      }
    }

    // Save user message
    await prisma.chatMessage.create({
      data: { userId: req.user.id, role: 'user', content: message.trim() },
    })

    const systemPrompt = buildSystemPrompt(
      user?.name || 'Estudiante',
      progress?.level || 1,
      progress?.totalXP || 0,
      progress?.streak || 0,
      progress?.videosWatched || 0,
      completedIds
    )

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message.trim() },
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
    })

    const reply = completion.choices[0].message.content || 'Lo siento, no pude generar una respuesta.'

    // Save assistant response
    await prisma.chatMessage.create({
      data: { userId: req.user.id, role: 'assistant', content: reply },
    })

    return res.status(200).json({
      success: true,
      data: { message: reply },
    })
  } catch (error: any) {
    console.error('Error en chatbot:', error)
    if (error?.status === 401) {
      return res.status(500).json({ success: false, error: 'API key de OpenAI inválida o expirada' })
    }
    return res.status(500).json({ success: false, error: 'Error al procesar el mensaje' })
  }
}

// GET /api/chat/history
export const getChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'No autorizado' })

    const messages = await prisma.chatMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return res.status(200).json({ success: true, data: messages })
  } catch {
    return res.status(500).json({ success: false, error: 'Error al obtener historial' })
  }
}

// DELETE /api/chat/history
export const clearChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'No autorizado' })

    await prisma.chatMessage.deleteMany({ where: { userId: req.user.id } })
    return res.status(200).json({ success: true, message: 'Historial borrado' })
  } catch {
    return res.status(500).json({ success: false, error: 'Error al borrar historial' })
  }
}
