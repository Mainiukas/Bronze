/**
 * Computer opponent: a greedy player. For every legal action it looks at the
 * resulting position, scores it with `evaluate`, and picks the best, with a
 * little seeded noise so matches don't all play out the same way.
 */

import { applyAction, currentPlayerId, findPath, legalActions, marketsFor, networkMarkets, networkTowns } from './engine'
import { INDUSTRIES, RULES } from './rules'
import type { GameAction, GameState, IndustryKind } from './types'

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
    switch (INDUSTRIES[building.kind].yields) {
      case 'coal':
        value += remaining * moneyValue * 1.8
        break
      case 'iron':
        value += remaining * moneyValue * 3.2
        break
      case 'prestige':
        value += remaining
        break
      case 'money':
        // Port: £1 a round, plus fees when others sell there.
        value += remaining * (moneyValue * 1 + 0.25)
        break
      case 'goods': {
        const perGoods = goodsValue(state, building.owner, building.townId, building.kind, moneyValue)
        // Goods left over after the last round are worth nothing.
        value += building.goods * perGoods * (remaining <= 1 ? 0.15 : 0.85)
        // Output made at the end of the last round can't be shipped; a full store wastes the next batch.
        const batches = Math.max(0, remaining - 1 - (building.goods >= RULES.goodsCapacity ? 1 : 0))
        value += batches * perGoods * 0.65
        break
      }
    }
  }

  value += networkMarkets(state, playerId).length * RULES.marketBonus

  // Room to grow: free plots in the network, while there's time to use them.
  // Goods plots with a way to a market that buys their goods are the prize.
  if (remaining > 2) {
    let potential = 0
    for (const townId of networkTowns(state, playerId)) {
      const town = state.board.towns.find((t) => t.id === townId)!
      town.slots.forEach((allowed, slot) => {
        if (state.buildings.some((b) => b.townId === townId && b.slot === slot)) return
        const goodsKinds = allowed.filter((kind) => INDUSTRIES[kind].yields === 'goods')
        if (goodsKinds.length === 0) potential += allowed.includes('port') ? 0.4 : 0.2
        else potential += goodsKinds.some((kind) => hasMarketAccess(state, playerId, townId, kind)) ? 0.7 : 0.3
      })
    }
    value += Math.min(potential, 3) * Math.min(1, (remaining - 2) / 3)
  }

  return value
}

/** Can goods of this kind from this town reach a market that buys them? */
function hasMarketAccess(state: GameState, playerId: number, townId: string, kind: IndustryKind): boolean {
  return marketsFor(state, kind).some((m) => findPath(state, playerId, townId, m.townId) !== null)
}

/**
 * Fewest links still to build from `from` to every town: built links (anyone's)
 * are free, unbuilt routes that can be built this era or later cost one.
 */
function linkGaps(state: GameState, from: string): Map<string, number> {
  const usable = state.board.routes.filter(
    (route) => route.id in state.links || state.era !== 'rail' || route.kinds.includes('rail'),
  )
  const gaps = new Map<string, number>([[from, 0]])
  const queue = [from]
  // 0-1 breadth-first search: free edges go to the front of the queue.
  while (queue.length) {
    const town = queue.shift()!
    const here = gaps.get(town)!
    for (const route of usable) {
      if (route.from !== town && route.to !== town) continue
      const next = route.from === town ? route.to : route.from
      const step = route.id in state.links ? 0 : 1
      if (here + step < (gaps.get(next) ?? Infinity)) {
        gaps.set(next, here + step)
        if (step === 0) queue.unshift(next)
        else queue.push(next)
      }
    }
  }
  return gaps
}

/**
 * Rough worth of one goods of this kind from this town. Connected markets
 * count in full; markets still some links away count less for each missing
 * link, so every link toward a buyer adds value.
 */
function goodsValue(state: GameState, owner: number, townId: string, kind: IndustryKind, moneyValue: number): number {
  const markets = marketsFor(state, kind)
  const gaps = linkGaps(state, townId)
  let best = 0
  for (const market of markets) {
    const gap = gaps.get(market.townId)
    if (gap === undefined) continue
    const fee = market.owner !== null && market.owner !== owner ? RULES.portFee : 0
    if (gap === 0) {
      const path = findPath(state, owner, townId, market.townId)
      if (!path) continue
      const tolls = Object.values(path.tollsByOwner).reduce((sum, n) => sum + n, 0)
      const prestige = path.routeIds.length >= RULES.longHaulLinks ? 2 : 1
      // Tolls are paid once per shipment; spread them over a typical load of 2 goods.
      best = Math.max(best, (market.price - fee) * moneyValue + prestige - tolls * RULES.toll * moneyValue * 0.5)
    } else {
      best = Math.max(best, ((market.price - fee) * moneyValue + 2) * 0.7 ** gap)
    }
  }
  return best
}
