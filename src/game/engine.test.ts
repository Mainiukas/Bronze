import { describe, expect, it } from 'vitest'
import { BOARD } from '../data/board'
import { GAME_MODES } from '../data/gameModes'
import { MAPS } from '../data/maps'
import {
  applyAction,
  boardFor,
  buildBlocker,
  buildsAnywhere,
  buildTargets,
  createGame,
  currentPlayerId,
  findPath,
  IllegalActionError,
  legalActions,
  linkBlocker,
  linkTargets,
  networkHubs,
  networkTowns,
  quote,
  readSavedGame,
  scoreFor,
  shipBlocker,
  shipOptions,
  shipQuotes,
} from './engine'
import { INDUSTRIES, RULES } from './rules'
import { GAME_VERSION, type Building, type GameState, type IndustryKind, type RouteKind, type SeatSetup } from './types'

/* ---- Helpers ---------------------------------------------------------------- */

const seats = (n: number): SeatSetup[] => Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, isAI: false }))
const newGame = (players = 2, modeId: 'normal' | 'blitz' | 'bullet' = 'normal') =>
  createGame({ mapId: 'wales-and-the-west', modeId, seats: seats(players), seed: 5 })

/** A copy of the game with a change made directly (to set up a position). */
function edit(game: GameState, change: (s: GameState) => void): GameState {
  const s = structuredClone(game)
  change(s)
  return s
}

/** Put an industry on the board for a player. */
function place(s: GameState, owner: number, kind: IndustryKind, townId: string, slot: number, goods = 0): Building {
  const building = { id: s.nextId++, kind, owner, townId, slot, goods }
  s.buildings.push(building)
  s.players[owner].hasBuilt = true
  return building
}

/** Give a player a built link. */
function own(s: GameState, owner: number, routeId: string, kind: RouteKind = s.era ?? 'canal') {
  s.links[routeId] = { owner, kind }
  s.players[owner].hasBuilt = true
}

/** Pass turns until the given round starts (or the match ends). */
function skipTo(game: GameState, round: number): GameState {
  let g = game
  while (g.round < round && g.status === 'playing') g = applyAction(g, { type: 'endTurn' })
  return g
}

const expectIllegal = (fn: () => unknown, message: RegExp) => {
  expect(fn).toThrow(IllegalActionError)
  expect(fn).toThrow(message)
}

/* ---- Setup and modes -------------------------------------------------------- */

describe('setup', () => {
  it('starts everyone with the mode’s money, empty stores, no ★ and hasBuilt false', () => {
    for (const mode of GAME_MODES) {
      const g = createGame({ mapId: 'wales-and-the-west', modeId: mode.id, seats: seats(4), seed: 1 })
      expect(g.totalRounds).toBe(mode.rounds)
      expect(g.era).toBe('canal')
      expect(g.railEraRound).toBe(Math.floor(mode.rounds / 2) + 1)
      for (const p of g.players) {
        expect(p).toMatchObject({ money: mode.startingMoney, coal: 0, iron: 0, prestige: 0, hasBuilt: false })
      }
      expect(g.prices).toEqual({ ...(mode.mapSize === 'compact' ? {} : { west_wales: 5 }), the_north: 6, london: 7 })
    }
    expect([10, 7, 5].map((r) => Math.floor(r / 2) + 1)).toEqual([6, 4, 3])
  })

  it('gives every player a different colour, defaulting to the first free ones', () => {
    const g = createGame({ mapId: 'wales-and-the-west', modeId: 'normal', seats: [{ name: 'A', isAI: false, color: 'blue' }, ...seats(2)], seed: 1 })
    expect(g.players.map((p) => p.color)).toEqual(['blue', 'yellow', 'purple'])
    expect(() =>
      createGame({ mapId: 'wales-and-the-west', modeId: 'normal', seats: [{ name: 'A', isAI: false, color: 'red' }, { name: 'B', isAI: true, color: 'red' }], seed: 1 }),
    ).toThrow(/different colour/)
  })

  it('takes 2–4 players, with an AI level for computer players', () => {
    expect(() => newGame(1)).toThrow(/2 to 4/)
    expect(() => newGame(5)).toThrow(/2 to 4/)
    const g = createGame({ mapId: 'wales-and-the-west', modeId: 'normal', seats: [{ name: 'A', isAI: false }, { name: 'B', isAI: true, aiLevel: 'hard' }, { name: 'C', isAI: true }], seed: 1 })
    expect(g.players.map((p) => p.aiLevel)).toEqual([null, 'hard', 'normal'])
  })

  it('cuts the map to the mode’s rings, and keeps only links between included locations', () => {
    for (const [size, maxRing, count] of [['compact', 1, 13], ['reduced', 2, 20], ['full', 3, 25]] as const) {
      const board = boardFor('wales-and-the-west', size)
      const expected = BOARD.locations.filter((l) => (l.ring ?? 1) <= maxRing).map((l) => l.id)
      expect(board.towns.map((t) => t.id)).toEqual(expected)
      expect(board.towns).toHaveLength(count)
      const ids = new Set(expected)
      for (const r of board.routes) expect(ids.has(r.from) && ids.has(r.to)).toBe(true)
      const inData = BOARD.links.filter((l) => ids.has(l.from) && ids.has(l.to))
      expect(board.routes).toHaveLength(inData.length)
    }
  })

  it('makes hubs markets for cotton, coal and iron as listed, and stops unbuildable', () => {
    const board = boardFor('wales-and-the-west', 'full')
    const town = (id: string) => board.towns.find((t) => t.id === id)!
    expect(town('london').market).toEqual({ price: 7, buys: ['cotton', 'coal', 'iron'] })
    expect(town('the_north').market).toEqual({ price: 6, buys: ['cotton', 'coal'] })
    expect(town('west_wales').market).toEqual({ price: 5, buys: ['cotton', 'coal'] })
    for (const id of ['brecon', 'reading', 'taunton']) expect(town(id)).toMatchObject({ kind: 'stop', slots: [], market: null })
    expect(board.towns.filter((t) => t.railOnly).map((t) => t.id)).toEqual(['the_north', 'taunton', 'plymouth'])
  })
})

/* ---- Costs and building ------------------------------------------------------ */

describe('costs', () => {
  it('buys missing coal (£3) and iron (£5) automatically, using the store first', () => {
    const empty = newGame().players[0]
    expect(quote(empty, INDUSTRIES.coal.cost).total).toBe(5)
    expect(quote(empty, INDUSTRIES.iron.cost)).toMatchObject({ total: 10, coalBought: 1 })
    expect(quote(empty, INDUSTRIES.cotton.cost)).toMatchObject({ total: 11, ironBought: 1 })
    expect(quote(empty, INDUSTRIES.port.cost).total).toBe(7)
    expect(quote(empty, INDUSTRIES.shipyard.cost)).toMatchObject({ total: 27, coalBought: 1, ironBought: 2 })
    expect(quote({ ...empty, coal: 3, iron: 1 }, INDUSTRIES.shipyard.cost)).toMatchObject({ total: 19, coalUsed: 1, ironUsed: 1, ironBought: 1 })
  })

  it('pays the total, takes stock and gives the industry’s ★', () => {
    let g = edit(newGame(), (s) => Object.assign(s.players[0], { money: 20, coal: 2 }))
    g = applyAction(g, { type: 'build', kind: 'iron', townId: 'wrexham', slot: 1 })
    expect(g.players[0]).toMatchObject({ money: 13, coal: 1, prestige: INDUSTRIES.iron.prestige, hasBuilt: true })
    expect(g.buildings).toHaveLength(1)
  })

  it('rejects what the player can’t afford', () => {
    const g = edit(newGame(), (s) => (s.players[0].money = 4))
    expectIllegal(() => applyAction(g, { type: 'build', kind: 'coal', townId: 'birmingham', slot: 3 }), /Needs £5/)
    expect(buildBlocker(g, 'coal')).toBe('Needs £5')
  })
})

describe('building industries', () => {
  it('lets the first build go anywhere, then only in the network', () => {
    let g = newGame()
    expect(buildTargets(g, 'coal').length).toBeGreaterThan(5)
    g = applyAction(g, { type: 'build', kind: 'coal', townId: 'birmingham', slot: 3 })
    expect(buildTargets(g, 'cotton')).toEqual([
      { townId: 'birmingham', slot: 0 },
      { townId: 'birmingham', slot: 1 },
      { townId: 'birmingham', slot: 2 },
    ])
    expectIllegal(() => applyAction(g, { type: 'build', kind: 'cotton', townId: 'oxford', slot: 0 }), /isn’t in your network/)
  })

  it('checks the plot: allowed industry, free, a real plot', () => {
    let g = newGame()
    expectIllegal(() => applyAction(g, { type: 'build', kind: 'iron', townId: 'birmingham', slot: 0 }), /can’t be built on that plot/)
    expectIllegal(() => applyAction(g, { type: 'build', kind: 'coal', townId: 'brecon', slot: 0 }), /no building plots/)
    expectIllegal(() => applyAction(g, { type: 'build', kind: 'coal', townId: 'birmingham', slot: 7 }), /no plot 8/)
    g = applyAction(g, { type: 'build', kind: 'coal', townId: 'birmingham', slot: 3 })
    g = applyAction(g, { type: 'endTurn' })
    expectIllegal(() => applyAction(g, { type: 'build', kind: 'coal', townId: 'birmingham', slot: 3 }), /taken/)
  })

  it('keeps rail-only towns closed in the canal era', () => {
    const g = edit(newGame(), (s) => (s.players[0].money = 40))
    expectIllegal(() => applyAction(g, { type: 'build', kind: 'iron', townId: 'plymouth', slot: 0 }), /Plymouth opens in the rail era/)
    expect(buildBlocker(g, 'shipyard')).toBe('Opens in the rail era')
    expect(buildTargets(g, 'iron').some((p) => p.townId === 'plymouth')).toBe(false)
  })
})

describe('building links', () => {
  it('only offers unbuilt routes of the current era touching the network (anywhere before the first build)', () => {
    let g = newGame()
    const kinds = new Set(linkTargets(g).map((r) => r.kinds.join('+')))
    expect(kinds).toEqual(new Set(['canal', 'canal+rail']))
    expect(linkTargets(g)).toHaveLength(22)
    g = applyAction(g, { type: 'build', kind: 'coal', townId: 'lichfield', slot: 0 })
    expect(linkTargets(g).map((r) => r.id).sort()).toEqual(['lichfield-birmingham', 'stoke-lichfield'])
    expectIllegal(() => applyAction(g, { type: 'link', routeId: 'derby-lichfield' }), /doesn’t exist in the canal era/)
    expectIllegal(() => applyAction(g, { type: 'link', routeId: 'oxford-swindon' }), /doesn’t touch your network/)
  })

  it('charges £3 for a canal and £5 + 1 coal for a railway, +1★ each', () => {
    let g = applyAction(newGame(), { type: 'link', routeId: 'lichfield-birmingham' })
    expect(g.players[0]).toMatchObject({ money: 11, prestige: 1, hasBuilt: true, linksBuilt: 1 })
    expect(g.links['lichfield-birmingham']).toEqual({ owner: 0, kind: 'canal' })
    expectIllegal(() => applyAction(g, { type: 'link', routeId: 'lichfield-birmingham' }), /already built/)
    g = skipTo(newGame(), 6)
    g = applyAction(g, { type: 'link', routeId: 'derby-lichfield' })
    expect(g.links['derby-lichfield']).toEqual({ owner: currentPlayerId(skipTo(newGame(), 6)), kind: 'rail' })
  })

  it('says why no link can be built', () => {
    const g = edit(newGame(), (s) => (s.players[0].money = 2))
    expect(linkBlocker(g)).toBe('Needs £3')
  })
})

/* ---- Shipping ---------------------------------------------------------------- */

describe('shipping', () => {
  it('sells cotton at a hub, the price dropping £1 per unit, with double ★ over 2+ links', () => {
    let mill = 0
    let g = edit(newGame(), (s) => {
      mill = place(s, 0, 'cotton', 'birmingham', 0, 3).id
      for (const id of ['birmingham-oxford', 'reading-oxford', 'london-reading']) own(s, 0, id)
    })
    const q = shipQuotes(g, mill).find((o) => o.marketId === 'london')!
    expect(q).toMatchObject({ amount: 3, revenue: 7 + 6 + 5, tollTotal: 0, fee: 0, prestige: 6, routeIds: ['birmingham-oxford', 'reading-oxford', 'london-reading'] })
    g = applyAction(g, { type: 'ship', buildingId: mill, marketId: 'london' })
    expect(g.players[0]).toMatchObject({ money: 14 + 18, prestige: 6, goodsShipped: 3 })
    expect(g.prices.london).toBe(4)
    expect(g.buildings[0].goods).toBe(0)
    expect(g.lastEvent).toMatchObject({ type: 'ship', goods: 'cotton', amount: 3, fromTownId: 'birmingham', marketTownId: 'london' })
  })

  it('never sells below £1 a unit', () => {
    let mill = 0
    const g = edit(newGame(), (s) => {
      mill = place(s, 0, 'cotton', 'birmingham', 0, 3).id
      for (const id of ['birmingham-oxford', 'reading-oxford', 'london-reading']) own(s, 0, id)
      s.prices.london = 2
    })
    expect(shipQuotes(g, mill)[0].revenue).toBe(2 + 1 + 1)
    expect(applyAction(g, { type: 'ship', buildingId: mill, marketId: 'london' }).prices.london).toBe(1)
  })

  it('sells cotton at your own port in the same town, without links, fee or double ★', () => {
    let mill = 0
    let port = 0
    let g = edit(newGame(), (s) => {
      port = place(s, 0, 'port', 'gloucester', 0).id
      mill = place(s, 0, 'cotton', 'gloucester', 1, 2).id
    })
    const q = shipQuotes(g, mill).find((o) => o.marketId === `port:${port}`)!
    expect(q).toMatchObject({ revenue: 6, fee: 0, prestige: 2, routeIds: [] })
    g = applyAction(g, { type: 'ship', buildingId: mill, marketId: `port:${port}` })
    expect(g.players[0]).toMatchObject({ money: 20, prestige: 2 })
  })

  it('pays an opponent £1 per unit to use their port', () => {
    let mill = 0
    let port = 0
    let g = edit(newGame(), (s) => {
      port = place(s, 1, 'port', 'gloucester', 0).id
      mill = place(s, 0, 'cotton', 'gloucester', 1, 3).id
    })
    const q = shipQuotes(g, mill).find((o) => o.marketId === `port:${port}`)!
    expect(q).toMatchObject({ revenue: 9, fee: 3, feeOwner: 1, net: 6 })
    g = applyAction(g, { type: 'ship', buildingId: mill, marketId: `port:${port}` })
    expect(g.players[0].money).toBe(20)
    expect(g.players[1].money).toBe(17)
  })

  it('ships the whole coal store to The North, and iron to London', () => {
    let mine = 0
    let g = edit(skipTo(newGame(), 6), (s) => {
      mine = place(s, 0, 'coal', 'stoke', 0).id
      own(s, 0, 'the_north-stoke', 'rail')
      s.players[0].coal = 4
      s.turnIndex = s.turnOrder.indexOf(0)
    })
    expect(shipQuotes(g, mine).map((q) => q.marketId)).toEqual(['the_north'])
    g = applyAction(g, { type: 'ship', buildingId: mine, marketId: 'the_north' })
    expect(g.players[0]).toMatchObject({ coal: 0, prestige: 4, goodsShipped: 4 })
    expect(g.prices.the_north).toBe(2)

    let works = 0
    g = edit(newGame(), (s) => {
      works = place(s, 0, 'iron', 'swindon', 0).id
      own(s, 0, 'swindon-southampton')
      own(s, 0, 'london-southampton')
      s.players[0].iron = 2
    })
    g = applyAction(g, { type: 'ship', buildingId: works, marketId: 'london' })
    expect(g.players[0]).toMatchObject({ iron: 0, money: 14 + 7 + 6, prestige: 4 })
  })

  it('rejects iron at The North and coal at a port', () => {
    let works = 0
    let mine = 0
    let port = 0
    const g = edit(skipTo(newGame(), 6), (s) => {
      works = place(s, 0, 'iron', 'wolverhampton', 0).id
      mine = place(s, 0, 'coal', 'stoke', 0).id
      port = place(s, 0, 'port', 'gloucester', 0).id
      own(s, 0, 'the_north-stoke', 'rail')
      own(s, 0, 'stoke-wolverhampton', 'rail')
      own(s, 0, 'wolverhampton-gloucester', 'rail')
      Object.assign(s.players[0], { coal: 2, iron: 2 })
      s.turnIndex = s.turnOrder.indexOf(0)
    })
    expectIllegal(() => applyAction(g, { type: 'ship', buildingId: works, marketId: 'the_north' }), /The North doesn’t buy iron/)
    expectIllegal(() => applyAction(g, { type: 'ship', buildingId: mine, marketId: `port:${port}` }), /Ports only buy cotton/)
    expect(shipOptions(g, works).map((q) => q.marketId)).toEqual([])
    expect(shipOptions(g, mine).map((q) => q.marketId)).toEqual(['the_north'])
  })

  it('charges £1 toll per opponent link, paid to its owner, and prefers fewer opponent links over a shorter way', () => {
    let mill = 0
    let g = edit(newGame(3), (s) => {
      mill = place(s, 0, 'cotton', 'birmingham', 0, 2).id
      own(s, 1, 'birmingham-oxford')
      own(s, 2, 'reading-oxford')
      own(s, 0, 'london-reading')
    })
    const q = shipQuotes(g, mill).find((o) => o.marketId === 'london')!
    expect(q).toMatchObject({ tollTotal: 2, tollsByOwner: { 1: 1, 2: 1 }, revenue: 13, net: 11, prestige: 4 })
    g = applyAction(g, { type: 'ship', buildingId: mill, marketId: 'london' })
    expect(g.players.map((p) => p.money)).toEqual([25, 15, 15])

    // Rail era: Birmingham–Gloucester direct is an opponent's; the way round through Wolverhampton is all yours.
    const rail = edit(skipTo(newGame(), 6), (s) => {
      own(s, 1, 'birmingham-gloucester', 'rail')
      own(s, 0, 'wolverhampton-birmingham', 'rail')
      own(s, 0, 'wolverhampton-gloucester', 'rail')
    })
    expect(findPath(rail, 0, 'birmingham', 'gloucester')).toEqual({ routeIds: ['wolverhampton-birmingham', 'wolverhampton-gloucester'], tollsByOwner: {} })
    expect(findPath(rail, 1, 'birmingham', 'gloucester')).toEqual({ routeIds: ['birmingham-gloucester'], tollsByOwner: {} })
  })

  it('refuses a shipment whose tolls and fees the shipper can’t pay, even after the revenue', () => {
    let mill = 0
    const g = edit(newGame(3), (s) => {
      mill = place(s, 0, 'cotton', 'birmingham', 0, 1).id
      own(s, 1, 'birmingham-oxford')
      own(s, 2, 'reading-oxford')
      own(s, 1, 'london-reading')
      s.prices.london = 1
      s.players[0].money = 1
    })
    expect(shipOptions(g, mill)[0]).toMatchObject({ marketId: 'london', revenue: 1, tollTotal: 3, affordable: false })
    expect(shipQuotes(g, mill)).toEqual([])
    expect(shipBlocker(g)).toBe('Can’t afford the tolls')
    expectIllegal(() => applyAction(g, { type: 'ship', buildingId: mill, marketId: 'london' }), /can’t afford the £3/)
  })

  it('can’t ship without a built way to a buyer, or without goods', () => {
    let mill = 0
    const g = edit(newGame(), (s) => {
      mill = place(s, 0, 'cotton', 'birmingham', 0, 2).id
    })
    expect(shipQuotes(g, mill)).toEqual([])
    expect(shipBlocker(g)).toBe('Not reachable')
    expectIllegal(() => applyAction(g, { type: 'ship', buildingId: mill, marketId: 'london' }), /isn’t reachable/)
    const empty = edit(g, (s) => (s.buildings[0].goods = 0))
    expect(shipBlocker(empty)).toBe('Nothing to ship yet')
    expectIllegal(() => applyAction(empty, { type: 'ship', buildingId: mill, marketId: 'london' }), /no cotton yet/)
    expectIllegal(() => applyAction(g, { type: 'ship', buildingId: 999, marketId: 'london' }), /Pick one of your/)
  })

  it('lists coal and iron shipments among the legal actions', () => {
    let mine = 0
    const g = edit(newGame(), (s) => {
      mine = place(s, 0, 'coal', 'swindon', 1).id
      own(s, 0, 'swindon-southampton')
      own(s, 0, 'london-southampton')
      s.players[0].coal = 3
    })
    expect(legalActions(g)).toContainEqual({ type: 'ship', buildingId: mine, marketId: 'london' })
  })
})

/* ---- Rounds, production, turn order ----------------------------------------- */

describe('rounds', () => {
  it('passes the turn after two actions, rotates the first player each round, and loses actions on time-out', () => {
    let g = newGame(3)
    g = applyAction(g, { type: 'raiseFunds' })
    expect(currentPlayerId(g)).toBe(0)
    g = applyAction(g, { type: 'raiseFunds' })
    expect(currentPlayerId(g)).toBe(1)
    g = applyAction(g, { type: 'endTurn', timedOut: true })
    expect(g.log.at(-1)!.text).toMatch(/ran out of time \(2 actions lost\)/)
    g = applyAction(g, { type: 'endTurn' })
    expect(g.round).toBe(2)
    expect(g.turnOrder).toEqual([1, 2, 0])
    g = skipTo(g, 3)
    expect(g.turnOrder).toEqual([2, 0, 1])
  })

  it('produces at the end of each round: stores with caps and overflow sales, mills up to 3, ports £1, shipyards ★, income £2, prices recover', () => {
    let g = edit(newGame(2), (s) => {
      place(s, 0, 'coal', 'birmingham', 3)
      place(s, 0, 'iron', 'wolverhampton', 0)
      place(s, 0, 'cotton', 'birmingham', 0, 2)
      place(s, 1, 'port', 'gloucester', 0)
      place(s, 1, 'shipyard', 'plymouth', 1)
      Object.assign(s.players[0], { coal: 4, iron: 5 })
      s.prices.london = 3
    })
    g = skipTo(g, 2)
    expect(g.players[0]).toMatchObject({ coal: 5, iron: 5, money: 14 + 2 + 2 })
    expect(g.players[1]).toMatchObject({ money: 14 + 1 + 2, prestige: 1 })
    expect(g.buildings.find((b) => b.kind === 'cotton')!.goods).toBe(3)
    expect(g.prices.london).toBe(4)
    g = skipTo(g, 3)
    expect(g.players[0]).toMatchObject({ coal: 5, iron: 5, money: 18 + 1 + 2 + 2 })
    expect(g.buildings.find((b) => b.kind === 'cotton')!.goods).toBe(3)
    g = skipTo(g, 6)
    expect(g.prices.london).toBe(7)
  })

  it('finishes after the last round with scores, and refuses further actions', () => {
    const g = skipTo(newGame(), 99)
    expect(g.status).toBe('finished')
    expect(g.round).toBe(g.totalRounds)
    expect(g.scores).toHaveLength(2)
    expect(legalActions(g)).toEqual([])
    expectIllegal(() => applyAction(g, { type: 'raiseFunds' }), /over/)
  })

  it('is deterministic: the same actions give the same states', () => {
    const play = () => {
      let g = newGame(3)
      for (const a of [{ type: 'raiseFunds' }, { type: 'link', routeId: 'birmingham-oxford' }, { type: 'endTurn' }] as const) g = applyAction(g, a)
      return g
    }
    expect(play()).toEqual(play())
  })
})

/* ---- Eras and the network ---------------------------------------------------- */

describe('eras', () => {
  it('switches to the rail era at round floor(rounds/2)+1, removing every canal link but keeping ★ and industries', () => {
    let g = edit(newGame(), (s) => {
      place(s, 0, 'coal', 'birmingham', 3)
      own(s, 0, 'birmingham-oxford', 'canal')
      own(s, 1, 'stoke-lichfield', 'canal')
      s.players[0].prestige = 3
    })
    g = skipTo(g, 5)
    expect(g.era).toBe('canal')
    g = skipTo(g, 6)
    expect(g.era).toBe('rail')
    expect(g.links).toEqual({})
    expect(g.eraChange).toEqual({ round: 6, removed: 2 })
    expect(g.buildings).toHaveLength(1)
    expect(g.players[0].prestige).toBe(3)
    expect(g.log.find((e) => e.kind === 'era')!.text).toMatch(/The Rail Era begins — the canals close and 2 canal links are removed/)
  })

  it('opens rail-only towns and their rail links in the rail era', () => {
    const g = edit(skipTo(newGame(), 6), (s) => (s.players[s.turnOrder[0]].money = 40))
    const p = currentPlayerId(g)
    expect(buildTargets(g, 'shipyard', p)).toEqual([{ townId: 'plymouth', slot: 1 }])
    expect(linkTargets(g, p).some((r) => r.id === 'the_north-stoke')).toBe(true)
    expect(linkTargets(g, p).every((r) => r.kinds.includes('rail'))).toBe(true)
    expect(linkTargets(g, p)).toHaveLength(33)
  })

  it('lets a player whose network was wiped out by the canals closing build anywhere again, and logs it', () => {
    let g = edit(newGame(), (s) => {
      own(s, 0, 'birmingham-oxford', 'canal')
      place(s, 1, 'coal', 'stoke', 0)
      own(s, 1, 'stoke-lichfield', 'canal')
    })
    expect(buildsAnywhere(g, 0)).toBe(false)
    expect(buildTargets(g, 'cotton', 0).every((p) => ['birmingham', 'oxford'].includes(p.townId))).toBe(true)
    g = skipTo(g, 6)
    // Player 0 had only a canal: anywhere again.
    expect(networkTowns(g, 0).size).toBe(0)
    expect(buildsAnywhere(g, 0)).toBe(true)
    expect(buildTargets(g, 'cotton', 0).length).toBeGreaterThan(10)
    expect(linkTargets(g, 0)).toHaveLength(33)
    expect(g.log.filter((e) => e.kind === 'reset').map((e) => e.text)).toEqual(['P1 has no network left and may build anywhere again.'])
    // Player 1 keeps the mine: links must touch Stoke, industries go in Stoke.
    expect(buildsAnywhere(g, 1)).toBe(false)
    expect(linkTargets(g, 1).map((r) => r.id).sort()).toEqual(['stoke-wolverhampton', 'the_north-stoke'])
    expect(new Set(buildTargets(g, 'coal', 1).map((p) => p.townId))).toEqual(new Set(['stoke']))
  })

  it('never offers an out-of-era link', () => {
    for (const round of [1, 6]) {
      const g = skipTo(newGame(), round)
      for (const a of legalActions(g)) {
        if (a.type !== 'link') continue
        const route = g.board.routes.find((r) => r.id === a.routeId)!
        expect(route.kinds).toContain(g.era)
      }
    }
  })
})

/* ---- Scoring -------------------------------------------------------------------- */

describe('scoring', () => {
  it('adds 1★ per £5 held and 2★ per hub in the network', () => {
    const g = edit(newGame(), (s) => {
      Object.assign(s.players[0], { prestige: 10, money: 14 })
      own(s, 0, 'london-reading')
      own(s, 0, 'west_wales-carmarthen')
    })
    expect(networkHubs(g, 0).sort()).toEqual(['london', 'west_wales'])
    expect(scoreFor(g, 0)).toEqual({ player: 0, prestige: 10, moneyBonus: 2, hubBonus: 4, total: 16 })
  })

  it('breaks ties by money, then shares the victory', () => {
    const finish = (change: (s: GameState) => void) => skipTo(edit(newGame(3), change), 99).scores!
    // All equal: a three-way shared victory.
    expect(finish(() => {}).map((s) => s.rank)).toEqual([1, 1, 1])
    // Same total (10★), but player 2 ends richer: 8★ + £10 beats 9★ + £5. (Ten rounds of £2 income are still to come.)
    const income = 10 * RULES.baseIncome
    const richer = finish((s) => {
      Object.assign(s.players[1], { prestige: 9, money: 5 - income })
      Object.assign(s.players[2], { prestige: 8, money: 10 - income })
      s.players[0].prestige = -20
    })
    expect(richer.map((s) => [s.player, s.total, s.rank])).toEqual([
      [2, 10, 1],
      [1, 10, 2],
      [0, -20 + Math.floor((14 + income) / 5), 3],
    ])
  })
})

/* ---- Saves and practice maps -------------------------------------------------- */

describe('saves', () => {
  it('resumes a current save and recognises one from an older version', () => {
    const g = newGame()
    expect(readSavedGame(JSON.parse(JSON.stringify(g)))).toEqual({ status: 'ok', game: g })
    expect(readSavedGame({ ...g, version: GAME_VERSION - 1 })).toEqual({ status: 'outdated' })
    expect(readSavedGame(null)).toEqual({ status: 'none' })
  })
})

describe('practice maps', () => {
  for (const map of MAPS.filter((m) => m.style === 'schematic')) {
    it(`${map.name}: connected, with market towns buying cotton, coal and iron`, () => {
      const board = boardFor(map.id, 'full')
      expect(board.eras).toBe(false)
      const markets = board.towns.filter((t) => t.market)
      expect(markets.length).toBeGreaterThanOrEqual(2)
      for (const t of markets) expect(t.market!.buys).toEqual(['cotton', 'coal', 'iron'])
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
      const sizes = (['full', 'reduced', 'compact'] as const).map((size) => boardFor(map.id, size).towns.length)
      expect(sizes[0]).toBeGreaterThan(sizes[1])
      expect(sizes[1]).toBeGreaterThan(sizes[2])
    })
  }

  it('builds canals and railways at any time on maps without eras', () => {
    const g = createGame({ mapId: 'mersey-valley', modeId: 'normal', seats: seats(2), seed: 3 })
    expect(g.era).toBeNull()
    const kinds = new Set(linkTargets(g).flatMap((r) => r.kinds))
    expect(kinds).toEqual(new Set(['canal', 'rail']))
  })
})
