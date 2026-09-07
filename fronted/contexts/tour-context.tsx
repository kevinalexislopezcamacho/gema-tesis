"use client"

import { createContext, useContext } from "react"
import type { AdminTab } from "@/lib/tour/types"

export interface TourContextValue {
  startTour: () => void
  registerAdminTabSetter: (fn: (tab: AdminTab) => void) => void
  tourActive: boolean
}

export const TourContext = createContext<TourContextValue | undefined>(undefined)

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour debe usarse dentro de un TourProvider")
  return ctx
}
