import { describe, expect, it } from 'vitest'
import {
  bentCubic,
  catmullRom,
  cubicAt,
  distance,
  flatten,
  offsetPolyline,
  pointAtLength,
  polyline,
  rectGap,
  trackSlices,
  unitNormal,
  visibleSpan,
} from '../components/board/geometry'
import { CANAL_PIECE, layoutBoard, MIN_GAP, RAIL_PIECE, TRACK_OFFSET } from '../components/board/layout'
import { createTextMeasurer } from '../components/board/measure'
import {
  BOARD,
  BOARD_TOPOLOGY,
  degrees,
  formatBoardJson,
  INDUSTRY_IDS,
  isLinkActive,
  parseBoardData,
  reachable,
  topologyProblems,
  validateBoardData,
  type BoardData,
} from './board'
import boardFile from './board.json?raw'

describe('board.json', () => {
  it('is valid and complete', () => {
    expect(validateBoardData(BOARD)).toEqual([])
    expect(BOARD.locations).toHaveLength(25)
    expect(BOARD.links).toHaveLength(39)
    const byType = (t: string) => BOARD.locations.filter((l) => l.type === t).map((l) => l.id)
    expect(byType('hub')).toEqual(['the_north', 'london', 'west_wales'])
    expect(byType('stop')).toEqual(['brecon', 'lichfield', 'reading', 'taunton'])
    expect(byType('city')).toHaveLength(18)
    const linkTypes = (t: string) => BOARD.links.filter((l) => l.type === t).length
    expect([linkTypes('both'), linkTypes('canal'), linkTypes('rail')]).toEqual([17, 6, 16])
  })

  it('uses only the five industries', () => {
    expect([...INDUSTRY_IDS].sort()).toEqual(['coal', 'cotton', 'iron', 'port', 'shipyard'])
    const used = new Set(BOARD.locations.flatMap((l) => (l.type === 'city' ? l.slots.flat() : l.type === 'hub' ? l.buys : [])))
    expect([...used].sort()).toEqual(['coal', 'cotton', 'iron', 'port', 'shipyard'])
  })

  it('matches the layout of the tiles and eras in the design', () => {
    const city = (id: string) => BOARD.locations.find((l) => l.id === id)
    expect(city('merthyr')).toMatchObject({ slots: [['iron'], ['iron'], ['coal'], ['coal']], region: 'wales' })
    expect(city('bristol')).toMatchObject({ slots: [['cotton', 'port'], ['cotton', 'port'], ['cotton', 'iron'], ['coal']] })
    expect(city('barnstaple')).toMatchObject({ slots: [['port']] })
    expect(city('london')).toMatchObject({ buys: ['cotton', 'coal', 'iron', 'port', 'shipyard'], value: 12 })
    expect(BOARD.locations.filter((l) => l.era === 'rail').map((l) => l.id)).toEqual(['taunton', 'plymouth'])
  })

  it('exports byte-for-byte as the checked-in file', () => {
    expect(formatBoardJson(BOARD)).toBe(boardFile)
  })

  it('exports valid JSON that round-trips after edits, in a stable key order', () => {
    const edited: BoardData = {
      ...BOARD,
      locations: BOARD.locations.map((l) => (l.id === 'bristol' ? { ...l, x: 55.4, y: 57.9, labelOffset: { x: -1.2, y: 0.5 } } : l)),
      links: BOARD.links.map((l) => (l.id === 'taunton-bristol' ? { ...l, points: [[50.1, 63.2]] } : l)),
    }
    const text = formatBoardJson(edited)
    expect(parseBoardData(JSON.parse(text))).toEqual(edited)
    // labelOffset is written before slots even though it was added last.
    expect(text).toMatch(/"ring": 1, "labelOffset": \{"x":-1.2,"y":0.5\}, "slots"/)
  })

  it('rejects broken data with readable errors', () => {
    const broken = {
      ...BOARD,
      locations: [...BOARD.locations, { id: 'nowhere', name: 'Nowhere', type: 'city', x: 120, y: 5, region: 'mars', slots: [['gold']] }],
      links: [
        ...BOARD.links,
        { id: 'x', from: 'bristol', to: 'atlantis', type: 'tram' },
        { id: 'y', from: 'stoke', to: 'the_north', type: 'rail', points: [[1, 2], [3, 4], [5, 6], [7, 8]] },
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

  it('fades links by era', () => {
    expect(isLinkActive('canal', 'canal')).toBe(true)
    expect(isLinkActive('rail', 'canal')).toBe(false)
    expect(isLinkActive('canal', 'rail')).toBe(false)
    expect(isLinkActive('both', 'rail')).toBe(true)
  })
})

describe('network design', () => {
  it('reaches everything but Plymouth and Taunton from The North in the canal era', () => {
    const reached = reachable(BOARD, 'the_north', 'canal')
    expect(BOARD.locations.filter((l) => !reached.has(l.id)).map((l) => l.id)).toEqual(['taunton', 'plymouth'])
    expect(reachable(BOARD, 'the_north', 'rail').size).toBe(25)
  })

  it('has degrees adding up to 78 (39 links)', () => {
    expect([...degrees(BOARD).values()].reduce((a, b) => a + b, 0)).toBe(78)
    expect(topologyProblems(BOARD, BOARD_TOPOLOGY)).toEqual([])
  })

  it('reports a network that breaks the design', () => {
    const cut: BoardData = { ...BOARD, links: BOARD.links.filter((l) => l.id !== 'barnstaple-exeter') }
    const problems = topologyProblems(cut, BOARD_TOPOLOGY).join('\n')
    expect(problems).toMatch(/can't reach taunton, exeter, plymouth/)
    expect(problems).toMatch(/add up to 76, expected 78/)
  })
})

describe('curves and tracks', () => {
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

  it('offsets parallel tracks along the normal, not by shifting x/y', () => {
    const curve = flatten([bentCubic(a, b, 0.15)])
    const side = offsetPolyline(curve, TRACK_OFFSET)
    for (const s of [0.2, 0.5, 0.8]) {
      const p = pointAtLength(side, side.total * s).point
      const nearest = Math.min(...curve.points.map((q) => distance(p, q)))
      expect(nearest).toBeCloseTo(TRACK_OFFSET, 0)
    }
  })

  it('lays texture slices end to end, overlapping by 1 and clipped at the end', () => {
    const line = flatten([bentCubic(a, b, 0.12)])
    for (const piece of [RAIL_PIECE, CANAL_PIECE]) {
      const slices = trackSlices(line, piece)
      // The texture runs on continuously: each slice starts where the last one's texture ended.
      for (let i = 1; i < slices.length; i++) {
        const step = piece / Math.ceil(piece / 16)
        expect(slices[i].u).toBeCloseTo((slices[i - 1].u + step) % piece, 5)
        expect(distance(slices[i - 1], slices[i])).toBeLessThan(slices[i - 1].w)
        expect(slices[i - 1].w - distance(slices[i - 1], slices[i])).toBeCloseTo(1, 0)
      }
      const last = slices.at(-1)!
      const rad = (last.angle * Math.PI) / 180
      const end = { x: last.x + Math.cos(rad) * last.w, y: last.y + Math.sin(rad) * last.w }
      expect(distance(end, line.points.at(-1)!)).toBeLessThan(0.5)
    }
  })

  it('trims routes where they leave and enter the plaques', () => {
    const line = polyline([a, b])
    const [s0, s1] = visibleSpan(
      line,
      (p) => p.x < 150,
      (p) => p.x > 420,
    )
    expect(s0).toBeCloseTo(50, 0)
    expect(s1).toBeCloseTo(320, 0)
    expect(unitNormal(a, b)).toEqual({ x: -0, y: 1 })
  })
})

describe('board layout', () => {
  const layout = layoutBoard(BOARD, createTextMeasurer(false))
  const groups = [...layout.groups.values()]

  it('leaves no overlaps: 8 units between plaques, tile groups, hubs and markers', () => {
    expect(layout.problems).toEqual([])
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) expect(rectGap(groups[i].bounds, groups[j].bounds)).toBeGreaterThanOrEqual(MIN_GAP - 0.05)
    }
  })

  it('keeps everything on the board and hubs at the edge', () => {
    for (const g of groups) {
      expect(g.bounds.x).toBeGreaterThanOrEqual(0)
      expect(g.bounds.y).toBeGreaterThanOrEqual(0)
      expect(g.bounds.x + g.bounds.w).toBeLessThanOrEqual(1000)
      expect(g.bounds.y + g.bounds.h).toBeLessThanOrEqual(1000)
    }
    const north = layout.groups.get('the_north')!
    const london = layout.groups.get('london')!
    const westWales = layout.groups.get('west_wales')!
    expect(north.bounds.y).toBeLessThan(10)
    expect(london.bounds.x + london.bounds.w).toBeGreaterThan(990)
    expect(westWales.bounds.x).toBeLessThan(10)
  })

  it('arranges tiles in a row, or 2 × 2 for four slots, above a plate wide enough for the name', () => {
    const tiles = (id: string) => {
      const g = layout.groups.get(id)!
      return g.parts.type === 'city' ? g.parts : null
    }
    const birmingham = tiles('birmingham')!
    expect(new Set(birmingham.tiles.map((t) => t.y)).size).toBe(2)
    expect(birmingham.tiles.every((t) => t.w === 22 && t.h === 22)).toBe(true)
    const stoke = tiles('stoke')!
    expect(new Set(stoke.tiles.map((t) => t.y)).size).toBe(1)
    expect(stoke.tiles[1].x - stoke.tiles[0].x).toBe(24)
    expect(stoke.plate.y).toBeGreaterThan(stoke.tiles[0].y + 22)
    const measure = createTextMeasurer(false)
    for (const g of groups) {
      if (g.parts.type !== 'city') continue
      expect(g.parts.plate.w).toBeGreaterThanOrEqual(measure(g.location.name.toUpperCase(), '700 11.5px Cinzel', 11.5 * 0.06))
    }
  })

  it('puts each marker between its two locations and draws both tracks on "both" links', () => {
    for (const route of layout.routes.values()) {
      expect(route.centre.total).toBeGreaterThan(30)
      expect(route.tracks.map((t) => t.kind)).toEqual(route.link.type === 'both' ? ['canal', 'rail'] : [route.link.type])
    }
  })

  it('respects a hand-placed labelOffset', () => {
    const placed: BoardData = { ...BOARD, locations: BOARD.locations.map((l) => (l.id === 'exeter' ? { ...l, labelOffset: { x: 2, y: -1.5 } } : l)) }
    const g = layoutBoard(placed, createTextMeasurer(false)).groups.get('exeter')!
    expect(g.center.x - g.point.x).toBeCloseTo(20)
    expect(g.center.y - g.point.y).toBeCloseTo(-15)
  })

  it('follows bend points when a link has them', () => {
    const bent: BoardData = { ...BOARD, links: BOARD.links.map((l) => (l.id === 'merthyr-barnstaple' ? { ...l, points: [[30, 52]] } : l)) }
    const route = layoutBoard(bent, createTextMeasurer(false)).routes.get('merthyr-barnstaple')!
    expect(route.segments).toHaveLength(2)
    expect(route.segments[0].p3).toEqual({ x: 300, y: 520 })
  })
})
