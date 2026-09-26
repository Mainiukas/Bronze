import type { Industry } from '../../data/board'

/**
 * Industry icons drawn as strokes on a 24 × 24 grid: the fallback when an
 * icon image is missing, and the glyphs used elsewhere in the game UI.
 */
export const BOARD_ICONS: Record<Industry, string> = {
  // Sawtooth-roofed mill
  cotton: 'M3 20.5h18V3.5h-3.5v9L13 9.5v3L8 9.5v3L3 9.5z',
  // Anchor
  port: 'M12 7v13M8.5 10h7M10 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 14.5c.5 3.5 3.5 5.5 7 5.5s6.5-2 7-5.5M5 14.5 3.5 16M5 14.5l2 1M19 14.5l1.5 1.5M19 14.5l-2 1',
  // Sailing ship
  shipyard: 'M3 15.5h18l-3 5H6zM12 15.5V3M12 4.5l6 9h-6M11 6.5l-5 7h5',
  // Blast furnace with flame
  iron: 'M5 21h14M7 21l2-11h6l2 11M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21M9.5 10V7h5v3M12 7c-1-1.5 0-3 1.2-4 .1 1.2.9 1.7.9 2.8',
  // Pithead: winding wheel on a headframe
  coal: 'M4.5 21 10.5 10M19.5 21 13.5 10M7 16.5h10M12 10V9.5M8.5 6a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M12 2.5v7M8.5 6h7',
}

/*
 * Filled silhouettes centred on (0, 0), about 20 units long, facing right.
 */

/** Narrowboat with a cabin and chimney: a link built in the canal era. */
export const BOAT_SILHOUETTE = 'M-9.5 1h19l-2.4 3h-14.2zM-6 -2.8h9v3.8h-9zM4.2 -4.4h1.7v5.4h-1.7z'

/** Steam locomotive: boiler, cab, chimney, cowcatcher and wheels. */
export const LOCOMOTIVE_SILHOUETTE =
  'M-6.5 -1.8h9v4.4h-9zM2.5 -4.6h4.8v7.2h-4.8zM-5.3 -5h2.4v3.4h-2.4zM-6.5 2.6l-3.1 1.7v-2.4l3.1-2.3z' +
  'M-5.8 3.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0M-1.9 3.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0M3 3.6a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0'

/** Beer barrel on a trade hub's bonus badge, about 8 units tall. */
export const BARREL_SILHOUETTE = 'M-3 -4.2h6q1.9 4.2 0 8.4h-6q-1.9 -4.2 0 -8.4z'
export const BARREL_HOOPS = 'M-3.7 -1.6h7.4M-3.7 1.6h7.4'
