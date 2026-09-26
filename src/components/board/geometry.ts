/**
 * Geometry for the illustrated board. Board data is in % of the image; the
 * SVG overlay uses viewBox 0 0 1000 1000, so view units = % × 10.
 *
 * A link is a cubic Bézier between its two ends (or a Catmull-Rom spline
 * through its bend points). For drawing, curves are flattened into
 * polylines measured by arc length: textures are laid along them, parallel
 * tracks are offset along their normals, and ends are trimmed at plaques.
 */

export const VIEW = 1000
export const UNITS_PER_PERCENT = VIEW / 100

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** A cubic Bézier segment. */
export interface Cubic {
  p0: Point
  p1: Point
  p2: Point
  p3: Point
}

export const toView = (p: Point): Point => ({ x: p.x * UNITS_PER_PERCENT, y: p.y * UNITS_PER_PERCENT })
export const toPercent = (p: Point): Point => ({ x: p.x / UNITS_PER_PERCENT, y: p.y / UNITS_PER_PERCENT })

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
export const length = (a: Point) => Math.hypot(a.x, a.y)
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Unit vector perpendicular to a→b (rotated 90° clockwise on screen). */
export function unitNormal(a: Point, b: Point): Point {
  const d = sub(b, a)
  const len = length(d) || 1
  return { x: -d.y / len, y: d.x / len }
}

/* ---- Seeded randomness ---------------------------------------------------- */

/** A stable number in [0, 1) for a string, so automatic bends don't change between renders. */
export function seededRandom(key: string): () => number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  let state = h >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---- Curves --------------------------------------------------------------- */

export function cubicAt({ p0, p1, p2, p3 }: Cubic, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

/**
 * A bowed cubic from a to b. `bend` is the sideways bulge as a fraction of the
 * chord (positive = the unitNormal side); `skew` shifts the bulge towards one
 * end for a less mechanical, hand-drawn look.
 */
export function bentCubic(a: Point, b: Point, bend: number, skew = 0): Cubic {
  const chord = distance(a, b)
  const n = unitNormal(a, b)
  // Control points offset by k each put the curve's midpoint 0.75 k off the chord.
  const k = (bend * chord) / 0.75
  return {
    p0: a,
    p1: add(lerp(a, b, 1 / 3), scale(n, k * (1 + skew))),
    p2: add(lerp(a, b, 2 / 3), scale(n, k * (1 - skew))),
    p3: b,
  }
}

/** Catmull-Rom spline through the points, as cubic segments (one per gap). */
export function catmullRom(points: Point[]): Cubic[] {
  const segments: Cubic[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p3 = points[i + 1]
    // Mirror the neighbours at the ends.
    const before = points[i - 1] ?? sub(scale(p0, 2), p3)
    const after = points[i + 2] ?? sub(scale(p3, 2), p0)
    segments.push({ p0, p1: add(p0, scale(sub(p3, before), 1 / 6)), p2: sub(p3, scale(sub(after, p0), 1 / 6)), p3 })
  }
  return segments
}

/* ---- Polylines ------------------------------------------------------------ */

/** A flattened curve with cumulative arc lengths: `lengths[i]` is the distance along it to `points[i]`. */
export interface Polyline {
  points: Point[]
  lengths: number[]
  total: number
}

export function polyline(points: Point[]): Polyline {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]))
  return { points, lengths, total: lengths[lengths.length - 1] ?? 0 }
}

/** Flatten cubic segments into a polyline with steps of about `step` units. */
export function flatten(segments: Cubic[], step = 2): Polyline {
  const points: Point[] = []
  segments.forEach((segment, i) => {
    const rough = distance(segment.p0, segment.p1) + distance(segment.p1, segment.p2) + distance(segment.p2, segment.p3)
    const n = Math.max(4, Math.ceil(rough / step))
    for (let k = i === 0 ? 0 : 1; k <= n; k++) points.push(cubicAt(segment, k / n))
  })
  return polyline(points)
}

/** Index of the polyline piece containing arc length s. */
function pieceAt(line: Polyline, s: number): number {
  let lo = 0
  let hi = line.points.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (line.lengths[mid] <= s) lo = mid
    else hi = mid
  }
  return lo
}

/** The point at arc length s, and the unit tangent there. */
export function pointAtLength(line: Polyline, s: number): { point: Point; tangent: Point } {
  const { points, lengths } = line
  if (points.length < 2) return { point: points[0] ?? { x: 0, y: 0 }, tangent: { x: 1, y: 0 } }
  const clamped = Math.min(line.total, Math.max(0, s))
  const i = Math.min(pieceAt(line, clamped), points.length - 2)
  const span = lengths[i + 1] - lengths[i] || 1
  const d = sub(points[i + 1], points[i])
  const len = length(d) || 1
  return { point: lerp(points[i], points[i + 1], (clamped - lengths[i]) / span), tangent: { x: d.x / len, y: d.y / len } }
}

/** The part of a polyline between arc lengths s0 and s1. */
export function slicePolyline(line: Polyline, s0: number, s1: number): Polyline {
  if (s1 <= s0) return polyline([pointAtLength(line, s0).point])
  const inner = line.points.filter((_, i) => line.lengths[i] > s0 && line.lengths[i] < s1)
  return polyline([pointAtLength(line, s0).point, ...inner, pointAtLength(line, s1).point])
}

/** A polyline running parallel at distance d (positive = the unitNormal side of travel). */
export function offsetPolyline(line: Polyline, d: number): Polyline {
  const { points } = line
  if (points.length < 2) return line
  const shifted = points.map((p, i) => {
    // Average the normals of the pieces either side of each vertex.
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    return add(p, scale(unitNormal(a, b), d))
  })
  return polyline(shifted)
}

/**
 * Arc lengths where the line first leaves `insideStart` and last comes out of
 * `insideEnd`, walking in from each end: the visible part between two shapes.
 */
export function visibleSpan(line: Polyline, insideStart: (p: Point) => boolean, insideEnd: (p: Point) => boolean): [number, number] {
  const { points, lengths } = line
  const refine = (inside: (p: Point) => boolean, iIn: number, iOut: number) => {
    // Binary search between a sample inside and one outside.
    let a = lengths[iIn]
    let b = lengths[iOut]
    for (let k = 0; k < 12; k++) {
      const m = (a + b) / 2
      if (inside(pointAtLength(line, m).point)) a = m
      else b = m
    }
    return (a + b) / 2
  }
  let start = 0
  for (let i = 0; i < points.length; i++) {
    if (!insideStart(points[i])) {
      start = i === 0 ? 0 : refine(insideStart, i - 1, i)
      break
    }
    if (i === points.length - 1) start = line.total / 2
  }
  let end = line.total
  for (let i = points.length - 1; i >= 0; i--) {
    if (!insideEnd(points[i])) {
      end = i === points.length - 1 ? line.total : refine(insideEnd, i + 1, i)
      break
    }
    if (i === 0) end = line.total / 2
  }
  return end > start ? [start, end] : [(start + end) / 2, (start + end) / 2]
}

/** SVG path data for a polyline, rounded to 0.1 unit. */
export function polylinePath(line: Polyline): string {
  const f = (n: number) => Math.round(n * 10) / 10
  return line.points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('')
}

/* ---- Texture slices ------------------------------------------------------- */

/**
 * One straight slice of a textured track: drawn at (x, y), rotated by `angle`
 * degrees, `w` long, showing the texture from `u` (its position along the
 * repeating texture). Slices overlap by `overlap` so bends show no gaps.
 */
export interface TrackSlice {
  x: number
  y: number
  angle: number
  u: number
  w: number
}

/**
 * Cut a track into straight slices that follow the line. Each texture piece
 * (`pieceLength` long, repeated end to end) is split into equal slices of at
 * most `maxSlice`; the last slice stops exactly at the end of the line.
 */
export function trackSlices(line: Polyline, pieceLength: number, maxSlice = 16, overlap = 1): TrackSlice[] {
  const perPiece = Math.max(1, Math.ceil(pieceLength / maxSlice))
  const step = pieceLength / perPiece
  const slices: TrackSlice[] = []
  for (let s = 0; s < line.total - 0.01; s += step) {
    const end = Math.min(line.total, s + step)
    const a = pointAtLength(line, s).point
    const b = pointAtLength(line, end).point
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    const isLast = end >= line.total
    slices.push({ x: a.x, y: a.y, angle, u: s % pieceLength, w: distance(a, b) + (isLast ? 0 : overlap) })
  }
  return slices
}

/* ---- Rects and shapes ----------------------------------------------------- */

export const inflate = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 })

export function union(rects: Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x))
  const y0 = Math.min(...rects.map((r) => r.y))
  const x1 = Math.max(...rects.map((r) => r.x + r.w))
  const y1 = Math.max(...rects.map((r) => r.y + r.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Distance from a point to a rect (0 inside). */
export function distanceToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
  return Math.hypot(dx, dy)
}

/** Gap between two rects (negative when they overlap, by the smaller penetration). */
export function rectGap(a: Rect, b: Rect): number {
  const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
  const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
  if (gx < 0 && gy < 0) return Math.max(gx, gy)
  if (gx < 0) return gy
  if (gy < 0) return gx
  return Math.hypot(gx, gy)
}

/* ---- Shapes --------------------------------------------------------------- */

/** Round a percentage to one decimal, clamped to the image. */
export function roundPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10
}

/**
 * A flat hexagon w × h centred on (cx, cy): pointed ends left and right, flat
 * top and bottom. `tip` is how far the points reach past the flat edges.
 */
export function flatHexagonPath(cx: number, cy: number, w: number, h: number, tip = h / 2): string {
  const f = (n: number) => Math.round(n * 100) / 100
  const x0 = cx - w / 2
  const x1 = cx + w / 2
  return `M${f(x0)} ${f(cy)}L${f(x0 + tip)} ${f(cy - h / 2)}H${f(x1 - tip)}L${f(x1)} ${f(cy)}L${f(x1 - tip)} ${f(cy + h / 2)}H${f(x0 + tip)}Z`
}
