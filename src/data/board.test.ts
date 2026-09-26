import { describe, expect, it } from 'vitest'
import {
  bentCubic,
  catmullRom,
  convexHull,
  cubicAt,
  distance,
  flatten,
  lineGap,
  outline,
  outlinePoint,
  polyline,
  rayExit,
  rectGap,
  texturePieces,
  upright,
  pointAtLength,
} from '../components/board/geometry'
import { distanceToGroup, FAN, layoutBoard, MIN_GAP, TEXTURE_PIECE, TILE, TILE_GAP, TRACK_H, type RouteLayout } from '../components/board/layout'
import { createTextMeasurer } from '../components/board/measure'
import {
  BOARD,
  BOARD_DESIGN,
  degrees,
  designProblems,
  formatBoardJson,
  INDUSTRY_IDS,
  isLinkActive,
  parseBoardData,
  reachable,
  validateBoardData,
  type BoardData,
} from './board'
import boardFile from './board.json?raw'

describe('board.json', () => {
  it('is valid and complete: 25 locations and 39 links', () => {
    expect(validateBoardData(BOARD)).toEqual([])
    const byType = (t: string) => BOARD.locations.filter((l) => l.type === t).map((l) => l.id)
    expect(byType('hub')).toEqual(['the_north', 'london', 'west_wales'])
    expect(byType('stop')).toEqual(['brecon', 'reading', 'taunton'])
    expect(byType('city')).toHaveLength(19)
    expect(BOARD.links).toHaveLength(39)
  })

  it('uses only the five industries', () => {
    expect([...INDUSTRY_IDS].sort()).toEqual(['coal', 'cotton', 'iron', 'port', 'shipyard'])
    const used = new Set(BOARD.locations.flatMap((l) => (l.type === 'city' ? l.slots.flat() : l.type === 'hub' ? l.buys : [])))
    expect([...used].sort()).toEqual(['coal', 'cotton', 'iron', 'port', 'shipyard'])
  })

  it('matches the design for a few spot checks', () => {
    const at = (id: string) => BOARD.locations.find((l) => l.id === id)
    expect(at('lichfield')).toMatchObject({ type: 'city', slots: [['coal']], region: 'midlands' })
    expect(at('merthyr')).toMatchObject({ slots: [['iron'], ['iron'], ['coal']] })
    expect(at('bristol')).toMatchObject({ slots: [['cotton', 'port'], ['cotton', 'port'], ['cotton', 'iron'], ['coal']] })
    expect(at('london')).toMatchObject({ buys: ['cotton', 'coal', 'iron', 'port', 'shipyard'], value: 12 })
    expect(BOARD.locations.filter((l) => l.era === 'rail').map((l) => l.id)).toEqual(['the_north', 'taunton', 'plymouth'])
    expect(BOARD.links.find((l) => l.id === 'the_north-stoke')?.type).toBe('rail')
  })

  it('exports byte-for-byte as the checked-in file', () => {
    expect(formatBoardJson(BOARD)).toBe(boardFile)
  })

  it('exports valid JSON that round-trips after edits, in a stable key order', () => {
    const edited: BoardData = {
      ...BOARD,
      locations: BOARD.locations.map((l) => (l.id === 'bristol' ? { ...l, x: 55.4, y: 57.9, labelOffset: { x: -1.2, y: 0.5 } } : l)),
      links: BOARD.links.map((l) => (l.id === 'bristol-taunton' ? { ...l, points: [[50.1, 63.2]] } : l)),
    }
    const text = formatBoardJson(edited)
    expect(parseBoardData(JSON.parse(text))).toEqual(edited)
    expect(text).toMatch(/"ring": 1, "labelOffset": \{"x":-1.2,"y":0.5\}, "slots"/)
  })

  it('rejects broken data with readable errors', () => {
    const broken = {
      ...BOARD,
      locations: [...BOARD.locations, { id: 'nowhere', name: 'Nowhere', type: 'city', x: 120, y: 5, region: 'mars', slots: [['gold']] }],
      links: [
        ...BOARD.links,
        { id: 'x', from: 'bristol', to: 'atlantis', type: 'tram' },
        { id: 'y', from: 'stoke', to: 'the_north', type: 'both', points: [[1, 2], [3, 4], [5, 6], [7, 8]] },
      ],
    }
    const errors = validateBoardData(broken).join('\n')
    expect(errors).toMatch(/nowhere: x and y/)
    expect(errors).toMatch(/unknown region "mars"/)
    expect(errors).toMatch(/known industries/)
    expect(errors).toMatch(/x: unknown from\/to/)
    expect(errors).toMatch(/x: type must be/)
    expect(errors).toMatch(/y: another link already joins/)
    expect(errors).toMatch(/y: points must be up to 3/)
    expect(parseBoardData(broken)).toBeUndefined()
  })

  it('has only the current era’s links', () => {
    expect(isLinkActive('canal', 'canal')).toBe(true)
    expect(isLinkActive('rail', 'canal')).toBe(false)
    expect(isLinkActive('canal', 'rail')).toBe(false)
    expect(isLinkActive('both', 'rail')).toBe(true)
  })
})

/** The checks from the board spec (section 12). */
describe('design checks', () => {
  it('1. canal + both links from Birmingham reach everything except The North, Plymouth and Taunton', () => {
    const reached = reachable(BOARD, 'birmingham', 'canal')
    expect(BOARD.locations.filter((l) => !reached.has(l.id)).map((l) => l.id).sort()).toEqual(['plymouth', 'taunton', 'the_north'])
  })

  it('2. rail + both links reach every location', () => {
    expect(reachable(BOARD, 'birmingham', 'rail').size).toBe(25)
  })

  it('3. degrees add up to 78, with 16 both, 6 canal and 17 rail links', () => {
    expect([...degrees(BOARD).values()].reduce((a, b) => a + b, 0)).toBe(78)
    const count = (t: string) => BOARD.links.filter((l) => l.type === t).length
    expect([count('both'), count('canal'), count('rail')]).toEqual([16, 6, 17])
  })

  it('4. tile distribution: 2 cities with 4 slots, 4 with 3, 10 with 2, 3 with 1', () => {
    const tiles: Record<number, number> = {}
    for (const l of BOARD.locations) if (l.type === 'city') tiles[l.slots.length] = (tiles[l.slots.length] ?? 0) + 1
    expect(tiles).toEqual({ 4: 2, 3: 4, 2: 10, 1: 3 })
  })

  it('all together (the same check the dev build runs at start-up)', () => {
    expect(designProblems(BOARD, BOARD_DESIGN)).toEqual([])
  })

  it('reports a network that breaks the design', () => {
    const cut: BoardData = { ...BOARD, links: BOARD.links.filter((l) => l.id !== 'barnstaple-exeter') }
    const problems = designProblems(cut, BOARD_DESIGN).join('\n')
    expect(problems).toMatch(/unreachable: the_north, taunton, exeter, plymouth/)
    expect(problems).toMatch(/add up to 76, expected 78/)
    expect(problems).toMatch(/5 canal links, expected 6/)
  })

  it('5. no trace of the old industries or line-drawn industry icons in the code', () => {
    const sources = import.meta.glob<string>('../**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' })
    // Spelled in pieces, so that grepping the code for these words finds nothing at all.
    const banned = new RegExp(['manu' + 'facturer', 'pot' + 'tery', 'BOARD_' + 'ICONS', 'INDUSTRY_' + 'GLYPHS', 'Engine ' + 'Works', "'wor" + "ks'"].join('|'), 'i')
    const offenders = Object.entries(sources)
      .filter(([, text]) => banned.test(text))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})

describe('curves and texture pieces', () => {
  const a = { x: 100, y: 500 }
  const b = { x: 500, y: 500 }

  it('bows a link by the given share of its length', () => {
    const mid = cubicAt(bentCubic(a, b, 0.1, 0.2), 0.5)
    expect(Math.abs(mid.y - 500)).toBeCloseTo(40)
  })

  it('passes a Catmull-Rom spline through its bend points', () => {
    const points = [a, { x: 300, y: 420 }, { x: 420, y: 560 }, b]
    const segments = catmullRom(points)
    expect(segments).toHaveLength(3)
    expect(segments[1].p0).toEqual(points[1])
    expect(segments[1].p3).toEqual(points[2])
  })

  it('lays texture pieces edge to edge with no overlap, the last one clipped at the end', () => {
    const line = flatten([bentCubic(a, b, 0.15)], 1)
    const at = (s: number) => pointAtLength(line, s)
    for (const era of ['canal', 'rail'] as const) {
      const pieces = texturePieces(at, line.total, TEXTURE_PIECE[era], TRACK_H[era])
      for (let i = 1; i < pieces.length; i++) {
        // Each piece starts exactly where the previous one ended…
        expect(pieces[i].quad[0]).toEqual(pieces[i - 1].quad[1])
        expect(pieces[i].quad[3]).toEqual(pieces[i - 1].quad[2])
        // …and carries on through the texture from there.
        const step = TEXTURE_PIECE[era] / Math.ceil(TEXTURE_PIECE[era] / 12)
        expect(pieces[i].u).toBeCloseTo((pieces[i - 1].u + step) % TEXTURE_PIECE[era], 5)
      }
      const end = at(line.total).point
      const last = pieces.at(-1)!
      expect(distance({ x: (last.quad[1].x + last.quad[2].x) / 2, y: (last.quad[1].y + last.quad[2].y) / 2 }, end)).toBeLessThan(0.01)
    }
  })

  it('turns tokens the right way up between 90° and 270°', () => {
    expect(upright(30)).toBe(30)
    expect(upright(120)).toBe(-60)
    expect(upright(-100)).toBe(80)
    expect(upright(270)).toBe(270 % 360)
  })

  it('finds where rays leave a hull, and measures route gaps', () => {
    const o = outline(convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }]))
    expect(o.perimeter).toBeCloseTo(40)
    const exit = outlinePoint(o, rayExit(o, { x: 5, y: 5 }, { x: 1, y: 0 }))
    expect(exit.x).toBeCloseTo(10)
    expect(exit.y).toBeCloseTo(5)
    expect(lineGap(polyline([{ x: 0, y: 0 }, { x: 10, y: 10 }]), polyline([{ x: 0, y: 10 }, { x: 10, y: 0 }]))).toBe(0)
    expect(lineGap(polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }]), polyline([{ x: 0, y: 6 }, { x: 10, y: 6 }]))).toBeCloseTo(6)
  })
})

describe('board layout', () => {
  const layout = layoutBoard(BOARD, createTextMeasurer(false))
  const groups = [...layout.groups.values()]
  const routes = (era: 'canal' | 'rail'): RouteLayout[] => [...layout.routes[era]!.routes.values()]

  it('6. leaves no overlaps and no route over another route, in either era', () => {
    expect(layout.problems).toEqual([])
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) expect(rectGap(groups[i].bounds, groups[j].bounds)).toBeGreaterThanOrEqual(MIN_GAP - 0.05)
    }
    for (const era of ['canal', 'rail'] as const) {
      const list = routes(era)
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) expect(lineGap(list[i].line, list[j].line)).toBeGreaterThanOrEqual((list[i].width + list[j].width) / 2)
        // Link spaces (and the tokens on them, 44 × 22) keep 8 clear of every group.
        const rad = (list[i].marker.angle * Math.PI) / 180
        for (const k of [-11, 0, 11]) {
          const p = { x: list[i].marker.x + Math.cos(rad) * k, y: list[i].marker.y + Math.sin(rad) * k }
          for (const g of groups) expect(distanceToGroup(g, p) - 11).toBeGreaterThanOrEqual(MIN_GAP - 0.05)
        }
      }
    }
  })

  it('draws only the era’s links: canal and both in the canal era, rail and both in the rail era', () => {
    expect(routes('canal').map((r) => r.link.type).sort()).toEqual([...Array(16).fill('both'), ...Array(6).fill('canal')])
    expect(routes('rail').map((r) => r.link.type).sort()).toEqual([...Array(16).fill('both'), ...Array(17).fill('rail')])
  })

  it('fans route ends out at least 14 apart around each group', () => {
    for (const era of ['canal', 'rail'] as const) {
      const ends = new Map<string, { x: number; y: number }[]>()
      for (const r of routes(era)) {
        const line = r.line.points
        for (const [id, p] of [
          [r.link.from, line[0]],
          [r.link.to, line[line.length - 1]],
        ] as const) ends.set(id, [...(ends.get(id) ?? []), p])
      }
      for (const [, points] of ends) {
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) expect(distance(points[i], points[j])).toBeGreaterThanOrEqual(Math.min(14, FAN) - 0.5)
      }
    }
  })

  it('keeps everything on the board, with hubs at the edge', () => {
    for (const g of groups) {
      expect(g.bounds.x).toBeGreaterThanOrEqual(0)
      expect(g.bounds.y).toBeGreaterThanOrEqual(0)
      expect(g.bounds.x + g.bounds.w).toBeLessThanOrEqual(1000)
      expect(g.bounds.y + g.bounds.h).toBeLessThanOrEqual(1000)
    }
    expect(layout.groups.get('the_north')!.bounds.y).toBeLessThan(10)
    const london = layout.groups.get('london')!
    expect(london.bounds.x + london.bounds.w).toBeGreaterThan(990)
    expect(layout.groups.get('west_wales')!.bounds.x).toBeLessThan(10)
  })

  it('uses 34-unit squares with 3-unit gaps, 2 × 2 for four slots, over a plate wide enough for the name', () => {
    const city = (id: string) => {
      const g = layout.groups.get(id)!
      return g.parts.type === 'city' ? g.parts : null
    }
    const birmingham = city('birmingham')!
    expect(new Set(birmingham.tiles.map((t) => t.y)).size).toBe(2)
    expect(birmingham.tiles.every((t) => t.w === TILE && t.h === TILE)).toBe(true)
    const stoke = city('stoke')!
    expect(new Set(stoke.tiles.map((t) => t.y)).size).toBe(1)
    expect(stoke.tiles[1].x - stoke.tiles[0].x).toBe(TILE + TILE_GAP)
    const measure = createTextMeasurer(false)
    for (const g of groups) {
      if (g.parts.type !== 'city') continue
      const tilesWidth = Math.max(...g.parts.tiles.map((t) => t.x + t.w)) - Math.min(...g.parts.tiles.map((t) => t.x))
      expect(g.parts.plate.w).toBeGreaterThanOrEqual(tilesWidth)
      expect(g.parts.plate.w).toBeGreaterThanOrEqual(measure(g.location.name.toUpperCase(), '700 13.5px Cinzel', 13.5 * 0.06))
    }
  })

  it('respects a hand-placed labelOffset and follows bend points', () => {
    const edited: BoardData = {
      ...BOARD,
      locations: BOARD.locations.map((l) => (l.id === 'exeter' ? { ...l, labelOffset: { x: 2, y: -1.5 } } : l)),
      links: BOARD.links.map((l) => (l.id === 'merthyr-barnstaple' ? { ...l, points: [[30, 52]] } : l)),
    }
    const result = layoutBoard(edited, createTextMeasurer(false), { quick: true, eras: ['canal'] })
    const g = result.groups.get('exeter')!
    expect(g.center.x - g.point.x).toBeCloseTo(20)
    expect(g.center.y - g.point.y).toBeCloseTo(-15)
    const route = result.routes.canal!.routes.get('merthyr-barnstaple')!
    expect(route.segments).toHaveLength(2)
    expect(route.segments[0].p3).toEqual({ x: 300, y: 520 })
  })
})
