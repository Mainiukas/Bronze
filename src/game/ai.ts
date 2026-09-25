/**
 * Computer opponent: a greedy player. For every legal action it looks at the
 * resulting position, scores it with `evaluate`, and picks the best, with a
 * little seeded noise so matches don't all play out the same way.
 */

import { applyAction, currentPlayerId, findPath, legalActions, networkMarkets, networkTowns } from './engine'
import { RULES } from './rules'
import type { Building, GameAction, GameState } from './types'

/** Small deterministic PRNG (mulberry32). */
function seededRandom(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** How much randomness to mix into each action's score (in prestige). */
const NOISE = 0.35
/** How many promising first actions get a full look at the follow-up action. */
const LOOKAHEAD_WIDTH = 6

/**
 * Pick an action for the current player. With two actions left, it plans
 * the whole turn: the best few first actions are each paired with their best
 * follow-up, so combos like "link to a town, then build a mill there" are found.
 */
export function chooseAIAction(state: GameState): GameAction {
  const playerId = currentPlayerId(state)
  // Seeded from the match seed and the action counter: same position, same choice.
  const random = seededRandom(state.seed ^ Math.imul(state.nextId, 2654435761))

  const options = legalActions(state)
    .filter((action) => action.type !== 'endTurn')
    .map((action) => {
      const next = applyAction(state, action)
      return { action, next, score: evaluate(next, playerId) }
    })
  if (options.length === 0) return { type: 'endTurn' }

  if (state.actionsLeft > 1) {
    options.sort((a, b) => b.score - a.score)
    for (const option of options.slice(0, LOOKAHEAD_WIDTH)) {
      if (option.next.status !== 'playing' || currentPlayerId(option.next) !== playerId) continue
      for (const follow of legalActions(option.next)) {
        if (follow.type === 'endTurn') continue
        option.score = Math.max(option.score, evaluate(applyAction(option.next, follow), playerId))
      }
    }
  }

  let best = options[0]
  let bestScore = -Infinity
  for (const option of options) {
    const score = option.score + random() * NOISE
    if (score > bestScore) [best, bestScore] = [option, score]
  }
  return best.action
}

/**
 * Estimated final score for a player from this position: prestige already
 * earned, plus what money, stock, industries and network should turn into.
 */
export function evaluate(state: GameState, playerId: number): number {
  const player = state.players[playerId]
  if (state.status === 'finished') {
    const score = state.scores!.find((s) => s.player === playerId)!
    return score.total + player.money * 0.01
  }

  // Production steps still to come, including the one ending this round.
  const remaining = state.totalRounds - state.round + 1
  // Money is worth more early on, when it can still be invested.
  const moneyValue = 1 / RULES.moneyPerPrestige + 0.15 * (remaining / state.totalRounds)

  let value = player.prestige + player.money * moneyValue

  // Coal and iron in stock only help if there's time to build with them.
  const stockUse = Math.min(1, Math.max(0, (remaining - 1) / 3))
  value += stockUse * moneyValue * (Math.min(player.coal, 3) * 2.5 + Math.min(player.iron, 3) * 4)

  for (const building of state.buildings) {
    if (building.owner !== playerId) continue
    switch (building.kind) {
      case 'colliery':
        value += remaining * moneyValue * 1.8
        break
      case 'ironworks':
        value += remaining * moneyValue * 3.2
        break
      case 'works':
        value += remaining
        break
      case 'mill': {
        const perGoods = goodsValue(state, building, moneyValue)
        // Goods left in a mill after the last round are worth nothing.
        value += building.goods * perGoods * (remaining <= 1 ? 0.15 : 0.85)
        // Output made at the end of the last round can't be shipped; a full mill wastes the next batch.
        const batches = Math.max(0, remaining - 1 - (building.goods >= RULES.millCapacity ? 1 : 0))
        value += batches * perGoods * 0.65
        break
      }
    }
  }

  value += networkMarkets(state, playerId).length * RULES.marketBonus

  // Room to grow: free plots in the network, while there's time to use them.
  // Mill plots with a way to market are the prize.
  if (remaining > 2) {
    let potential = 0
    for (const townId of networkTowns(state, playerId)) {
      const town = state.board.towns.find((t) => t.id === townId)!
      const toMarket = town.market !== null || hasMarketAccess(state, playerId, townId)
      town.slots.forEach((allowed, slot) => {
        if (state.buildings.some((b) => b.townId === townId && b.slot === slot)) return
        potential += allowed.includes('mill') ? (toMarket ? 0.7 : 0.3) : 0.2
      })
    }
    value += Math.min(potential, 3) * Math.min(1, (remaining - 2) / 3)
  }

  return value
}

/** Can goods from this town reach any market over built links? */
function hasMarketAccess(state: GameState, playerId: number, townId: string): boolean {
  return state.board.towns.some((t) => t.market !== null && findPath(state, playerId, townId, t.id) !== null)
}

/** Rough worth of one goods from this mill, given where it can be shipped today. */
function goodsValue(state: GameState, mill: Building, moneyValue: number): number {
  let best = -Infinity
  let marketCount = 0
  let priceSum = 0
  for (const town of state.board.towns) {
    if (town.market === null) continue
    marketCount++
    priceSum += town.market
    const path = findPath(state, mill.owner, mill.townId, town.id)
    if (!path) continue
    const tolls = Object.values(path.tollsByOwner).reduce((sum, n) => sum + n, 0)
    const prestige = path.routeIds.length >= RULES.longHaulLinks ? 2 : 1
    // Tolls are paid once per shipment; spread them over a typical load of 2 goods.
    best = Math.max(best, state.prices[town.id] * moneyValue + prestige - tolls * RULES.toll * moneyValue * 0.5)
  }
  // Not connected to any market yet: worth something, since a link could fix that.
  if (best === -Infinity) return 0.35 * ((priceSum / Math.max(1, marketCount)) * moneyValue + 1)
  return best
}
