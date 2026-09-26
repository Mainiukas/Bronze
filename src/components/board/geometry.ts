/**
 * Geometry for the illustrated board. Board data is in % of the image; the
 * SVG overlay uses viewBox 0 0 1000 1000, so view units = % × 10.
 *
 * Every link is a quadratic Bézier from one location to the other. Its
 * control point sits on the perpendicular through the midpoint, `curve` %
 * away from it (0 = straight).
 */

export const VIEW = 1000
export const UNITS_PER_PERCENT = VIEW / 100

export interface Point {
  x: number
  y: number
}

export interface Curve {
  p0: Point
  p1: Point
  p2: Point
}

export const toView = (p: Point): Point => ({ x: p.x * UNITS_PER_PERCENT, y: p.y * UNITS_PER_PERCENT })
export const toPercent = (p: Point): Point => ({ x: p.x / UNITS_PER_PERCENT, y: p.y / UNITS_PER_PERCENT })

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
const length = (a: Point) => Math.hypot(a.x, a.y)
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Unit vector perpendicular to a→b (rotated 90° clockwise on screen). */
export function unitNormal(a: Point, b: Point): Point {
  const d = sub(b, a)
  const len = length(d) || 1
  return { x: -d.y / len, y: d.x / len }
}

/** The curve for a link between two points (view units), bent by `curve` %. */
export function linkCurve(a: Point, b: Point, curve = 0): Curve {
  const mid = lerp(a, b, 0.5)
  return { p0: a, p1: add(mid, scale(unitNormal(a, b), curve * UNITS_PER_PERCENT)), p2: b }
}

export function pointAt({ p0, p1, p2 }: Curve, t: number): Point {
  return lerp(lerp(p0, p1, t), lerp(p1, p2, t), t)
}

/** Midpoint of the curve (t = 0.5): where the link marker and edit handle go. */
export const curveMidpoint = (c: Curve): Point => pointAt(c, 0.5)

/** The part of a curve between t0 and t1, itself a quadratic (by blossoming). */
export function subCurve({ p0, p1, p2 }: Curve, t0: number, t1: number): Curve {
  const blossom = (a: number, b: number): Point =>
    add(add(scale(p0, (1 - a) * (1 - b)), scale(p1, (1 - a) * b + a * (1 - b))), scale(p2, a * b))
  return { p0: blossom(t0, t0), p1: blossom(t0, t1), p2: blossom(t1, t1) }
}

/** Rough arc length: the average of chord and control-polygon lengths. */
export function approxLength({ p0, p1, p2 }: Curve): number {
  return (length(sub(p2, p0)) + length(sub(p1, p0)) + length(sub(p2, p1))) / 2
}

/** Shorten a curve by roughly `start` and `end` units at each end. */
export function trimCurve(c: Curve, start: number, end: number): Curve {
  const len = approxLength(c)
  if (len <= start + end + 1) return c
  return subCurve(c, start / len, 1 - end / len)
}

/**
 * A curve running parallel at distance `d` (positive = the unitNormal side),
 * by offsetting each leg of the control polygon (Tiller–Hanson).
 */
export function offsetCurve({ p0, p1, p2 }: Curve, d: number): Curve {
  const n0 = unitNormal(p0, p1)
  const n1 = unitNormal(p1, p2)
  const a0 = add(p0, scale(n0, d))
  const a1 = add(p1, scale(n0, d))
  const b0 = add(p1, scale(n1, d))
  const b1 = add(p2, scale(n1, d))
  // Intersect line a0→a1 with line b0→b1 for the new control point.
  const r = sub(a1, a0)
  const s = sub(b1, b0)
  const denom = r.x * s.y - r.y * s.x
  const control =
    Math.abs(denom) < 1e-6 ? scale(add(a1, b0), 0.5) : add(a0, scale(r, ((b0.x - a0.x) * s.y - (b0.y - a0.y) * s.x) / denom))
  return { p0: a0, p1: control, p2: b1 }
}

export function curvePath({ p0, p1, p2 }: Curve): string {
  const f = (n: number) => Math.round(n * 10) / 10
  return `M${f(p0.x)} ${f(p0.y)}Q${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)}`
}

/**
 * Inverse of the midpoint: the `curve` value (in %) that puts the curve's
 * midpoint as close as possible to `pointer`. Used by the editor's drag handles.
 */
export function curveForMidpoint(a: Point, b: Point, pointer: Point): number {
  const mid = lerp(a, b, 0.5)
  const n = unitNormal(a, b)
  const along = (pointer.x - mid.x) * n.x + (pointer.y - mid.y) * n.y
  // The midpoint moves half as far as the control point.
  return Math.round(((2 * along) / UNITS_PER_PERCENT) * 10) / 10
}

/** Round a percentage to one decimal, clamped to the image. */
export function roundPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10
}

/** Regular hexagon path centred on (cx, cy) with a flat top. */
export function hexagonPath(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i
    return `${Math.round((cx + r * Math.cos(angle)) * 10) / 10} ${Math.round((cy + r * Math.sin(angle)) * 10) / 10}`
  })
  return `M${points.join('L')}Z`
}
