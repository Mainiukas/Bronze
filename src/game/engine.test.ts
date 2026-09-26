import { describe, expect, it } from 'vitest'
import { GAME_MODES } from '../data/gameModes'
import { MAPS } from '../data/maps'
import { chooseAIAction } from './ai'
import {
  applyAction,
  boardFor,
  buildTargets,
  createGame,
  currentPlayerId,
  IllegalActionError,
  legalActions,
  linkTargets,
  networkTowns,
  quote,
  shipQuotes,
} from './engine'
import { RULES } from './rules'
import type { GameState, SeatSetup } from './types'

const seats = (n: number, isAI = false): SeatSetup[] =>
  Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, isAI }))

const newGame = (players = 2) => createGame({ mapId: 'mersey-valley', modeId: 'normal', seats: seats(players), seed: 7 })

describe('boards', () => {
  for (const map of MAPS) {
    for (const mode of GAME_MODES) {
      it(`${map.name} / ${mode.name} is connected and has markets`, () => {
        const board = boardFor(map.id, mode.mapSize)
        expect(board.towns.filter((t) => t.market !== null).length).toBeGreaterThanOrEqual(2)
        // Every town reachable from the first over the route graph.
        const seen = new Set([board.towns[0].id])
        for (let grew = true; grew; ) {
          grew = false
          for (const r of board.routes) {
            if (seen.has(r.from) !== seen.has(r.to)) {
              seen.add(r.from)
              seen.add(r.to)
              grew = true
            }
          }
        }
        expect(seen.size).toBe(board.towns.length)
      })
    }
  }

  it('smaller modes use fewer towns', () => {
    for (const map of MAPS) {
      const sizes = (['full', 'reduced', 'compact'] as const).map((size) => boardFor(map.id, size).towns.length)
      expect(sizes[0]).toBeGreaterThan(sizes[1])
      expect(sizes[1]).toBeGreaterThan(sizes[2])
    }
  })
})

describe('building', () => {
  it('lets the first build go anywhere, then only in your network', () => {
    let g = newGame()
    expect(buildTargets(g, 'cotton').length).toBeGreaterThan(3)
    g = applyAction(g, { type: 'build', kind: 'coal', townId: 'lowford', slot: 0 })
    const targets = buildTargets(g, 'cotton')
    expect(targets.every((plot) => plot.townId === 'lowford')).toBe(true)
    expect(() => applyAction(g, { type: 'build', kind: 'cotton', townId: 'saltport', slot: 0 })).toThrow(
      IllegalActionError,
    )
  })

  it('buys missing coal and iron automatically', () => {
    const g = newGame()
    const player = g.players[0]
    expect(quote(player, { money: 6, coal: 0, iron: 1 }).total).toBe(6 + RULES.ironPrice)
    const after = applyAction(g, { type: 'build', kind: 'cotton', townId: 'lowford', slot: 1 })
    expect(after.players[0].money).toBe(player.money - 6 - RULES.ironPrice)
    expect(after.players[0].prestige).toBe(2)
  })

  it('uses stock before buying', () => {
    const g = newGame()
    g.players[0].iron = 1
    const after = applyAction(g, { type: 'build', kind: 'cotton', townId: 'lowford', slot: 1 })
    expect(after.players[0].iron).toBe(0)
    expect(after.players[0].money).toBe(g.players[0].money - 6)
  })

  it('rejects a plot that does not allow the industry or is taken', () => {
    let g = newGame()
    expect(() => applyAction(g, { type: 'build', kind: 'cotton', townId: 'lowford', slot: 0 })).toThrow()
    g = applyAction(g, { type: 'build', kind: 'coal', townId: 'lowford', slot: 0 })
    g = applyAction(g, { type: 'raiseFunds' })
    // Player 2 can't take the same plot.
    expect(() => applyAction(g, { type: 'build', kind: 'coal', townId: 'lowford', slot: 0 })).toThrow()
  })
})

describe('links', () => {
  it('must touch your network and add prestige', () => {
    let g = newGame()
    g = applyAction(g, { type: 'build', kind: 'coal', townId: 'lowford', slot: 0 })
    const reachable = linkTargets(g).map((r) => r.id)
    expect(reachable.every((id) => id.includes('lowford'))).toBe(true)
    g = applyAction(g, { type: 'link', routeId: 'saltport~lowford' })
    expect(g.links['saltport~lowford']).toEqual({ owner: 0, kind: 'canal' })
    expect(g.players[0].prestige).toBe(1 + RULES.linkPrestige)
    expect(networkTowns(g, 0).has('saltport')).toBe(true)
  })

  it('charges coal for railways', () => {
    const g = newGame()
    const after = applyAction(g, { type: 'link', routeId: 'lowford~weirside' })
    expect(after.players[0].money).toBe(g.players[0].money - 5 - RULES.coalPrice)
  })
})

describe('shipping', () => {
  /** P1 owns a cotton mill with 2 goods in Lowford; P2 owns the canal to Saltport. */
  function shippingSetup(): GameState {
    const g = newGame()
    g.buildings.push({ id: 900, kind: 'cotton', owner: 0, townId: 'lowford', slot: 1, goods: 2 })
    g.links['saltport~lowford'] = { owner: 1, kind: 'canal' }
    return g
  }

  it('pays falling prices, distance prestige and tolls', () => {
    const g = shippingSetup()
    const q = shipQuotes(g, 900).find((option) => option.marketId === 'saltport')!
    expect(q.revenue).toBe(6 + 5)
    expect(q.tollTotal).toBe(RULES.toll)
    // One link: not a long haul, so +1★ per goods.
    expect(q.prestige).toBe(2)
    const after = applyAction(g, { type: 'ship', buildingId: 900, marketId: 'saltport' })
    expect(after.players[0].money).toBe(g.players[0].money + 11 - RULES.toll)
    expect(after.players[1].money).toBe(g.players[1].money + RULES.toll)
    expect(after.players[0].prestige).toBe(2)
    expect(after.prices.saltport).toBe(4)
    expect(after.buildings.find((b) => b.id === 900)!.goods).toBe(0)
  })

  it('doubles prestige over two or more links', () => {
    const g = shippingSetup()
    g.links['ferrybridge~kingsferry'] = { owner: 0, kind: 'rail' }
    g.links['saltport~ferrybridge'] = { owner: 0, kind: 'canal' }
    const q = shipQuotes(g, 900).find((option) => option.marketId === 'kingsferry')!
    expect(q.routeIds).toHaveLength(3)
    expect(q.prestige).toBe(2 * 2)
  })

  it('cannot reach markets without built links', () => {
    const g = newGame()
    g.buildings.push({ id: 900, kind: 'cotton', owner: 0, townId: 'lowford', slot: 1, goods: 1 })
    expect(shipQuotes(g, 900)).toEqual([])
  })

  it('can sell in its own market town without links', () => {
    const g = newGame()
    g.buildings.push({ id: 900, kind: 'cotton', owner: 0, townId: 'saltport', slot: 0, goods: 1 })
    const q = shipQuotes(g, 900)
    expect(q.map((option) => option.marketId)).toEqual(['saltport'])
    expect(q[0].prestige).toBe(1)
  })
})

describe('rounds', () => {
  it('passes the turn after two actions and rotates the start player', () => {
    let g = newGame(3)
    expect(currentPlayerId(g)).toBe(0)
    g = applyAction(g, { type: 'raiseFunds' })
    expect(currentPlayerId(g)).toBe(0)
    g = applyAction(g, { type: 'raiseFunds' })
    expect(currentPlayerId(g)).toBe(1)
    g = applyAction(g, { type: 'endTurn' })
    g = applyAction(g, { type: 'endTurn' })
    expect(g.round).toBe(2)
    expect(g.turnOrder).toEqual([1, 2, 0])
  })

  it('produces at the end of each round', () => {
    let g = newGame()
    g.buildings.push(
      { id: 901, kind: 'coal', owner: 0, townId: 'lowford', slot: 0, goods: 0 },
      { id: 902, kind: 'cotton', owner: 0, townId: 'lowford', slot: 1, goods: 3 },
      { id: 903, kind: 'shipyard', owner: 1, townId: 'saltport', slot: 1, goods: 0 },
    )
    g.players[0].coal = RULES.storeCap
    g.prices.saltport = 2
    const money = g.players.map((p) => p.money)
    g = applyAction(g, { type: 'endTurn' })
    g = applyAction(g, { type: 'endTurn' })
    expect(g.players[0].coal).toBe(RULES.storeCap)
    expect(g.players[0].money).toBe(money[0] + RULES.baseIncome + RULES.coalOverflowValue)
    expect(g.buildings.find((b) => b.id === 902)!.goods).toBe(RULES.goodsCapacity)
    expect(g.players[1].prestige).toBe(1)
    expect(g.prices.saltport).toBe(3)
  })

  it('finishes after the last round with ranked scores', () => {
    let g = createGame({ mapId: 'pennine-mills', modeId: 'bullet', seats: seats(2), seed: 1 })
    g.buildings.push({ id: 900, kind: 'cotton', owner: 1, townId: 'millbrook', slot: 0, goods: 0 })
    while (g.status === 'playing') g = applyAction(g, { type: 'endTurn' })
    expect(g.round).toBe(g.totalRounds)
    expect(g.scores).not.toBeNull()
    const [first, second] = g.scores!
    expect(first.player).toBe(1)
    expect(first.marketBonus).toBe(RULES.marketBonus)
    expect(first.rank).toBe(1)
    expect(second.rank).toBe(2)
    expect(() => applyAction(g, { type: 'raiseFunds' })).toThrow()
  })
})

describe('computer players', () => {
  for (const map of MAPS) {
    for (const mode of GAME_MODES) {
      for (let players = map.players.min; players <= map.players.max; players++) {
        it(`finish a ${players}-player ${mode.name} match on ${map.name}`, () => {
          let g = createGame({ mapId: map.id, modeId: mode.id, seats: seats(players, true), seed: players * 31 })
          let steps = 0
          while (g.status === 'playing') {
            const action = chooseAIAction(g)
            expect(legalActions(g)).toContainEqual(action)
            g = applyAction(g, action)
            steps++
            expect(steps).toBeLessThan(mode.rounds * players * RULES.actionsPerTurn + 1)
          }
          for (const p of g.players) expect(p.money).toBeGreaterThanOrEqual(0)
          const plots = g.buildings.map((b) => `${b.townId}#${b.slot}`)
          expect(new Set(plots).size).toBe(plots.length)
          expect(g.scores).toHaveLength(players)
          // Computer players should actually develop the board.
          expect(g.buildings.length).toBeGreaterThan(players)
          expect(g.players.some((p) => p.goodsShipped > 0)).toBe(true)
          if (import.meta.env.SIM) {
            console.log(
              `${map.id} ${mode.id} ${players}p:`,
              g.scores!.map((s) => `${s.total}(${s.prestige}+${s.moneyBonus}+${s.marketBonus})`).join(' '),
              `| builds ${g.buildings.length}, links ${Object.keys(g.links).length}, shipped ${g.players.map((p) => p.goodsShipped).join('/')}`,
            )
          }
        })
      }
    }
  }
})
