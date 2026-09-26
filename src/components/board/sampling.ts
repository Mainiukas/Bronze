import { flatten, pointAtLength, type Cubic, type Point } from './geometry'

/**
 * Measure a curve the way the browser draws it: an SVG path's
 * getTotalLength() and getPointAtLength(). Outside a browser (tests) the
 * curve is flattened and measured in JavaScript instead.
 */

let measuringPath: SVGPathElement | null = null

function pathElement(): SVGPathElement | null {
  if (typeof document === 'undefined' || !document.body) return null
  if (!measuringPath) {
    // Attached (but hidden) so every browser will measure it.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden'
    measuringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.append(measuringPath)
    document.body.append(svg)
  }
  return measuringPath
}

export interface PathSampler {
  total: number
  /** Point and unit tangent at arc length s. */
  at: (s: number) => { point: Point; tangent: Point }
}

export function samplePath(d: string, segments: Cubic[]): PathSampler {
  const path = pathElement()
  if (!path) {
    const line = flatten(segments, 1)
    return { total: line.total, at: (s) => pointAtLength(line, s) }
  }
  path.setAttribute('d', d)
  const total = path.getTotalLength()
  const point = (s: number) => {
    const p = path.getPointAtLength(Math.min(total, Math.max(0, s)))
    return { x: p.x, y: p.y }
  }
  // Read everything now: the shared element is reused for the next path.
  const cache = new Map<number, { point: Point; tangent: Point }>()
  const at = (s: number) => {
    const key = Math.round(s * 100) / 100
    const hit = cache.get(key)
    if (hit) return hit
    const a = point(s - 0.5)
    const b = point(s + 0.5)
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const value = { point: point(s), tangent: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } }
    cache.set(key, value)
    return value
  }
  return { total, at }
}
