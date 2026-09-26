/**
 * The rules of Bronze, as numbers. Tweak balance here.
 *
 * Summary (the Rules screen explains the same in plain words, from these numbers):
 * - Each round, every player takes a turn of RULES.actionsPerTurn actions:
 *   build an industry, build a link, ship, raise funds (or end the turn early).
 * - Your network is every town where you own an industry plus both ends of
 *   every link you own. You build in and next to it; until your first build
 *   (and again if your network is ever wiped out) you may build anywhere.
 * - Coal and iron you don't have are bought automatically at fixed prices.
 * - Ship cotton from a mill, or the coal or iron in your store, over built
 *   links (anyone's) to a hub that buys it (cotton also to any port): money,
 *   +1★ per unit, doubled over 2+ links. Opponents' links cost a toll.
 * - Boards with eras start in the canal era and switch to the rail era half
 *   way through; the canals then come off the board.
 * - At the end of each round industries produce and everyone gets income.
 * - After the last round: +1★ per £5, +2★ per hub in your network.
 */

import type { GoodsKind, IndustryKind, RouteKind } from './types'

export const RULES = {
  actionsPerTurn: 2,
  /** Price when coal or iron is bought automatically for a build (£). */
  coalPrice: 3,
  ironPrice: 5,
  /** Most coal or iron a player can store; extra output is sold instead. */
  storeCap: 5,
  coalOverflowValue: 1,
  ironOverflowValue: 2,
  /** Cotton a mill can hold; more output is lost. */
  goodsCapacity: 3,
  /** Money every player collects at the end of each round (£). */
  baseIncome: 2,
  /** Money from the Raise funds action (£). */
  raiseFunds: 3,
  /** Toll per opponent-owned link used when shipping (£). */
  toll: 1,
  /** Shipping earns +1 prestige per goods, doubled when goods travel at least this many links. */
  longHaulLinks: 2,
  /** Each sale lowers a market town's price by this much, down to the floor. */
  priceDropPerGoods: 1,
  priceFloor: 1,
  /** Ports buy cotton at this fixed price (£ per unit). */
  portPrice: 3,
  /** Paid to a port's owner, per unit, when someone else sells there (£). */
  portFee: 1,
  /** What ports buy. */
  portBuys: 'cotton' as GoodsKind,
  /** Hub prices recover this much at the end of each round, up to their starting price. */
  priceRecovery: 1,
  /** Money a port pays its owner each round (£). */
  portIncome: 1,
  /** Prestige per link built. */
  linkPrestige: 1,
  /** End of game: prestige per hub in your network. */
  hubBonus: 2,
  /** End of game: £ needed per bonus prestige. */
  moneyPerPrestige: 5,
} as const

export interface Cost {
  money: number
  coal: number
  iron: number
}

export interface IndustryDef {
  kind: IndustryKind
  name: string
  cost: Cost
  /** Prestige gained when built. */
  prestige: number
  /** What it does at the end of each round. */
  yields: 'coal' | 'iron' | 'goods' | 'money' | 'prestige'
  /**
   * What shipping from it sells: cotton waiting at the mill, or the coal or
   * iron in the owner's store (mines and iron works).
   */
  ships?: GoodsKind
  /** Ports: a market for cotton. */
  market?: boolean
  /** Short description of what it does. */
  output: string
}

export const INDUSTRIES: Record<IndustryKind, IndustryDef> = {
  coal: {
    kind: 'coal',
    name: 'Coal mine',
    cost: { money: 5, coal: 0, iron: 0 },
    prestige: 1,
    yields: 'coal',
    ships: 'coal',
    output: `+1 coal to your store each round (up to ${RULES.storeCap}; extra sold for £${RULES.coalOverflowValue})`,
  },
  iron: {
    kind: 'iron',
    name: 'Iron works',
    cost: { money: 7, coal: 1, iron: 0 },
    prestige: 2,
    yields: 'iron',
    ships: 'iron',
    output: `+1 iron to your store each round (up to ${RULES.storeCap}; extra sold for £${RULES.ironOverflowValue})`,
  },
  cotton: {
    kind: 'cotton',
    name: 'Cotton mill',
    cost: { money: 6, coal: 0, iron: 1 },
    prestige: 2,
    yields: 'goods',
    ships: 'cotton',
    output: `+1 cotton on the mill each round (holds ${RULES.goodsCapacity})`,
  },
  port: {
    kind: 'port',
    name: 'Port',
    cost: { money: 7, coal: 0, iron: 0 },
    prestige: 2,
    yields: 'money',
    market: true,
    output: `+£${RULES.portIncome} each round. Buys cotton at £${RULES.portPrice}; others pay you £${RULES.portFee} per unit`,
  },
  shipyard: {
    kind: 'shipyard',
    name: 'Shipyard',
    cost: { money: 14, coal: 1, iron: 2 },
    prestige: 6,
    yields: 'prestige',
    output: '+1★ each round',
  },
}

/** Display order. Each board only offers the industries its plots allow. */
export const INDUSTRY_ORDER: readonly IndustryKind[] = ['cotton', 'port', 'shipyard', 'iron', 'coal']

export const LINK_COST: Record<RouteKind, Cost> = {
  canal: { money: 3, coal: 0, iron: 0 },
  rail: { money: 5, coal: 1, iron: 0 },
}

export const GOODS_NAMES: Record<GoodsKind, string> = { cotton: 'cotton', coal: 'coal', iron: 'iron' }

/** Names for computer players, in seat order. */
export const AI_NAMES = ['Ada Whitlow', 'Silas Crane', 'Martha Penrose', 'Josiah Hale', 'Edith Marlowe']

/** Oldest log entries are dropped beyond this many. */
export const MAX_LOG_ENTRIES = 80
