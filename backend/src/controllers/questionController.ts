import { prisma } from '../lib/prisma'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { updateElo } from '../utils/elo'
import { runCode } from './executeController'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// GET /api/videos/:videoId/questions
// Selección adaptativa: cada slide tiene varias variantes de pregunta (distinta
// dificultadElo). Por cada slide se elige la variante cuya dificultad está más
// cerca del Elo actual del estudiante en ese tema — así la pregunta que ve cada
// estudiante no es siempre la misma, se recalibra con su nivel medido.
export const getQuestionsForVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autorizado' })
    }
    const { videoId } = req.params
    const userId = req.user.id

    const allVariants = await prisma.question.findMany({
      where: { videoId },
      orderBy: { triggerTimeSec: 'asc' },
      select: {
        id: true,
        topicId: true,
        slideIndex: true,
        triggerTimeSec: true,
        tipo: true,
        lenguaje: true,
        enunciado: true,
        opciones: true,
        codigoInicial: true,
        dificultadElo: true,
      },
    })

    if (allVariants.length === 0) {
      return res.status(200).json({ success: true, data: [] })
    }

    const topicId = allVariants[0].topicId
    const skill = await prisma.studentTopicSkill.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })
    const studentElo = skill?.elo ?? 1200

    // Agrupar variantes por slide y elegir la más cercana al Elo del estudiante
    const porSlide = new Map<number, typeof allVariants>()
    for (const v of allVariants) {
      const grupo = porSlide.get(v.slideIndex) ?? []
      grupo.push(v)
      porSlide.set(v.slideIndex, grupo)
    }

    const seleccionadas = [...porSlide.values()]
      .map(variantes =>
        variantes.reduce((mejor, actual) =>
          Math.abs(actual.dificultadElo - studentElo) < Math.abs(mejor.dificultadElo - studentElo) ? actual : mejor
        )
      )
      .sort((a, b) => a.triggerTimeSec - b.triggerTimeSec)

    const data = seleccionadas.map(q => ({
      id:             q.id,
      slideIndex:     q.slideIndex,
      triggerTimeSec: q.triggerTimeSec,
      tipo:           q.tipo,
      lenguaje:       q.lenguaje,
      enunciado:      q.enunciado,
      opciones:       q.opciones ? JSON.parse(q.opciones) : null,
      codigoInicial:  q.codigoInicial,
    }))

    return res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('Error al obtener preguntas del video:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFC')           // unify Unicode composition (ñ single char vs n+tilde)
    .trim()
    .toLowerCase()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/\s+$/, '')
}

// Mismas líneas que la salida esperada, solo que en otro orden — el enunciado no siempre
// especifica el orden de impresión, así que no debería contar como error.
function mismasLineas(a: string, b: string): boolean {
  const ordenar = (s: string) => s.split('\n').sort()
  const la = ordenar(a), lb = ordenar(b)
  return la.length === lb.length && la.every((linea, i) => linea === lb[i])
}

// Un punto/exclamación/coma final no cambia el contenido de la salida — pero
// sí puede hacer que una comparación exacta falle por error humano al armar
// la pregunta (p.ej. la salida esperada quedó con un "." que la plantilla de
// código que el estudiante realmente completa nunca produce). Se compara sin
// esa puntuación final ANTES de gastar una llamada a la IA para lo mismo.
function sinPuntuacionFinal(s: string): string {
  return s.replace(/[.!?,;:]+$/, '').trim()
}

// Evalúa semánticamente la salida de código cuando la comparación exacta falla
// o cuando no hay salida esperada guardada en la BD.
async function salidaEquivalente(enunciado: string, esperada: string, obtenida: string): Promise<boolean> {
  if (!obtenida || obtenida.toLowerCase().startsWith('error')) return false
  try {
    const content = esperada
      ? `Un estudiante de programación completó un ejercicio de código. Su salida impresa
es correcta si transmite el mismo contenido/resultado que la salida de referencia,
SIN IMPORTAR mayúsculas/minúsculas, signos de puntuación (comas, exclamaciones, puntos),
artículos, o pequeñas diferencias de redacción. Por ejemplo, "hola juan" y "Hola, Juan!"
cuentan como LA MISMA salida (ambas son un saludo a Juan) — NO marques error por eso.
Solo marca false si el CONTENIDO es realmente distinto: un valor numérico diferente,
falta información, o el resultado no responde a lo pedido.

Tarea: ${enunciado}
Salida de referencia: ${esperada}
Salida del estudiante: ${obtenida}

Responde SOLO con JSON: {"correcto": true} o {"correcto": false}`
      : `Evalúa si la salida de este programa es correcta para la tarea pedida.
Tarea: ${enunciado}
Salida del programa: ${obtenida}
¿La salida es una respuesta válida y razonable para la tarea? (No debe ser un error)
Responde SOLO con JSON: {"correcto": true} o {"correcto": false}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      temperature: 0,
      max_tokens: 20,
    })
    const raw = completion.choices[0].message.content?.trim() ?? '{}'
    const parsed = JSON.parse(raw.startsWith('```') ? raw.split('```')[1].replace(/^json/, '').trim() : raw)
    return !!parsed.correcto
  } catch {
    return false
  }
}

async function calificarAbierta(enunciado: string, respuestaModelo: string, respuestaEstudiante: string): Promise<{ correcto: boolean; feedback: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres un asistente que califica respuestas abiertas de estudiantes de Fundamentos de Programación.

Pregunta: ${enunciado}
Respuesta de referencia (guía, no exigir texto idéntico): ${respuestaModelo}
Respuesta del estudiante: ${respuestaEstudiante}

Evalúa si la respuesta del estudiante demuestra haber entendido el concepto, aunque esté redactada distinto a la referencia.
Responde ÚNICAMENTE un JSON válido sin markdown: {"correcto": boolean, "feedback": "breve retroalimentación en español, máximo 2 oraciones"}`,
      }],
      temperature: 0.3,
      max_tokens: 200,
    })

    let raw = completion.choices[0].message.content?.trim() ?? '{}'
    if (raw.startsWith('```')) {
      raw = raw.split('```')[1].replace(/^json/, '').trim()
    }
    const parsed = JSON.parse(raw)
    return { correcto: !!parsed.correcto, feedback: parsed.feedback ?? '' }
  } catch (error) {
    console.error('Error calificando respuesta abierta:', error)
    return { correcto: false, feedback: 'No se pudo evaluar automáticamente tu respuesta.' }
  }
}

// Resuelve un ejercicio de código con IA y VERIFICA la propuesta ejecutándola
// de verdad antes de confiar en ella — nunca se le muestra al estudiante una
// "solución" que no produzca exactamente la salida esperada. Se llama solo
// cuando un estudiante ya falló 3 veces seguidas (ver submitAttempt) y el
// resultado se cachea en Question.codigoSolucion para no volver a gastar una
// llamada a la IA la próxima vez que alguien se atore en la misma pregunta.
async function resolverCodigoVerificado(question: {
  enunciado: string
  codigoInicial: string | null
  lenguaje: string
  respuestaCorrecta: string | null
}): Promise<string | null> {
  if (!question.codigoInicial || !question.respuestaCorrecta) return null
  const esperada = normalizar(question.respuestaCorrecta)

  for (let intento = 0; intento < 3; intento++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Un estudiante falló 3 veces seguidas este ejercicio de código y necesita ver la solución completa.

Enunciado: ${question.enunciado}
Código inicial (con un espacio en blanco por completar):
${question.codigoInicial}

Lenguaje: ${question.lenguaje}
Salida esperada exacta al ejecutar la solución: ${question.respuestaCorrecta}

Devuelve ÚNICAMENTE el código fuente completo y correcto que produce exactamente esa salida — sin explicaciones, sin markdown, sin comentarios tipo "completar aquí" (ya deben estar resueltos). Conserva la misma estructura y nombres de variables del código inicial en la medida de lo posible.`,
        }],
        temperature: 0,
        max_tokens: 500,
      })
      let codigo = completion.choices[0].message.content?.trim() ?? ''
      codigo = codigo.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim()
      if (!codigo) continue

      const result = await runCode(question.lenguaje, codigo)
      const salida = normalizar(result.stdout)
      if (salida === esperada || mismasLineas(salida, esperada) || sinPuntuacionFinal(salida) === sinPuntuacionFinal(esperada)) {
        return codigo
      }
    } catch {
      // intenta de nuevo con el siguiente intento
    }
  }
  return null
}

// Reglas de calificación por tipo de pregunta — compartidas entre
// submitAttempt (una pregunta a la vez, embebida en video) y el examen final
// de módulo (10 preguntas de una vez), para que ambos flujos califiquen
// exactamente igual.
export async function gradeAnswer(question: {
  tipo: string
  opciones: string | null
  respuestaCorrecta: string | null
  enunciado: string
  explicacion: string
}, respuesta: unknown): Promise<{ correcto: boolean; feedback: string }> {
  let correcto = false
  let feedback = question.explicacion

  if (question.tipo === 'seleccion_multiple') {
    const correctaRaw = String(question.respuestaCorrecta ?? '').trim()
    const respuestaStr = String(respuesta).trim()
    if (/^\d+$/.test(correctaRaw)) {
      correcto = respuestaStr === correctaRaw
    } else {
      const opciones: string[] = question.opciones ? JSON.parse(question.opciones) : []
      const correctaIdx = opciones.findIndex(o => o.toLowerCase().trim() === correctaRaw.toLowerCase())
      correcto = correctaIdx !== -1 && respuestaStr === String(correctaIdx)
    }
  } else if (question.tipo === 'codigo') {
    const normResp     = normalizar(String(respuesta))
    const normEsperada = normalizar(question.respuestaCorrecta ?? '')

    const esError = (s: string) =>
      !s || s.startsWith('error:') || s.startsWith('error\n') || s.startsWith('traceback')

    if (normEsperada) {
      correcto = normResp === normEsperada || mismasLineas(normResp, normEsperada) ||
        sinPuntuacionFinal(normResp) === sinPuntuacionFinal(normEsperada)
      if (!correcto && normResp && !esError(normResp)) {
        correcto = await salidaEquivalente(question.enunciado, normEsperada, normResp)
      }
    } else {
      correcto = !esError(normResp) && normResp.length > 0 && normResp !== '(sin salida)'
    }
  } else if (question.tipo === 'abierta') {
    const juicio = await calificarAbierta(question.enunciado, question.respuestaCorrecta ?? '', String(respuesta))
    correcto = juicio.correcto
    feedback = juicio.feedback || question.explicacion
  }

  return { correcto, feedback }
}

// POST /api/questions/:id/attempt
export const submitAttempt = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autorizado' })
    }
    const userId = req.user.id
    const { id: questionId } = req.params
    const { respuesta } = req.body

    if (respuesta === undefined || respuesta === null || respuesta === '') {
      return res.status(400).json({ success: false, error: 'Falta la respuesta' })
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } })
    if (!question) {
      return res.status(404).json({ success: false, error: 'Pregunta no encontrada' })
    }

    const skill = await prisma.studentTopicSkill.upsert({
      where:  { userId_topicId: { userId, topicId: question.topicId } },
      update: {},
      create: { userId, topicId: question.topicId, elo: 1200 },
    })

    const { correcto, feedback } = await gradeAnswer(question, respuesta)

    const { nuevoEstudiante, nuevaPregunta } = updateElo(skill.elo, question.dificultadElo, correcto)

    await prisma.studentTopicSkill.update({
      where: { userId_topicId: { userId, topicId: question.topicId } },
      data:  { elo: nuevoEstudiante },
    })

    await prisma.question.update({
      where: { id: questionId },
      data: {
        dificultadElo:   nuevaPregunta,
        vecesRespondida: { increment: 1 },
        vecesCorrecta:   correcto ? { increment: 1 } : undefined,
      },
    })

    await prisma.questionAttempt.create({
      data: {
        userId,
        questionId,
        respuestaDada:        String(respuesta),
        correcto,
        eloEstudianteAntes:   skill.elo,
        eloEstudianteDespues: nuevoEstudiante,
        eloPreguntaAntes:     question.dificultadElo,
        eloPreguntaDespues:   nuevaPregunta,
      },
    })

    // Monedas por responder correctamente — pequeño incentivo adicional al
    // XP que ya da completar el video/módulo.
    const COIN_REWARD_CORRECT_ANSWER = 3
    const coinsGained = correcto ? COIN_REWARD_CORRECT_ANSWER : 0
    if (coinsGained > 0) {
      await prisma.studentProgress.update({
        where: { userId },
        data:  { coins: { increment: coinsGained } },
      })
    }

    // Si es una pregunta de código y esta es la 3ra falla SEGUIDA (sin ningún
    // acierto entremedio), se le revela la solución completa automáticamente
    // — ya no pudo resolverla solo. Se calcula (y verifica ejecutándola) solo
    // la primera vez; de ahí en adelante se sirve cacheada desde la BD.
    let codigoSolucion: string | null = null
    if (question.tipo === 'codigo' && !correcto) {
      const ultimosTres = await prisma.questionAttempt.findMany({
        where: { userId, questionId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })
      const tresFallosSeguidos = ultimosTres.length === 3 && ultimosTres.every(a => !a.correcto)
      if (tresFallosSeguidos) {
        codigoSolucion = question.codigoSolucion
        if (!codigoSolucion) {
          codigoSolucion = await resolverCodigoVerificado(question)
          if (codigoSolucion) {
            await prisma.question.update({ where: { id: questionId }, data: { codigoSolucion } })
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        correcto,
        explicacion:       feedback,
        eloEstudiante:     Math.round(nuevoEstudiante),
        coinsGained,
        // Revelar la respuesta correcta solo ahora que ya se calificó el intento — sirve
        // para que el estudiante pueda revisar la pregunta sin que sea "hacer trampa".
        respuestaCorrecta: question.respuestaCorrecta,
        codigoSolucion,
      },
    })
  } catch (error) {
    console.error('Error al calificar intento de pregunta:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}
