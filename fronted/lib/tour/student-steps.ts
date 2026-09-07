import type { TourStep, TourStepContent } from "./types"
import raw from "./student-steps.data.json"

export const STUDENT_STEPS: TourStep[] = (raw as TourStepContent[]).map(step => ({
  ...step,
  audioSrc: `/audio/tour/${step.id}.mp3`,
}))
