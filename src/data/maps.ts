/**
 * Map configuration.
 *
 * To add a map, append an entry to MAPS. The `preview` block describes a
 * schematic drawing (towns, links, water, hills) that MapPreview renders as
 * SVG, so a new map needs no image assets.
 *
 * Preview coordinates live in a 160 × 100 box: x from 0 (west) to 160 (east),
 * y from 0 (north) to 100 (south).
 */

export interface MapTown {
  readonly id: string
  readonly x: number
  readonly y: number
  /** Cities are drawn larger than towns. */
  readonly city?: boolean
}

export interface MapLink {
  /** Town ids at either end of the link. */
  readonly from: string
  readonly to: string
  readonly kind: 'rail' | 'canal'
}

export interface MapWater {
  /** SVG path data in preview coordinates. */
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

export interface MapPreviewData {
  readonly towns: readonly MapTown[]
  readonly links: readonly MapLink[]
  readonly water?: readonly MapWater[]
  readonly hills?: readonly MapHill[]
  readonly landmarks?: readonly MapLandmark[]
}

export interface MapConfig {
  /** Stable identifier. Saved to localStorage, so avoid renaming. */
  readonly id: string
  readonly name: string
  /** Short tag describing the terrain, e.g. "River & Port". */
  readonly terrain: string
  /** One or two sentences of flavor text for the card. */
  readonly flavor: string
  /** Recommended player count. */
  readonly players: { readonly min: number; readonly max: number }
  readonly preview: MapPreviewData
}

export const MAPS = [
  {
    id: 'mersey-valley',
    name: 'Mersey Valley',
    terrain: 'River & Port',
    flavor: 'A broad tidal river feeds a busy port. Move goods downstream before your rivals do.',
    players: { min: 2, max: 4 },
    preview: {
      water: [
        { path: 'M0 46 C 12 48 22 56 26 62 C 22 70 12 76 0 80 Z', fill: true },
        { path: 'M160 60 C 140 54 128 72 108 66 S 76 50 56 58 S 32 66 20 62', width: 3.5 },
      ],
      towns: [
        { id: 'port', x: 16, y: 36, city: true },
        { id: 'ferry', x: 40, y: 42 },
        { id: 'lowford', x: 56, y: 76 },
        { id: 'hub', x: 82, y: 42, city: true },
        { id: 'weir', x: 104, y: 80 },
        { id: 'works', x: 122, y: 34 },
        { id: 'head', x: 144, y: 72 },
      ],
      links: [
        { from: 'port', to: 'ferry', kind: 'rail' },
        { from: 'ferry', to: 'hub', kind: 'rail' },
        { from: 'ferry', to: 'lowford', kind: 'canal' },
        { from: 'lowford', to: 'weir', kind: 'canal' },
        { from: 'hub', to: 'weir', kind: 'rail' },
        { from: 'hub', to: 'works', kind: 'rail' },
        { from: 'works', to: 'head', kind: 'canal' },
        { from: 'weir', to: 'head', kind: 'rail' },
      ],
      landmarks: [
        { kind: 'dock', x: 12, y: 58 },
        { kind: 'mill', x: 132, y: 52 },
      ],
    },
  },
  {
    id: 'black-country',
    name: 'Black Country',
    terrain: 'Coal & Iron',
    flavor: 'Coal seams, ironworks and a tangle of canals. Crowded, cutthroat, and glowing all night.',
    players: { min: 3, max: 4 },
    preview: {
      towns: [
        { id: 'a', x: 24, y: 26 },
        { id: 'b', x: 50, y: 16 },
        { id: 'c', x: 74, y: 32, city: true },
        { id: 'd', x: 100, y: 18 },
        { id: 'e', x: 130, y: 28 },
        { id: 'f', x: 34, y: 58 },
        { id: 'g', x: 62, y: 64, city: true },
        { id: 'h', x: 92, y: 54 },
        { id: 'i', x: 120, y: 66 },
        { id: 'j', x: 84, y: 86 },
        { id: 'k', x: 144, y: 54 },
        { id: 'l', x: 18, y: 84 },
      ],
      links: [
        { from: 'a', to: 'b', kind: 'rail' },
        { from: 'b', to: 'c', kind: 'rail' },
        { from: 'c', to: 'd', kind: 'rail' },
        { from: 'd', to: 'e', kind: 'rail' },
        { from: 'a', to: 'f', kind: 'canal' },
        { from: 'f', to: 'g', kind: 'rail' },
        { from: 'c', to: 'g', kind: 'canal' },
        { from: 'c', to: 'h', kind: 'rail' },
        { from: 'g', to: 'h', kind: 'rail' },
        { from: 'd', to: 'h', kind: 'canal' },
        { from: 'h', to: 'i', kind: 'rail' },
        { from: 'i', to: 'k', kind: 'canal' },
        { from: 'e', to: 'k', kind: 'rail' },
        { from: 'g', to: 'j', kind: 'canal' },
        { from: 'h', to: 'j', kind: 'rail' },
        { from: 'f', to: 'l', kind: 'canal' },
      ],
      landmarks: [
        { kind: 'mine', x: 44, y: 38 },
        { kind: 'mine', x: 112, y: 42 },
        { kind: 'mine', x: 52, y: 86 },
        { kind: 'mine', x: 134, y: 84 },
      ],
    },
  },
  {
    id: 'pennine-mills',
    name: 'Pennine Mills',
    terrain: 'Moors & Mills',
    flavor: 'Mill towns tucked between windswept moors. Fast water, steep hills and few easy routes.',
    players: { min: 2, max: 3 },
    preview: {
      hills: [
        { x: 60, y: 38, rx: 26, ry: 17 },
        { x: 118, y: 46, rx: 20, ry: 14 },
        { x: 94, y: 10, rx: 14, ry: 8 },
      ],
      water: [
        { path: 'M60 55 C 56 68 48 80 40 100', width: 2.5 },
        { path: 'M118 60 C 124 72 132 82 138 100', width: 2.5 },
        { path: 'M22 0 C 28 18 16 36 20 56', width: 2 },
      ],
      towns: [
        { id: 'north', x: 16, y: 22 },
        { id: 'vale', x: 26, y: 76, city: true },
        { id: 'brook', x: 56, y: 88 },
        { id: 'gap', x: 90, y: 68 },
        { id: 'clough', x: 110, y: 88 },
        { id: 'moor', x: 146, y: 74, city: true },
        { id: 'edge', x: 146, y: 22 },
        { id: 'saddle', x: 90, y: 34 },
      ],
      links: [
        { from: 'north', to: 'vale', kind: 'rail' },
        { from: 'vale', to: 'brook', kind: 'canal' },
        { from: 'brook', to: 'gap', kind: 'rail' },
        { from: 'gap', to: 'clough', kind: 'canal' },
        { from: 'clough', to: 'moor', kind: 'rail' },
        { from: 'moor', to: 'edge', kind: 'rail' },
        { from: 'edge', to: 'saddle', kind: 'rail' },
        { from: 'saddle', to: 'north', kind: 'rail' },
        { from: 'saddle', to: 'gap', kind: 'canal' },
      ],
      landmarks: [
        { kind: 'mill', x: 42, y: 64 },
        { kind: 'mill', x: 98, y: 84 },
        { kind: 'mill', x: 138, y: 40 },
      ],
    },
  },
] as const satisfies readonly MapConfig[]

export type GameMap = (typeof MAPS)[number]
export type MapId = GameMap['id']

export const DEFAULT_MAP_ID: MapId = 'mersey-valley'

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
