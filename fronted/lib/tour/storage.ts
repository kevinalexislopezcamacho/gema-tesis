import type { TourRole } from "./types"

// Clave nueva (no un bump de versión de la vieja "codepath-tutorial-done-v1-")
// para que tanto los estudiantes que ya vieron el tutorial viejo como los
// docentes (que nunca tuvieron ninguno) vean este tour nuevo una vez.
const storageKey = (role: TourRole, userId: string) => `gema-tour-done-v1-${role}-${userId}`

export function shouldShowTour(role: TourRole, userId: string): boolean {
  if (typeof window === "undefined") return false
  return !localStorage.getItem(storageKey(role, userId))
}

export function markTourDone(role: TourRole, userId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(role, userId), "1")
}
