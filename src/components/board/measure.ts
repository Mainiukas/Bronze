import { useEffect, useState } from 'react'

/**
 * Text measurement for sizing plates to their names. SVG text is laid out
 * in viewBox units, so measuring at "N px" gives a width in units.
 */

export type MeasureText = (text: string, font: string, letterSpacing?: number) => number

/**
 * Advance widths of Cinzel Bold (the board's label font), per 1000 units of
 * font size, measured in Chromium. Every label is measured from this table,
 * so the layout is the same in every browser, before the font has loaded,
 * and in the tests. Kerning is left out, which makes labels measure 0–3 %
 * wider than they draw: they always fit their plates.
 */
const CINZEL_BOLD: Record<string, number> = {
  A: 717, B: 674, C: 780, D: 828, E: 632, F: 596, G: 836, H: 862, I: 387, J: 385, K: 757, L: 617, M: 953,
  N: 865, O: 879, P: 656, Q: 883, R: 747, S: 578, T: 667, U: 821, V: 728, W: 971, X: 729, Y: 702, Z: 661,
  '0': 653, '1': 393, '2': 617, '3': 563, '4': 619, '5': 554, '6': 630, '7': 545, '8': 603, '9': 630,
  ' ': 250, '-': 380, '’': 245, "'": 200, '&': 807, '.': 222, ',': 231, '(': 423, ')': 423,
}
/** For anything not in the table: about a wide capital. */
const UNKNOWN = 860

/** A measurer with its own cache: `font` gives the size (its "N px"); the width is in the same units. */
export function createTextMeasurer(): MeasureText {
  const cache = new Map<string, number>()
  return (text, font, letterSpacing = 0) => {
    const key = `${font}|${letterSpacing}|${text}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16)
    let units = 0
    for (const c of text) units += CINZEL_BOLD[c] ?? CINZEL_BOLD[c.toUpperCase()] ?? UNKNOWN
    const width = (size * units) / 1000 + letterSpacing * text.length
    cache.set(key, width)
    return width
  }
}

/** True once `fonts` (CSS font shorthands) have loaded. */
export function useFontsReady(fonts: string[]): boolean {
  const [ready, setReady] = useState(
    () => typeof document === 'undefined' || !document.fonts || fonts.every((f) => document.fonts.check(f)),
  )
  const key = fonts.join(',')
  useEffect(() => {
    if (ready || !document.fonts) return
    let alive = true
    Promise.all(key.split(',').map((f) => document.fonts.load(f)))
      .catch(() => [])
      .then(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [key, ready])
  return ready
}
