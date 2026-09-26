/**
 * Where everything on the illustrated board goes, in view units (viewBox
 * 0 0 1000 1000): each location's tile group, plaque or hub, and, for each
 * era, the routes that exist in it with their link spaces.
 *
 * Groups start centred on their location (or at its labelOffset) and are
 * nudged apart until nothing overlaps: at least MIN_GAP between any two
 * groups, and enough room between linked groups for a link space. Location
 * points never move.
 *
 * Routes end TRIM short of a group's outline, their ends fanned out around it
 * at least FAN apart. Each gets a seeded 8–15 % bend, flipped or increased
 * where it would run into another route, a group or a link space.
 */

import { isLinkActive, type BoardData, type BoardLink, type BoardLocation, type Era } from '../../data/board'
import {
  bentCubic,
  catmullRom,
  convexHull,
  distance,
  distanceToLine,
  distanceToRect,
  flatten,
  inflate,
  lineBounds,
  lineGap,
  outline,
  outlinePoint,
  pointAtLength,
  polyline,
  rayExit,
  rectGap,
  seededRandom,
  sub,
  toView,
  union,
  type Cubic,
  type Outline,
  type Point,
  type Polyline,
  type Rect,
} from './geometry'
import type { MeasureText } from './measure'

/* ---- Sizes (view units) --------------------------------------------------- */

export const TILE = 34
export const TILE_GAP = 3
export const PLATE_H = 20
const PLATE_GAP = 3
const PLATE_PAD = 9

export const STOP_H = 22
const STOP_PAD = 12
export const EMBLEM_R = 5

export const MEDALLION_R = 32
export const IRON_RING = 4
export const HUB_SLOT_W = 34
export const HUB_SLOT_H = 20
const HUB_SLOT_GAP = 4
export const RIBBON_H = 18
export const RIBBON_TAIL = 9
export const BADGE = 16
export const BONUS_R = 9
export const BUY_ICON = 10
const BUY_GAP = 2

export const RAIL_BADGE_R = 8

export const CITY_FONT = 13.5
export const STOP_FONT = 12
export const HUB_FONT = 11.5
export const CITY_WEIGHT = 700
export const STOP_WEIGHT = 700
export const HUB_WEIGHT = 700
/** Letter spacing, in em. */
export const CITY_TRACKING = 0.06
export const STOP_TRACKING = 0.18
export const HUB_TRACKING = 0.12

/** CSS font shorthand used both to draw and to measure each kind of label. */
export const boardFont = (size: number, weight: number) => `${weight} ${size}px Cinzel`

/** Texture heights on the board, and the length of one repeat of each texture (sources 1639 × 256 and 1084 × 256). */
export const TRACK_H: Record<Era, number> = { canal: 12, rail: 14 }
export const TEXTURE_PIECE: Record<Era, number> = { canal: (1639 * 12) / 256, rail: (1084 * 14) / 256 }

/** Empty link space (a flat hexagon) and a built link's token. */
export const LINK_W = 40
export const LINK_H = 22
export const TOKEN_W = 44
export const TOKEN_H = 18

/** Routes stop this far short of a plaque or tile group. */
export const TRIM = 4
/** Smallest gap between any two groups, link spaces or tokens. */
export const MIN_GAP = 8
/** Route ends around one group are at least this far apart along its outline (the spec asks for 14). */
export const FAN = 18
/** Extra room kept between two routes' textures. */
const ROUTE_CLEAR = 2
/** A link space or token, as a capsule: spine half-length and radius (covers 44 × 22). */
const SPACE_SPINE = TOKEN_W / 2 - LINK_H / 2
const SPACE_R = LINK_H / 2
/**
 * Room linked groups need between them along the line joining them: the link
 * space or token, a gap on each side, and slack for routes arriving at an angle.
 */
const LINK_GAP = TOKEN_W + 2 * MIN_GAP + 12
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
  /** The two merchant spaces (bounding boxes of the hexagons). */
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
  bounds: Rect
  parts: CityParts | StopParts | HubParts
  /** Rail-era badge centre, if the location has one. */
  railBadge: Point | null
  fontSize: number
  /** Placed by hand (labelOffset), so the nudging leaves it alone. */
  fixed: boolean
  solids: Solid[]
  /** Convex outline TRIM outside the drawn shapes: where routes end. */
  rim: Outline
}

export interface RouteLayout {
  link: BoardLink
  era: Era
  /** The drawn curve, end to end (the ends sit on the groups' rims). */
  segments: Cubic[]
  line: Polyline
  width: number
  /** Link space / token centre and rotation (degrees). */
  marker: { x: number; y: number; angle: number }
}

export interface RoutesLayout {
  era: Era
  routes: Map<string, RouteLayout>
  /** Overlaps left in this era, as readable messages. Empty means a clean board. */
  problems: string[]
}

export interface GroupsLayout {
  groups: Map<string, GroupLayout>
  problems: string[]
}

/** A group that must keep `clearance` away from a route (found by a previous layout pass). */
export interface Avoid {
  id: string
  line: Polyline
  clearance: number
}

/* ---- Group shapes --------------------------------------------------------- */

type Shape = Omit<GroupLayout, 'location' | 'point' | 'center' | 'fixed' | 'rim'>

const moveRect = (r: Rect, d: Point): Rect => ({ x: r.x + d.x, y: r.y + d.y, w: r.w, h: r.h })
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
    const railBadge = railOnly ? { x: plate.x + plate.w - 1, y: plate.y + 1 } : null
    const solids: Solid[] = [
      { type: 'rect', rect: block },
      { type: 'rect', rect: plate },
      ...(railBadge ? [{ type: 'circle' as const, c: railBadge, r: RAIL_BADGE_R }] : []),
    ]
    const bounds = union([block, plate, ...(railBadge ? [circleBox(railBadge, RAIL_BADGE_R)] : [])])
    return { parts: { type: 'city', tiles, plate }, bounds, railBadge, fontSize: CITY_FONT, solids }
  }

  if (location.type === 'stop') {
    const text = measure(name, boardFont(STOP_FONT, STOP_WEIGHT), STOP_FONT * STOP_TRACKING)
    const plaque = { x: 0, y: 0, w: Math.ceil(text + STOP_PAD * 2), h: STOP_H }
    const emblems = [
      { x: plaque.w / 2 - EMBLEM_R - 2, y: 0 },
      { x: plaque.w / 2 + EMBLEM_R + 2, y: 0 },
    ]
    const railBadge = railOnly ? { x: plaque.w - 1, y: 1 } : null
    const solids: Solid[] = [
      { type: 'rect', rect: plaque },
      ...emblems.map((c) => ({ type: 'circle' as const, c, r: EMBLEM_R })),
      ...(railBadge ? [{ type: 'circle' as const, c: railBadge, r: RAIL_BADGE_R }] : []),
    ]
    const bounds = union([plaque, ...emblems.map((c) => circleBox(c, EMBLEM_R * 0.87)), ...(railBadge ? [circleBox(railBadge, RAIL_BADGE_R)] : [])])
    return { parts: { type: 'stop', plaque, emblems }, bounds, railBadge, fontSize: STOP_FONT, solids }
  }

  // Hub: medallion at (0, 0), two merchant spaces on top, ribbon across the middle.
  const R = MEDALLION_R
  const text = measure(name, boardFont(HUB_FONT, HUB_WEIGHT), HUB_FONT * HUB_TRACKING)
  const ribbonW = Math.max(R * 2 + 20, Math.ceil(text + 26))
  const ribbon = { x: -ribbonW / 2, y: -RIBBON_H / 2 - 1, w: ribbonW, h: RIBBON_H }
  const slots = [-1, 1].map((side) => ({
    x: side * (HUB_SLOT_W / 2 + HUB_SLOT_GAP / 2) - HUB_SLOT_W / 2,
    y: -R - HUB_SLOT_H + 5,
    w: HUB_SLOT_W,
    h: HUB_SLOT_H,
  }))
  const badge = { x: -R - 6 - BADGE / 2, y: ribbon.y - BADGE - 2, w: BADGE, h: BADGE }
  const bonus = { x: 0, y: R + 5 }
  const n = location.buys.length
  const iconsW = n * BUY_ICON + (n - 1) * BUY_GAP
  const icons = location.buys.map((_, i) => ({ x: -iconsW / 2 + i * (BUY_ICON + BUY_GAP), y: ribbon.y + ribbon.h + 3, w: BUY_ICON, h: BUY_ICON }))
  const tails = { x: ribbon.x - RIBBON_TAIL, y: ribbon.y + 2, w: ribbon.w + RIBBON_TAIL * 2, h: ribbon.h + 3 }
  const railBadge = railOnly ? { x: ribbon.x + ribbon.w, y: ribbon.y } : null
  const solids: Solid[] = [
    { type: 'circle', c: { x: 0, y: 0 }, r: R + 1 },
    { type: 'rect', rect: tails },
    ...slots.map((rect) => ({ type: 'rect' as const, rect })),
    { type: 'rect', rect: badge },
    { type: 'circle', c: bonus, r: BONUS_R },
    ...(railBadge ? [{ type: 'circle' as const, c: railBadge, r: RAIL_BADGE_R }] : []),
  ]
  const bounds = union([circleBox({ x: 0, y: 0 }, R + 1), tails, ...slots, badge, circleBox(bonus, BONUS_R), ...(railBadge ? [circleBox(railBadge, RAIL_BADGE_R)] : [])])
  return { parts: { type: 'hub', medallion: { x: 0, y: 0 }, slots, ribbon, badge, bonus, icons }, bounds, railBadge, fontSize: HUB_FONT, solids }
}

/** Distance from p to the nearest shape the group draws (0 inside). */
export function distanceToGroup(group: Pick<GroupLayout, 'solids'>, p: Point): number {
  let nearest = Infinity
  for (const s of group.solids) nearest = Math.min(nearest, s.type === 'rect' ? distanceToRect(p, s.rect) : Math.max(0, distance(p, s.c) - s.r))
  return nearest
}

/** The convex outline TRIM outside a group's shapes, rounded at the corners. */
function rimOf(solids: Solid[]): Outline {
  const points: Point[] = []
  const ring = (c: Point, r: number, n = 12) => {
    for (let i = 0; i < n; i++) points.push({ x: c.x + Math.cos((i / n) * Math.PI * 2) * r, y: c.y + Math.sin((i / n) * Math.PI * 2) * r })
  }
  for (const s of solids) {
    if (s.type === 'circle') ring(s.c, s.r + TRIM, 16)
    else {
      const { x, y, w, h } = s.rect
      for (const corner of [
        { x, y },
        { x: x + w, y },
        { x, y: y + h },
        { x: x + w, y: y + h },
      ])
        ring(corner, TRIM, 8)
    }
  }
  return outline(convexHull(points))
}

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

/** A group this close to the straight line of a link it isn't part of is edged aside. */
const CORRIDOR = 4

/** Nudge groups apart. Deterministic: the same board always lays out the same way. */
function relax(bodies: Body[], linked: Set<string>, links: [number, number][], avoid: { body: Body; line: Polyline; clearance: number }[]) {
  const move = (a: Body, b: Body, d: Point) => {
    // Push a by −d and b by +d, sharing the move unless one is pinned.
    const share = a.fixed || b.fixed ? 1 : 0.5
    if (!a.fixed) a.center = { x: a.center.x - d.x * share, y: a.center.y - d.y * share }
    if (!b.fixed) b.center = { x: b.center.x + d.x * share, y: b.center.y + d.y * share }
  }
  const ITERATIONS = 1200
  const SPRING_UNTIL = 400
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
          const span = distance(a.center, b.center) || 1
          const dir = { x: (b.center.x - a.center.x) / span, y: (b.center.y - a.center.y) / span }
          const gap = span - exitDistance(ra, a.center, dir) - exitDistance(rb, b.center, { x: -dir.x, y: -dir.y })
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
    // Early on, edge groups off the straight line of links they aren't part of, so routes needn't swerve around them.
    for (const [ia, ib] of iter < SPRING_UNTIL ? links : []) {
      const a = bodies[ia].center
      const b = bodies[ib].center
      for (let k = 0; k < bodies.length; k++) {
        const c = bodies[k]
        if (k === ia || k === ib || c.fixed) continue
        const rect = boundsAt(c)
        // Quick reject: the link's box doesn't come near the group.
        if (rect.x > Math.max(a.x, b.x) + CORRIDOR || rect.x + rect.w < Math.min(a.x, b.x) - CORRIDOR) continue
        if (rect.y > Math.max(a.y, b.y) + CORRIDOR || rect.y + rect.h < Math.min(a.y, b.y) - CORRIDOR) continue
        let nearest = { d: Infinity, at: a }
        for (let t = 0.1; t <= 0.9; t += 0.05) {
          const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
          const d = distanceToRect(q, rect)
          if (d < nearest.d) nearest = { d, at: q }
        }
        if (nearest.d >= CORRIDOR) continue
        // Sideways, away from the line.
        const n = { x: -(b.y - a.y), y: b.x - a.x }
        const len = Math.hypot(n.x, n.y) || 1
        const side = Math.sign((c.center.x - nearest.at.x) * n.x + (c.center.y - nearest.at.y) * n.y) || 1
        const push = Math.min(CORRIDOR - nearest.d, 2)
        c.center = { x: c.center.x + (n.x / len) * push * side, y: c.center.y + (n.y / len) * push * side }
      }
    }
    // Step aside from routes that ran into this group last time.
    for (const { body, line, clearance } of avoid) {
      if (body.fixed) continue
      const rect = boundsAt(body)
      let nearest = { d: Infinity, at: line.points[0] }
      for (const q of line.points) {
        const d = distanceToRect(q, rect)
        if (d < nearest.d) nearest = { d, at: q }
      }
      if (nearest.d >= clearance) continue
      const away = sub(body.center, nearest.at)
      const len = Math.hypot(away.x, away.y) || 1
      const push = Math.min(clearance - nearest.d, 2)
      body.center = { x: body.center.x + (away.x / len) * push, y: body.center.y + (away.y / len) * push }
    }
    for (const b of bodies) if (!b.fixed) b.center = clampToBoard(b.shape, b.center)
    // Once the pull towards the points has stopped, finish as soon as a pass moves nothing.
    if (iter >= SPRING_UNTIL && bodies.every((b, i) => Math.abs(b.center.x - before[i].x) + Math.abs(b.center.y - before[i].y) < 0.01)) break
  }
}

export function layoutGroups(board: BoardData, measure: MeasureText, avoid: Avoid[] = []): GroupsLayout {
  const linked = new Set<string>()
  const index = new Map(board.locations.map((l, i) => [l.id, i]))
  const pairs: [number, number][] = []
  for (const link of board.links) {
    const [i, j] = [index.get(link.from)!, index.get(link.to)!].sort((x, y) => x - y)
    linked.add(`${board.locations[i].id}|${board.locations[j].id}`)
    // Links with hand-set bend points go their own way; only straight-ish ones keep a corridor.
    if (!link.points?.length) pairs.push([i, j])
  }
  const bodies: Body[] = board.locations.map((location) => {
    const raw = rawShape(location, measure)
    const c = { x: raw.bounds.x + raw.bounds.w / 2, y: raw.bounds.y + raw.bounds.h / 2 }
    const shape = moveShape(raw, { x: -c.x, y: -c.y })
    const point = toView(location)
    const fixed = location.labelOffset !== undefined
    const center = fixed ? { x: point.x + location.labelOffset!.x * 10, y: point.y + location.labelOffset!.y * 10 } : clampToBoard(shape, point)
    return { id: location.id, shape, point, center, fixed }
  })
  const byId = new Map(bodies.map((b) => [b.id, b]))
  relax(
    bodies,
    linked,
    pairs,
    avoid.map((a) => ({ body: byId.get(a.id)!, line: a.line, clearance: a.clearance })),
  )

  const groups = new Map<string, GroupLayout>()
  for (const [i, body] of bodies.entries()) {
    const placed = moveShape(body.shape, body.center)
    groups.set(body.id, { ...placed, location: board.locations[i], point: body.point, center: body.center, fixed: body.fixed, rim: rimOf(placed.solids) })
  }
  const problems: string[] = []
  const all = [...groups.values()]
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const gap = rectGap(all[i].bounds, all[j].bounds)
      if (gap < MIN_GAP - 0.05) problems.push(`${all[i].location.id} and ${all[j].location.id} are ${round(gap)} apart`)
    }
  }
  return { groups, problems }
}

const round = (n: number) => Math.round(n * 10) / 10

/* ---- Routes --------------------------------------------------------------- */

/** Automatic bends: 8–15 % of the link's length, then wider sweeps only where needed to clear something. */
const BENDS = [0.08, 0.1, 0.12, 0.15]
const WIDE_BENDS = [0.2, 0.26, 0.32, 0.4, 0.5]

interface Candidate {
  segments: Cubic[]
  line: Polyline
  coarse: Polyline
  box: Rect
  marker: { point: Point; tangent: Point }
}

/** Points along a link space's long axis: with radius SPACE_R they cover the space and its token. */
function spine(at: Point, tangent: Point): Point[] {
  return [-1, -0.5, 0, 0.5, 1].map((k) => ({ x: at.x + tangent.x * SPACE_SPINE * k, y: at.y + tangent.y * SPACE_SPINE * k }))
}

const boxesNear = (a: Rect, b: Rect, pad: number) => rectGap(a, b) < pad

/**
 * Where each route leaves each group: aimed at the other end (or the first
 * bend point), then spread around the group's rim so ends are at least FAN
 * apart.
 */
function routeEnds(links: BoardLink[], groups: Map<string, GroupLayout>, aims?: Map<string, Point>): Map<string, [Point, Point]> {
  const wants = new Map<string, { key: string; pos: number }[]>()
  for (const link of links) {
    for (const end of [0, 1] as const) {
      const here = groups.get(end === 0 ? link.from : link.to)!
      const there = groups.get(end === 0 ? link.to : link.from)!
      const bend = link.points?.length ? (end === 0 ? link.points[0] : link.points[link.points.length - 1]) : null
      const toward = aims?.get(`${link.id}:${end}`) ?? (bend ? toView({ x: bend[0], y: bend[1] }) : there.center)
      const d = sub(toward, here.center)
      const len = Math.hypot(d.x, d.y) || 1
      const list = wants.get(here.location.id) ?? []
      list.push({ key: `${link.id}:${end}`, pos: rayExit(here.rim, here.center, { x: d.x / len, y: d.y / len }) })
      wants.set(here.location.id, list)
    }
  }
  const at = new Map<string, Point>()
  for (const [id, list] of wants) {
    const rim = groups.get(id)!.rim
    const P = rim.perimeter
    const minGap = Math.min(FAN, P / list.length)
    list.sort((a, b) => a.pos - b.pos)
    if (list.length > 1) {
      for (let iter = 0; iter < 80; iter++) {
        let moved = false
        for (let i = 0; i < list.length; i++) {
          const a = list[i]
          const b = list[(i + 1) % list.length]
          const gap = (((b.pos - a.pos) % P) + P) % P
          if (gap < minGap - 0.01) {
            const push = (minGap - gap) / 2
            a.pos -= push
            b.pos += push
            moved = true
          }
        }
        if (!moved) break
      }
    }
    for (const w of list) at.set(w.key, outlinePoint(rim, w.pos))
  }
  return new Map(links.map((l) => [l.id, [at.get(`${l.id}:0`)!, at.get(`${l.id}:1`)!]]))
}

function candidatesFor(link: BoardLink, a: Point, b: Point): Candidate[] {
  const make = (segments: Cubic[]): Candidate => {
    const line = flatten(segments, 2)
    const coarse = flatten(segments, 7)
    return { segments, line, coarse, box: lineBounds(coarse), marker: pointAtLength(line, line.total / 2) }
  }
  if (link.points?.length) return [make(catmullRom([a, ...link.points.map(([x, y]) => toView({ x, y })), b]))]
  const random = seededRandom(link.id)
  const sign = random() < 0.5 ? -1 : 1
  const bend = BENDS[Math.floor(random() * BENDS.length)]
  const skew = (random() - 0.5) * 0.5
  const options: { sign: number; bend: number; skew: number }[] = [{ sign, bend, skew }]
  for (const s of [sign, -sign]) for (const k of BENDS) for (const sk of [skew, -skew]) options.push({ sign: s, bend: k, skew: sk })
  for (const s of [sign, -sign]) for (const k of WIDE_BENDS) for (const sk of [0, 0.35, -0.35]) options.push({ sign: s, bend: k, skew: sk })
  return options.map((o) => make([bentCubic(a, b, o.sign * o.bend, o.skew)]))
}

interface Placed {
  index: number
  link: BoardLink
  width: number
  groups: [GroupLayout, GroupLayout]
  options: Candidate[]
  choice: number
}

/** Conflict costs, cached: each option against the groups, and each pair of options against each other. */
class Costs {
  private alone = new Map<string, number>()
  private pairs = new Map<string, number>()
  private groups: GroupLayout[]
  constructor(groups: GroupLayout[]) {
    this.groups = groups
  }

  /** Against the groups: its own (don't swing back in) and others (keep the texture and link space clear). */
  groupCost(route: Placed, i: number): number {
    const key = `${route.index}:${i}`
    let cost = this.alone.get(key)
    if (cost !== undefined) return cost
    cost = 0
    const c = route.options[i]
    const half = route.width / 2
    const [ga, gb] = route.groups
    const m = spine(c.marker.point, c.marker.tangent)
    for (const g of this.groups) {
      if (!boxesNear(g.bounds, c.box, half + MIN_GAP + SPACE_R)) continue
      const own = g === ga || g === gb
      const need = own ? TRIM - 1 : half + TRIM
      for (const p of c.coarse.points) {
        const d = distanceToGroup(g, p)
        if (d < need) cost += (need - d) * (own ? 2 : 4)
      }
      for (const p of m) {
        const d = distanceToGroup(g, p) - SPACE_R
        if (d < MIN_GAP) cost += (MIN_GAP - d) * 3
      }
    }
    this.alone.set(key, cost)
    return cost
  }

  /** Two routes: textures must not touch, link spaces must keep apart and off the other route. */
  pairCost(a: Placed, i: number, b: Placed, j: number): number {
    const key = a.index < b.index ? `${a.index}:${i}|${b.index}:${j}` : `${b.index}:${j}|${a.index}:${i}`
    let cost = this.pairs.get(key)
    if (cost !== undefined) return cost
    cost = 0
    const ca = a.options[i]
    const cb = b.options[j]
    if (boxesNear(ca.box, cb.box, 30)) {
      const need = (a.width + b.width) / 2 + ROUTE_CLEAR
      const gap = lineGap(ca.coarse, cb.coarse)
      if (gap < need) cost += (need - gap) * 25 + 40
      const sa = spine(ca.marker.point, ca.marker.tangent)
      const sb = spine(cb.marker.point, cb.marker.tangent)
      let nearest = Infinity
      for (const p of sa) for (const q of sb) nearest = Math.min(nearest, distance(p, q))
      if (nearest - 2 * SPACE_R < MIN_GAP) cost += (MIN_GAP - (nearest - 2 * SPACE_R)) * 3
      for (const p of sa) {
        const d = distanceToLine(p, cb.coarse) - SPACE_R - b.width / 2
        if (d < 2) cost += (2 - d) * 2
      }
      for (const p of sb) {
        const d = distanceToLine(p, ca.coarse) - SPACE_R - a.width / 2
        if (d < 2) cost += (2 - d) * 2
      }
    }
    this.pairs.set(key, cost)
    return cost
  }

  /** Everything wrong with a route taking option i while the others keep theirs. */
  total(route: Placed, i: number, others: Placed[]): number {
    let cost = this.groupCost(route, i)
    for (const o of others) cost += this.pairCost(route, i, o, o.choice)
    return cost
  }
}

/** Each route takes its best option given the others, a few times over. */
function settle(placed: Placed[], costs: Costs) {
  for (let sweep = 0; sweep < 6; sweep++) {
    let changed = false
    for (const route of placed) {
      const others = placed.filter((r) => r !== route)
      const current = costs.total(route, route.choice, others)
      if (current === 0) continue
      let best = { i: route.choice, cost: current }
      route.options.forEach((_, i) => {
        if (i === route.choice) return
        // Prefer gentler, earlier options: a tiny cost per step down the list.
        const cost = costs.total(route, i, others) + i * 0.01
        if (cost < best.cost - 1e-6) best = { i, cost }
      })
      if (best.i !== route.choice) {
        route.choice = best.i
        changed = true
      }
    }
    if (!changed) break
  }
}

/**
 * Where two routes still get in each other's way, re-bend both together:
 * one alone can't move out of the other's path while the other stays put.
 */
function untangle(placed: Placed[], costs: Costs) {
  const TOP = 16
  for (let round = 0; round < 3; round++) {
    let changed = false
    for (const a of placed) {
      for (const b of placed) {
        if (a.index >= b.index || costs.pairCost(a, a.choice, b, b.choice) === 0) continue
        const rest = placed.filter((r) => r !== a && r !== b)
        const shortlist = (r: Placed) =>
          r.options
            .map((_, i) => ({ i, cost: costs.total(r, i, rest) + i * 0.01 }))
            .sort((x, y) => x.cost - y.cost)
            .slice(0, TOP)
        const la = shortlist(a)
        const lb = shortlist(b)
        let best = {
          ai: a.choice,
          bi: b.choice,
          cost: costs.total(a, a.choice, rest) + costs.total(b, b.choice, rest) + costs.pairCost(a, a.choice, b, b.choice),
        }
        for (const oa of la) {
          for (const ob of lb) {
            const cost = oa.cost + ob.cost + costs.pairCost(a, oa.i, b, ob.i)
            if (cost < best.cost - 1e-6) best = { ai: oa.i, bi: ob.i, cost }
          }
        }
        if (best.ai !== a.choice || best.bi !== b.choice) {
          a.choice = best.ai
          b.choice = best.bi
          changed = true
        }
      }
    }
    if (!changed) break
  }
}

/**
 * Lay out the routes that exist in an era: ends, bends and link spaces.
 * `quick` (while dragging in the editor) skips the slower refinements.
 */
export function layoutRoutes(board: BoardData, groupsLayout: GroupsLayout, era: Era, quick = false): RoutesLayout {
  const { groups } = groupsLayout
  const all = [...groups.values()]
  const links = board.links.filter((l) => isLinkActive(l.type, era))
  const build = (ends: Map<string, [Point, Point]>, choices?: Map<string, number>): Placed[] =>
    links.map((link, index) => {
      const [a, b] = ends.get(link.id)!
      const options = candidatesFor(link, a, b)
      return { index, link, width: TRACK_H[era], groups: [groups.get(link.from)!, groups.get(link.to)!], options, choice: Math.min(choices?.get(link.id) ?? 0, options.length - 1) }
    })

  // First pass: ends aimed straight at the other town; settle the bends.
  let placed = build(routeEnds(links, groups))
  let costs = new Costs(all)
  settle(placed, costs)
  if (!quick) untangle(placed, costs)
  // Second pass: fan the ends out in the order the curves actually leave each town, and settle again.
  const aims = new Map<string, Point>()
  for (const r of placed) {
    const c = r.options[r.choice]
    aims.set(`${r.link.id}:0`, pointAtLength(c.line, Math.min(c.line.total * 0.3, 60)).point)
    aims.set(`${r.link.id}:1`, pointAtLength(c.line, Math.max(c.line.total * 0.7, c.line.total - 60)).point)
  }
  if (!quick) {
    placed = build(routeEnds(links, groups, aims), new Map(placed.map((r) => [r.link.id, r.choice])))
    costs = new Costs(all)
    settle(placed, costs)
    untangle(placed, costs)
    settle(placed, costs)
  }

  // Link spaces: at the midpoint, or slid along the route to clear groups and each other.
  const routes = new Map<string, RouteLayout>()
  const spaces: Point[][] = []
  for (const route of placed) {
    const c = route.options[route.choice]
    const others = placed.filter((r) => r !== route).map((r) => r.options[r.choice].coarse)
    let best = { bad: Infinity, point: c.marker.point, tangent: c.marker.tangent }
    for (const f of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7]) {
      const at = pointAtLength(c.line, c.line.total * f)
      const s = spine(at.point, at.tangent)
      let bad = 0
      for (const g of all) for (const p of s) bad += Math.max(0, SPACE_R + MIN_GAP - distanceToGroup(g, p))
      for (const other of spaces) {
        let nearest = Infinity
        for (const p of s) for (const q of other) nearest = Math.min(nearest, distance(p, q))
        bad += Math.max(0, 2 * SPACE_R + MIN_GAP - nearest)
      }
      for (const line of others) for (const p of s) bad += Math.max(0, SPACE_R + TRACK_H[era] / 2 + 1 - distanceToLine(p, line)) * 0.2
      if (bad < best.bad - 1e-6) best = { bad, point: at.point, tangent: at.tangent }
      if (bad === 0) break
    }
    spaces.push(spine(best.point, best.tangent))
    routes.set(route.link.id, {
      link: route.link,
      era,
      segments: c.segments,
      line: c.line,
      width: route.width,
      marker: { x: best.point.x, y: best.point.y, angle: (Math.atan2(best.tangent.y, best.tangent.x) * 180) / Math.PI },
    })
  }
  return { era, routes, problems: routeProblems(era, [...routes.values()], all) }
}

/** Overlaps left after layout in one era. Empty means a clean board. */
function routeProblems(era: Era, routes: RouteLayout[], groups: GroupLayout[]): string[] {
  const problems: string[] = []
  const spines = routes.map((r) => {
    const rad = (r.marker.angle * Math.PI) / 180
    return spine(r.marker, { x: Math.cos(rad), y: Math.sin(rad) })
  })
  routes.forEach((route, i) => {
    for (const g of groups) {
      const nearest = Math.min(...spines[i].map((p) => distanceToGroup(g, p))) - SPACE_R
      if (nearest < MIN_GAP - 0.05) problems.push(`${era}: link space of ${route.link.id} is ${round(nearest)} from ${g.location.id}`)
      if (g.location.id === route.link.from || g.location.id === route.link.to) continue
      const run = Math.min(...route.line.points.map((p) => distanceToGroup(g, p))) - route.width / 2
      if (run < 0) problems.push(`${era}: ${route.link.id} runs over ${g.location.id}`)
    }
    for (let j = i + 1; j < routes.length; j++) {
      let nearest = Infinity
      for (const p of spines[i]) for (const q of spines[j]) nearest = Math.min(nearest, distance(p, q))
      if (nearest - 2 * SPACE_R < MIN_GAP - 0.05) problems.push(`${era}: link spaces of ${route.link.id} and ${routes[j].link.id} are ${round(nearest - 2 * SPACE_R)} apart`)
      const gap = lineGap(route.line, routes[j].line)
      if (gap < (route.width + routes[j].width) / 2) problems.push(`${era}: ${route.link.id} and ${routes[j].link.id} overlap`)
    }
  })
  return problems
}

/** Routes that ran into groups (or put a link space too close to one): each group must step aside. */
function blockers(routes: RouteLayout[], groups: GroupLayout[]): Avoid[] {
  const found: Avoid[] = []
  for (const route of routes) {
    const rad = (route.marker.angle * Math.PI) / 180
    const space = polyline(spine(route.marker, { x: Math.cos(rad), y: Math.sin(rad) }))
    for (const g of groups) {
      const own = g.location.id === route.link.from || g.location.id === route.link.to
      if (!own && Math.min(...route.line.points.map((p) => distanceToGroup(g, p))) < route.width / 2 + TRIM) {
        found.push({ id: g.location.id, line: route.line, clearance: route.width / 2 + TRIM + 2 })
      }
      if (Math.min(...space.points.map((p) => distanceToGroup(g, p))) < SPACE_R + MIN_GAP) {
        found.push({ id: g.location.id, line: space, clearance: SPACE_R + MIN_GAP + 1 })
      }
    }
  }
  return found
}

export interface BoardLayout {
  groups: Map<string, GroupLayout>
  /** Routes per era (only the eras asked for). */
  routes: Partial<Record<Era, RoutesLayout>>
  /** Every problem left, both eras. Empty means a clean board. */
  problems: string[]
}

/**
 * The whole layout: groups, then both eras' routes. Where a route still runs
 * into a group, or a link space sits too close to one, that group steps aside
 * and the layout is redone (a few passes at most). Groups are shared by both
 * eras, so the board doesn't shift when the era changes.
 */
export function layoutBoard(board: BoardData, measure: MeasureText, options: { quick?: boolean; eras?: Era[] } = {}): BoardLayout {
  const eras = options.eras ?? (['canal', 'rail'] as const)
  const passes = options.quick ? 1 : 3
  let avoid: Avoid[] = []
  let result: BoardLayout | null = null
  for (let pass = 0; pass < passes; pass++) {
    const groups = layoutGroups(board, measure, avoid)
    const routes = eras.map((era) => layoutRoutes(board, groups, era, options.quick))
    result = {
      groups: groups.groups,
      routes: Object.fromEntries(routes.map((r) => [r.era, r])),
      problems: [...groups.problems, ...routes.flatMap((r) => r.problems)],
    }
    if (!result.problems.length) break
    const all = [...groups.groups.values()]
    const more = routes.flatMap((r) => blockers([...r.routes.values()], all))
    if (!more.length) break
    avoid = [...avoid, ...more]
  }
  return result!
}

/** Midpoints of each curve segment: where the editor offers to add a bend point. */
export function segmentMidpoints(route: RouteLayout): Point[] {
  return route.segments.map((s) => {
    const line = flatten([s], 4)
    return pointAtLength(line, line.total / 2).point
  })
}

/** The bounds of a group, padded, for highlights. */
export const groupBox = (g: GroupLayout, pad: number): Rect => inflate(g.bounds, pad)

