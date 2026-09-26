import { afterAll, describe, expect, it, vi } from 'vitest'
import { GAME_MODES } from '../data/gameModes'
import { chooseAIAction } from './ai'
import { applyAction, createGame, legalActions } from './engine'
import { INDUSTRIES, RULES } from './rules'
import { AI_LEVELS, type AILevel, type GameState } from './types'

/**
 * Simulated matches on Wales & the West: four computer players, every mode,
 * 20 seeds each. Every action must be one of the legal actions, and after
 * every action the state must still make sense. Seat levels rotate with the
 * seed so every level plays every seat; the average score per level is
 * printed at the end.
 */

const SEEDS = 20

/** Everything that must hold in any state the engine produces. */
function checkState(g: GameState) {
  const towns = new Map(g.board.towns.map((t) => [t.id, t]))
  for (const p of g.players) {
    expect(p.money).toBeGreaterThanOrEqual(0)
    expect(p.coal).toBeGreaterThanOrEqual(0)
    expect(p.coal).toBeLessThanOrEqual(RULES.storeCap)
    expect(p.iron).toBeGreaterThanOrEqual(0)
    expect(p.iron).toBeLessThanOrEqual(RULES.storeCap)
  }
  const plots = new Set<string>()
  for (const b of g.buildings) {
    const town = towns.get(b.townId)
    expect(town?.slots[b.slot]).toContain(b.kind)
    expect(plots.has(`${b.townId}#${b.slot}`)).toBe(false)
    plots.add(`${b.townId}#${b.slot}`)
    expect(b.goods).toBeGreaterThanOrEqual(0)
    expect(b.goods).toBeLessThanOrEqual(INDUSTRIES[b.kind].ships === 'cotton' ? RULES.goodsCapacity : 0)
    if (town?.railOnly) expect(g.era === 'rail' || g.status === 'finished').toBe(true)
  }
  for (const [id, link] of Object.entries(g.links)) {
    const route = g.board.routes.find((r) => r.id === id)
    expect(route).toBeDefined()
    expect(route!.kinds).toContain(link.kind)
    if (g.era) expect(link.kind).toBe(g.era)
    expect(g.players[link.owner]).toBeDefined()
  }
  for (const town of g.board.towns) {
    if (!town.market) continue
    expect(g.prices[town.id]).toBeGreaterThanOrEqual(RULES.priceFloor)
    expect(g.prices[town.id]).toBeLessThanOrEqual(town.market.price)
  }
  if (g.status === 'playing') {
    expect(g.actionsLeft).toBeGreaterThanOrEqual(1)
    expect(g.actionsLeft).toBeLessThanOrEqual(RULES.actionsPerTurn)
  }
}

const totals: Record<AILevel, number[]> = { easy: [], normal: [], hard: [] }
const wins: Record<AILevel, number> = { easy: 0, normal: 0, hard: 0 }

describe('simulated matches (4 computer players)', () => {
  for (const mode of GAME_MODES) {
    it(`${mode.name}: ${SEEDS} seeds play to the end with no errors and no illegal states`, () => {
      const warn = vi.spyOn(console, 'warn')
      for (let seed = 1; seed <= SEEDS; seed++) {
        const levels = [0, 1, 2, 3].map((seat) => AI_LEVELS[(seat + seed) % AI_LEVELS.length])
        let g = createGame({
          mapId: 'wales-and-the-west',
          modeId: mode.id,
          seats: levels.map((aiLevel, i) => ({ name: `AI ${i + 1}`, isAI: true, aiLevel })),
          seed: seed * 7919,
        })
        let steps = 0
        while (g.status === 'playing') {
          const action = chooseAIAction(g)
          expect(legalActions(g)).toContainEqual(action)
          g = applyAction(g, action)
          checkState(g)
          steps++
          expect(steps).toBeLessThanOrEqual(mode.rounds * 4 * RULES.actionsPerTurn)
        }
        expect(g.round).toBe(mode.rounds)
        expect(g.scores).toHaveLength(4)
        expect(g.buildings.length).toBeGreaterThan(4)
        expect(g.players.some((p) => p.goodsShipped > 0)).toBe(true)
        for (const s of g.scores!) {
          totals[levels[s.player]].push(s.total)
          if (s.rank === 1) wins[levels[s.player]] += 1
        }
      }
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    }, 120_000)
  }

  afterAll(() => {
    const rows = AI_LEVELS.map((level) => {
      const list = totals[level]
      const avg = list.reduce((a, b) => a + b, 0) / (list.length || 1)
      return `${level.padEnd(6)} ${String(list.length).padStart(3)} seats  average ${avg.toFixed(1)}★  wins ${wins[level]}`
    })
    console.log(`Average final score per AI level (${SEEDS} seeds × ${GAME_MODES.length} modes):\n${rows.join('\n')}`)
  })

  it('replays the same match from the same seed', () => {
    const play = () => {
      let g = createGame({
        mapId: 'wales-and-the-west',
        modeId: 'blitz',
        seats: AI_LEVELS.map((aiLevel, i) => ({ name: `AI ${i + 1}`, isAI: true, aiLevel })),
        seed: 42,
      })
      while (g.status === 'playing') g = applyAction(g, chooseAIAction(g))
      return g
    }
    expect(play()).toEqual(play())
  })

  it('never throws: a broken position ends the turn with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const g = createGame({ mapId: 'wales-and-the-west', modeId: 'normal', seats: [{ name: 'A', isAI: true }, { name: 'B', isAI: true }], seed: 1 })
    const broken = { ...g, board: { ...g.board, towns: null } } as unknown as GameState
    expect(chooseAIAction(broken)).toEqual({ type: 'endTurn' })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('ships coal and iron as well as cotton', () => {
    const shipped = new Set<string>()
    for (let seed = 1; seed <= 6 && shipped.size < 3; seed++) {
      let g = createGame({
        mapId: 'wales-and-the-west',
        modeId: 'normal',
        seats: [0, 1, 2, 3].map((i) => ({ name: `AI ${i + 1}`, isAI: true, aiLevel: 'hard' as const })),
        seed,
      })
      while (g.status === 'playing') {
        g = applyAction(g, chooseAIAction(g))
        if (g.lastEvent?.type === 'ship') shipped.add(g.lastEvent.goods)
      }
    }
    expect(shipped).toEqual(new Set(['cotton', 'coal', 'iron']))
  }, 60_000)
})
