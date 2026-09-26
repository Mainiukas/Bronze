import { useEffect, useState } from 'react'

/**
 * Text measurement for sizing banners to their names. SVG text is laid out
 * in viewBox units, so measuring at "N px" gives a width in units.
 */

export type MeasureText = (text: string, font: string, letterSpacing?: number) => number

/**
 * A measurer with its own cache. Once `fontsLoaded`, it measures exactly with
 * canvas; before that (or without canvas) it estimates from Cinzel's average
 * letter width, so banners don't jump much when the font arrives.
 */
export function createTextMeasurer(fontsLoaded: boolean): MeasureText {
  const cache = new Map<string, number>()
  let context: CanvasRenderingContext2D | null = null
  if (fontsLoaded) {
    try {
      context = document.createElement('canvas').getContext('2d')
    } catch {
      context = null
    }
  }
  return (text, font, letterSpacing = 0) => {
    const key = `${font}|${letterSpacing}|${text}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    let width: number
    if (context) {
      context.font = font
      width = context.measureText(text).width
    } else {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16)
      const capitals = text.replace(/[^A-Z]/g, '').length
      width = size * (capitals * 0.78 + (text.length - capitals) * 0.64)
    }
    width += letterSpacing * text.length
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
