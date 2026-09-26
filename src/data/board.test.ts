import { describe, expect, it } from 'vitest'
import {
  curveForMidpoint,
  curveMidpoint,
  linkCurve,
  offsetCurve,
  pointAt,
  subCurve,
  trimCurve,
  unitNormal,
} from '../components/board/geometry'
import { BOARD, formatBoardJson, isLinkActive, parseBoardData, validateBoardData, type BoardData } from './board'
import boardFile from './board.json?raw'

describe('board.json', () => {
  it('is valid and complete', () => {
    expect(validateBoardData(BOARD)).toEqual([])
    expect(BOARD.locations).toHaveLength(25)
    expect(BOARD.links).toHaveLength(37)
    const byType = (t: string) => BOARD.locations.filter((l) => l.type === t).length
    expect([byType('city'), byType('stop'), byType('hub')]).toEqual([19, 3, 3])
    const linkTypes = (t: string) => BOARD.links.filter((l) => l.type === t).length
    expect([linkTypes('both'), linkTypes('canal'), linkTypes('rail')]).toEqual([9, 8, 20])
  })

  it('connects every location', () => {
    const touched = new Set(BOARD.links.flatMap((l) => [l.from, l.to]))
    expect(BOARD.locations.filter((l) => !touched.has(l.id)).map((l) => l.id)).toEqual([])
  })

  it('exports byte-for-byte as the checked-in file', () => {
    expect(formatBoardJson(BOARD)).toBe(boardFile)
  })

  it('exports valid JSON that round-trips after edits', () => {
    const edited: BoardData = {
      ...BOARD,
      locations: BOARD.locations.map((l) => (l.id === 'bristol' ? { ...l, x: 55.4, y: 57.9 } : l)),
      links: BOARD.links.map((l) => (l.id === 'bristol-taunton' ? { ...l, curve: -3.2 } : l)),
    }
    const parsed = parseBoardData(JSON.parse(formatBoardJson(edited)))
    expect(parsed).toEqual(edited)
  })

  it('rejects broken data with readable errors', () => {
    const broken = {
      ...BOARD,
      locations: [...BOARD.locations, { id: 'nowhere', name: 'Nowhere', type: 'city', x: 120, y: 5, size: 'huge', region: 'mars', slots: [['gold']] }],
      links: [...BOARD.links, { id: 'x', from: 'bristol', to: 'atlantis', type: 'tram' }],
    }
    const errors = validateBoardData(broken)
    expect(errors.join('\n')).toMatch(/nowhere: x and y/)
    expect(errors.join('\n')).toMatch(/nowhere: size/)
    expect(errors.join('\n')).toMatch(/unknown region "mars"/)
    expect(errors.join('\n')).toMatch(/known industries/)
    expect(errors.join('\n')).toMatch(/x: unknown from\/to/)
    expect(errors.join('\n')).toMatch(/x: type must be/)
    expect(parseBoardData(broken)).toBeUndefined()
  })

  it('fades links by era', () => {
    expect(isLinkActive('canal', 'canal')).toBe(true)
    expect(isLinkActive('rail', 'canal')).toBe(false)
    expect(isLinkActive('canal', 'rail')).toBe(false)
    expect(isLinkActive('both', 'rail')).toBe(true)
  })
})

describe('link geometry', () => {
  const a = { x: 100, y: 500 }
  const b = { x: 500, y: 500 }

  it('draws a straight link when curve is 0', () => {
    const c = linkCurve(a, b)
    expect(curveMidpoint(c)).toEqual({ x: 300, y: 500 })
  })

  it('puts the midpoint half the control offset from the chord', () => {
    const c = linkCurve(a, b, 4) // 4% = 40 view units
    const mid = curveMidpoint(c)
    expect(mid.x).toBeCloseTo(300)
    expect(Math.abs(mid.y - 500)).toBeCloseTo(20)
  })

  it('inverts the midpoint when dragging a handle', () => {
    for (const curve of [-6.5, 0, 2.3, 10]) {
      const mid = curveMidpoint(linkCurve(a, { x: 420, y: 180 }, curve))
      expect(curveForMidpoint(a, { x: 420, y: 180 }, mid)).toBeCloseTo(curve, 1)
    }
  })

  it('splits curves without changing their shape', () => {
    const c = linkCurve(a, b, 5)
    const part = subCurve(c, 0.2, 0.7)
    const p = pointAt(part, 0.5)
    const q = pointAt(c, 0.45)
    expect(p.x).toBeCloseTo(q.x)
    expect(p.y).toBeCloseTo(q.y)
  })

  it('trims both ends', () => {
    const t = trimCurve(linkCurve(a, b), 20, 30)
    expect(t.p0.x).toBeCloseTo(120)
    expect(t.p2.x).toBeCloseTo(470)
  })

  it('offsets parallel lines to either side', () => {
    const c = linkCurve(a, b)
    const n = unitNormal(a, b)
    const left = offsetCurve(c, 7)
    expect(left.p0.x).toBeCloseTo(a.x + n.x * 7)
    expect(left.p0.y).toBeCloseTo(a.y + n.y * 7)
    expect(curveMidpoint(left).y).toBeCloseTo(500 + n.y * 7)
  })
})
