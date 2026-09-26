import type { IndustryKind } from '../../game/types'
import { BOARD_ICONS } from '../board/icons'

/**
 * Glyphs for each industry, drawn on a 24 × 24 grid as strokes. The painted
 * board, the schematic board and the panels all use these, so they match.
 */
export const INDUSTRY_GLYPHS: Record<IndustryKind, string> = {
  ...BOARD_ICONS,
  // Gear
  works:
    'M10.3 3h3.4l.6 2.4 1.9.8 2.1-1.3 2.4 2.4-1.3 2.1.8 1.9 2.4.6v3.4l-2.4.6-.8 1.9 1.3 2.1-2.4 2.4-2.1-1.3-1.9.8-.6 2.4h-3.4l-.6-2.4-1.9-.8-2.1 1.3-2.4-2.4 1.3-2.1-.8-1.9L2.8 13.7v-3.4l2.4-.6.8-1.9-1.3-2.1 2.4-2.4 2.1 1.3 1.9-.8zM8.8 12a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0',
}

/** CSS color for a seat (0-based), from the --color-seat-* theme tokens. */
export function seatColor(seat: number): string {
  return `var(--color-seat-${(seat % 4) + 1})`
}
