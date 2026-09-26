import type { Industry } from '../../data/board'

/**
 * Industry icons for the illustrated board, drawn as strokes on a 24 × 24
 * grid. Slots and tiles scale them down with a transform.
 */
export const BOARD_ICONS: Record<Industry, string> = {
  // Pithead: winding wheel on a headframe
  coal: 'M4.5 21 10.5 10M19.5 21 13.5 10M7 16.5h10M12 10V9.5M8.5 6a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M12 2.5v7M8.5 6h7',
  // Blast furnace with flame
  iron: 'M5 21h14M7 21l2-11h6l2 11M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21M9.5 10V7h5v3M12 7c-1-1.5 0-3 1.2-4 .1 1.2.9 1.7.9 2.8',
  // Sawtooth-roofed mill
  cotton: 'M3 20.5h18V3.5h-3.5v9L13 9.5v3L8 9.5v3L3 9.5z',
  // Packing crate with a brace
  manufacturer: 'M4 5h16v15H4zM4 9h16M4 16h16M7.5 9l9 7',
  // Bottle kiln
  pottery: 'M8.5 21c-1.5-3.5-2-7.5.5-10.5 1-1.2 1-3.5 1-5.5h4c0 2 0 4.3 1 5.5 2.5 3 2 7 .5 10.5zM9.5 5h5M5 21h14',
  // Anchor
  port: 'M12 7v13M8.5 10h7M10 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 14.5c.5 3.5 3.5 5.5 7 5.5s6.5-2 7-5.5M5 14.5 3.5 16M5 14.5l2 1M19 14.5l1.5 1.5M19 14.5l-2 1',
  // Sailing ship
  shipyard: 'M3 15.5h18l-3 5H6zM12 15.5V3M12 4.5l6 9h-6M11 6.5l-5 7h5',
}
