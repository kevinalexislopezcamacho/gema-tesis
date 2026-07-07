import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Traduce el puntaje Elo (interno, base 1200) a una etiqueta amigable para mostrar
// en la UI. Los cortes están alineados con las anclas de dificultad del backend
// (fácil=1000, medio=1300, avanzado=1600) — ver backend/src/utils/elo.ts.
export function eloLabel(elo: number): { label: string; className: string } {
  if (elo < 1150)  return { label: "Principiante", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" }
  if (elo < 1450)  return { label: "Intermedio",    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" }
  return                 { label: "Avanzado",       className: "bg-green-500/15 text-green-400 border-green-500/30" }
}
