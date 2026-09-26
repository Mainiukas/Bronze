import type { GameModeId } from '../data/gameModes'
import type { MapId } from '../data/maps'

/** Bump when GameState's shape changes, so old saves are recognised and not resumed. */
export const GAME_VERSION = 5

/** The five industries: the game has exactly these. */
export type IndustryKind = 'cotton' | 'port' | 'shipyard' | 'iron' | 'coal'
/** What can be shipped and sold: cotton from mills, coal and iron from a player's store. */
export type GoodsKind = 'cotton' | 'coal' | 'iron'
export type RouteKind = 'canal' | 'rail'
export type Era = 'canal' | 'rail'
export type AILevel = 'easy' | 'normal' | 'hard'

/** Player colours: the colours the built-link tokens come in. */
export type PlayerColor = 'purple' | 'red' | 'yellow' | 'blue' | 'white'
/** Default colour for each seat, in seat order. */
export const PLAYER_COLORS: readonly PlayerColor[] = ['yellow', 'blue', 'purple', 'red', 'white']
export const AI_LEVELS: readonly AILevel[] = ['easy', 'normal', 'hard']

/** A place that buys goods (a trade hub, or a market town on a practice map). */
export interface Market {
  /** Starting (and highest) price per unit (£). */
  price: number
  buys: GoodsKind[]
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
  /** Computer players only; defaults to normal. */
  aiLevel?: AILevel
  /** Defaults to PLAYER_COLORS[seat]. Every player needs a different colour. */
  color?: PlayerColor
}

export interface PlayerState {
  /** Seat index, also the index into GameState.players. */
  id: number
  name: string
  isAI: boolean
  aiLevel: AILevel | null
  color: PlayerColor
  money: number
  coal: number
  iron: number
  prestige: number
  /** False until the player's first industry or link: until then they may build anywhere. */
  hasBuilt: boolean
  /** Units shipped this match (all goods). */
  goodsShipped: number
  /** Links built this match, including canals later removed by the rail era. */
  linksBuilt: number
}

export interface Building {
  id: number
  kind: IndustryKind
  owner: number
  townId: string
  slot: number
  /** Cotton waiting at a mill (other industries keep 0). */
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
  /** Ship from one of your mills, mines or iron works. `marketId` is a town id, or `port:<buildingId>` for a port. */
  | { type: 'ship'; buildingId: number; marketId: string }
  | { type: 'raiseFunds' }
  | { type: 'endTurn'; timedOut?: boolean }

/** What just happened, so the board can highlight it. */
export type GameEvent =
  | { type: 'build'; player: number; townId: string; slot: number }
  | { type: 'link'; player: number; routeId: string }
  | { type: 'ship'; player: number; goods: GoodsKind; amount: number; fromTownId: string; marketId: string; marketTownId: string; routeIds: string[] }
  | { type: 'raiseFunds'; player: number }
  | { type: 'endTurn'; player: number; timedOut: boolean }

export type LogKind = 'build' | 'link' | 'ship' | 'funds' | 'turn' | 'round' | 'era' | 'reset' | 'end'

export interface LogEntry {
  id: number
  round: number
  kind: LogKind
  /** Acting player, or null for round events. */
  player: number | null
  text: string
}

export interface FinalScore {
  player: number
  /** Prestige earned during play. */
  prestige: number
  moneyBonus: number
  /** +2★ per hub (market) in the player's network. */
  hubBonus: number
  total: number
  /** 1 = winner. Full ties share a rank. */
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
  /** Current price per hub (market town) id. */
  prices: Record<string, number>
  /** 1-based. */
  round: number
  totalRounds: number
  /** Current era, or null on boards without eras. */
  era: Era | null
  /** First round of the rail era, or null on boards without eras. */
  railEraRound: number | null
  /** Set when the rail era began: its round and how many canal links came off the board. */
  eraChange: { round: number; removed: number } | null
  /** Seats in play order for this round. */
  turnOrder: number[]
  turnIndex: number
  actionsLeft: number
  status: 'playing' | 'finished'
  log: LogEntry[]
  lastEvent: GameEvent | null
  scores: FinalScore[] | null
  /** The match seed: the computer players' choices follow from it. */
  seed: number
  /** Counter for building and log ids; also advances with every action. */
  nextId: number
}
