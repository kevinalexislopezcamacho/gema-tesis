import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Sprout, BookOpen, Zap, Flame, Gem, Trophy, Crown, type LucideIcon } from 'lucide-react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface EloTier {
  icon:      LucideIcon
  label:     string
  min:       number
  max:       number
  textColor: string
  bgColor:   string
  barFrom:   string
  barTo:     string
}

export const ELO_TIERS: EloTier[] = [
  { icon: Sprout,   label: "Novato",      min: 0,    max: 1099, textColor: "text-slate-500",  bgColor: "bg-slate-500/15",  barFrom: "#94a3b8", barTo: "#64748b"  },
  { icon: BookOpen, label: "Aprendiz",    min: 1100, max: 1199, textColor: "text-blue-500",   bgColor: "bg-blue-500/15",   barFrom: "#60a5fa", barTo: "#3b82f6"  },
  { icon: Zap,      label: "Practicante", min: 1200, max: 1299, textColor: "text-cyan-500",   bgColor: "bg-cyan-500/15",   barFrom: "#22d3ee", barTo: "#06b6d4"  },
  { icon: Flame,    label: "Competente",  min: 1300, max: 1399, textColor: "text-amber-600",  bgColor: "bg-amber-500/15",  barFrom: "#fbbf24", barTo: "#d97706"  },
  { icon: Gem,      label: "Avanzado",    min: 1400, max: 1499, textColor: "text-violet-500", bgColor: "bg-violet-500/15", barFrom: "#a78bfa", barTo: "#7c3aed"  },
  { icon: Trophy,   label: "Experto",     min: 1500, max: 1599, textColor: "text-orange-500", bgColor: "bg-orange-500/15", barFrom: "#fb923c", barTo: "#ea580c"  },
  { icon: Crown,    label: "Maestro",     min: 1600, max: 9999, textColor: "text-yellow-600", bgColor: "bg-yellow-500/15", barFrom: "#facc15", barTo: "#ca8a04"  },
]

export function getEloTier(elo: number): EloTier {
  return ELO_TIERS.find(t => elo >= t.min && elo <= t.max) ?? ELO_TIERS[0]
}

export function getNextEloTier(elo: number): EloTier | null {
  const idx = ELO_TIERS.findIndex(t => elo >= t.min && elo <= t.max)
  if (idx === -1 || idx === ELO_TIERS.length - 1) return null
  return ELO_TIERS[idx + 1]
}

export function eloLabel(elo: number): { label: string; className: string } {
  const tier = getEloTier(elo)
  return { label: tier.label, className: `${tier.bgColor} ${tier.textColor}` }
}
