/**
 * Geometry for the illustrated board. Board data is in % of the image; the
 * SVG overlay uses viewBox 0 0 1000 1000, so view units = % × 10.
 *
 * A link is a cubic Bézier between its two ends (or a Catmull-Rom spline
 * through its bend points). Curves are flattened into polylines measured
 * by arc length for layout checks; textures are laid along the SVG path.
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

/** A stable number stream for a string, so automatic bends don't change between renders. */
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

/** SVG path data for cubic segments. */
export function cubicPath(segments: Cubic[]): string {
  const f = (n: number) => Math.round(n * 100) / 100
  if (!segments.length) return ''
  return (
    `M${f(segments[0].p0.x)} ${f(segments[0].p0.y)}` +
    segments.map((s) => `C${f(s.p1.x)} ${f(s.p1.y)} ${f(s.p2.x)} ${f(s.p2.y)} ${f(s.p3.x)} ${f(s.p3.y)}`).join('')
  )
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

/** The point at arc length s, and the unit tangent there. */
export function pointAtLength(line: Polyline, s: number): { point: Point; tangent: Point } {
  const { points, lengths } = line
  if (points.length < 2) return { point: points[0] ?? { x: 0, y: 0 }, tangent: { x: 1, y: 0 } }
  const clamped = Math.min(line.total, Math.max(0, s))
  let lo = 0
  let hi = points.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] <= clamped) lo = mid
    else hi = mid
  }
  const i = Math.min(lo, points.length - 2)
  const span = lengths[i + 1] - lengths[i] || 1
  const d = sub(points[i + 1], points[i])
  const len = length(d) || 1
  return { point: lerp(points[i], points[i + 1], (clamped - lengths[i]) / span), tangent: { x: d.x / len, y: d.y / len } }
}

/** SVG path data for a polyline, rounded to 0.1 unit. */
export function polylinePath(line: Polyline): string {
  const f = (n: number) => Math.round(n * 10) / 10
  return line.points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('')
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const d = sub(b, a)
  const len2 = d.x * d.x + d.y * d.y
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / len2)) : 0
  return distance(p, { x: a.x + d.x * t, y: a.y + d.y * t })
}

/** Distance from a point to a polyline. */
export function distanceToLine(p: Point, line: Polyline): number {
  let nearest = Infinity
  for (let i = 1; i < line.points.length; i++) nearest = Math.min(nearest, segmentDistance(p, line.points[i - 1], line.points[i]))
  return line.points.length === 1 ? distance(p, line.points[0]) : nearest
}

/** Smallest distance between two polylines (0 if they cross). */
export function lineGap(a: Polyline, b: Polyline): number {
  let nearest = Infinity
  for (const p of a.points) nearest = Math.min(nearest, distanceToLine(p, b))
  for (const p of b.points) nearest = Math.min(nearest, distanceToLine(p, a))
  return segmentsCross(a, b) ? 0 : nearest
}

function segmentsCross(a: Polyline, b: Polyline): boolean {
  const cross = (o: Point, p: Point, q: Point) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x)
  for (let i = 1; i < a.points.length; i++) {
    for (let j = 1; j < b.points.length; j++) {
      const [p1, p2, q1, q2] = [a.points[i - 1], a.points[i], b.points[j - 1], b.points[j]]
      const d1 = cross(q1, q2, p1)
      const d2 = cross(q1, q2, p2)
      const d3 = cross(p1, p2, q1)
      const d4 = cross(p1, p2, q2)
      if (d1 * d2 < 0 && d3 * d4 < 0) return true
    }
  }
  return false
}

export function lineBounds(line: Polyline): Rect {
  const xs = line.points.map((p) => p.x)
  const ys = line.points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/* ---- Texture pieces ------------------------------------------------------- */

/**
 * One piece of a textured route: a quad between the route's normals at two
 * points along it, filled with the texture rotated to the route there. `u` is
 * where the piece starts in the repeating texture. Neighbouring quads share
 * an edge exactly, so pieces sit edge to edge with no overlap and no gap.
 */
export interface TexturePiece {
  quad: [Point, Point, Point, Point]
  x: number
  y: number
  angle: number
  u: number
}

/**
 * Cut a route into texture pieces. `at(s)` gives the point and unit tangent
 * at arc length s (from getPointAtLength, or a polyline). Each repeat of the
 * texture (`pieceLength`) is split into equal pieces of at most `maxPiece` so
 * they follow the curve; the last one stops exactly at the end.
 */
export function texturePieces(
  at: (s: number) => { point: Point; tangent: Point },
  total: number,
  pieceLength: number,
  height: number,
  maxPiece = 12,
): TexturePiece[] {
  const step = pieceLength / Math.max(1, Math.ceil(pieceLength / maxPiece))
  const half = height / 2 + 1
  const pieces: TexturePiece[] = []
  for (let s = 0; s < total - 0.01; s += step) {
    const e = Math.min(total, s + step)
    const a = at(s)
    const b = at(e)
    const na = { x: -a.tangent.y, y: a.tangent.x }
    const nb = { x: -b.tangent.y, y: b.tangent.x }
    pieces.push({
      quad: [add(a.point, scale(na, half)), add(b.point, scale(nb, half)), sub(b.point, scale(nb, half)), sub(a.point, scale(na, half))],
      x: a.point.x,
      y: a.point.y,
      angle: (Math.atan2(b.point.y - a.point.y, b.point.x - a.point.x) * 180) / Math.PI,
      u: s % pieceLength,
    })
  }
  return pieces
}

/**
 * The rotation for art laid along a route (link tokens): if the route's angle
 * is between 90° and 270°, turn it 180° so the barge or train is never upside down.
 */
export function upright(angle: number): number {
  const a = ((angle % 360) + 360) % 360
  return a > 90 && a < 270 ? a - 180 : a
}

/* ---- Hulls ---------------------------------------------------------------- */

/** Convex hull (counter-clockwise on screen) of a set of points. */
export function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const build = (list: Point[]) => {
    const out: Point[] = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...build(sorted), ...build([...sorted].reverse())]
}

/** A closed outline measured by perimeter position. */
export interface Outline {
  points: Point[]
  /** Perimeter position of each vertex. */
  lengths: number[]
  perimeter: number
}

export function outline(points: Point[]): Outline {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]))
  return { points, lengths, perimeter: lengths[lengths.length - 1] + distance(points[points.length - 1], points[0]) }
}

/** The outline's point at perimeter position p (wraps around). */
export function outlinePoint(o: Outline, p: number): Point {
  const pos = ((p % o.perimeter) + o.perimeter) % o.perimeter
  let i = 0
  while (i < o.points.length - 1 && o.lengths[i + 1] <= pos) i++
  const a = o.points[i]
  const b = o.points[(i + 1) % o.points.length]
  const span = (i + 1 < o.points.length ? o.lengths[i + 1] : o.perimeter) - o.lengths[i] || 1
  return lerp(a, b, (pos - o.lengths[i]) / span)
}

/** Perimeter position where a ray from `from` (inside) in direction `dir` leaves the outline. */
export function rayExit(o: Outline, from: Point, dir: Point): number {
  let best = { t: Infinity, pos: 0 }
  for (let i = 0; i < o.points.length; i++) {
    const a = o.points[i]
    const b = o.points[(i + 1) % o.points.length]
    const e = sub(b, a)
    const denom = dir.x * e.y - dir.y * e.x
    if (Math.abs(denom) < 1e-9) continue
    const w = sub(a, from)
    const t = (w.x * e.y - w.y * e.x) / denom
    const u = (w.x * dir.y - w.y * dir.x) / denom
    if (t > 0 && u >= 0 && u <= 1 && t < best.t) best = { t, pos: o.lengths[i] + u * distance(a, b) }
  }
  return best.pos
}

/* ---- Rects ---------------------------------------------------------------- */

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

/* ---- Percentages ---------------------------------------------------------- */

/** Round a percentage to one decimal, clamped to the image. */
export function roundPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10
}
