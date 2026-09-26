/**
 * Where each location's banner, slots or plaque sit, in view units
 * (viewBox 0 0 1000 1000). Banners hang just below the location point with
 * the slots underneath; hub plaques are centred on the point.
 */

import type { BoardLocation, CitySize } from '../../data/board'
import { toView, type Point } from './geometry'
import type { MeasureText } from './measure'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const CITY_FONT: Record<CitySize, number> = { small: 13, medium: 14.5, big: 18 }
const CITY_BANNER_H: Record<CitySize, number> = { small: 21, medium: 22, big: 27 }
export const STOP_FONT = 11.5
export const HUB_FONT = 15
export const LETTER_SPACING = 0.06 // em
export const SLOT = 25
const SLOT_GAP = 4
const HUB_ICON = 22
const HUB_ICON_GAP = 7

/** CSS font shorthand used both to draw and to measure each kind of label. */
export const boardFont = (size: number, weight: number) => `${weight} ${size}px Cinzel`
export const CITY_WEIGHT = 700
export const STOP_WEIGHT = 600
export const HUB_WEIGHT = 800

export interface LocationLayout {
  center: Point
  /** City/stop banner band, or the hub plaque. */
  label: Rect
  fontSize: number
  slots: Rect[]
  /** Hub only: where the icons of goods it buys go. */
  icons: Rect[]
  /** Everything drawn for this location, for highlights and tooltips. */
  bounds: Rect
}

/** Keep a rect inside the board, with a small margin. */
function clampRect(r: Rect, margin = 6): Rect {
  return {
    ...r,
    x: Math.min(1000 - margin - r.w, Math.max(margin, r.x)),
    y: Math.min(1000 - margin - r.h, Math.max(margin, r.y)),
  }
}

function union(rects: Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x))
  const y0 = Math.min(...rects.map((r) => r.y))
  const x1 = Math.max(...rects.map((r) => r.x + r.w))
  const y1 = Math.max(...rects.map((r) => r.y + r.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function layoutLocation(location: BoardLocation, measureText: MeasureText): LocationLayout {
  const center = toView(location)

  if (location.type === 'hub') {
    const fontSize = HUB_FONT
    const text = measureText(location.name.toUpperCase(), boardFont(fontSize, HUB_WEIGHT), fontSize * 0.1)
    const iconsWidth = location.buys.length * HUB_ICON + (location.buys.length - 1) * HUB_ICON_GAP
    const w = Math.max(text, iconsWidth) + 34
    const h = 14 + fontSize + 8 + HUB_ICON + 10
    const label = clampRect({ x: center.x - w / 2, y: center.y - h / 2, w, h })
    const iconsTop = label.y + 14 + fontSize + 6
    const icons = location.buys.map((_, i) => ({
      x: label.x + label.w / 2 - iconsWidth / 2 + i * (HUB_ICON + HUB_ICON_GAP),
      y: iconsTop,
      w: HUB_ICON,
      h: HUB_ICON,
    }))
    return { center, label, fontSize, slots: [], icons, bounds: label }
  }

  const isStop = location.type === 'stop'
  const fontSize = isStop ? STOP_FONT : CITY_FONT[location.size]
  const weight = isStop ? STOP_WEIGHT : CITY_WEIGHT
  const text = measureText(location.name, boardFont(fontSize, weight), fontSize * LETTER_SPACING)
  const h = isStop ? 18 : CITY_BANNER_H[location.size]
  const w = Math.max(text + fontSize * 1.3, 56)
  const label = clampRect({ x: center.x - w / 2, y: center.y + 9, w, h }, 20)

  const slots: Rect[] = []
  if (location.type === 'city') {
    const n = location.slots.length
    const top = label.y + h + 9
    if (n === 4) {
      const left = center.x - SLOT - SLOT_GAP / 2
      for (let i = 0; i < 4; i++) {
        slots.push({ x: left + (i % 2) * (SLOT + SLOT_GAP), y: top + Math.floor(i / 2) * (SLOT + SLOT_GAP), w: SLOT, h: SLOT })
      }
    } else {
      const left = center.x - (n * SLOT + (n - 1) * SLOT_GAP) / 2
      for (let i = 0; i < n; i++) slots.push({ x: left + i * (SLOT + SLOT_GAP), y: top, w: SLOT, h: SLOT })
    }
  }

  // Banner tails reach about 0.8 × height past each end.
  const tails = { x: label.x - h * 0.8, y: label.y, w: label.w + h * 1.6, h: h * 1.3 }
  return { center, label, fontSize, slots, icons: [], bounds: union([tails, ...slots]) }
}
