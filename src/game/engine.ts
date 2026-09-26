/**
 * The Bronze game engine: pure functions over a serialisable GameState.
 * No React, no timers, no randomness except the seed kept in the state.
 * applyAction never mutates its input; it returns a new state.
 */

import { BOARD, type BoardData } from '../data/board'
import { getGameMode, type GameModeConfig, type GameModeId } from '../data/gameModes'
import { getMap, type MapId, type SchematicMapConfig } from '../data/maps'
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
const KIND_BY_CODE: Record<string, IndustryKind> = { C: 'coal', I: 'iron', M: 'cotton', W: 'works' }

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
      market: town.market ? { price: town.market, buys: 'any' } : null,
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

export interface NewGameOptions {
  mapId: MapId
  modeId: GameModeId
  seats: SeatSetup[]
  seed?: number
}

export function createGame({ mapId, modeId, seats, seed = Date.now() }: NewGameOptions): GameState {
  if (seats.length < 2) throw new Error('A match needs at least two players')
  const mode = getGameMode(modeId)
  const board = boardFor(mapId, mode.mapSize)
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
    board.eras
      ? `Round 1 of ${mode.rounds} begins in the canal era. Railways arrive in round ${state.railEraRound}.`
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

/** Does this industry make goods to ship? */
export const makesGoods = (kind: IndustryKind) => INDUSTRIES[kind].yields === 'goods'

/** Towns where the player owns an industry, or that one of their links touches. */
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

/** Market towns (hubs, market cities) in the player's network: each is worth bonus prestige at the end. */
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
    if (town.railOnly && state.era === 'canal') continue
    town.slots.forEach((allowed, slot) => {
      if (allowed.includes(kind) && !buildingAt(state, town.id, slot)) plots.push({ townId: town.id, slot })
    })
  }
  return plots
}

/** What this route would be built as right now, or null if the current era doesn't allow it. */
export function linkKindNow(state: GameState, route: BoardRoute): RouteKind | null {
  if (!state.era) return route.kinds[0]
  return route.kinds.includes(state.era) ? state.era : null
}

/** Cost of building a route now. */
export function linkCost(state: GameState, route: BoardRoute): Cost {
  return LINK_COST[linkKindNow(state, route) ?? route.kinds[0]]
}

/** Unbuilt routes, buildable this era, that touch the player's network (ignores money). */
export function linkTargets(state: GameState, playerId = currentPlayerId(state)): BoardRoute[] {
  const network = networkTowns(state, playerId)
  const anywhere = network.size === 0
  return state.board.routes.filter(
    (route) =>
      !(route.id in state.links) &&
      linkKindNow(state, route) !== null &&
      (anywhere || network.has(route.from) || network.has(route.to)),
  )
}

interface Path {
  routeIds: string[]
  /** Number of opponent-owned links on the path, per owner. */
  tollsByOwner: Record<number, number>
}

/**
 * Cheapest way to move goods between two towns over built links (anyone's,
 * canal or rail). Prefers fewer tolls, then fewer links. Null if not connected.
 */
export function findPath(state: GameState, playerId: number, from: string, to: string): Path | null {
  if (from === to) return { routeIds: [], tollsByOwner: {} }
  const built = state.board.routes.filter((route) => route.id in state.links)
  const cost = new Map<string, number>([[from, 0]])
  const via = new Map<string, BoardRoute>()
  const done = new Set<string>()
  // Small graphs (≤ 30 towns), so a plain O(n²) Dijkstra is plenty.
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
      const step = 1 + (state.links[route.id].owner === playerId ? 0 : 100)
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

/** Somewhere goods can be sold: a market town, or a port. */
export interface MarketPoint {
  /** Town id, or `port:<buildingId>`. */
  id: string
  townId: string
  name: string
  /** Price of the next goods sold here. */
  price: number
  /** Port owner (null for market towns). */
  owner: number | null
}

/** Every place that buys goods from this kind of industry. */
export function marketsFor(state: GameState, kind: IndustryKind): MarketPoint[] {
  const points: MarketPoint[] = []
  for (const town of state.board.towns) {
    if (town.market && (town.market.buys === 'any' || town.market.buys.includes(kind))) {
      points.push({ id: town.id, townId: town.id, name: town.name, price: state.prices[town.id], owner: null })
    }
  }
  for (const b of state.buildings) {
    if (!INDUSTRIES[b.kind].market) continue
    points.push({
      id: `port:${b.id}`,
      townId: b.townId,
      name: `${getTown(state, b.townId).name} port`,
      price: RULES.portPrice,
      owner: b.owner,
    })
  }
  return points
}

export interface ShipQuote {
  buildingId: number
  marketId: string
  marketTownId: string
  marketName: string
  goods: number
  revenue: number
  tollTotal: number
  tollsByOwner: Record<number, number>
  /** Port fee paid to the port's owner (0 at market towns and your own ports). */
  fee: number
  feeOwner: number | null
  prestige: number
  routeIds: string[]
}

/** Money for selling `goods` at a market town, price falling with each one sold. */
export function saleRevenue(price: number, goods: number): number {
  let revenue = 0
  for (let i = 0; i < goods; i++) revenue += Math.max(RULES.priceFloor, price - i * RULES.priceDropPerGoods)
  return revenue
}

/** Every market this industry's goods can reach right now, with the payout for each. */
export function shipQuotes(state: GameState, buildingId: number): ShipQuote[] {
  const source = state.buildings.find((b) => b.id === buildingId)
  if (!source || !makesGoods(source.kind) || source.goods === 0) return []
  const quotes: ShipQuote[] = []
  for (const market of marketsFor(state, source.kind)) {
    const path = findPath(state, source.owner, source.townId, market.townId)
    if (!path) continue
    const tollTotal = Object.values(path.tollsByOwner).reduce((sum, n) => sum + n * RULES.toll, 0)
    const isPort = market.owner !== null
    const revenue = isPort ? source.goods * RULES.portPrice : saleRevenue(market.price, source.goods)
    const feeOwner = isPort && market.owner !== source.owner ? market.owner : null
    const fee = feeOwner === null ? 0 : source.goods * RULES.portFee
    if (state.players[source.owner].money + revenue < tollTotal + fee) continue
    quotes.push({
      buildingId,
      marketId: market.id,
      marketTownId: market.townId,
      marketName: market.name,
      goods: source.goods,
      revenue,
      tollTotal,
      tollsByOwner: path.tollsByOwner,
      fee,
      feeOwner,
      prestige: source.goods * (path.routeIds.length >= RULES.longHaulLinks ? 2 : 1),
      routeIds: path.routeIds,
    })
  }
  const net = (q: ShipQuote) => q.revenue - q.tollTotal - q.fee + q.prestige
  return quotes.sort((a, b) => net(b) - net(a))
}

/** The player's goods industries that have goods and at least one market to send them to. */
export function shipSources(state: GameState, playerId = currentPlayerId(state)): Building[] {
  return state.buildings.filter(
    (b) => b.owner === playerId && makesGoods(b.kind) && b.goods > 0 && shipQuotes(state, b.id).length > 0,
  )
}

/** Every action the current player may take right now. */
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
  for (const source of shipSources(state, playerId)) {
    for (const q of shipQuotes(state, source.id)) actions.push({ type: 'ship', buildingId: source.id, marketId: q.marketId })
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
      if (!allowed) {
        throw new IllegalActionError(
          town.railOnly && s.era === 'canal' ? `${town.name} opens in the rail era` : `You can't build a ${def.name} there`,
        )
      }
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
      const kind = linkKindNow(s, route)
      if (!kind) throw new IllegalActionError(`That route can't be built in the ${s.era} era`)
      if (!linkTargets(s, playerId).some((r) => r.id === route.id)) {
        throw new IllegalActionError('That route is taken or out of your reach')
      }
      const q = pay(player, LINK_COST[kind])
      s.links[route.id] = { owner: playerId, kind }
      player.prestige += RULES.linkPrestige
      const name = `${getTown(s, route.from).name}–${getTown(s, route.to).name}`
      addLog(
        s,
        playerId,
        `${player.name} ${kind === 'canal' ? 'dug' : 'laid'} the ${name} ${kind === 'canal' ? 'canal' : 'railway'} (${formatPayment(q)}, +${RULES.linkPrestige}★)`,
      )
      s.lastEvent = { type: 'link', player: playerId, routeId: route.id }
      break
    }

    case 'ship': {
      const source = s.buildings.find((b) => b.id === action.buildingId)
      if (!source || source.owner !== playerId || !makesGoods(source.kind)) {
        throw new IllegalActionError('Pick one of your goods industries')
      }
      if (source.goods === 0) throw new IllegalActionError('It has no goods yet')
      const q = shipQuotes(s, source.id).find((option) => option.marketId === action.marketId)
      if (!q) throw new IllegalActionError('That market is out of reach or doesn’t buy these goods')
      player.money += q.revenue - q.tollTotal - q.fee
      for (const [owner, count] of Object.entries(q.tollsByOwner)) s.players[Number(owner)].money += count * RULES.toll
      if (q.feeOwner !== null) s.players[q.feeOwner].money += q.fee
      player.prestige += q.prestige
      player.goodsShipped += q.goods
      if (q.marketId in s.prices) {
        s.prices[q.marketId] = Math.max(RULES.priceFloor, s.prices[q.marketId] - q.goods * RULES.priceDropPerGoods)
      }
      source.goods = 0
      const extras = [
        ...Object.entries(q.tollsByOwner).map(([owner, count]) => `£${count * RULES.toll} toll to ${s.players[Number(owner)].name}`),
        ...(q.feeOwner !== null ? [`£${q.fee} port fee to ${s.players[q.feeOwner].name}`] : []),
      ].join(', ')
      const goods = `${q.goods} ${INDUSTRIES[source.kind].goodsName ?? 'goods'}`
      const where =
        source.townId === q.marketTownId
          ? `sold ${goods} in ${q.marketName}`
          : `shipped ${goods} from ${getTown(s, source.townId).name} to ${q.marketName}`
      addLog(s, playerId, `${player.name} ${where} (+£${q.revenue}${extras ? `, ${extras}` : ''}, +${q.prestige}★)`)
      s.lastEvent = {
        type: 'ship',
        player: playerId,
        fromTownId: source.townId,
        marketId: q.marketId,
        marketTownId: q.marketTownId,
        routeIds: q.routeIds,
      }
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
        owner.money += 1
        break
      case 'prestige':
        owner.prestige += 1
        break
    }
  }
  for (const player of s.players) player.money += RULES.baseIncome
  for (const town of s.board.towns) {
    if (town.market) s.prices[town.id] = Math.min(town.market.price, s.prices[town.id] + 1)
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
  if (s.era === 'canal' && s.railEraRound !== null && s.round >= s.railEraRound) {
    s.era = 'rail'
    addLog(s, null, `The rail era begins: no more canals can be dug, but railways can now be laid.`)
  }
  addLog(s, null, `Round ${s.round} of ${s.totalRounds} begins.`)
}

/** Validate something loaded from storage well enough to resume it. */
export function parseSavedGame(raw: unknown): GameState | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const game = raw as Partial<GameState>
  if (game.version !== GAME_VERSION || !game.board || !Array.isArray(game.players)) return undefined
  return game as GameState
}
