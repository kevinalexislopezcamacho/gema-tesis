import type { TourStep, TourStepContent } from "./types"
import raw from "./admin-steps.data.json"

export const ADMIN_STEPS: TourStep[] = (raw as TourStepContent[]).map(step => ({
  ...step,
  audioSrc: `/audio/tour/${step.id}.mp3`,
}))
