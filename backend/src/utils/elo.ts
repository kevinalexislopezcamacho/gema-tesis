const K_STUDENT  = 32
const K_QUESTION = 8

/**
 * Actualización de Elo de 2 jugadores (estudiante vs. pregunta).
 * Si el estudiante "gana" (responde bien), gana lo que la pregunta "pierde"
 * — mismo delta, signo invertido. Fórmula: nuevo = actual + K × (resultado − esperado).
 */
export function updateElo(studentElo: number, questionElo: number, correct: boolean) {
  const resultado = correct ? 1 : 0
  const esperado  = 1 / (1 + Math.pow(10, (questionElo - studentElo) / 400))
  const delta     = resultado - esperado

  return {
    nuevoEstudiante: studentElo + K_STUDENT * delta,
    nuevaPregunta:   questionElo - K_QUESTION * delta,
  }
}

// Ancla inicial de dificultad por etiqueta — tanto para el nivel del video
// (fácil/medio/avanzado) como para las variantes de pregunta (facil/medio/dificil).
export const ELO_ANCHOR_POR_NIVEL: Record<string, number> = {
  'fácil':    1000,
  'facil':    1000,
  'medio':    1300,
  'avanzado': 1600,
  'dificil':  1600,
  'difícil':  1600,
}
