// Server-side mirror of the 40 achievement definitions in
// fronted/app/dashboard/student/achievements/page.tsx — the claim endpoint
// must independently re-verify the unlock condition, never trust the client.
//
// coinReward formula (applied once while transcribing each entry's rewardXP):
//   rewardXP > 0 ? Math.max(5, Math.round(rewardXP / 5)) : 10

export interface AchievementStats {
  totalXP: number
  level: number
  streak: number
  videosWatched: number
  chatbotSessions: number
  completedCount: number       // completedTopics.length
  fullyWatchedTopics: number   // topics with all 3 levels watched
  tier1Unlocked?: number       // populated after computing tier1
}

export interface AchievementRule {
  id: string
  tier: 1 | 2
  coinReward: number
  check: (s: AchievementStats) => boolean
}

export const ACHIEVEMENT_RULES: AchievementRule[] = [
  // ── TIER 1 — PRINCIPIANTE ──────────────────────────────────────────────
  { id: 't1_first_video',     tier: 1, coinReward: 10, check: s => s.videosWatched >= 1 },
  { id: 't1_streak_2',        tier: 1, coinReward: 6,  check: s => s.streak >= 2 },
  { id: 't1_first_chat',      tier: 1, coinReward: 5,  check: s => s.chatbotSessions >= 1 },
  { id: 't1_first_module',    tier: 1, coinReward: 20, check: s => s.completedCount >= 1 },
  { id: 't1_xp_100',          tier: 1, coinReward: 10, check: s => s.totalXP >= 100 },
  { id: 't1_3_videos',        tier: 1, coinReward: 8,  check: s => s.videosWatched >= 3 },
  { id: 't1_2_modules',       tier: 1, coinReward: 16, check: s => s.completedCount >= 2 },
  { id: 't1_streak_3',        tier: 1, coinReward: 12, check: s => s.streak >= 3 },
  { id: 't1_triple_threat',   tier: 1, coinReward: 30, check: s => s.fullyWatchedTopics >= 1 },
  { id: 't1_5_chats',         tier: 1, coinReward: 8,  check: s => s.chatbotSessions >= 3 },
  { id: 't1_level_2',         tier: 1, coinReward: 10, check: s => s.level >= 2 },
  { id: 't1_xp_200',          tier: 1, coinReward: 14, check: s => s.totalXP >= 200 },
  { id: 't1_3_modules',       tier: 1, coinReward: 30, check: s => s.completedCount >= 3 },
  { id: 't1_5_videos',        tier: 1, coinReward: 12, check: s => s.videosWatched >= 5 },
  { id: 't1_xp_500',          tier: 1, coinReward: 20, check: s => s.totalXP >= 500 },
  { id: 't1_chat_5',          tier: 1, coinReward: 15, check: s => s.chatbotSessions >= 5 },
  { id: 't1_10_videos',       tier: 1, coinReward: 16, check: s => s.videosWatched >= 10 },
  { id: 't1_2_full_topics',   tier: 1, coinReward: 24, check: s => s.fullyWatchedTopics >= 2 },
  { id: 't1_4_modules',       tier: 1, coinReward: 40, check: s => s.completedCount >= 4 },
  { id: 't1_streak_5',        tier: 1, coinReward: 24, check: s => s.streak >= 5 },

  // ── TIER 2 — AVANZADO ───────────────────────────────────────────────────
  { id: 't2_xp_1000',         tier: 2, coinReward: 40,  check: s => s.totalXP >= 1000 },
  { id: 't2_streak_7',        tier: 2, coinReward: 36,  check: s => s.streak >= 7 },
  { id: 't2_5_modules',       tier: 2, coinReward: 50,  check: s => s.completedCount >= 5 },
  { id: 't2_15_videos',       tier: 2, coinReward: 30,  check: s => s.videosWatched >= 15 },
  { id: 't2_level_3',         tier: 2, coinReward: 40,  check: s => s.level >= 3 },
  { id: 't2_chat_10',         tier: 2, coinReward: 20,  check: s => s.chatbotSessions >= 10 },
  { id: 't2_4_full_topics',   tier: 2, coinReward: 44,  check: s => s.fullyWatchedTopics >= 4 },
  { id: 't2_6_modules',       tier: 2, coinReward: 56,  check: s => s.completedCount >= 6 },
  { id: 't2_3_full_topics',   tier: 2, coinReward: 35,  check: s => s.fullyWatchedTopics >= 3 },
  { id: 't2_streak_14',       tier: 2, coinReward: 70,  check: s => s.streak >= 14 },
  { id: 't2_20_videos',       tier: 2, coinReward: 40,  check: s => s.videosWatched >= 20 },
  { id: 't2_xp_1500',         tier: 2, coinReward: 60,  check: s => s.totalXP >= 1500 },
  { id: 't2_15_basic',        tier: 2, coinReward: 30,  check: s => (s.tier1Unlocked ?? 0) >= 15 },
  { id: 't2_7_modules',       tier: 2, coinReward: 70,  check: s => s.completedCount >= 7 },
  { id: 't2_8_modules',       tier: 2, coinReward: 100, check: s => s.completedCount >= 8 },
  { id: 't2_chat_20',         tier: 2, coinReward: 40,  check: s => s.chatbotSessions >= 20 },
  { id: 't2_level_4',         tier: 2, coinReward: 50,  check: s => s.level >= 4 },
  { id: 't2_xp_2000',         tier: 2, coinReward: 80,  check: s => s.totalXP >= 2000 },
  { id: 't2_streak_30',       tier: 2, coinReward: 100, check: s => s.streak >= 30 },
  { id: 't2_graduate',        tier: 2, coinReward: 200, check: s => s.completedCount >= 8 && s.level >= 3 },
]

const TIER1_RULES = ACHIEVEMENT_RULES.filter(r => r.tier === 1)

// Computes AchievementStats from progress fields + grouped video-watch data —
// same derivation as fronted/app/dashboard/student/achievements/page.tsx.
export function computeStats(base: Omit<AchievementStats, 'tier1Unlocked'>): AchievementStats {
  const tier1Unlocked = TIER1_RULES.filter(r => r.check(base as AchievementStats)).length
  return { ...base, tier1Unlocked }
}
