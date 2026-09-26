import { describe, expect, it } from 'vitest'
import {
  applyAction,
  boardFor,
  buildTargets,
  createGame,
  findPath,
  legalActions,
  linkTargets,
  networkMarkets,
  networkTowns,
  scoreFor,
  shipQuotes,
} from './engine'
import { RULES } from './rules'
import type { GameState, SeatSetup } from './types'

/** Rules specific to the painted board: eras, stops, hubs, ports, shipyards. */

const seats = (n: number): SeatSetup[] => Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, isAI: false }))
const newGame = (players = 2, modeId: 'normal' | 'blitz' | 'bullet' = 'normal') =>
  createGame({ mapId: 'wales-and-the-west', modeId, seats: seats(players), seed: 5 })

/** Pass turns until the given round starts. */
function skipTo(game: GameState, round: number): GameState {
  let g = game
  while (g.round < round) g = applyAction(g, { type: 'endTurn' })
  return g
}

describe('board sizes', () => {
  it('uses more of the map in longer modes', () => {
    expect(boardFor('wales-and-the-west', 'compact').towns).toHaveLength(13)
    expect(boardFor('wales-and-the-west', 'reduced').towns).toHaveLength(18)
    expect(boardFor('wales-and-the-west', 'full').towns).toHaveLength(25)
  })

  it('keeps stops unbuildable and hubs as markets for their listed goods', () => {
    const board = boardFor('wales-and-the-west', 'full')
    const brecon = board.towns.find((t) => t.id === 'brecon')!
    expect(brecon.kind).toBe('stop')
    expect(brecon.slots).toEqual([])
    const london = board.towns.find((t) => t.id === 'london')!
    expect(london.market).toEqual({ price: 7, buys: ['manufacturer', 'pottery'] })
  })
})

describe('eras', () => {
  it('starts in the canal era and switches half way', () => {
    const g = newGame()
    expect(g.era).toBe('canal')
    expect(g.railEraRound).toBe(6)
    const later = skipTo(g, 6)
    expect(later.era).toBe('rail')
    expect(later.log.some((e) => /rail era begins/.test(e.text))).toBe(true)
  })

  it('only offers routes of the current era', () => {
    const g = newGame()
    const kinds = (game: GameState) =>
      new Set(linkTargets(game).flatMap((r) => game.board.routes.find((x) => x.id === r.id)!.kinds))
    expect(linkTargets(g).every((r) => r.kinds.includes('canal'))).toBe(true)
    expect(() => applyAction(g, { type: 'link', routeId: 'the_north-derby' })).toThrow(/canal era/)
    const rail = skipTo(g, 6)
    expect(linkTargets(rail).every((r) => r.kinds.includes('rail'))).toBe(true)
    expect(kinds(rail).has('rail')).toBe(true)
    expect(() => applyAction(rail, { type: 'link', routeId: 'stoke-derby' })).toThrow(/rail era/)
  })

  it('builds a dual route as the era’s kind, and old canals keep carrying goods', () => {
    let g = newGame()
    g = applyAction(g, { type: 'link', routeId: 'gloucester-bristol' })
    expect(g.links['gloucester-bristol']).toEqual({ owner: 0, kind: 'canal' })
    g = skipTo(g, 6)
    expect(findPath(g, 1, 'gloucester', 'bristol')?.routeIds).toEqual(['gloucester-bristol'])
    const player = g.turnOrder[g.turnIndex]
    g = applyAction(g, { type: 'link', routeId: 'bristol-swindon' })
    expect(g.links['bristol-swindon']).toEqual({ owner: player, kind: 'rail' })
    // Railways cost coal, bought automatically.
    expect(g.players[player].money).toBe(newGame().players[player].money + 5 * RULES.baseIncome - 5 - RULES.coalPrice)
  })

  it('never offers an out-of-era link as a legal action', () => {
    const g = newGame()
    const railOnly = new Set(g.board.routes.filter((r) => !r.kinds.includes('canal')).map((r) => r.id))
    expect(legalActions(g).some((a) => a.type === 'link' && railOnly.has(a.routeId))).toBe(false)
  })
})

describe('stops and hubs', () => {
  it('lets links reach through stops', () => {
    let g = newGame()
    g = applyAction(g, { type: 'link', routeId: 'stoke-lichfield' })
    expect(networkTowns(g, 0).has('lichfield')).toBe(true)
    expect(buildTargets(g, 'coal').some((p) => p.townId === 'lichfield')).toBe(false)
  })

  it('sells only the goods a hub buys, and scores hubs in your network', () => {
    const g = newGame()
    g.buildings.push({ id: 900, kind: 'cotton', owner: 0, townId: 'birmingham', slot: 2, goods: 2 })
    g.links['lichfield-birmingham'] = { owner: 0, kind: 'canal' }
    g.links['stoke-lichfield'] = { owner: 1, kind: 'canal' }
    g.links['the_north-stoke'] = { owner: 0, kind: 'canal' }
    g.links['birmingham-oxford'] = { owner: 0, kind: 'canal' }
    g.links['oxford-reading'] = { owner: 0, kind: 'canal' }
    g.links['reading-london'] = { owner: 0, kind: 'canal' }
    const quotes = shipQuotes(g, 900)
    // London is connected but doesn't buy cotton.
    expect(quotes.map((q) => q.marketId)).toEqual(['the_north'])
    const [q] = quotes
    expect(q.revenue).toBe(6 + 5)
    expect(q.tollTotal).toBe(RULES.toll)
    expect(q.prestige).toBe(2 * 2)
    const after = applyAction(g, { type: 'ship', buildingId: 900, marketId: 'the_north' })
    expect(after.players[0].money).toBe(g.players[0].money + 11 - RULES.toll)
    expect(after.players[1].money).toBe(g.players[1].money + RULES.toll)
    expect(after.prices.the_north).toBe(4)
    expect(networkMarkets(after, 0).sort()).toEqual(['london', 'the_north'])
    expect(scoreFor(after, 0).marketBonus).toBe(2 * RULES.marketBonus)
  })
})

describe('ports and shipyards', () => {
  /** P2 owns Bristol's port; P1 has a cotton mill in Gloucester linked to Bristol. */
  function portSetup(): GameState {
    const g = newGame()
    g.buildings.push(
      { id: 900, kind: 'port', owner: 1, townId: 'bristol', slot: 0, goods: 0 },
      { id: 901, kind: 'cotton', owner: 0, townId: 'gloucester', slot: 1, goods: 2 },
    )
    g.links['gloucester-bristol'] = { owner: 0, kind: 'canal' }
    return g
  }

  it('buys any goods at a fixed price and pays the owner a fee', () => {
    const g = portSetup()
    const q = shipQuotes(g, 901).find((option) => option.marketId === 'port:900')!
    expect(q.revenue).toBe(2 * RULES.portPrice)
    expect(q.fee).toBe(2 * RULES.portFee)
    expect(q.feeOwner).toBe(1)
    const after = applyAction(g, { type: 'ship', buildingId: 901, marketId: 'port:900' })
    expect(after.players[0].money).toBe(g.players[0].money + 2 * RULES.portPrice - 2 * RULES.portFee)
    expect(after.players[1].money).toBe(g.players[1].money + 2 * RULES.portFee)
    expect(after.log.at(-1)!.text).toMatch(/Bristol port/)
  })

  it('charges no fee at your own port and pays £1 a round', () => {
    const g = portSetup()
    g.buildings[0].owner = 0
    expect(shipQuotes(g, 901).find((q) => q.marketId === 'port:900')!.fee).toBe(0)
    const next = skipTo(g, 2)
    expect(next.players[0].money).toBe(g.players[0].money + RULES.baseIncome + 1)
  })

  it('needs a port in town before a shipyard', () => {
    let g = newGame()
    expect(buildTargets(g, 'shipyard')).toEqual([])
    g = applyAction(g, { type: 'build', kind: 'port', townId: 'bristol', slot: 0 })
    g = applyAction(g, { type: 'raiseFunds' })
    // Player 2 (empty network) can now build the shipyard in Bristol.
    expect(buildTargets(g, 'shipyard')).toEqual([{ townId: 'bristol', slot: 1 }])
    expect(() => applyAction(g, { type: 'build', kind: 'shipyard', townId: 'southampton', slot: 1 })).toThrow(/needs a Port/)
  })
})
