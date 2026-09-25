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
 * - Mills make goods; ship them over built links (anyone's) to a market town
 *   for money and +1 prestige per goods (doubled over 2+ links).
 *   Using another player's link costs a toll, paid to its owner.
 * - At the end of each round industries produce and everyone gets income.
 * - After the last round: +1 prestige per £5, +2 per market in your network.
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
  /** Goods a mill can hold before its output is wasted. */
  millCapacity: 3,
  /** Money every player collects at the end of each round (£). */
  baseIncome: 2,
  /** Money from the Raise funds action (£). */
  raiseFunds: 3,
  /** Toll per opponent-owned link used when shipping (£). */
  toll: 1,
  /** Shipping earns +1 prestige per goods, doubled when goods travel at least this many links. */
  longHaulLinks: 2,
  /** Each sale lowers a market's price by this much, down to the floor. */
  priceDropPerGoods: 1,
  priceFloor: 1,
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
  /** Letter used in map data plot codes. */
  code: string
  cost: Cost
  /** Prestige gained when built. */
  prestige: number
  /** Short description of what it does each round. */
  output: string
}

export const INDUSTRIES: Record<IndustryKind, IndustryDef> = {
  colliery: {
    kind: 'colliery',
    name: 'Colliery',
    code: 'C',
    cost: { money: 5, coal: 0, iron: 0 },
    prestige: 1,
    output: '+1 coal each round',
  },
  ironworks: {
    kind: 'ironworks',
    name: 'Ironworks',
    code: 'I',
    cost: { money: 7, coal: 1, iron: 0 },
    prestige: 2,
    output: '+1 iron each round',
  },
  mill: {
    kind: 'mill',
    name: 'Mill',
    code: 'M',
    cost: { money: 6, coal: 0, iron: 1 },
    prestige: 2,
    output: '+1 goods each round (holds 3)',
  },
  works: {
    kind: 'works',
    name: 'Engine Works',
    code: 'W',
    cost: { money: 12, coal: 1, iron: 2 },
    prestige: 5,
    output: '+1 prestige each round',
  },
}

export const INDUSTRY_ORDER: readonly IndustryKind[] = ['colliery', 'ironworks', 'mill', 'works']

export const LINK_COST: Record<RouteKind, Cost> = {
  canal: { money: 3, coal: 0, iron: 0 },
  rail: { money: 5, coal: 1, iron: 0 },
}

/** Names for computer players, in seat order. */
export const AI_NAMES = ['Ada Whitlow', 'Silas Crane', 'Martha Penrose', 'Josiah Hale', 'Edith Marlowe']

/** Oldest log entries are dropped beyond this many. */
export const MAX_LOG_ENTRIES = 80
