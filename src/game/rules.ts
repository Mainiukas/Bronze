/**
 * The rules of Bronze, as numbers. Tweak balance here.
 *
 * Summary (the How to Play dialog explains the same in plain words):
 * - Each round, every player takes a turn of RULES.actionsPerTurn actions.
 * - Actions: build an industry, build a link, ship goods, raise funds.
 * - Your network is every town where you own an industry or that one of your
 *   links touches. You build industries in your network and links that touch
 *   it; your very first build can go anywhere.
 * - Coal and iron you don't have are bought automatically at fixed prices.
 * - Goods industries make goods; ship them over built links (anyone's) to a
 *   market that buys them, for money and +1 prestige per goods (doubled over
 *   2+ links). Using another player's link costs a toll, paid to its owner.
 * - Boards with eras start in the canal era and switch to the rail era half
 *   way through. Only routes of the current era's kind can be built.
 * - At the end of each round industries produce and everyone gets income.
 * - After the last round: +1 prestige per £5, +2 per market town in your network.
 */

import type { IndustryKind, RouteKind } from './types'

export const RULES = {
  actionsPerTurn: 2,
  /** Price when coal or iron is bought automatically for a build (£). */
  coalPrice: 3,
  ironPrice: 5,
  /** Most coal or iron a player can store; extra output is sold instead. */
  storeCap: 5,
  coalOverflowValue: 1,
  ironOverflowValue: 2,
  /** Goods an industry can hold before its output is wasted. */
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
  /** Ports buy any goods at this fixed price (£ per goods). */
  portPrice: 3,
  /** Paid to a port's owner, per goods, when someone else sells there (£). */
  portFee: 1,
  /** Prestige per link built. */
  linkPrestige: 1,
  /** End of game: prestige per market town in your network. */
  marketBonus: 2,
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
  /** What its goods are called, for industries that make goods. */
  goodsName?: string
  cost: Cost
  /** Prestige gained when built. */
  prestige: number
  /** What it does at the end of each round. */
  yields: 'coal' | 'iron' | 'goods' | 'money' | 'prestige'
  /** Ports: a market for any goods. */
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
    output: '+1 coal each round',
  },
  iron: {
    kind: 'iron',
    name: 'Iron works',
    cost: { money: 7, coal: 1, iron: 0 },
    prestige: 2,
    yields: 'iron',
    output: '+1 iron each round',
  },
  cotton: {
    kind: 'cotton',
    name: 'Cotton mill',
    goodsName: 'cotton',
    cost: { money: 6, coal: 0, iron: 1 },
    prestige: 2,
    yields: 'goods',
    output: '+1 cotton each round (holds 3)',
  },
  port: {
    kind: 'port',
    name: 'Port',
    cost: { money: 7, coal: 0, iron: 0 },
    prestige: 2,
    yields: 'money',
    market: true,
    output: `+£1 each round. Buys any goods for £${RULES.portPrice}; others pay you £${RULES.portFee} per goods`,
  },
  shipyard: {
    kind: 'shipyard',
    name: 'Shipyard',
    cost: { money: 14, coal: 1, iron: 2 },
    prestige: 6,
    yields: 'prestige',
    output: '+1 prestige each round',
  },
}

/** Display order. Each board only offers the industries its plots allow. */
export const INDUSTRY_ORDER: readonly IndustryKind[] = ['cotton', 'port', 'shipyard', 'iron', 'coal']

export const LINK_COST: Record<RouteKind, Cost> = {
  canal: { money: 3, coal: 0, iron: 0 },
  rail: { money: 5, coal: 1, iron: 0 },
}

/** Names for computer players, in seat order. */
export const AI_NAMES = ['Ada Whitlow', 'Silas Crane', 'Martha Penrose', 'Josiah Hale', 'Edith Marlowe']

/** Oldest log entries are dropped beyond this many. */
export const MAX_LOG_ENTRIES = 80
