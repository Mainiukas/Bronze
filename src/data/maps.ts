/**
 * Map configuration.
 *
 * Two styles of map:
 * - `illustrated`: the painted board (assets/map.png) whose towns, slots and
 *   routes live in src/data/board.json. Canal and rail eras apply.
 * - `schematic`: drawn entirely from the `board` block below (towns,
 *   building plots, routes, decoration). MapPreview draws it in the lobby and
 *   the game board renders it in play, so it needs no image assets.
 *
 * Coordinates live in a 160 × 100 box: x from 0 (west) to 160 (east),
 * y from 0 (north) to 100 (south). Keep towns about 30 units apart so their
 * labels and plots don't collide.
 */

export interface MapTown {
  readonly id: string
  readonly name: string
  readonly x: number
  readonly y: number
  /**
   * Which modes include this town: 1 = every mode (the compact core),
   * 2 = Normal and Blitz, 3 = Normal only.
   */
  readonly ring: 1 | 2 | 3
  /** Market towns buy goods. The value is the starting price per goods (£). */
  readonly market?: number
  /**
   * Building plots. Each string is one plot; its letters are the
   * industries allowed there: C coal mine, I iron works, M cotton mill,
   * W engine works. "CI" means a plot that takes either.
   */
  readonly slots: readonly string[]
}

export interface MapLink {
  /** Town ids at either end of the route. */
  readonly from: string
  readonly to: string
  readonly kind: 'rail' | 'canal'
}

export interface MapWater {
  /** SVG path data in board coordinates. */
  readonly path: string
  /** Stroke width for rivers. Ignored when `fill` is set. */
  readonly width?: number
  /** Draw as a filled area (estuary, lake) instead of a line. */
  readonly fill?: boolean
}

export interface MapHill {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
}

export interface MapLandmark {
  readonly kind: 'mine' | 'mill' | 'dock'
  readonly x: number
  readonly y: number
}

export interface MapBoardData {
  readonly towns: readonly MapTown[]
  readonly links: readonly MapLink[]
  readonly water?: readonly MapWater[]
  readonly hills?: readonly MapHill[]
  readonly landmarks?: readonly MapLandmark[]
}

interface MapConfigBase {
  /** Stable identifier. Saved to localStorage, so avoid renaming. */
  readonly id: string
  readonly name: string
  /** Short tag describing the terrain, e.g. "River & Port". */
  readonly terrain: string
  /** One or two sentences of flavor text for the card. */
  readonly flavor: string
  /** Supported player count. */
  readonly players: { readonly min: number; readonly max: number }
}

export interface SchematicMapConfig extends MapConfigBase {
  readonly style: 'schematic'
  readonly board: MapBoardData
}

/** The painted board. Its locations and links come from src/data/board.json. */
export interface IllustratedMapConfig extends MapConfigBase {
  readonly style: 'illustrated'
}

export type MapConfig = SchematicMapConfig | IllustratedMapConfig

export const MAPS = [
  {
    id: 'wales-and-the-west',
    style: 'illustrated',
    name: 'Wales & the West',
    terrain: 'Canals & Railways',
    flavor: 'Welsh coal, Midlands workshops and Severn ports. Dig canals first, then race to lay the railways.',
    players: { min: 2, max: 4 },
  },
  {
    id: 'mersey-valley',
    style: 'schematic',
    name: 'Mersey Valley',
    terrain: 'River & Port',
    flavor: 'A broad tidal river feeds a busy port. Move goods downstream before your rivals do.',
    players: { min: 2, max: 4 },
    board: {
      water: [
        { path: 'M0 52 C 12 54 22 60 26 64 C 22 72 12 80 0 84 Z', fill: true },
        { path: 'M160 66 C 142 60 128 72 112 66 S 88 58 70 64 S 42 60 22 64', width: 3.5 },
      ],
      towns: [
        { id: 'saltport', name: 'Saltport', x: 16, y: 38, ring: 1, market: 6, slots: ['M', 'W'] },
        { id: 'ferrybridge', name: 'Ferrybridge', x: 44, y: 20, ring: 1, slots: ['CI', 'M'] },
        { id: 'lowford', name: 'Lowford', x: 42, y: 80, ring: 1, slots: ['C', 'M'] },
        { id: 'kingsferry', name: 'Kingsferry', x: 74, y: 46, ring: 1, market: 5, slots: ['I', 'M', 'W'] },
        { id: 'ashcombe', name: 'Ashcombe', x: 76, y: 12, ring: 2, slots: ['C', 'C'] },
        { id: 'weirside', name: 'Weirside', x: 100, y: 82, ring: 1, slots: ['M', 'I'] },
        { id: 'halton-cross', name: 'Halton Cross', x: 108, y: 28, ring: 1, slots: ['CI', 'M'] },
        { id: 'brindlemoor', name: 'Brindlemoor', x: 138, y: 12, ring: 3, slots: ['C', 'I'] },
        { id: 'eastmere', name: 'Eastmere', x: 142, y: 48, ring: 2, market: 4, slots: ['M', 'W'] },
        { id: 'dunmore', name: 'Dunmore', x: 136, y: 84, ring: 3, slots: ['C', 'M'] },
      ],
      links: [
        { from: 'saltport', to: 'ferrybridge', kind: 'canal' },
        { from: 'saltport', to: 'lowford', kind: 'canal' },
        { from: 'ferrybridge', to: 'kingsferry', kind: 'rail' },
        { from: 'lowford', to: 'kingsferry', kind: 'canal' },
        { from: 'ferrybridge', to: 'ashcombe', kind: 'rail' },
        { from: 'ashcombe', to: 'halton-cross', kind: 'rail' },
        { from: 'kingsferry', to: 'halton-cross', kind: 'canal' },
        { from: 'kingsferry', to: 'weirside', kind: 'canal' },
        { from: 'lowford', to: 'weirside', kind: 'rail' },
        { from: 'halton-cross', to: 'brindlemoor', kind: 'rail' },
        { from: 'halton-cross', to: 'eastmere', kind: 'canal' },
        { from: 'weirside', to: 'eastmere', kind: 'rail' },
        { from: 'weirside', to: 'dunmore', kind: 'canal' },
        { from: 'brindlemoor', to: 'eastmere', kind: 'rail' },
        { from: 'eastmere', to: 'dunmore', kind: 'canal' },
      ],
      landmarks: [
        { kind: 'dock', x: 8, y: 62 },
        { kind: 'mine', x: 92, y: 10 },
      ],
    },
  },
  {
    id: 'black-country',
    style: 'schematic',
    name: 'Black Country',
    terrain: 'Coal & Iron',
    flavor: 'Coal seams, ironworks and a tangle of canals. Crowded, cutthroat, and glowing all night.',
    players: { min: 3, max: 4 },
    board: {
      towns: [
        { id: 'coalgate', name: 'Coalgate', x: 16, y: 18, ring: 2, slots: ['C', 'C'] },
        { id: 'tipwell', name: 'Tipwell', x: 46, y: 14, ring: 2, slots: ['C', 'I'] },
        { id: 'ironvale', name: 'Ironvale', x: 80, y: 18, ring: 1, slots: ['I', 'I', 'C'] },
        { id: 'sootley', name: 'Sootley', x: 112, y: 12, ring: 2, slots: ['C', 'I'] },
        { id: 'emberton', name: 'Emberton', x: 144, y: 20, ring: 3, slots: ['C', 'M'] },
        { id: 'cinderford', name: 'Cinderford', x: 26, y: 50, ring: 1, slots: ['CI', 'M'] },
        { id: 'dudwell', name: 'Dudwell', x: 60, y: 48, ring: 1, market: 5, slots: ['M', 'W', 'I'] },
        { id: 'anvil-green', name: 'Anvil Green', x: 94, y: 50, ring: 1, slots: ['CI', 'M'] },
        { id: 'furnace-end', name: 'Furnace End', x: 128, y: 50, ring: 2, market: 4, slots: ['I', 'W'] },
        { id: 'hollowmere', name: 'Hollowmere', x: 14, y: 84, ring: 3, slots: ['C', 'M'] },
        { id: 'lockside', name: 'Lockside', x: 44, y: 84, ring: 1, slots: ['M', 'C'] },
        { id: 'wednesfold', name: 'Wednesfold', x: 78, y: 82, ring: 1, market: 5, slots: ['M', 'W'] },
        { id: 'kettleby', name: 'Kettleby', x: 112, y: 84, ring: 2, slots: ['M', 'I'] },
        { id: 'ashpit', name: 'Ashpit', x: 146, y: 82, ring: 3, slots: ['C', 'M'] },
      ],
      links: [
        { from: 'coalgate', to: 'tipwell', kind: 'canal' },
        { from: 'coalgate', to: 'cinderford', kind: 'canal' },
        { from: 'tipwell', to: 'ironvale', kind: 'rail' },
        { from: 'tipwell', to: 'cinderford', kind: 'rail' },
        { from: 'ironvale', to: 'sootley', kind: 'canal' },
        { from: 'ironvale', to: 'dudwell', kind: 'canal' },
        { from: 'ironvale', to: 'anvil-green', kind: 'rail' },
        { from: 'sootley', to: 'emberton', kind: 'rail' },
        { from: 'sootley', to: 'anvil-green', kind: 'canal' },
        { from: 'sootley', to: 'furnace-end', kind: 'rail' },
        { from: 'emberton', to: 'furnace-end', kind: 'canal' },
        { from: 'cinderford', to: 'dudwell', kind: 'rail' },
        { from: 'cinderford', to: 'hollowmere', kind: 'canal' },
        { from: 'cinderford', to: 'lockside', kind: 'canal' },
        { from: 'dudwell', to: 'anvil-green', kind: 'canal' },
        { from: 'dudwell', to: 'lockside', kind: 'rail' },
        { from: 'dudwell', to: 'wednesfold', kind: 'canal' },
        { from: 'anvil-green', to: 'furnace-end', kind: 'rail' },
        { from: 'anvil-green', to: 'wednesfold', kind: 'rail' },
        { from: 'anvil-green', to: 'kettleby', kind: 'canal' },
        { from: 'furnace-end', to: 'kettleby', kind: 'canal' },
        { from: 'furnace-end', to: 'ashpit', kind: 'rail' },
        { from: 'hollowmere', to: 'lockside', kind: 'rail' },
        { from: 'lockside', to: 'wednesfold', kind: 'canal' },
        { from: 'wednesfold', to: 'kettleby', kind: 'rail' },
        { from: 'kettleby', to: 'ashpit', kind: 'canal' },
      ],
      landmarks: [
        { kind: 'mine', x: 30, y: 30 },
        { kind: 'mine', x: 128, y: 30 },
        { kind: 'mine', x: 28, y: 70 },
        { kind: 'mine', x: 132, y: 68 },
      ],
    },
  },
  {
    id: 'pennine-mills',
    style: 'schematic',
    name: 'Pennine Mills',
    terrain: 'Moors & Mills',
    flavor: 'Mill towns tucked between windswept moors. Fast water, steep hills and few easy routes.',
    players: { min: 2, max: 3 },
    board: {
      hills: [
        { x: 54, y: 34, rx: 20, ry: 12 },
        { x: 116, y: 44, rx: 18, ry: 11 },
        { x: 30, y: 38, rx: 8, ry: 5 },
      ],
      water: [
        { path: 'M0 74 C 20 70 40 78 60 74 S 100 70 120 76 S 150 80 160 74', width: 3 },
        { path: 'M54 46 C 52 56 58 64 60 74', width: 2 },
        { path: 'M116 55 C 120 62 118 70 120 76', width: 2 },
      ],
      towns: [
        { id: 'heathfold', name: 'Heathfold', x: 14, y: 18, ring: 2, slots: ['M', 'C'] },
        { id: 'windhill', name: 'Windhill', x: 50, y: 12, ring: 3, slots: ['C', 'I'] },
        { id: 'high-saddle', name: 'High Saddle', x: 86, y: 24, ring: 1, slots: ['M', 'CI'] },
        { id: 'moorend', name: 'Moorend', x: 120, y: 12, ring: 3, slots: ['C', 'M'] },
        { id: 'edgecliff', name: 'Edgecliff', x: 146, y: 30, ring: 2, slots: ['M', 'W'] },
        { id: 'millbrook', name: 'Millbrook', x: 20, y: 58, ring: 1, market: 5, slots: ['M', 'M', 'W'] },
        { id: 'clough-end', name: 'Clough End', x: 52, y: 60, ring: 1, slots: ['M', 'C'] },
        { id: 'greystones', name: 'Greystones', x: 86, y: 58, ring: 1, market: 4, slots: ['CI', 'M'] },
        { id: 'loomfield', name: 'Loomfield', x: 140, y: 64, ring: 2, market: 5, slots: ['M', 'W'] },
        { id: 'brookside', name: 'Brookside', x: 36, y: 88, ring: 1, slots: ['M', 'I'] },
        { id: 'beckfoot', name: 'Beckfoot', x: 72, y: 88, ring: 1, slots: ['M', 'C'] },
        { id: 'shuttle-end', name: 'Shuttle End', x: 108, y: 86, ring: 2, slots: ['M', 'M'] },
      ],
      links: [
        { from: 'heathfold', to: 'windhill', kind: 'rail' },
        { from: 'heathfold', to: 'millbrook', kind: 'canal' },
        { from: 'windhill', to: 'high-saddle', kind: 'rail' },
        { from: 'windhill', to: 'clough-end', kind: 'rail' },
        { from: 'high-saddle', to: 'moorend', kind: 'rail' },
        { from: 'high-saddle', to: 'greystones', kind: 'canal' },
        { from: 'high-saddle', to: 'clough-end', kind: 'rail' },
        { from: 'moorend', to: 'edgecliff', kind: 'canal' },
        { from: 'edgecliff', to: 'loomfield', kind: 'rail' },
        { from: 'edgecliff', to: 'greystones', kind: 'rail' },
        { from: 'millbrook', to: 'clough-end', kind: 'canal' },
        { from: 'millbrook', to: 'brookside', kind: 'canal' },
        { from: 'clough-end', to: 'greystones', kind: 'canal' },
        { from: 'clough-end', to: 'beckfoot', kind: 'rail' },
        { from: 'brookside', to: 'beckfoot', kind: 'canal' },
        { from: 'greystones', to: 'beckfoot', kind: 'rail' },
        { from: 'greystones', to: 'loomfield', kind: 'canal' },
        { from: 'greystones', to: 'shuttle-end', kind: 'rail' },
        { from: 'beckfoot', to: 'shuttle-end', kind: 'canal' },
        { from: 'shuttle-end', to: 'loomfield', kind: 'canal' },
      ],
      landmarks: [
        { kind: 'mill', x: 28, y: 76 },
        { kind: 'mill', x: 96, y: 72 },
        { kind: 'mill', x: 132, y: 84 },
      ],
    },
  },
] as const satisfies readonly MapConfig[]

export type GameMap = (typeof MAPS)[number]
export type MapId = GameMap['id']

export const DEFAULT_MAP_ID: MapId = 'wales-and-the-west'

/** Type guard: is `value` the id of a known map? Used to validate saved data. */
export function isMapId(value: unknown): value is MapId {
  return MAPS.some((map) => map.id === value)
}

/** Look up a map by id, falling back to the default map. */
export function getMap(id: MapId): GameMap {
  return MAPS.find((map) => map.id === id) ?? MAPS[0]
}

/** "2–4 players" */
export function formatPlayers({ min, max }: MapConfig['players']): string {
  return min === max ? `${min} players` : `${min}–${max} players`
}
