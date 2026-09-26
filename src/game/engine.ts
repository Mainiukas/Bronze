/**
 * The Bronze game engine: pure functions over a serialisable GameState.
 * No React, no timers, no randomness: the same state and action always give
 * the same result. applyAction never mutates its input; it returns a new state
 * or throws IllegalActionError with a message the player can read.
 */

import { BOARD, type BoardData } from '../data/board'
import { getGameMode, type GameModeConfig, type GameModeId } from '../data/gameModes'
import { getMap, type MapId, type SchematicMapConfig } from '../data/maps'
import { GOODS_NAMES, INDUSTRIES, INDUSTRY_ORDER, LINK_COST, MAX_LOG_ENTRIES, RULES, type Cost } from './rules'
import {
  GAME_VERSION,
  PLAYER_COLORS,
  type Board,
  type BoardRoute,
  type BoardTown,
  type Building,
  type FinalScore,
  type GameAction,
  type GameState,
  type GoodsKind,
  type IndustryKind,
  type LogKind,
  type PlayerColor,
  type PlayerState,
  type RouteKind,
  type SeatSetup,
} from './types'

/** Thrown when an action isn't allowed. The message is shown to the player. */
export class IllegalActionError extends Error {}

/* ------------------------------------------------------------------------ */
/* Setup                                                                     */
/* ------------------------------------------------------------------------ */

const MAX_RING: Record<GameModeConfig['mapSize'], number> = { full: 3, reduced: 2, compact: 1 }

/** Plot letters used by schematic maps. */
const KIND_BY_CODE: Record<string, IndustryKind> = { C: 'coal', I: 'iron', M: 'cotton', S: 'shipyard' }

/** What market towns buy on the practice (schematic) maps: the same as London. */
const SCHEMATIC_BUYS: GoodsKind[] = ['cotton', 'coal', 'iron']

/** Cut a schematic map down to a mode's size and decode its plots. */
export function schematicBoard(map: SchematicMapConfig, mapSize: GameModeConfig['mapSize']): Board {
  const maxRing = MAX_RING[mapSize]
  const towns: BoardTown[] = map.board.towns
    .filter((town) => town.ring <= maxRing)
    .map((town) => ({
      id: town.id,
      name: town.name,
      x: town.x,
      y: town.y,
      kind: 'city',
      market: town.market ? { price: town.market, buys: [...SCHEMATIC_BUYS] } : null,
      slots: town.slots.map((code) =>
        [...code].map((letter) => {
          const kind = KIND_BY_CODE[letter]
          if (!kind) throw new Error(`Unknown plot code "${letter}" in ${map.id}/${town.id}`)
          return kind
        }),
      ),
    }))
  const included = new Set(towns.map((town) => town.id))
  const routes: BoardRoute[] = map.board.links
    .filter((link) => included.has(link.from) && included.has(link.to))
    .map((link) => ({ id: `${link.from}~${link.to}`, from: link.from, to: link.to, kinds: [link.kind] }))
  return { towns, routes, eras: false }
}

/** The painted board (board.json), cut down to a mode's size by each location's ring. */
export function illustratedBoard(data: BoardData, mapSize: GameModeConfig['mapSize']): Board {
  const maxRing = MAX_RING[mapSize]
  const towns: BoardTown[] = data.locations
    .filter((location) => (location.ring ?? 1) <= maxRing)
    .map((location) => ({
      id: location.id,
      name: location.name,
      x: location.x,
      y: location.y,
      kind: location.type,
      market: location.type === 'hub' ? { price: location.price, buys: [...location.buys] } : null,
      slots: location.type === 'city' ? location.slots.map((allowed) => [...allowed]) : [],
      railOnly: location.era === 'rail',
    }))
  const included = new Set(towns.map((town) => town.id))
  const routes: BoardRoute[] = data.links
    .filter((link) => included.has(link.from) && included.has(link.to))
    .map((link) => ({
      id: link.id,
      from: link.from,
      to: link.to,
      kinds: link.type === 'both' ? ['canal', 'rail'] : [link.type],
    }))
  return { towns, routes, eras: true }
}

/** The board a match on this map and mode is played on. */
export function boardFor(mapId: MapId, mapSize: GameModeConfig['mapSize']): Board {
  const map = getMap(mapId)
  return map.style === 'illustrated' ? illustratedBoard(BOARD, mapSize) : schematicBoard(map, mapSize)
}

/** Industries that can be built somewhere on this board, in display order. */
export function industriesOn(board: Board): IndustryKind[] {
  const present = new Set(board.towns.flatMap((town) => town.slots.flat()))
  return INDUSTRY_ORDER.filter((kind) => present.has(kind))
}

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

/** Each seat's colour: the chosen ones, then the first free colour for seats without one. */
export function seatColors(seats: SeatSetup[]): PlayerColor[] {
  const chosen = seats.map((seat) => seat.color)
  const taken = new Set(chosen.filter((c): c is PlayerColor => c !== undefined))
  if (taken.size !== chosen.filter(Boolean).length) throw new Error('Every player needs a different colour')
  const free = PLAYER_COLORS.filter((c) => !taken.has(c))
  return chosen.map((c) => c ?? free.shift()!)
}

export interface NewGameOptions {
  mapId: MapId
  modeId: GameModeId
  seats: SeatSetup[]
  /** The same seed and seats replay the same match (the computer players follow it). */
  seed: number
}

export function createGame({ mapId, modeId, seats, seed }: NewGameOptions): GameState {
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) throw new Error(`A match needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`)
  const mode = getGameMode(modeId)
  const board = boardFor(mapId, mode.mapSize)
  const colors = seatColors(seats)
  const players: PlayerState[] = seats.map((seat, id) => ({
    id,
    name: seat.name,
    isAI: seat.isAI,
    aiLevel: seat.isAI ? (seat.aiLevel ?? 'normal') : null,
    color: colors[id],
    money: mode.startingMoney,
    coal: 0,
    iron: 0,
    prestige: 0,
    hasBuilt: false,
    goodsShipped: 0,
    linksBuilt: 0,
  }))
  const prices: Record<string, number> = {}
  for (const town of board.towns) if (town.market) prices[town.id] = town.market.price

  const state: GameState = {
    version: GAME_VERSION,
    modeId,
    mapId,
    board,
    players,
    buildings: [],
    links: {},
    prices,
    round: 1,
    totalRounds: mode.rounds,
    era: board.eras ? 'canal' : null,
    railEraRound: board.eras ? Math.floor(mode.rounds / 2) + 1 : null,
    eraChange: null,
    turnOrder: players.map((player) => player.id),
    turnIndex: 0,
    actionsLeft: RULES.actionsPerTurn,
    status: 'playing',
    log: [],
    lastEvent: null,
    scores: null,
    seed: seed >>> 0,
    nextId: 1,
  }
  addLog(
    state,
    null,
    'round',
    board.eras
      ? `Round 1 of ${mode.rounds} begins in the canal era. The rail era begins in round ${state.railEraRound}.`
      : `Round 1 of ${mode.rounds} begins.`,
  )
  return state
}

/* ------------------------------------------------------------------------ */
/* Queries                                                                   */
/* ------------------------------------------------------------------------ */

export function currentPlayerId(state: GameState): number {
  return state.turnOrder[state.turnIndex]
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[currentPlayerId(state)]
}

export function findTown(state: GameState, townId: string): BoardTown | undefined {
  return state.board.towns.find((t) => t.id === townId)
}

export function getTown(state: GameState, townId: string): BoardTown {
  const town = findTown(state, townId)
  if (!town) throw new IllegalActionError(`There is no town "${townId}" in this match`)
  return town
}

export function getRoute(state: GameState, routeId: string): BoardRoute {
  const route = state.board.routes.find((r) => r.id === routeId)
  if (!route) throw new IllegalActionError(`There is no route "${routeId}" in this match`)
  return route
}

export function buildingAt(state: GameState, townId: string, slot: number): Building | undefined {
  return state.buildings.find((b) => b.townId === townId && b.slot === slot)
}

/** "Birmingham–Oxford" */
export function routeName(state: GameState, route: BoardRoute): string {
  return `${getTown(state, route.from).name}–${getTown(state, route.to).name}`
}

/** Every town where the player owns an industry, plus both ends of every link they own (hubs and stops included). */
export function networkTowns(state: GameState, playerId: number): Set<string> {
  const towns = new Set<string>()
  for (const building of state.buildings) if (building.owner === playerId) towns.add(building.townId)
  for (const route of state.board.routes) {
    if (state.links[route.id]?.owner === playerId) {
      towns.add(route.from)
      towns.add(route.to)
    }
  }
  return towns
}

/**
 * May the player build anywhere? Only before their first build, or if their
 * network was wiped out later (their only links were canals and the rail era
 * removed them, with no industry left to hold on to).
 */
export function buildsAnywhere(state: GameState, playerId: number): boolean {
  return !state.players[playerId].hasBuilt || networkTowns(state, playerId).size === 0
}

/** Hubs (towns with a market) in the player's network: each is worth +2★ at the end. */
export function networkHubs(state: GameState, playerId: number): string[] {
  return [...networkTowns(state, playerId)].filter((id) => getTown(state, id).market !== null)
}

export interface Quote {
  /** Total money due, including coal and iron bought automatically. */
  total: number
  coalUsed: number
  ironUsed: number
  coalBought: number
  ironBought: number
}

/** What a cost comes to for this player: their store is used first, the rest is bought. */
export function quote(player: PlayerState, cost: Cost): Quote {
  const coalUsed = Math.min(player.coal, cost.coal)
  const ironUsed = Math.min(player.iron, cost.iron)
  const coalBought = cost.coal - coalUsed
  const ironBought = cost.iron - ironUsed
  return {
    total: cost.money + coalBought * RULES.coalPrice + ironBought * RULES.ironPrice,
    coalUsed,
    ironUsed,
    coalBought,
    ironBought,
  }
}

export function canAfford(player: PlayerState, cost: Cost): boolean {
  return quote(player, cost).total <= player.money
}

/** "−£6, −1 iron" */
export function formatPayment(q: Quote): string {
  const parts = [`−£${q.total}`]
  if (q.coalUsed) parts.push(`−${q.coalUsed} coal`)
  if (q.ironUsed) parts.push(`−${q.ironUsed} iron`)
  return parts.join(', ')
}

/** "£6 + 1 iron" */
export function formatCost(cost: Cost): string {
  const parts = [`£${cost.money}`]
  if (cost.coal) parts.push(`${cost.coal} coal`)
  if (cost.iron) parts.push(`${cost.iron} iron`)
  return parts.join(' + ')
}

export interface Plot {
  townId: string
  slot: number
}

/** Free plots where the player may build this industry now (ignores money). */
export function buildTargets(state: GameState, kind: IndustryKind, playerId = currentPlayerId(state)): Plot[] {
  const anywhere = buildsAnywhere(state, playerId)
  const network = networkTowns(state, playerId)
  const plots: Plot[] = []
  for (const town of state.board.towns) {
    if (!anywhere && !network.has(town.id)) continue
    if (town.railOnly && state.era === 'canal') continue
    town.slots.forEach((allowed, slot) => {
      if (allowed.includes(kind) && !buildingAt(state, town.id, slot)) plots.push({ townId: town.id, slot })
    })
  }
  return plots
}

/** Why this industry can't be built now, or null if it can (the reasons the UI shows on disabled buttons). */
export function buildBlocker(state: GameState, kind: IndustryKind, playerId = currentPlayerId(state)): string | null {
  const plots = state.board.towns.filter((town) => town.slots.some((allowed) => allowed.includes(kind)))
  if (plots.length === 0) return 'Not on this map'
  if (buildTargets(state, kind, playerId).length === 0) {
    const free = plots.filter((town) => town.slots.some((allowed, slot) => allowed.includes(kind) && !buildingAt(state, town.id, slot)))
    if (free.length === 0) return 'Every plot is taken'
    if (state.era === 'canal' && free.every((town) => town.railOnly)) return 'Opens in the rail era'
    return 'No free plot in your network'
  }
  const q = quote(state.players[playerId], INDUSTRIES[kind].cost)
  return q.total > state.players[playerId].money ? `Needs £${q.total}` : null
}

/** What this route would be built as right now, or null if it doesn't exist in the current era. */
export function linkKindNow(state: GameState, route: BoardRoute): RouteKind | null {
  if (!state.era) return route.kinds[0]
  return route.kinds.includes(state.era) ? state.era : null
}

/** Cost of building a route now. */
export function linkCost(state: GameState, route: BoardRoute): Cost {
  return LINK_COST[linkKindNow(state, route) ?? route.kinds[0]]
}

/** Unbuilt routes of the current era that touch the player's network (anywhere, if they may build anywhere). Ignores money. */
export function linkTargets(state: GameState, playerId = currentPlayerId(state)): BoardRoute[] {
  const anywhere = buildsAnywhere(state, playerId)
  const network = networkTowns(state, playerId)
  return state.board.routes.filter(
    (route) =>
      !(route.id in state.links) &&
      linkKindNow(state, route) !== null &&
      (anywhere || network.has(route.from) || network.has(route.to)),
  )
}

/** Why no link can be built now, or null if at least one can. */
export function linkBlocker(state: GameState, playerId = currentPlayerId(state)): string | null {
  const targets = linkTargets(state, playerId)
  if (targets.length === 0) return 'No free route touches your network'
  const player = state.players[playerId]
  const cheapest = Math.min(...targets.map((route) => quote(player, linkCost(state, route)).total))
  return cheapest > player.money ? `Needs £${cheapest}` : null
}

export interface Path {
  /** In order, from the source town to the market town. */
  routeIds: string[]
  /** Number of opponent-owned links on the path, per owner. */
  tollsByOwner: Record<number, number>
}

/**
 * The way goods travel between two towns over built links of the current era
 * (anyone's): fewest opponent links first, then fewest links. Null if the
 * towns aren't connected. The same town is distance 0.
 */
export function findPath(state: GameState, playerId: number, from: string, to: string): Path | null {
  if (from === to) return { routeIds: [], tollsByOwner: {} }
  const built = state.board.routes.filter((route) => {
    const link = state.links[route.id]
    return link !== undefined && (state.era === null || link.kind === state.era)
  })
  // An opponent link costs more than any path of own links could (boards have < 100 routes).
  const OPPONENT = 1000
  const cost = new Map<string, number>([[from, 0]])
  const via = new Map<string, BoardRoute>()
  const done = new Set<string>()
  // Small graphs (≤ 30 towns), so a plain O(n²) Dijkstra is plenty. Ties go to the earlier route in board order.
  for (;;) {
    let town: string | null = null
    let best = Infinity
    for (const [id, c] of cost) if (!done.has(id) && c < best) [town, best] = [id, c]
    if (town === null) return null
    if (town === to) break
    done.add(town)
    for (const route of built) {
      if (route.from !== town && route.to !== town) continue
      const next = route.from === town ? route.to : route.from
      const step = 1 + (state.links[route.id].owner === playerId ? 0 : OPPONENT)
      if (best + step < (cost.get(next) ?? Infinity)) {
        cost.set(next, best + step)
        via.set(next, route)
      }
    }
  }
  const routeIds: string[] = []
  const tollsByOwner: Record<number, number> = {}
  for (let town = to; town !== from; ) {
    const route = via.get(town)!
    routeIds.unshift(route.id)
    const owner = state.links[route.id].owner
    if (owner !== playerId) tollsByOwner[owner] = (tollsByOwner[owner] ?? 0) + 1
    town = route.from === town ? route.to : route.from
  }
  return { routeIds, tollsByOwner }
}

/** Somewhere goods can be sold: a hub, or a port (cotton only). */
export interface MarketPoint {
  /** Town id for a hub, `port:<buildingId>` for a port. */
  id: string
  townId: string
  name: string
  /** Price of the next unit sold here. */
  price: number
  /** Port owner; null for hubs. */
  owner: number | null
}

/** Every place that buys these goods: hubs that list them, and ports for cotton. */
export function marketsFor(state: GameState, goods: GoodsKind): MarketPoint[] {
  const points: MarketPoint[] = []
  for (const town of state.board.towns) {
    if (town.market?.buys.includes(goods)) {
      points.push({ id: town.id, townId: town.id, name: town.name, price: state.prices[town.id], owner: null })
    }
  }
  if (goods === RULES.portBuys) {
    for (const b of state.buildings) {
      if (!INDUSTRIES[b.kind].market) continue
      points.push({ id: `port:${b.id}`, townId: b.townId, name: `${getTown(state, b.townId).name} port`, price: RULES.portPrice, owner: b.owner })
    }
  }
  return points
}

/** What shipping from this industry would sell: the mill's cotton, or the owner's whole coal or iron store. */
export function shipment(state: GameState, building: Building): { goods: GoodsKind; amount: number } | null {
  const goods = INDUSTRIES[building.kind].ships
  if (!goods) return null
  const owner = state.players[building.owner]
  return { goods, amount: goods === 'cotton' ? building.goods : goods === 'coal' ? owner.coal : owner.iron }
}

export interface ShipQuote {
  buildingId: number
  goods: GoodsKind
  amount: number
  marketId: string
  marketTownId: string
  marketName: string
  /** Hub (null) or port owner. */
  portOwner: number | null
  revenue: number
  tollTotal: number
  tollsByOwner: Record<number, number>
  /** Port fee, paid to the port's owner (0 at hubs and your own ports). */
  fee: number
  feeOwner: number | null
  prestige: number
  routeIds: string[]
  /** Money change for the shipper: revenue − tolls − fee. */
  net: number
  /** Can the shipper pay the tolls and fee out of their money plus the revenue? */
  affordable: boolean
}

/** Money for selling `amount` units at a hub: each unit at the current price, which drops £1 per unit (not below £1). */
export function saleRevenue(price: number, amount: number): number {
  let revenue = 0
  for (let i = 0; i < amount; i++) revenue += Math.max(RULES.priceFloor, price - i * RULES.priceDropPerGoods)
  return revenue
}

/** Every reachable market for this industry's shipment, best first, including ones the shipper can't afford. */
export function shipOptions(state: GameState, buildingId: number): ShipQuote[] {
  const source = state.buildings.find((b) => b.id === buildingId)
  const load = source && shipment(state, source)
  if (!source || !load || load.amount === 0) return []
  const quotes: ShipQuote[] = []
  for (const market of marketsFor(state, load.goods)) {
    const path = findPath(state, source.owner, source.townId, market.townId)
    if (!path) continue
    const tollTotal = Object.values(path.tollsByOwner).reduce((sum, n) => sum + n * RULES.toll, 0)
    const isPort = market.owner !== null
    const revenue = isPort ? load.amount * RULES.portPrice : saleRevenue(market.price, load.amount)
    const feeOwner = isPort && market.owner !== source.owner ? market.owner : null
    const fee = feeOwner === null ? 0 : load.amount * RULES.portFee
    const net = revenue - tollTotal - fee
    quotes.push({
      buildingId,
      goods: load.goods,
      amount: load.amount,
      marketId: market.id,
      marketTownId: market.townId,
      marketName: market.name,
      portOwner: market.owner,
      revenue,
      tollTotal,
      tollsByOwner: path.tollsByOwner,
      fee,
      feeOwner,
      prestige: load.amount * (path.routeIds.length >= RULES.longHaulLinks ? 2 : 1),
      routeIds: path.routeIds,
      net,
      affordable: state.players[source.owner].money + revenue >= tollTotal + fee,
    })
  }
  return quotes.sort((a, b) => b.net + b.prestige - (a.net + a.prestige))
}

/** The markets this industry can ship to right now. */
export function shipQuotes(state: GameState, buildingId: number): ShipQuote[] {
  return shipOptions(state, buildingId).filter((q) => q.affordable)
}

/** The player's industries with something to ship and at least one market it can go to. */
export function shipSources(state: GameState, playerId = currentPlayerId(state)): Building[] {
  return state.buildings.filter((b) => b.owner === playerId && shipQuotes(state, b.id).length > 0)
}

/** Why nothing can be shipped now, or null if something can. */
export function shipBlocker(state: GameState, playerId = currentPlayerId(state)): string | null {
  const own = state.buildings.filter((b) => b.owner === playerId && INDUSTRIES[b.kind].ships)
  if (own.length === 0) return 'Build a mill, mine or iron works first'
  const loaded = own.filter((b) => (shipment(state, b)?.amount ?? 0) > 0)
  if (loaded.length === 0) return 'Nothing to ship yet'
  const reachable = loaded.filter((b) => shipOptions(state, b.id).length > 0)
  if (reachable.length === 0) return 'Not reachable'
  return reachable.some((b) => shipQuotes(state, b.id).length > 0) ? null : 'Can’t afford the tolls'
}

/** Every action the current player may take right now. The AI only ever picks from these. */
export function legalActions(state: GameState): GameAction[] {
  if (state.status !== 'playing') return []
  const playerId = currentPlayerId(state)
  const player = state.players[playerId]
  const actions: GameAction[] = []
  for (const kind of industriesOn(state.board)) {
    if (!canAfford(player, INDUSTRIES[kind].cost)) continue
    for (const plot of buildTargets(state, kind, playerId)) actions.push({ type: 'build', kind, ...plot })
  }
  for (const route of linkTargets(state, playerId)) {
    if (canAfford(player, linkCost(state, route))) actions.push({ type: 'link', routeId: route.id })
  }
  for (const source of state.buildings) {
    if (source.owner !== playerId) continue
    for (const q of shipQuotes(state, source.id)) actions.push({ type: 'ship', buildingId: source.id, marketId: q.marketId })
  }
  actions.push({ type: 'raiseFunds' }, { type: 'endTurn' })
  return actions
}

/** Score as if the match ended now: ★ earned + 1★ per £5 + 2★ per hub in the network. */
export function scoreFor(state: GameState, playerId: number): Omit<FinalScore, 'rank'> {
  const player = state.players[playerId]
  const moneyBonus = Math.floor(player.money / RULES.moneyPerPrestige)
  const hubBonus = networkHubs(state, playerId).length * RULES.hubBonus
  return { player: playerId, prestige: player.prestige, moneyBonus, hubBonus, total: player.prestige + moneyBonus + hubBonus }
}

/** Final standings, best first. Ties on total go to the richer player; still tied, they share the rank. */
export function finalScores(state: GameState): FinalScore[] {
  const scores = state.players.map((p) => scoreFor(state, p.id))
  const money = (id: number) => state.players[id].money
  scores.sort((a, b) => b.total - a.total || money(b.player) - money(a.player) || a.player - b.player)
  const ranked: FinalScore[] = []
  scores.forEach((score, i) => {
    const prev = ranked[i - 1]
    const tied = prev && prev.total === score.total && money(prev.player) === money(score.player)
    ranked.push({ ...score, rank: tied ? prev.rank : i + 1 })
  })
  return ranked
}

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

function addLog(state: GameState, player: number | null, kind: LogKind, text: string) {
  state.log.push({ id: state.nextId++, round: state.round, kind, player, text })
  if (state.log.length > MAX_LOG_ENTRIES) state.log.splice(0, state.log.length - MAX_LOG_ENTRIES)
}

function pay(player: PlayerState, cost: Cost): Quote {
  const q = quote(player, cost)
  if (q.total > player.money) throw new IllegalActionError(`Needs £${q.total}; you have £${player.money}`)
  player.money -= q.total
  player.coal -= q.coalUsed
  player.iron -= q.ironUsed
  return q
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
/** "a Coal mine", "an Iron works" */
const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`

function checkBuild(s: GameState, playerId: number, kind: IndustryKind, townId: string, slot: number) {
  const def = INDUSTRIES[kind]
  if (!def) throw new IllegalActionError(`Unknown industry "${kind}"`)
  const town = getTown(s, townId)
  if (town.slots.length === 0) throw new IllegalActionError(`${town.name} has no building plots`)
  const allowed = town.slots[slot]
  if (!allowed) throw new IllegalActionError(`${town.name} has no plot ${slot + 1}`)
  if (buildingAt(s, townId, slot)) throw new IllegalActionError(`That plot in ${town.name} is taken`)
  if (!allowed.includes(kind)) throw new IllegalActionError(`${withArticle(def.name).replace(/^a/, 'A')} can’t be built on that plot`)
  if (town.railOnly && s.era === 'canal') throw new IllegalActionError(`${town.name} opens in the rail era`)
  if (!buildsAnywhere(s, playerId) && !networkTowns(s, playerId).has(townId)) {
    throw new IllegalActionError(`${town.name} isn’t in your network`)
  }
}

function checkLink(s: GameState, playerId: number, routeId: string): RouteKind {
  const route = getRoute(s, routeId)
  if (route.id in s.links) throw new IllegalActionError(`${routeName(s, route)} is already built`)
  const kind = linkKindNow(s, route)
  if (!kind) throw new IllegalActionError(`${routeName(s, route)} doesn’t exist in the ${s.era} era`)
  if (!buildsAnywhere(s, playerId)) {
    const network = networkTowns(s, playerId)
    if (!network.has(route.from) && !network.has(route.to)) throw new IllegalActionError(`${routeName(s, route)} doesn’t touch your network`)
  }
  return kind
}

/** Apply an action for the current player and return the new state. */
export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.status !== 'playing') throw new IllegalActionError('The match is over')
  const s = structuredClone(state)
  const playerId = currentPlayerId(s)
  const player = s.players[playerId]

  switch (action.type) {
    case 'build': {
      checkBuild(s, playerId, action.kind, action.townId, action.slot)
      const def = INDUSTRIES[action.kind]
      const town = getTown(s, action.townId)
      const q = pay(player, def.cost)
      player.prestige += def.prestige
      player.hasBuilt = true
      s.buildings.push({ id: s.nextId++, kind: action.kind, owner: playerId, townId: town.id, slot: action.slot, goods: 0 })
      addLog(s, playerId, 'build', `${player.name} built ${withArticle(def.name)} in ${town.name} (${formatPayment(q)}, +${def.prestige}★)`)
      s.lastEvent = { type: 'build', player: playerId, townId: town.id, slot: action.slot }
      break
    }

    case 'link': {
      const kind = checkLink(s, playerId, action.routeId)
      const route = getRoute(s, action.routeId)
      const q = pay(player, LINK_COST[kind])
      s.links[route.id] = { owner: playerId, kind }
      player.prestige += RULES.linkPrestige
      player.hasBuilt = true
      player.linksBuilt += 1
      addLog(
        s,
        playerId,
        'link',
        `${player.name} ${kind === 'canal' ? 'dug the' : 'laid the'} ${routeName(s, route)} ${kind === 'canal' ? 'canal' : 'railway'} (${formatPayment(q)}, +${RULES.linkPrestige}★)`,
      )
      s.lastEvent = { type: 'link', player: playerId, routeId: route.id }
      break
    }

    case 'ship': {
      const source = s.buildings.find((b) => b.id === action.buildingId)
      const load = source && source.owner === playerId ? shipment(s, source) : null
      if (!source || !load) throw new IllegalActionError('Pick one of your mills, coal mines or iron works')
      const sourceName = INDUSTRIES[source.kind].name
      if (load.amount === 0) {
        throw new IllegalActionError(load.goods === 'cotton' ? `The ${sourceName} has no cotton yet` : `Your ${load.goods} store is empty`)
      }
      const buyer = marketsFor(s, load.goods).find((m) => m.id === action.marketId)
      if (!buyer) {
        const town = findTown(s, action.marketId)
        throw new IllegalActionError(
          action.marketId.startsWith('port:') ? `Ports only buy ${RULES.portBuys}` : `${town?.name ?? 'That place'} doesn’t buy ${load.goods}`,
        )
      }
      const q = shipOptions(s, source.id).find((option) => option.marketId === action.marketId)
      if (!q) throw new IllegalActionError(`${buyer.name} isn’t reachable over built links`)
      if (!q.affordable) throw new IllegalActionError(`You can’t afford the £${q.tollTotal + q.fee} in tolls and fees`)
      player.money += q.net
      for (const [owner, count] of Object.entries(q.tollsByOwner)) s.players[Number(owner)].money += count * RULES.toll
      if (q.feeOwner !== null) s.players[q.feeOwner].money += q.fee
      player.prestige += q.prestige
      player.goodsShipped += q.amount
      if (q.portOwner === null) s.prices[q.marketId] = Math.max(RULES.priceFloor, s.prices[q.marketId] - q.amount * RULES.priceDropPerGoods)
      if (load.goods === 'cotton') source.goods = 0
      else if (load.goods === 'coal') player.coal = 0
      else player.iron = 0
      const extras = [
        ...Object.entries(q.tollsByOwner).map(([owner, count]) => `£${count * RULES.toll} toll to ${s.players[Number(owner)].name}`),
        ...(q.feeOwner !== null ? [`£${q.fee} port fee to ${s.players[q.feeOwner].name}`] : []),
      ].join(', ')
      const goods = `${q.amount} ${GOODS_NAMES[q.goods]}`
      const where =
        source.townId === q.marketTownId
          ? `sold ${goods} at ${q.marketName}`
          : `shipped ${goods} from ${getTown(s, source.townId).name} to ${q.marketName}`
      addLog(s, playerId, 'ship', `${player.name} ${where} (+£${q.revenue}${extras ? `, ${extras}` : ''}, +${q.prestige}★)`)
      s.lastEvent = {
        type: 'ship',
        player: playerId,
        goods: q.goods,
        amount: q.amount,
        fromTownId: source.townId,
        marketId: q.marketId,
        marketTownId: q.marketTownId,
        routeIds: q.routeIds,
      }
      break
    }

    case 'raiseFunds': {
      player.money += RULES.raiseFunds
      addLog(s, playerId, 'funds', `${player.name} raised funds (+£${RULES.raiseFunds})`)
      s.lastEvent = { type: 'raiseFunds', player: playerId }
      break
    }

    case 'endTurn': {
      const lost = s.actionsLeft
      addLog(
        s,
        playerId,
        'turn',
        action.timedOut
          ? `${player.name} ran out of time (${plural(lost, 'action')} lost)`
          : `${player.name} ended the turn${lost < RULES.actionsPerTurn ? ' early' : ' without acting'}`,
      )
      s.lastEvent = { type: 'endTurn', player: playerId, timedOut: action.timedOut ?? false }
      s.actionsLeft = 0
      break
    }

    default:
      throw new IllegalActionError('Unknown action')
  }

  if (action.type !== 'endTurn') s.actionsLeft -= 1
  if (s.actionsLeft <= 0) advanceTurn(s)
  return s
}

function advanceTurn(s: GameState) {
  s.turnIndex += 1
  s.actionsLeft = RULES.actionsPerTurn
  if (s.turnIndex >= s.turnOrder.length) endRound(s)
}

/** Industries produce, everyone collects income, hub prices recover. */
function produce(s: GameState) {
  for (const b of s.buildings) {
    const owner = s.players[b.owner]
    switch (INDUSTRIES[b.kind].yields) {
      case 'coal':
        if (owner.coal < RULES.storeCap) owner.coal += 1
        else owner.money += RULES.coalOverflowValue
        break
      case 'iron':
        if (owner.iron < RULES.storeCap) owner.iron += 1
        else owner.money += RULES.ironOverflowValue
        break
      case 'goods':
        b.goods = Math.min(RULES.goodsCapacity, b.goods + 1)
        break
      case 'money':
        owner.money += RULES.portIncome
        break
      case 'prestige':
        owner.prestige += 1
        break
    }
  }
  for (const player of s.players) player.money += RULES.baseIncome
  for (const town of s.board.towns) {
    if (town.market) s.prices[town.id] = Math.min(town.market.price, s.prices[town.id] + RULES.priceRecovery)
  }
}

function endRound(s: GameState) {
  produce(s)
  addLog(s, null, 'round', `Round ${s.round} ends: industries produce and everyone collects £${RULES.baseIncome}.`)
  if (s.round >= s.totalRounds) {
    s.status = 'finished'
    s.actionsLeft = 0
    s.turnIndex = 0
    s.scores = finalScores(s)
    const winners = s.scores.filter((score) => score.rank === 1).map((score) => s.players[score.player].name)
    addLog(s, null, 'end', winners.length > 1 ? `Shared victory: ${winners.join(' and ')}.` : `${winners[0]} won the match.`)
    return
  }
  s.round += 1
  const n = s.players.length
  const start = (s.round - 1) % n
  s.turnOrder = s.players.map((_, i) => (start + i) % n)
  s.turnIndex = 0
  if (s.era === 'canal' && s.railEraRound !== null && s.round >= s.railEraRound) startRailEra(s)
  addLog(s, null, 'round', `Round ${s.round} of ${s.totalRounds} begins.`)
}

/** The canals close: every canal link comes off the board (owners keep the ★ they earned; industries stay). */
function startRailEra(s: GameState) {
  s.era = 'rail'
  const canals = Object.keys(s.links).filter((id) => s.links[id].kind === 'canal')
  for (const id of canals) delete s.links[id]
  s.eraChange = { round: s.round, removed: canals.length }
  addLog(
    s,
    null,
    'era',
    `The Rail Era begins — the canals close${canals.length ? ` and ${plural(canals.length, 'canal link')} ${canals.length === 1 ? 'is' : 'are'} removed` : ''}. Railways can now be laid.`,
  )
  for (const player of s.players) {
    if (player.hasBuilt && networkTowns(s, player.id).size === 0) {
      addLog(s, player.id, 'reset', `${player.name} has no network left and may build anywhere again.`)
    }
  }
}

/** A save that can be resumed, one from an older version of the game (can't be resumed), or nothing usable. */
export type SavedGame = { status: 'ok'; game: GameState } | { status: 'outdated' } | { status: 'none' }

/** Validate something loaded from storage well enough to resume it. */
export function readSavedGame(raw: unknown): SavedGame {
  if (typeof raw !== 'object' || raw === null) return { status: 'none' }
  const game = raw as Partial<GameState>
  if (game.version !== GAME_VERSION) return { status: 'outdated' }
  if (!game.board || !Array.isArray(game.players) || !Array.isArray(game.buildings) || typeof game.links !== 'object') {
    return { status: 'outdated' }
  }
  return { status: 'ok', game: game as GameState }
}

/** Just the game, for storage hooks: undefined unless the save can be resumed. */
export function parseSavedGame(raw: unknown): GameState | undefined {
  const saved = readSavedGame(raw)
  return saved.status === 'ok' ? saved.game : undefined
}
