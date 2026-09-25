/**
 * The Bronze game engine: pure functions over a serialisable GameState.
 * No React, no timers, no randomness except the seed kept in the state.
 * applyAction never mutates its input; it returns a new state.
 */

import { getGameMode, type GameModeConfig, type GameModeId } from '../data/gameModes'
import { getMap, type MapConfig, type MapId } from '../data/maps'
import { INDUSTRIES, INDUSTRY_ORDER, LINK_COST, MAX_LOG_ENTRIES, RULES, type Cost } from './rules'
import {
  GAME_VERSION,
  type Board,
  type BoardRoute,
  type BoardTown,
  type Building,
  type FinalScore,
  type GameAction,
  type GameState,
  type IndustryKind,
  type PlayerState,
  type SeatSetup,
} from './types'

/** Thrown when an action isn't allowed. The message is shown to the player. */
export class IllegalActionError extends Error {}

/* ------------------------------------------------------------------------ */
/* Setup                                                                     */
/* ------------------------------------------------------------------------ */

const MAX_RING: Record<GameModeConfig['mapSize'], number> = { full: 3, reduced: 2, compact: 1 }

const KIND_BY_CODE = Object.fromEntries(INDUSTRY_ORDER.map((kind) => [INDUSTRIES[kind].code, kind])) as Record<
  string,
  IndustryKind
>

/** Cut a map down to a mode's size and decode its plots. */
export function buildBoard(map: MapConfig, mapSize: GameModeConfig['mapSize']): Board {
  const maxRing = MAX_RING[mapSize]
  const towns: BoardTown[] = map.board.towns
    .filter((town) => town.ring <= maxRing)
    .map((town) => ({
      id: town.id,
      name: town.name,
      x: town.x,
      y: town.y,
      market: town.market ?? null,
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
    .map((link) => ({ id: `${link.from}~${link.to}`, from: link.from, to: link.to, kind: link.kind }))
  return { towns, routes }
}

export interface NewGameOptions {
  mapId: MapId
  modeId: GameModeId
  seats: SeatSetup[]
  seed?: number
}

export function createGame({ mapId, modeId, seats, seed = Date.now() }: NewGameOptions): GameState {
  if (seats.length < 2) throw new Error('A match needs at least two players')
  const mode = getGameMode(modeId)
  const board = buildBoard(getMap(mapId), mode.mapSize)
  const players: PlayerState[] = seats.map((seat, id) => ({
    id,
    name: seat.name,
    isAI: seat.isAI,
    money: mode.startingMoney,
    coal: 0,
    iron: 0,
    prestige: 0,
    goodsShipped: 0,
  }))
  const prices: Record<string, number> = {}
  for (const town of board.towns) if (town.market !== null) prices[town.id] = town.market

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
  addLog(state, null, `Round 1 of ${mode.rounds} begins.`)
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

export function getTown(state: GameState, townId: string): BoardTown {
  const town = state.board.towns.find((t) => t.id === townId)
  if (!town) throw new IllegalActionError(`Unknown town "${townId}"`)
  return town
}

export function getRoute(state: GameState, routeId: string): BoardRoute {
  const route = state.board.routes.find((r) => r.id === routeId)
  if (!route) throw new IllegalActionError(`Unknown route "${routeId}"`)
  return route
}

export function buildingAt(state: GameState, townId: string, slot: number): Building | undefined {
  return state.buildings.find((b) => b.townId === townId && b.slot === slot)
}

/** Towns where the player owns an industry, or that one of their links touches. */
export function networkTowns(state: GameState, playerId: number): Set<string> {
  const towns = new Set<string>()
  for (const building of state.buildings) if (building.owner === playerId) towns.add(building.townId)
  for (const route of state.board.routes) {
    if (state.links[route.id] === playerId) {
      towns.add(route.from)
      towns.add(route.to)
    }
  }
  return towns
}

/** Market towns in the player's network (each is worth bonus prestige at the end). */
export function networkMarkets(state: GameState, playerId: number): string[] {
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

/** What a cost comes to for this player: stock is used first, the rest is bought. */
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

/** Empty plots where the player may build this industry (ignores money). */
export function buildTargets(state: GameState, kind: IndustryKind, playerId = currentPlayerId(state)): Plot[] {
  const network = networkTowns(state, playerId)
  const anywhere = network.size === 0
  const plots: Plot[] = []
  for (const town of state.board.towns) {
    if (!anywhere && !network.has(town.id)) continue
    town.slots.forEach((allowed, slot) => {
      if (allowed.includes(kind) && !buildingAt(state, town.id, slot)) plots.push({ townId: town.id, slot })
    })
  }
  return plots
}

/** Unbuilt routes that touch the player's network (ignores money). */
export function linkTargets(state: GameState, playerId = currentPlayerId(state)): BoardRoute[] {
  const network = networkTowns(state, playerId)
  const anywhere = network.size === 0
  return state.board.routes.filter(
    (route) => !(route.id in state.links) && (anywhere || network.has(route.from) || network.has(route.to)),
  )
}

interface Path {
  routeIds: string[]
  /** Number of opponent-owned links on the path, per owner. */
  tollsByOwner: Record<number, number>
}

/**
 * Cheapest way to move goods between two towns over built links (anyone's).
 * Prefers fewer tolls, then fewer links. Returns null if not connected.
 */
export function findPath(state: GameState, playerId: number, from: string, to: string): Path | null {
  if (from === to) return { routeIds: [], tollsByOwner: {} }
  const built = state.board.routes.filter((route) => route.id in state.links)
  const cost = new Map<string, number>([[from, 0]])
  const via = new Map<string, BoardRoute>()
  const done = new Set<string>()
  // Tiny graphs (≤ 20 towns), so a plain O(n²) Dijkstra is plenty.
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
      const step = 1 + (state.links[route.id] === playerId ? 0 : 100)
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
    const owner = state.links[route.id]
    if (owner !== playerId) tollsByOwner[owner] = (tollsByOwner[owner] ?? 0) + 1
    town = route.from === town ? route.to : route.from
  }
  return { routeIds, tollsByOwner }
}

export interface ShipQuote {
  buildingId: number
  marketId: string
  goods: number
  revenue: number
  tollTotal: number
  tollsByOwner: Record<number, number>
  prestige: number
  routeIds: string[]
}

/** Money for selling `goods` at a market, price falling with each one sold. */
export function saleRevenue(price: number, goods: number): number {
  let revenue = 0
  for (let i = 0; i < goods; i++) revenue += Math.max(RULES.priceFloor, price - i * RULES.priceDropPerGoods)
  return revenue
}

/** Every market this mill's goods can reach right now, with the payout for each. */
export function shipQuotes(state: GameState, buildingId: number): ShipQuote[] {
  const mill = state.buildings.find((b) => b.id === buildingId)
  if (!mill || mill.kind !== 'mill' || mill.goods === 0) return []
  const quotes: ShipQuote[] = []
  for (const town of state.board.towns) {
    if (town.market === null) continue
    const path = findPath(state, mill.owner, mill.townId, town.id)
    if (!path) continue
    const tollTotal = Object.values(path.tollsByOwner).reduce((sum, n) => sum + n * RULES.toll, 0)
    const revenue = saleRevenue(state.prices[town.id], mill.goods)
    if (state.players[mill.owner].money + revenue < tollTotal) continue
    quotes.push({
      buildingId,
      marketId: town.id,
      goods: mill.goods,
      revenue,
      tollTotal,
      tollsByOwner: path.tollsByOwner,
      prestige: mill.goods * (path.routeIds.length >= RULES.longHaulLinks ? 2 : 1),
      routeIds: path.routeIds,
    })
  }
  return quotes.sort((a, b) => b.revenue - b.tollTotal + b.prestige - (a.revenue - a.tollTotal + a.prestige))
}

/** The player's mills that have goods and at least one market to send them to. */
export function shipSources(state: GameState, playerId = currentPlayerId(state)): Building[] {
  return state.buildings.filter(
    (b) => b.owner === playerId && b.kind === 'mill' && b.goods > 0 && shipQuotes(state, b.id).length > 0,
  )
}

/** Every action the current player may take right now. */
export function legalActions(state: GameState): GameAction[] {
  if (state.status !== 'playing') return []
  const playerId = currentPlayerId(state)
  const player = state.players[playerId]
  const actions: GameAction[] = []
  for (const kind of INDUSTRY_ORDER) {
    if (!canAfford(player, INDUSTRIES[kind].cost)) continue
    for (const plot of buildTargets(state, kind, playerId)) actions.push({ type: 'build', kind, ...plot })
  }
  for (const route of linkTargets(state, playerId)) {
    if (canAfford(player, LINK_COST[route.kind])) actions.push({ type: 'link', routeId: route.id })
  }
  for (const mill of shipSources(state, playerId)) {
    for (const q of shipQuotes(state, mill.id)) actions.push({ type: 'ship', buildingId: mill.id, marketId: q.marketId })
  }
  actions.push({ type: 'raiseFunds' }, { type: 'endTurn' })
  return actions
}

/** Score as if the match ended now. */
export function scoreFor(state: GameState, playerId: number): Omit<FinalScore, 'rank'> {
  const player = state.players[playerId]
  const moneyBonus = Math.floor(player.money / RULES.moneyPerPrestige)
  const marketBonus = networkMarkets(state, playerId).length * RULES.marketBonus
  return {
    player: playerId,
    prestige: player.prestige,
    moneyBonus,
    marketBonus,
    total: player.prestige + moneyBonus + marketBonus,
  }
}

/** Final standings, best first. Ties on total are broken by money; full ties share a rank. */
export function finalScores(state: GameState): FinalScore[] {
  const scores = state.players.map((p) => scoreFor(state, p.id))
  const money = (id: number) => state.players[id].money
  scores.sort((a, b) => b.total - a.total || money(b.player) - money(a.player))
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

function addLog(state: GameState, player: number | null, text: string) {
  state.log.push({ id: state.nextId++, round: state.round, player, text })
  if (state.log.length > MAX_LOG_ENTRIES) state.log.splice(0, state.log.length - MAX_LOG_ENTRIES)
}

function pay(player: PlayerState, cost: Cost): Quote {
  const q = quote(player, cost)
  if (q.total > player.money) throw new IllegalActionError(`That costs £${q.total}; you have £${player.money}`)
  player.money -= q.total
  player.coal -= q.coalUsed
  player.iron -= q.ironUsed
  return q
}

/** Apply an action for the current player and return the new state. */
export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.status !== 'playing') throw new IllegalActionError('The match is over')
  const s = structuredClone(state)
  const playerId = currentPlayerId(s)
  const player = s.players[playerId]

  switch (action.type) {
    case 'build': {
      const def = INDUSTRIES[action.kind]
      const town = getTown(s, action.townId)
      const allowed = buildTargets(s, action.kind, playerId).some(
        (plot) => plot.townId === action.townId && plot.slot === action.slot,
      )
      if (!allowed) throw new IllegalActionError(`You can't build a ${def.name} there`)
      const q = pay(player, def.cost)
      player.prestige += def.prestige
      s.buildings.push({
        id: s.nextId++,
        kind: action.kind,
        owner: playerId,
        townId: town.id,
        slot: action.slot,
        goods: 0,
      })
      addLog(s, playerId, `${player.name} built a ${def.name} in ${town.name} (${formatPayment(q)}, +${def.prestige}★)`)
      s.lastEvent = { type: 'build', player: playerId, townId: town.id, slot: action.slot }
      break
    }

    case 'link': {
      const route = getRoute(s, action.routeId)
      if (!linkTargets(s, playerId).some((r) => r.id === route.id)) {
        throw new IllegalActionError('That route is taken or out of your reach')
      }
      const q = pay(player, LINK_COST[route.kind])
      s.links[route.id] = playerId
      player.prestige += RULES.linkPrestige
      const name = `${getTown(s, route.from).name}–${getTown(s, route.to).name}`
      addLog(
        s,
        playerId,
        `${player.name} opened the ${name} ${route.kind === 'canal' ? 'canal' : 'railway'} (${formatPayment(q)}, +${RULES.linkPrestige}★)`,
      )
      s.lastEvent = { type: 'link', player: playerId, routeId: route.id }
      break
    }

    case 'ship': {
      const mill = s.buildings.find((b) => b.id === action.buildingId)
      if (!mill || mill.owner !== playerId || mill.kind !== 'mill') throw new IllegalActionError('Pick one of your mills')
      if (mill.goods === 0) throw new IllegalActionError('That mill has no goods yet')
      const q = shipQuotes(s, mill.id).find((option) => option.marketId === action.marketId)
      if (!q) throw new IllegalActionError('That market is out of reach')
      player.money += q.revenue - q.tollTotal
      for (const [owner, count] of Object.entries(q.tollsByOwner)) s.players[Number(owner)].money += count * RULES.toll
      player.prestige += q.prestige
      player.goodsShipped += q.goods
      s.prices[q.marketId] = Math.max(RULES.priceFloor, s.prices[q.marketId] - q.goods * RULES.priceDropPerGoods)
      mill.goods = 0
      const tolls = Object.entries(q.tollsByOwner)
        .map(([owner, count]) => `£${count * RULES.toll} toll to ${s.players[Number(owner)].name}`)
        .join(', ')
      const where =
        mill.townId === q.marketId
          ? `sold ${q.goods} goods in ${getTown(s, q.marketId).name}`
          : `shipped ${q.goods} goods from ${getTown(s, mill.townId).name} to ${getTown(s, q.marketId).name}`
      addLog(s, playerId, `${player.name} ${where} (+£${q.revenue}${tolls ? `, ${tolls}` : ''}, +${q.prestige}★)`)
      s.lastEvent = { type: 'ship', player: playerId, fromTownId: mill.townId, marketId: q.marketId, routeIds: q.routeIds }
      break
    }

    case 'raiseFunds': {
      player.money += RULES.raiseFunds
      addLog(s, playerId, `${player.name} raised funds (+£${RULES.raiseFunds})`)
      s.lastEvent = { type: 'raiseFunds', player: playerId }
      break
    }

    case 'endTurn': {
      addLog(s, playerId, action.timedOut ? `${player.name} ran out of time` : `${player.name} ended the turn early`)
      s.lastEvent = { type: 'endTurn', player: playerId }
      s.actionsLeft = 0
      break
    }
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

/** Industries produce, everyone collects income, market prices recover. */
function produce(s: GameState) {
  for (const b of s.buildings) {
    const owner = s.players[b.owner]
    switch (b.kind) {
      case 'colliery':
        if (owner.coal < RULES.storeCap) owner.coal += 1
        else owner.money += RULES.coalOverflowValue
        break
      case 'ironworks':
        if (owner.iron < RULES.storeCap) owner.iron += 1
        else owner.money += RULES.ironOverflowValue
        break
      case 'mill':
        b.goods = Math.min(RULES.millCapacity, b.goods + 1)
        break
      case 'works':
        owner.prestige += 1
        break
    }
  }
  for (const player of s.players) player.money += RULES.baseIncome
  for (const town of s.board.towns) {
    if (town.market !== null) s.prices[town.id] = Math.min(town.market, s.prices[town.id] + 1)
  }
}

function endRound(s: GameState) {
  produce(s)
  addLog(s, null, `Round ${s.round} ends: industries produce and everyone collects £${RULES.baseIncome}.`)
  if (s.round >= s.totalRounds) {
    s.status = 'finished'
    s.actionsLeft = 0
    s.turnIndex = 0
    s.scores = finalScores(s)
    const winners = s.scores.filter((score) => score.rank === 1).map((score) => s.players[score.player].name)
    addLog(s, null, winners.length > 1 ? `Tie for first: ${winners.join(' and ')}.` : `${winners[0]} won the match.`)
    return
  }
  s.round += 1
  const n = s.players.length
  const start = (s.round - 1) % n
  s.turnOrder = s.players.map((_, i) => (start + i) % n)
  s.turnIndex = 0
  addLog(s, null, `Round ${s.round} of ${s.totalRounds} begins.`)
}

/** Validate something loaded from storage well enough to resume it. */
export function parseSavedGame(raw: unknown): GameState | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const game = raw as Partial<GameState>
  if (game.version !== GAME_VERSION || !game.board || !Array.isArray(game.players)) return undefined
  return game as GameState
}
