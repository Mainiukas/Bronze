/**
 * The illustrated board (assets/map.png): locations, industry slots and
 * links, loaded from board.json and validated. Coordinates are percentages
 * of the image (0–100), so they stay aligned at any size.
 *
 * Edit positions with the in-app editor (open #/board?edit=1), then paste its
 * export over board.json. formatBoardJson writes the same layout as the file,
 * so an unchanged board exports byte-for-byte identical.
 */

import boardJson from './board.json'

export const INDUSTRY_IDS = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'port', 'shipyard'] as const
export type Industry = (typeof INDUSTRY_IDS)[number]

export const INDUSTRY_NAMES: Record<Industry, string> = {
  coal: 'Coal mine',
  iron: 'Iron works',
  cotton: 'Cotton mill',
  manufacturer: 'Manufacturer',
  pottery: 'Pottery',
  port: 'Port',
  shipyard: 'Shipyard',
}

/** What each industry's goods are called when a hub buys them. */
export const GOODS_NAMES: Record<Industry, string> = {
  coal: 'Coal',
  iron: 'Iron',
  cotton: 'Cotton',
  manufacturer: 'Manufactured goods',
  pottery: 'Pottery',
  port: 'Port trade',
  shipyard: 'Ships',
}

export type LocationType = 'city' | 'stop' | 'hub'
export type CitySize = 'small' | 'medium' | 'big'
export type LinkType = 'canal' | 'rail' | 'both'
export type Era = 'canal' | 'rail'

export interface Region {
  name: string
  /** Banner colour for cities in this region. */
  color: string
}

interface LocationBase {
  id: string
  name: string
  /** % from the left of the image. */
  x: number
  /** % from the top of the image. */
  y: number
}

/** Buildable town with industry slots. */
export interface CityLocation extends LocationBase {
  type: 'city'
  size: CitySize
  region: string
  /** One entry per slot: the industries allowed in it. */
  slots: Industry[][]
}

/** Not buildable; routes pass through it. */
export interface StopLocation extends LocationBase {
  type: 'stop'
}

/** Trade hub where goods are sold. Not buildable. */
export interface HubLocation extends LocationBase {
  type: 'hub'
  buys: Industry[]
}

export type BoardLocation = CityLocation | StopLocation | HubLocation

export interface BoardLink {
  id: string
  from: string
  to: string
  type: LinkType
  /** Sideways offset of the curve's control point, in % of the image. 0 = straight. */
  curve?: number
}

export interface BoardData {
  version: 1
  regions: Record<string, Region>
  locations: BoardLocation[]
  links: BoardLink[]
}

/** What has been built: rendered on top of the board. */
export interface BuiltState {
  /** Key from slotKey(locationId, slotIndex). */
  slots: Record<string, { player: number; industry: Industry }>
  /** Link id → owner. */
  links: Record<string, { player: number }>
}

export const EMPTY_BUILT: BuiltState = { slots: {}, links: {} }

export function slotKey(locationId: string, slotIndex: number): string {
  return `${locationId}:${slotIndex}`
}

/** Canal links work only in the canal era, rail links only in the rail era, `both` always. */
export function isLinkActive(type: LinkType, era: Era): boolean {
  return type === 'both' || type === era
}

/* ------------------------------------------------------------------------ */
/* Validation                                                                */
/* ------------------------------------------------------------------------ */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isIndustry = (v: unknown): v is Industry => INDUSTRY_IDS.includes(v as Industry)

/** Every problem found in `raw`, as readable messages. Empty means valid. */
export function validateBoardData(raw: unknown): string[] {
  const errors: string[] = []
  if (!isObject(raw)) return ['Board data must be an object']
  if (raw.version !== 1) errors.push('version must be 1')

  const regions = isObject(raw.regions) ? raw.regions : {}
  if (!isObject(raw.regions)) errors.push('regions must be an object')
  for (const [id, region] of Object.entries(regions)) {
    if (!isObject(region) || typeof region.name !== 'string' || typeof region.color !== 'string') {
      errors.push(`region ${id} needs a name and a color`)
    }
  }

  const ids = new Set<string>()
  if (!Array.isArray(raw.locations)) errors.push('locations must be an array')
  for (const [i, loc] of (Array.isArray(raw.locations) ? raw.locations : []).entries()) {
    const where = isObject(loc) && typeof loc.id === 'string' ? loc.id : `locations[${i}]`
    if (!isObject(loc) || typeof loc.id !== 'string' || typeof loc.name !== 'string') {
      errors.push(`${where}: needs an id and a name`)
      continue
    }
    if (ids.has(loc.id)) errors.push(`${where}: duplicate id`)
    ids.add(loc.id)
    if (!isNumber(loc.x) || !isNumber(loc.y) || loc.x < 0 || loc.x > 100 || loc.y < 0 || loc.y > 100) {
      errors.push(`${where}: x and y must be numbers from 0 to 100`)
    }
    if (loc.type === 'city') {
      if (!['small', 'medium', 'big'].includes(loc.size as string)) errors.push(`${where}: size must be small, medium or big`)
      if (typeof loc.region !== 'string' || !(loc.region in regions)) errors.push(`${where}: unknown region "${String(loc.region)}"`)
      const slots = loc.slots
      if (!Array.isArray(slots) || slots.length === 0 || slots.length > 4) errors.push(`${where}: needs 1–4 slots`)
      else if (!slots.every((s) => Array.isArray(s) && s.length >= 1 && s.length <= 2 && s.every(isIndustry))) {
        errors.push(`${where}: each slot lists 1 or 2 known industries`)
      }
    } else if (loc.type === 'hub') {
      if (!Array.isArray(loc.buys) || loc.buys.length === 0 || !loc.buys.every(isIndustry)) {
        errors.push(`${where}: a hub needs a list of industries it buys`)
      }
    } else if (loc.type !== 'stop') {
      errors.push(`${where}: type must be city, stop or hub`)
    }
  }

  const linkIds = new Set<string>()
  if (!Array.isArray(raw.links)) errors.push('links must be an array')
  for (const [i, link] of (Array.isArray(raw.links) ? raw.links : []).entries()) {
    const where = isObject(link) && typeof link.id === 'string' ? link.id : `links[${i}]`
    if (!isObject(link) || typeof link.id !== 'string') {
      errors.push(`${where}: needs an id`)
      continue
    }
    if (linkIds.has(link.id)) errors.push(`${where}: duplicate id`)
    linkIds.add(link.id)
    if (!ids.has(link.from as string) || !ids.has(link.to as string)) errors.push(`${where}: unknown from/to location`)
    if (link.from === link.to) errors.push(`${where}: links a location to itself`)
    if (!['canal', 'rail', 'both'].includes(link.type as string)) errors.push(`${where}: type must be canal, rail or both`)
    if (link.curve !== undefined && !isNumber(link.curve)) errors.push(`${where}: curve must be a number`)
  }
  return errors
}

/** The board if `raw` is valid, otherwise undefined. */
export function parseBoardData(raw: unknown): BoardData | undefined {
  return validateBoardData(raw).length === 0 ? (raw as BoardData) : undefined
}

/* ------------------------------------------------------------------------ */
/* Export                                                                    */
/* ------------------------------------------------------------------------ */

/** One object per line, `{ "key": value, ... }`, as board.json is laid out. */
function inline(obj: object): string {
  const entries = Object.entries(obj).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
  return `{ ${entries.join(', ')} }`
}

/** Serialise a board as board.json: valid JSON, one location or link per line. */
export function formatBoardJson(board: BoardData): string {
  const regions = Object.entries(board.regions).map(([id, r]) => `    ${JSON.stringify(id)}: ${inline(r)}`)
  return [
    '{',
    `  "version": ${board.version},`,
    '  "regions": {',
    regions.join(',\n'),
    '  },',
    '  "locations": [',
    board.locations.map((l) => `    ${inline(l)}`).join(',\n'),
    '  ],',
    '  "links": [',
    board.links.map((l) => `    ${inline(l)}`).join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n')
}

/* ------------------------------------------------------------------------ */
/* The checked-in board                                                      */
/* ------------------------------------------------------------------------ */

const problems = validateBoardData(boardJson)
if (problems.length) throw new Error(`src/data/board.json is invalid:\n${problems.join('\n')}`)

export const BOARD: BoardData = boardJson as BoardData
