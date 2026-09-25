import type { IndustryKind } from '../../game/types'

/**
 * Glyphs for each industry, drawn on a 24 × 24 grid as strokes. The board
 * draws the same paths scaled down, so the panels and the board match.
 */
export const INDUSTRY_GLYPHS: Record<IndustryKind, string> = {
  // Pithead frame with its winding wheel
  colliery: 'M5.5 21L11 8M18.5 21L13 8M11 8h2M7.6 16h8.8M12 8V7M9.5 4.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0',
  // Furnace flame
  ironworks: 'M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3.5C12 9.5 11 6.5 12 3z',
  // Sawtooth-roofed mill
  mill: 'M3 20.5h18V3.5h-3.5v9L13 9.5v3L8 9.5v3L3 9.5z',
  // Gear
  works:
    'M10.3 3h3.4l.6 2.4 1.9.8 2.1-1.3 2.4 2.4-1.3 2.1.8 1.9 2.4.6v3.4l-2.4.6-.8 1.9 1.3 2.1-2.4 2.4-2.1-1.3-1.9.8-.6 2.4h-3.4l-.6-2.4-1.9-.8-2.1 1.3-2.4-2.4 1.3-2.1-.8-1.9L2.8 13.7v-3.4l2.4-.6.8-1.9-1.3-2.1 2.4-2.4 2.1 1.3 1.9-.8zM8.8 12a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0',
}

/** CSS color for a seat (0-based), from the --color-seat-* theme tokens. */
export function seatColor(seat: number): string {
  return `var(--color-seat-${(seat % 4) + 1})`
}
