/**
 * Computer opponents, in three levels. Every level picks only from
 * legalActions, and chooseAIAction never throws: if anything goes wrong it
 * ends the turn (and logs a warning). Choices are seeded from the match seed
 * and the position, so the same match plays out the same way.
 *
 * - Easy: a random legal move, weighted towards building.
 * - Normal: greedy, one action deep: immediate ★, money, and a small bonus
 *   for a bigger network and for mills that can reach a market.
 * - Hard: plans both actions of the turn together, with a full estimate of
 *   the final score (production still to come, money → ★ at the end, hubs).
 */

import { applyAction, currentPlayerId, findPath, legalActions, marketsFor, networkHubs, networkTowns } from './engine'
import { INDUSTRIES, RULES } from './rules'
import type { AILevel, GameAction, GameState, GoodsKind } from './types'

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

/** Seeded from the match seed and the action counter: same position, same choice. */
const randomFor = (state: GameState) => seededRandom(state.seed ^ Math.imul(state.nextId, 2654435761))

/**
 * The current (computer) player's next action. Never throws: an unexpected
 * error, or a choice that somehow isn't legal, ends the turn instead.
 */
export function chooseAIAction(state: GameState): GameAction {
  try {
    const level = state.players[currentPlayerId(state)]?.aiLevel ?? 'normal'
    const legal = legalActions(state)
    const action = pick(state, level, legal)
    if (!legal.some((a) => JSON.stringify(a) === JSON.stringify(action))) throw new Error(`picked an illegal action ${JSON.stringify(action)}`)
    return action
  } catch (error) {
    console.warn('Computer player failed to choose an action; ending its turn.', error)
    return { type: 'endTurn' }
  }
}

function pick(state: GameState, level: AILevel, legal: GameAction[]): GameAction {
  const options = legal.filter((a) => a.type !== 'endTurn')
  if (options.length === 0) return { type: 'endTurn' }
  const random = randomFor(state)
  if (level === 'easy') return pickEasy(options, random)
  if (level === 'normal') return pickNormal(state, options, random)
  return pickHard(state, options, random)
}

/* ---- Easy ----------------------------------------------------------------- */

const EASY_WEIGHTS: Record<GameAction['type'], number> = { build: 5, link: 3, ship: 4, raiseFunds: 1, endTurn: 0 }

/** A random legal action; each kind of action is weighted, then spread over its options. */
function pickEasy(options: GameAction[], random: () => number): GameAction {
  const byType = new Map<GameAction['type'], GameAction[]>()
  for (const a of options) byType.set(a.type, [...(byType.get(a.type) ?? []), a])
  const types = [...byType.keys()]
  const total = types.reduce((sum, t) => sum + EASY_WEIGHTS[t], 0)
  let roll = random() * total
  for (const t of types) {
    roll -= EASY_WEIGHTS[t]
    if (roll <= 0) {
      const list = byType.get(t)!
      return list[Math.floor(random() * list.length)]
    }
  }
  return options[0]
}

/* ---- Normal --------------------------------------------------------------- */

/** How much randomness to mix into each action's score (in ★). */
const NOISE = 0.35

function pickNormal(state: GameState, options: GameAction[], random: () => number): GameAction {
  const playerId = currentPlayerId(state)
  let best = options[0]
  let bestScore = -Infinity
  for (const action of options) {
    const score = greedyValue(applyAction(state, action), playerId) + random() * NOISE
    if (score > bestScore) [best, bestScore] = [action, score]
  }
  return best
}

/**
 * One-look value of a position: ★, money, stock, a rough worth of what the
 * player's industries will still produce, and a little for reach and for
 * mills that can get their cotton to a market.
 */
export function greedyValue(state: GameState, playerId: number): number {
  const player = state.players[playerId]
  const remaining = state.status === 'finished' ? 0 : state.totalRounds - state.round + 1
  // Money is worth its end-of-game ★ plus a little while it can still be invested.
  const moneyValue = 1 / RULES.moneyPerPrestige + 0.05 * (remaining / state.totalRounds)
  const later = Math.max(0, remaining - 1)
  let value = player.prestige + player.money * moneyValue
  value += (player.coal * RULES.coalPrice + player.iron * RULES.ironPrice) * moneyValue * 0.7
  for (const b of state.buildings) {
    if (b.owner !== playerId) continue
    switch (INDUSTRIES[b.kind].yields) {
      case 'coal':
        value += later * RULES.coalPrice * moneyValue * 0.6
        break
      case 'iron':
        value += later * RULES.ironPrice * moneyValue * 0.6
        break
      case 'money':
        value += remaining * RULES.portIncome * moneyValue
        break
      case 'prestige':
        value += remaining
        break
      case 'goods': {
        // A mill near a market is worth its cotton; one without a buyer in reach much less.
        const near = hasMarket(state, playerId, b.townId, 'cotton')
        const perUnit = RULES.portPrice * moneyValue + 1.5
        value += (b.goods + later * 0.8) * perUnit * (near ? 0.7 : 0.25) + (near ? 0.5 : 0)
        break
      }
    }
  }
  value += networkTowns(state, playerId).size * 0.3 + networkHubs(state, playerId).length * RULES.hubBonus * 0.8
  return value
}

/** Can goods from this town reach a market that buys them right now? */
function hasMarket(state: GameState, playerId: number, townId: string, goods: GoodsKind): boolean {
  return marketsFor(state, goods).some((m) => findPath(state, playerId, townId, m.townId) !== null)
}

/* ---- Hard ----------------------------------------------------------------- */

/** How many promising first actions get a full look at the follow-up action. */
const LOOKAHEAD_WIDTH = 6

/**
 * With two actions left, plan the whole turn: the best few first actions are
 * each paired with their best follow-up, so combos like "link to a town, then
 * build a mill there" are found.
 */
function pickHard(state: GameState, actions: GameAction[], random: () => number): GameAction {
  const playerId = currentPlayerId(state)
  const options = actions.map((action) => {
    const next = applyAction(state, action)
    return { action, next, score: evaluate(next, playerId) }
  })
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
    const score = option.score + random() * NOISE * 0.5
    if (score > bestScore) [best, bestScore] = [option, score]
  }
  return best.action
}

/**
 * Estimated final score for a player from this position: prestige already
 * earned, plus what money, stock, industries and network should turn into.
 * Near the end, money counts as the ★ it will convert to (1 per £5, whole
 * fives only) and hubs in the network as their +2★.
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

  let value = player.prestige
  if (remaining <= 1) {
    // Last round: count money exactly as the final scoring will (income still to come).
    const final = player.money + RULES.baseIncome
    value += Math.floor(final / RULES.moneyPerPrestige) + (final % RULES.moneyPerPrestige) * 0.02
  } else value += player.money * moneyValue

  // Coal and iron in stock: for building with while there's time, or to ship.
  const stockUse = Math.min(1, Math.max(0, (remaining - 1) / 3))
  value += stockUse * moneyValue * (Math.min(player.coal, 3) * 2.5 + Math.min(player.iron, 3) * 4)
  value += storeSaleValue(state, playerId, 'coal', player.coal) + storeSaleValue(state, playerId, 'iron', player.iron)

  for (const building of state.buildings) {
    if (building.owner !== playerId) continue
    switch (INDUSTRIES[building.kind].yields) {
      case 'coal':
        value += (remaining - 1) * moneyValue * 1.8
        break
      case 'iron':
        value += (remaining - 1) * moneyValue * 3.2
        break
      case 'prestige':
        value += remaining
        break
      case 'money':
        // Port: £1 a round, plus fees when others sell there.
        value += remaining * (moneyValue * RULES.portIncome + 0.25)
        break
      case 'goods': {
        const perUnit = goodsValue(state, building.owner, building.townId, 'cotton', moneyValue)
        // Cotton left over after the last round is worth nothing.
        value += building.goods * perUnit * (remaining <= 1 ? 0.15 : 0.85)
        // Output made at the end of the last round can't be shipped; a full mill wastes the next batch.
        const batches = Math.max(0, remaining - 1 - (building.goods >= RULES.goodsCapacity ? 1 : 0))
        value += batches * perUnit * 0.65
        break
      }
    }
  }

  value += networkHubs(state, playerId).length * RULES.hubBonus

  // Room to grow: free plots in the network, while there's time to use them.
  // Mill plots with a way to a market are the prize.
  if (remaining > 2) {
    let potential = 0
    for (const townId of networkTowns(state, playerId)) {
      const town = state.board.towns.find((t) => t.id === townId)!
      if (town.railOnly && state.era === 'canal') continue
      town.slots.forEach((allowed, slot) => {
        if (state.buildings.some((b) => b.townId === townId && b.slot === slot)) return
        if (!allowed.includes('cotton')) potential += allowed.includes('port') ? 0.4 : 0.2
        else potential += hasMarket(state, playerId, townId, 'cotton') ? 0.7 : 0.3
      })
    }
    value += Math.min(potential, 3) * Math.min(1, (remaining - 2) / 3)
  }

  return value
}

/**
 * What coal or iron in the store could sell for this turn or next, if one of
 * the player's mines or works can reach a hub buying it (beyond what it's
 * worth for building, which the stock value above covers up to 3).
 */
function storeSaleValue(state: GameState, playerId: number, goods: 'coal' | 'iron', amount: number): number {
  if (amount === 0) return 0
  let best = 0
  for (const b of state.buildings) {
    if (b.owner !== playerId || INDUSTRIES[b.kind].ships !== goods) continue
    for (const m of marketsFor(state, goods)) {
      const path = findPath(state, playerId, b.townId, m.townId)
      if (!path) continue
      let revenue = 0
      for (let i = 0; i < amount; i++) revenue += Math.max(RULES.priceFloor, m.price - i)
      const tolls = Object.values(path.tollsByOwner).reduce((sum, n) => sum + n * RULES.toll, 0)
      const prestige = amount * (path.routeIds.length >= RULES.longHaulLinks ? 2 : 1)
      best = Math.max(best, (revenue - tolls) / RULES.moneyPerPrestige + prestige)
    }
  }
  // Only the part above the building value counts, and only half of it (it's still a choice to be made).
  return Math.max(0, best - Math.min(amount, 3) * 0.8) * 0.5
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
 * Rough worth of one unit of these goods from this town. Connected markets
 * count in full; markets still some links away count less for each missing
 * link, so every link toward a buyer adds value.
 */
function goodsValue(state: GameState, owner: number, townId: string, goods: GoodsKind, moneyValue: number): number {
  const markets = marketsFor(state, goods)
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
      // Tolls are paid once per shipment; spread them over a typical load of 2.
      best = Math.max(best, (market.price - fee) * moneyValue + prestige - tolls * RULES.toll * moneyValue * 0.5)
    } else {
      best = Math.max(best, ((market.price - fee) * moneyValue + 2) * 0.7 ** gap)
    }
  }
  return best
}
