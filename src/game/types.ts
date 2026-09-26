import type { GameModeId } from '../data/gameModes'
import type { MapId } from '../data/maps'

/** Bump when GameState's shape changes, so old saves are discarded. */
export const GAME_VERSION = 3

export type IndustryKind = 'coal' | 'iron' | 'cotton' | 'port' | 'shipyard' | 'works'
export type RouteKind = 'canal' | 'rail'
export type Era = 'canal' | 'rail'

/** A place that buys goods. `buys` lists the producing industries whose goods it takes. */
export interface Market {
  /** Starting price per goods (£). */
  price: number
  buys: IndustryKind[] | 'any'
}

export interface BoardTown {
  id: string
  name: string
  /** Position on the map's own grid (only used for drawing). */
  x: number
  y: number
  /** Cities hold industries; stops only carry routes; hubs buy goods. */
  kind: 'city' | 'stop' | 'hub'
  market: Market | null
  /** One entry per building plot: the industries allowed on it. */
  slots: IndustryKind[][]
  /** Opens in the rail era: nothing can be built here during the canal era. */
  railOnly?: boolean
}

export interface BoardRoute {
  id: string
  from: string
  to: string
  /** What this route can be built as. With eras, only the current era's kind can be built. */
  kinds: RouteKind[]
}

/** The playable board: a map cut down to the chosen mode's size. */
export interface Board {
  towns: BoardTown[]
  routes: BoardRoute[]
  /** Canal era, then rail era. */
  eras: boolean
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
  /** Goods waiting to be shipped (goods-producing industries only). */
  goods: number
}

export interface LinkState {
  owner: number
  /** What it was built as. */
  kind: RouteKind
}

export type GameAction =
  | { type: 'build'; kind: IndustryKind; townId: string; slot: number }
  | { type: 'link'; routeId: string }
  /** `marketId` is a town id, or `port:<buildingId>` for a port. */
  | { type: 'ship'; buildingId: number; marketId: string }
  | { type: 'raiseFunds' }
  | { type: 'endTurn'; timedOut?: boolean }

/** What just happened, so the board can highlight it. */
export type GameEvent =
  | { type: 'build'; player: number; townId: string; slot: number }
  | { type: 'link'; player: number; routeId: string }
  | { type: 'ship'; player: number; fromTownId: string; marketId: string; marketTownId: string; routeIds: string[] }
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
  /** Built routes by route id. */
  links: Record<string, LinkState>
  /** Current goods price per market town id. */
  prices: Record<string, number>
  /** 1-based. */
  round: number
  totalRounds: number
  /** Current era, or null on boards without eras. */
  era: Era | null
  /** First round of the rail era, or null on boards without eras. */
  railEraRound: number | null
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
