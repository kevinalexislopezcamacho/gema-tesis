import type { ByteExpression } from "@/components/byte/ByteMascot"

export type TourRole = "student" | "admin"

export type AdminTab = "videos" | "students" | "analytics" | "modules" | "report"

export interface TourStepContent {
  id: string
  route?: string
  target?: string
  title: string
  body: string
  expression: ByteExpression
  placement?: "top" | "bottom" | "left" | "right" | "auto"
  adminTab?: AdminTab
  openChat?: boolean
}

export interface TourStep extends TourStepContent {
  audioSrc: string
}
