import type { LucideIcon } from 'lucide-react'
import { Compass, Copy, Layers, Link2, Sparkles, Trophy } from 'lucide-react'

/**
 * Quest & points config for the payment-link generator (Express + Bulk).
 * This is the single source of truth for what quests exist, what they're
 * worth, and how they're displayed — `useQuests` only ever stores *which*
 * quest ids are completed, never their point values, so points can be
 * rebalanced here without any data migration.
 */
export type QuestId = 'first_link' | 'copy_cat' | 'bulk_starter' | 'bulk_master' | 'multi_asset' | 'explorer'

export interface Quest {
  id: QuestId
  title: string
  description: string
  points: number
  icon: LucideIcon
}

export const QUESTS: Quest[] = [
  {
    id: 'first_link',
    title: 'First Link',
    description: 'Generate your first payment link with Express Request.',
    points: 10,
    icon: Link2,
  },
  {
    id: 'copy_cat',
    title: 'Copy Cat',
    description: 'Copy a generated payment link to your clipboard.',
    points: 5,
    icon: Copy,
  },
  {
    id: 'bulk_starter',
    title: 'Bulk Starter',
    description: 'Generate a batch of payment links with Bulk Request.',
    points: 15,
    icon: Layers,
  },
  {
    id: 'bulk_master',
    title: 'Bulk Master',
    description: 'Generate 10 or more payment links in a single Bulk Request batch.',
    points: 25,
    icon: Trophy,
  },
  {
    id: 'multi_asset',
    title: 'Multi Asset',
    description: 'Create payment links using 2 different assets.',
    points: 15,
    icon: Sparkles,
  },
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'Try both Express Request and Bulk Request at least once.',
    points: 10,
    icon: Compass,
  },
]

export const QUEST_MAP: Record<QuestId, Quest> = QUESTS.reduce((map, quest) => {
  map[quest.id] = quest
  return map
}, {} as Record<QuestId, Quest>)

export const TOTAL_POSSIBLE_POINTS = QUESTS.reduce((sum, quest) => sum + quest.points, 0)

export interface PointTier {
  name: string
  minPoints: number
}

/** Ordered ascending by minPoints — the highest tier whose threshold is met wins. */
export const POINT_TIERS: PointTier[] = [
  { name: 'Newcomer', minPoints: 0 },
  { name: 'Bronze', minPoints: 10 },
  { name: 'Silver', minPoints: 40 },
  { name: 'Gold', minPoints: 70 },
]

export function getTier(points: number): PointTier {
  let current = POINT_TIERS[0]
  for (const tier of POINT_TIERS) {
    if (points >= tier.minPoints) current = tier
  }
  return current
}
