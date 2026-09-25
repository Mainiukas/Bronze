/**
 * Achievements and lifetime stats for the local player (seat 0, "You").
 * Stats are saved in localStorage; recordMatch folds in a finished match
 * and reports which achievements it unlocked.
 */

import type { GameState } from '../game/types'
import { MAPS } from './maps'

export interface PlayerStats {
  matches: number
  wins: number
  bestScore: number
  goodsShipped: number
  /** Map ids with at least one finished match. */
  mapsPlayed: string[]
  /** Achievement id → ISO date it was unlocked. */
  unlocked: Record<string, string>
}

export const EMPTY_STATS: PlayerStats = {
  matches: 0,
  wins: 0,
  bestScore: 0,
  goodsShipped: 0,
  mapsPlayed: [],
  unlocked: {},
}

/** What the local player did in one finished match. */
export interface MatchSummary {
  won: boolean
  score: number
  modeId: string
  players: number
  goodsShipped: number
  links: number
  works: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  /** Unlocked by this match, given stats that already include it? */
  earned: (match: MatchSummary, stats: PlayerStats) => boolean
  /** Progress toward a cumulative goal, for the progress bar. */
  progress?: (stats: PlayerStats) => { value: number; target: number }
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-shift', name: 'First Shift', description: 'Finish a match.', earned: () => true },
  { id: 'foreman', name: 'Foreman', description: 'Win a match.', earned: (m) => m.won },
  { id: 'quick-draw', name: 'Quick Draw', description: 'Win a Bullet match.', earned: (m) => m.won && m.modeId === 'bullet' },
  { id: 'full-house', name: 'Full House', description: 'Win a four-player match.', earned: (m) => m.won && m.players >= 4 },
  { id: 'merchant-fleet', name: 'Merchant Fleet', description: 'Ship 12 goods in one match.', earned: (m) => m.goodsShipped >= 12 },
  { id: 'iron-web', name: 'Iron Web', description: 'Own 6 links in one match.', earned: (m) => m.links >= 6 },
  { id: 'engine-room', name: 'Engine Room', description: 'Build 2 Engine Works in one match.', earned: (m) => m.works >= 2 },
  { id: 'tycoon', name: 'Tycoon', description: 'Score 55 or more in a match.', earned: (m) => m.score >= 55 },
  {
    id: 'grand-tour',
    name: 'Grand Tour',
    description: 'Finish a match on every map.',
    earned: (_, s) => MAPS.every((map) => s.mapsPlayed.includes(map.id)),
    progress: (s) => ({ value: MAPS.filter((map) => s.mapsPlayed.includes(map.id)).length, target: MAPS.length }),
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Finish 10 matches.',
    earned: (_, s) => s.matches >= 10,
    progress: (s) => ({ value: Math.min(s.matches, 10), target: 10 }),
  },
]

/** Fold a finished match into the stats. Returns the new stats and what was unlocked. */
export function recordMatch(stats: PlayerStats, game: GameState): { stats: PlayerStats; unlocked: Achievement[] } {
  const you = game.players[0]
  const score = game.scores?.find((s) => s.player === 0)
  if (!score || you.isAI) return { stats, unlocked: [] }

  const match: MatchSummary = {
    won: score.rank === 1,
    score: score.total,
    modeId: game.modeId,
    players: game.players.length,
    goodsShipped: you.goodsShipped,
    links: Object.values(game.links).filter((owner) => owner === 0).length,
    works: game.buildings.filter((b) => b.owner === 0 && b.kind === 'works').length,
  }
  const next: PlayerStats = {
    matches: stats.matches + 1,
    wins: stats.wins + (match.won ? 1 : 0),
    bestScore: Math.max(stats.bestScore, match.score),
    goodsShipped: stats.goodsShipped + match.goodsShipped,
    mapsPlayed: stats.mapsPlayed.includes(game.mapId) ? stats.mapsPlayed : [...stats.mapsPlayed, game.mapId],
    unlocked: { ...stats.unlocked },
  }
  const unlocked = ACHIEVEMENTS.filter((a) => !next.unlocked[a.id] && a.earned(match, next))
  const today = new Date().toISOString()
  for (const achievement of unlocked) next.unlocked[achievement.id] = today
  return { stats: next, unlocked }
}

/** Validate saved stats, filling in anything missing. */
export function parseStats(raw: unknown): PlayerStats | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const saved = raw as Partial<PlayerStats>
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0)
  return {
    matches: count(saved.matches),
    wins: count(saved.wins),
    bestScore: count(saved.bestScore),
    goodsShipped: count(saved.goodsShipped),
    mapsPlayed: Array.isArray(saved.mapsPlayed) ? saved.mapsPlayed.filter((id) => typeof id === 'string') : [],
    unlocked:
      typeof saved.unlocked === 'object' && saved.unlocked !== null ? { ...(saved.unlocked as Record<string, string>) } : {},
  }
}
