import type { GameModeId } from '../data/gameModes'
import type { MapId } from '../data/maps'

/** Bump when GameState's shape changes, so old saves are discarded. */
export const GAME_VERSION = 1

export type IndustryKind = 'colliery' | 'ironworks' | 'mill' | 'works'
export type RouteKind = 'canal' | 'rail'

export interface BoardTown {
  id: string
  name: string
  x: number
  y: number
  /** Starting goods price if this is a market town, otherwise null. */
  market: number | null
  /** One entry per building plot: the industries allowed on it. */
  slots: IndustryKind[][]
}

export interface BoardRoute {
  id: string
  from: string
  to: string
  kind: RouteKind
}

/** The playable board: a map cut down to the chosen mode's size. */
export interface Board {
  towns: BoardTown[]
  routes: BoardRoute[]
}

export interface SeatSetup {
  name: string
  isAI: boolean
}

export interface PlayerState {
  /** Seat index, also the index into GameState.players. */
  id: number
  name: string
  isAI: boolean
  money: number
  coal: number
  iron: number
  prestige: number
  /** Total goods shipped this match (for stats and achievements). */
  goodsShipped: number
}

export interface Building {
  id: number
  kind: IndustryKind
  owner: number
  townId: string
  slot: number
  /** Goods waiting to be shipped (mills only). */
  goods: number
}

export type GameAction =
  | { type: 'build'; kind: IndustryKind; townId: string; slot: number }
  | { type: 'link'; routeId: string }
  | { type: 'ship'; buildingId: number; marketId: string }
  | { type: 'raiseFunds' }
  | { type: 'endTurn'; timedOut?: boolean }

/** What just happened, so the board can highlight it. */
export type GameEvent =
  | { type: 'build'; player: number; townId: string; slot: number }
  | { type: 'link'; player: number; routeId: string }
  | { type: 'ship'; player: number; fromTownId: string; marketId: string; routeIds: string[] }
  | { type: 'raiseFunds'; player: number }
  | { type: 'endTurn'; player: number }

export interface LogEntry {
  id: number
  round: number
  /** Acting player, or null for round events. */
  player: number | null
  text: string
}

export interface FinalScore {
  player: number
  /** Prestige earned during play. */
  prestige: number
  moneyBonus: number
  marketBonus: number
  total: number
  /** 1 = winner. Ties share a rank. */
  rank: number
}

export interface GameState {
  version: typeof GAME_VERSION
  modeId: GameModeId
  mapId: MapId
  board: Board
  players: PlayerState[]
  buildings: Building[]
  /** Built routes: route id → owner seat. */
  links: Record<string, number>
  /** Current goods price per market town id. */
  prices: Record<string, number>
  /** 1-based. */
  round: number
  totalRounds: number
  /** Seats in play order for this round. */
  turnOrder: number[]
  turnIndex: number
  actionsLeft: number
  status: 'playing' | 'finished'
  log: LogEntry[]
  lastEvent: GameEvent | null
  scores: FinalScore[] | null
  /** Seed for the computer players' tie-breaking. */
  seed: number
  /** Counter for building and log ids. */
  nextId: number
}
