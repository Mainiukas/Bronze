/**
 * Where everything on the illustrated board goes, in view units (viewBox
 * 0 0 1000 1000): each location's tile group, plaque or hub, and each link's
 * curve, tracks and marker.
 *
 * Groups start centred on their location (or at its labelOffset) and are
 * then nudged apart until nothing overlaps: at least MIN_GAP between any two
 * groups, and enough room between linked groups for the route and its
 * marker. Location points never move. Links without bend points get a
 * seeded bend, turned whichever way keeps them clear of other groups.
 */

import type { BoardData, BoardLink, BoardLocation, Era } from '../../data/board'
import {
  bentCubic,
  catmullRom,
  distance,
  distanceToRect,
  flatten,
  offsetPolyline,
  pointAtLength,
  rectGap,
  seededRandom,
  slicePolyline,
  toView,
  union,
  visibleSpan,
  type Cubic,
  type Point,
  type Polyline,
  type Rect,
} from './geometry'
import type { MeasureText } from './measure'

/* ---- Sizes (view units) --------------------------------------------------- */

export const TILE = 22
export const TILE_GAP = 2
export const PLATE_H = 16
const PLATE_GAP = 2
const PLATE_PAD = 8

export const STOP_H = 18
const STOP_PAD = 10
export const EMBLEM_R = 5

export const MEDALLION_R = 30
export const HUB_SLOT_W = 30
export const HUB_SLOT_H = 18
export const RIBBON_H = 16
const RIBBON_TAIL = 8
export const BADGE = 15
export const BONUS_R = 8
export const BUY_ICON = 8
const BUY_GAP = 1.5

export const RAIL_BADGE_R = 7

export const CITY_FONT = 11.5
export const STOP_FONT = 10.5
export const HUB_FONT = 10
export const CITY_WEIGHT = 700
export const STOP_WEIGHT = 700
export const HUB_WEIGHT = 700
/** Letter spacing, in em. */
export const CITY_TRACKING = 0.06
export const STOP_TRACKING = 0.18
export const HUB_TRACKING = 0.12

/** CSS font shorthand used both to draw and to measure each kind of label. */
export const boardFont = (size: number, weight: number) => `${weight} ${size}px Cinzel`

/** Texture heights on the board, and the length of one repeat of each texture (source 1084 × 256 and 1639 × 256). */
export const RAIL_H = 14
export const CANAL_H = 16
export const RAIL_PIECE = (1084 * RAIL_H) / 256
export const CANAL_PIECE = (1639 * CANAL_H) / 256
/** Distance of each track from the centre line on a "both" link. */
export const TRACK_OFFSET = 9

export const MARKER_W = 26
export const MARKER_H = 14

/** Routes stop this far short of a plaque or tile edge. */
export const TRIM = 4
/** Smallest gap between any two groups or markers. */
export const MIN_GAP = 8
/**
 * Room linked groups need between them along the line joining them: the
 * marker, a gap on each side, and slack for routes that arrive at an angle.
 */
const LINK_GAP = MARKER_W + 2 * MIN_GAP + 16
/** Groups stay this far inside the board edge. */
const EDGE = 4

/* ---- Types ---------------------------------------------------------------- */

type Solid = { type: 'rect'; rect: Rect } | { type: 'circle'; c: Point; r: number }

export interface CityParts {
  type: 'city'
  tiles: Rect[]
  plate: Rect
}

export interface StopParts {
  type: 'stop'
  plaque: Rect
  emblems: Point[]
}

export interface HubParts {
  type: 'hub'
  medallion: Point
  /** The two merchant slots (bounding boxes of the hexagons). */
  slots: Rect[]
  /** Ribbon body; the folded tails reach RIBBON_TAIL past each end. */
  ribbon: Rect
  badge: Rect
  bonus: Point
  icons: Rect[]
}

export interface GroupLayout {
  location: BoardLocation
  /** The location's own point. */
  point: Point
  /** Centre of the group's bounds after nudging. */
  center: Point
  /** Where routes aim: the medallion for hubs, the centre otherwise. */
  anchor: Point
  bounds: Rect
  parts: CityParts | StopParts | HubParts
  /** Rail-era badge centre, if the location has one. */
  railBadge: Point | null
  fontSize: number
  /** Placed by hand (labelOffset), so the nudging leaves it alone. */
  fixed: boolean
  solids: Solid[]
}

export interface Track {
  kind: Era
  line: Polyline
}

export interface RouteLayout {
  link: BoardLink
  /** The whole curve, anchor to anchor. */
  segments: Cubic[]
  /** The visible part of the centre line, between the two groups. */
  centre: Polyline
  /** Canal first, then rail, so canals draw underneath. */
  tracks: Track[]
  marker: { x: number; y: number; angle: number }
}

export interface BoardLayout {
  groups: Map<string, GroupLayout>
  routes: Map<string, RouteLayout>
  /** Anything still too close after layout, as readable messages. */
  problems: string[]
}

/* ---- Group shapes --------------------------------------------------------- */

type Shape = Omit<GroupLayout, 'location' | 'point' | 'center' | 'fixed'>

function moveRect(r: Rect, d: Point): Rect {
  return { x: r.x + d.x, y: r.y + d.y, w: r.w, h: r.h }
}
const movePoint = (p: Point, d: Point): Point => ({ x: p.x + d.x, y: p.y + d.y })

function moveShape(shape: Shape, d: Point): Shape {
  const parts = shape.parts
  const moved: Shape['parts'] =
    parts.type === 'city'
      ? { ...parts, tiles: parts.tiles.map((r) => moveRect(r, d)), plate: moveRect(parts.plate, d) }
      : parts.type === 'stop'
        ? { ...parts, plaque: moveRect(parts.plaque, d), emblems: parts.emblems.map((p) => movePoint(p, d)) }
        : {
            ...parts,
            medallion: movePoint(parts.medallion, d),
            slots: parts.slots.map((r) => moveRect(r, d)),
            ribbon: moveRect(parts.ribbon, d),
            badge: moveRect(parts.badge, d),
            bonus: movePoint(parts.bonus, d),
            icons: parts.icons.map((r) => moveRect(r, d)),
          }
  return {
    ...shape,
    parts: moved,
    anchor: movePoint(shape.anchor, d),
    bounds: moveRect(shape.bounds, d),
    railBadge: shape.railBadge && movePoint(shape.railBadge, d),
    solids: shape.solids.map((s) => (s.type === 'rect' ? { type: 'rect', rect: moveRect(s.rect, d) } : { ...s, c: movePoint(s.c, d) })),
  }
}

const circleBox = (c: Point, r: number): Rect => ({ x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 })

/** A location's group drawn around (0, 0), before it's centred. */
function rawShape(location: BoardLocation, measure: MeasureText): Shape {
  const name = location.name.toUpperCase()
  const railOnly = location.era === 'rail'

  if (location.type === 'city') {
    const n = location.slots.length
    const grid = n === 4
    const blockW = grid ? TILE * 2 + TILE_GAP : n * TILE + (n - 1) * TILE_GAP
    const blockH = grid ? TILE * 2 + TILE_GAP : TILE
    const text = measure(name, boardFont(CITY_FONT, CITY_WEIGHT), CITY_FONT * CITY_TRACKING)
    const w = Math.max(blockW, Math.ceil(text + PLATE_PAD * 2))
    const left = (w - blockW) / 2
    const tiles = Array.from({ length: n }, (_, i) =>
      grid
        ? { x: left + (i % 2) * (TILE + TILE_GAP), y: Math.floor(i / 2) * (TILE + TILE_GAP), w: TILE, h: TILE }
        : { x: left + i * (TILE + TILE_GAP), y: 0, w: TILE, h: TILE },
    )
    const plate = { x: 0, y: blockH + PLATE_GAP, w, h: PLATE_H }
    const block = { x: left, y: 0, w: blockW, h: blockH }
    const railBadge = railOnly ? { x: plate.x + plate.w - 1, y: plate.y - 1 } : null
    const solids: Solid[] = [
      { type: 'rect', rect: block },
      { type: 'rect', rect: plate },
      ...(railBadge ? [{ type: 'circle' as const, c: railBadge, r: RAIL_BADGE_R }] : []),
    ]
    const bounds = union([block, plate, ...(railBadge ? [circleBox(railBadge, RAIL_BADGE_R)] : [])])
    return { parts: { type: 'city', tiles, plate }, anchor: { x: w / 2, y: (blockH + PLATE_GAP + PLATE_H) / 2 }, bounds, railBadge, fontSize: CITY_FONT, solids }
  }

  if (location.type === 'stop') {
    const text = measure(name, boardFont(STOP_FONT, STOP_WEIGHT), STOP_FONT * STOP_TRACKING)
    const plaque = { x: 0, y: 0, w: Math.ceil(text + STOP_PAD * 2), h: STOP_H }
    const emblems = [
      { x: plaque.w / 2 - EMBLEM_R - 2, y: 0 },
      { x: plaque.w / 2 + EMBLEM_R + 2, y: 0 },
    ]
    const railBadge = railOnly ? { x: plaque.w - 1, y: -1 } : null
    const solids: Solid[] = [
      { type: 'rect', rect: plaque },
      ...emblems.map((c) => ({ type: 'circle' as const, c, r: EMBLEM_R })),
      ...(railBadge ? [{ type: 'circle' as const, c: railBadge, r: RAIL_BADGE_R }] : []),
    ]
    const bounds = union([plaque, ...emblems.map((c) => circleBox(c, EMBLEM_R * 0.87)), ...(railBadge ? [circleBox(railBadge, RAIL_BADGE_R)] : [])])
    return { parts: { type: 'stop', plaque, emblems }, anchor: { x: plaque.w / 2, y: plaque.h / 2 }, bounds, railBadge, fontSize: STOP_FONT, solids }
  }

  // Hub: medallion at (0, 0), merchant slots on top, ribbon across the middle.
  const R = MEDALLION_R
  const text = measure(name, boardFont(HUB_FONT, HUB_WEIGHT), HUB_FONT * HUB_TRACKING)
  const ribbonW = Math.max(R * 2 + 16, Math.ceil(text + 22))
  const ribbon = { x: -ribbonW / 2, y: -RIBBON_H / 2 - 1, w: ribbonW, h: RIBBON_H }
  const slots = [-1, 1].map((side) => ({ x: side * 16 - HUB_SLOT_W / 2, y: -R - HUB_SLOT_H + 4, w: HUB_SLOT_W, h: HUB_SLOT_H }))
  const badge = { x: -R - 4 - BADGE / 2, y: -R + 6, w: BADGE, h: BADGE }
  const bonus = { x: 0, y: R + 4 }
  const n = location.buys.length
  const iconsW = n * BUY_ICON + (n - 1) * BUY_GAP
  const icons = location.buys.map((_, i) => ({ x: -iconsW / 2 + i * (BUY_ICON + BUY_GAP), y: ribbon.y + ribbon.h + 2, w: BUY_ICON, h: BUY_ICON }))
  const tails = { x: ribbon.x - RIBBON_TAIL, y: ribbon.y + 2, w: ribbon.w + RIBBON_TAIL * 2, h: ribbon.h + 3 }
  const solids: Solid[] = [
    { type: 'circle', c: { x: 0, y: 0 }, r: R + 1.5 },
    { type: 'rect', rect: tails },
    ...slots.map((rect) => ({ type: 'rect' as const, rect })),
    { type: 'rect', rect: badge },
    { type: 'circle', c: bonus, r: BONUS_R },
  ]
  const bounds = union([circleBox({ x: 0, y: 0 }, R + 1.5), tails, ...slots, badge, circleBox(bonus, BONUS_R)])
  return { parts: { type: 'hub', medallion: { x: 0, y: 0 }, slots, ribbon, badge, bonus, icons }, anchor: { x: 0, y: 0 }, bounds, railBadge: null, fontSize: HUB_FONT, solids }
}

/** Distance from p to the nearest shape the group draws (0 inside). */
export function distanceToGroup(group: Pick<GroupLayout, 'solids'>, p: Point): number {
  let nearest = Infinity
  for (const s of group.solids) nearest = Math.min(nearest, s.type === 'rect' ? distanceToRect(p, s.rect) : Math.max(0, distance(p, s.c) - s.r))
  return nearest
}

/** Is p within `pad` of the group's drawn shapes? */
export const nearGroup = (group: Pick<GroupLayout, 'solids'>, p: Point, pad: number): boolean => distanceToGroup(group, p) < pad

/* ---- Collision pass ------------------------------------------------------- */

/** How far a ray from inside a rect travels before leaving it. */
function exitDistance(r: Rect, from: Point, dir: Point): number {
  const tx = dir.x > 1e-9 ? (r.x + r.w - from.x) / dir.x : dir.x < -1e-9 ? (r.x - from.x) / dir.x : Infinity
  const ty = dir.y > 1e-9 ? (r.y + r.h - from.y) / dir.y : dir.y < -1e-9 ? (r.y - from.y) / dir.y : Infinity
  return Math.max(0, Math.min(tx, ty))
}

function clampToBoard(shape: Shape, center: Point): Point {
  const half = { x: shape.bounds.w / 2, y: shape.bounds.h / 2 }
  return {
    x: Math.min(1000 - EDGE - half.x, Math.max(EDGE + half.x, center.x)),
    y: Math.min(1000 - EDGE - half.y, Math.max(EDGE + half.y, center.y)),
  }
}

interface Body {
  id: string
  shape: Shape
  point: Point
  center: Point
  fixed: boolean
}

const boundsAt = (b: Body): Rect => ({ x: b.center.x - b.shape.bounds.w / 2, y: b.center.y - b.shape.bounds.h / 2, w: b.shape.bounds.w, h: b.shape.bounds.h })
const anchorAt = (b: Body): Point => ({ x: b.center.x + b.shape.anchor.x, y: b.center.y + b.shape.anchor.y })

/** Nudge groups apart. Deterministic: the same board always lays out the same way. */
function relax(bodies: Body[], linked: Set<string>) {
  const move = (a: Body, b: Body, d: Point) => {
    // Push a by −d and b by +d, sharing the move unless one is pinned.
    const share = a.fixed || b.fixed ? 1 : 0.5
    if (!a.fixed) a.center = { x: a.center.x - d.x * share, y: a.center.y - d.y * share }
    if (!b.fixed) b.center = { x: b.center.x + d.x * share, y: b.center.y + d.y * share }
  }
  const ITERATIONS = 900
  const SPRING_UNTIL = 300
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const before = bodies.map((b) => b.center)
    // A gentle pull back towards each location's own point keeps groups near their towns.
    if (iter < SPRING_UNTIL) {
      for (const b of bodies) if (!b.fixed) b.center = { x: b.point.x + (b.center.x - b.point.x) * 0.96, y: b.point.y + (b.center.y - b.point.y) * 0.96 }
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]
        if (a.fixed && b.fixed) continue
        const ra = boundsAt(a)
        const rb = boundsAt(b)
        if (linked.has(`${a.id}|${b.id}`)) {
          const pa = anchorAt(a)
          const pb = anchorAt(b)
          const span = distance(pa, pb) || 1
          const dir = { x: (pb.x - pa.x) / span, y: (pb.y - pa.y) / span }
          const gap = span - exitDistance(ra, pa, dir) - exitDistance(rb, pb, { x: -dir.x, y: -dir.y })
          if (gap < LINK_GAP) move(a, b, { x: dir.x * (LINK_GAP - gap), y: dir.y * (LINK_GAP - gap) })
        }
        const gap = rectGap(ra, rb)
        if (gap < MIN_GAP) {
          const ca = { x: ra.x + ra.w / 2, y: ra.y + ra.h / 2 }
          const cb = { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 }
          const sepX = Math.max(rb.x - (ra.x + ra.w), ra.x - (rb.x + rb.w))
          const sepY = Math.max(rb.y - (ra.y + ra.h), ra.y - (rb.y + rb.h))
          const sx = Math.sign(cb.x - ca.x) || 1
          const sy = Math.sign(cb.y - ca.y) || 1
          if (sepX < 0 && sepY < 0) {
            // Overlapping: separate along the axis that needs the smaller move.
            const needX = MIN_GAP - sepX
            const needY = MIN_GAP - sepY
            move(a, b, needX < needY ? { x: sx * needX, y: 0 } : { x: 0, y: sy * needY })
          } else if (sepY < 0) move(a, b, { x: sx * (MIN_GAP - sepX), y: 0 })
          else if (sepX < 0) move(a, b, { x: 0, y: sy * (MIN_GAP - sepY) })
          else {
            const d = Math.hypot(sepX, sepY) || 1
            const k = (MIN_GAP - d) / d
            move(a, b, { x: sx * sepX * k, y: sy * sepY * k })
          }
        }
      }
    }
    for (const b of bodies) if (!b.fixed) b.center = clampToBoard(b.shape, b.center)
    // Once the pull towards the points has stopped, finish as soon as a pass moves nothing.
    if (iter >= SPRING_UNTIL) {
      const moved = bodies.some((b, i) => Math.abs(b.center.x - before[i].x) + Math.abs(b.center.y - before[i].y) > 0.01)
      if (!moved) break
    }
  }
}

/* ---- Routes --------------------------------------------------------------- */

/** Automatic bends: 8–15 % of the link's length. */
const BENDS = [0.08, 0.1, 0.12, 0.15]
/** Only when no gentle bend clears the way: a wider sweep around a plaque in the path. */
const WIDE_BENDS = [0.2, 0.26, 0.32]

function trackLines(full: Polyline, type: BoardLink['type'], inStart: (p: Point) => boolean, inEnd: (p: Point) => boolean): Track[] {
  const visible = (line: Polyline) => {
    const [s0, s1] = visibleSpan(line, inStart, inEnd)
    return slicePolyline(line, s0, s1)
  }
  if (type !== 'both') return [{ kind: type, line: visible(full) }]
  return [
    { kind: 'canal', line: visible(offsetPolyline(full, -TRACK_OFFSET)) },
    { kind: 'rail', line: visible(offsetPolyline(full, TRACK_OFFSET)) },
  ]
}

/** Points along the marker's long axis, for clearance checks (a capsule of radius MARKER_H / 2). */
function markerSpine(at: Point, tangent: Point): Point[] {
  const half = MARKER_W / 2 - MARKER_H / 2
  return [-1, -0.5, 0, 0.5, 1].map((k) => ({ x: at.x + tangent.x * half * k, y: at.y + tangent.y * half * k }))
}

/** How badly a marker at `spine` crowds these groups' shapes (0 = clear by MIN_GAP). */
function markerCrowding(spine: Point[], groups: Pick<GroupLayout, 'solids'>[]): number {
  let bad = 0
  for (const g of groups) {
    for (const p of spine) bad += Math.max(0, MARKER_H / 2 + MIN_GAP - distanceToGroup(g, p))
  }
  return bad
}

function markerClash(spine: Point[], others: Point[][]): number {
  let bad = 0
  for (const other of others) {
    let nearest = Infinity
    for (const p of spine) for (const q of other) nearest = Math.min(nearest, distance(p, q))
    bad += Math.max(0, MARKER_H + MIN_GAP - nearest)
  }
  return bad
}

function routeFor(link: BoardLink, a: GroupLayout, b: GroupLayout, others: GroupLayout[]): { segments: Cubic[]; full: Polyline; span: [number, number] } {
  const inA = (p: Point) => nearGroup(a, p, TRIM)
  const inB = (p: Point) => nearGroup(b, p, TRIM)
  if (link.points?.length) {
    const segments = catmullRom([a.anchor, ...link.points.map(([x, y]) => toView({ x, y })), b.anchor])
    const full = flatten(segments)
    return { segments, full, span: visibleSpan(full, inA, inB) }
  }
  // Seeded default bend, then try the alternatives if it runs into other groups.
  const random = seededRandom(link.id)
  const sign = random() < 0.5 ? -1 : 1
  const bend = BENDS[Math.floor(random() * BENDS.length)]
  const skew = (random() - 0.5) * 0.5
  const options = (bends: number[]) => [sign, -sign].flatMap((s) => bends.flatMap((k) => [skew, -skew].map((sk) => ({ sign: s, bend: k, skew: sk }))))
  const candidates = [{ sign, bend, skew }, ...options(BENDS), ...options(WIDE_BENDS)]
  const gentle = 1 + options(BENDS).length
  const halfBand = (link.type === 'both' ? TRACK_OFFSET + CANAL_H / 2 : CANAL_H / 2) + MIN_GAP / 2
  const nearby = others.filter((g) => g !== a && g !== b)
  let best: { segments: Cubic[]; full: Polyline; span: [number, number]; score: number } | null = null
  for (const [i, c] of candidates.entries()) {
    // Wide sweeps are a last resort: stop at the gentle ones if any is clear.
    if (i === gentle && best && best.score === 0) break
    const segments = [bentCubic(a.anchor, b.anchor, c.sign * c.bend, c.skew)]
    const full = flatten(segments, 6)
    const span = visibleSpan(full, inA, inB)
    let score = 0
    for (let i = 0; i < full.points.length; i++) {
      if (full.lengths[i] < span[0] || full.lengths[i] > span[1]) continue
      for (const g of nearby) {
        const d = distanceToRect(full.points[i], g.bounds)
        if (d < halfBand) score += (halfBand - d) ** 2
      }
    }
    const mid = pointAtLength(full, (span[0] + span[1]) / 2)
    // The marker must also clear the link's own two ends.
    score += markerCrowding(markerSpine(mid.point, mid.tangent), [a, b, ...nearby]) * 20
    if (!best || score < best.score - 1e-6) best = { segments, full, span, score }
    if (score === 0) break
  }
  const fine = flatten(best!.segments)
  return { segments: best!.segments, full: fine, span: visibleSpan(fine, inA, inB) }
}

/* ---- The board ------------------------------------------------------------ */

export function layoutBoard(board: BoardData, measure: MeasureText): BoardLayout {
  const linked = new Set<string>()
  const index = new Map(board.locations.map((l, i) => [l.id, i]))
  for (const link of board.links) {
    const [i, j] = [index.get(link.from)!, index.get(link.to)!].sort((x, y) => x - y)
    linked.add(`${board.locations[i].id}|${board.locations[j].id}`)
  }

  // 1. Shapes, centred on their points (or placed by labelOffset), then nudged apart.
  const bodies: Body[] = board.locations.map((location) => {
    const raw = rawShape(location, measure)
    const c = { x: raw.bounds.x + raw.bounds.w / 2, y: raw.bounds.y + raw.bounds.h / 2 }
    const shape = moveShape(raw, { x: -c.x, y: -c.y })
    const point = toView(location)
    const fixed = location.labelOffset !== undefined
    const center = fixed ? { x: point.x + location.labelOffset!.x * 10, y: point.y + location.labelOffset!.y * 10 } : point
    return { id: location.id, shape, point, center: fixed ? center : clampToBoard(shape, center), fixed }
  })
  relax(bodies, linked)

  const groups = new Map<string, GroupLayout>()
  for (const [i, body] of bodies.entries()) {
    const placed = moveShape(body.shape, body.center)
    groups.set(body.id, { ...placed, location: board.locations[i], point: body.point, center: body.center, fixed: body.fixed })
  }

  // 2. Routes, then markers placed clear of groups and of each other.
  const all = [...groups.values()]
  const routes = new Map<string, RouteLayout>()
  const placedMarkers: Point[][] = []
  for (const link of board.links) {
    const a = groups.get(link.from)!
    const b = groups.get(link.to)!
    const { segments, full, span } = routeFor(link, a, b, all)
    const inA = (p: Point) => nearGroup(a, p, TRIM)
    const inB = (p: Point) => nearGroup(b, p, TRIM)
    let marker = { x: 0, y: 0, angle: 0 }
    let bestBad = Infinity
    let bestSpine: Point[] = []
    for (const f of [0.5, 0.44, 0.56, 0.38, 0.62, 0.32, 0.68]) {
      const { point, tangent } = pointAtLength(full, span[0] + (span[1] - span[0]) * f)
      const spine = markerSpine(point, tangent)
      const bad = markerCrowding(spine, all) + markerClash(spine, placedMarkers)
      if (bad < bestBad - 1e-6) {
        bestBad = bad
        bestSpine = spine
        marker = { x: point.x, y: point.y, angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI }
      }
      if (bad === 0) break
    }
    placedMarkers.push(bestSpine)
    routes.set(link.id, {
      link,
      segments,
      centre: slicePolyline(full, span[0], span[1]),
      tracks: trackLines(full, link.type, inA, inB),
      marker,
    })
  }

  return { groups, routes, problems: layoutProblems(all, [...routes.values()]) }
}

/** Everything that is closer than MIN_GAP after layout. Empty means a clean board. */
function layoutProblems(groups: GroupLayout[], routes: RouteLayout[]): string[] {
  const problems: string[] = []
  const round = (n: number) => Math.round(n * 10) / 10
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const gap = rectGap(groups[i].bounds, groups[j].bounds)
      if (gap < MIN_GAP - 0.05) problems.push(`${groups[i].location.id} and ${groups[j].location.id} are ${round(gap)} apart`)
    }
  }
  const spines = routes.map((r) => markerSpine(r.marker, { x: Math.cos((r.marker.angle * Math.PI) / 180), y: Math.sin((r.marker.angle * Math.PI) / 180) }))
  routes.forEach((route, i) => {
    for (const g of groups) {
      const nearest = Math.min(...spines[i].map((p) => distanceToGroup(g, p))) - MARKER_H / 2
      if (nearest < MIN_GAP - 0.05) problems.push(`marker of ${route.link.id} is ${round(nearest)} from ${g.location.id}`)
    }
    for (let j = i + 1; j < routes.length; j++) {
      let nearest = Infinity
      for (const p of spines[i]) for (const q of spines[j]) nearest = Math.min(nearest, distance(p, q))
      if (nearest - MARKER_H < MIN_GAP - 0.05) problems.push(`markers of ${route.link.id} and ${routes[j].link.id} are ${round(nearest - MARKER_H)} apart`)
    }
  })
  return problems
}

/** Midpoints of each curve segment: where the editor offers to add a bend point. */
export function segmentMidpoints(route: RouteLayout): Point[] {
  return route.segments.map((s) => {
    const line = flatten([s], 4)
    return pointAtLength(line, line.total / 2).point
  })
}

