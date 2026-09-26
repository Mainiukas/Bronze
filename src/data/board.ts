/**
 * The illustrated board (assets/map.webp): locations, industry slots and
 * links, loaded from board.json and validated. Coordinates are percentages
 * of the image (0–100), so they stay aligned at any size.
 *
 * Edit positions with the in-app editor (open #/board?edit=1), then paste its
 * export over board.json. formatBoardJson writes the same layout as the file,
 * so an unchanged board exports byte-for-byte identical.
 */

import boardJson from './board.json'

/** The five industries of the game. */
export const INDUSTRY_IDS = ['cotton', 'port', 'shipyard', 'iron', 'coal'] as const
export type Industry = (typeof INDUSTRY_IDS)[number]

export const INDUSTRY_NAMES: Record<Industry, string> = {
  cotton: 'Cotton mill',
  port: 'Port',
  shipyard: 'Shipyard',
  iron: 'Iron works',
  coal: 'Coal mine',
}

/** Short labels, shown in place of an industry's picture if it can't be loaded. */
export const INDUSTRY_SHORT: Record<Industry, string> = { cotton: 'COT', port: 'PRT', shipyard: 'SHP', iron: 'IRN', coal: 'COL' }

/** What a hub is buying when it lists each industry. */
export const GOODS_NAMES: Record<Industry, string> = {
  cotton: 'Cotton',
  port: 'Port cargo',
  shipyard: 'Ships',
  iron: 'Iron',
  coal: 'Coal',
}

export type LocationType = 'city' | 'stop' | 'hub'
export type LinkType = 'canal' | 'rail' | 'both'
export type Era = 'canal' | 'rail'

export interface Region {
  name: string
  /** Name plate colour for cities in this region. */
  color: string
}

/** An x/y pair in % of the image. */
export interface Offset {
  x: number
  y: number
}

interface LocationBase {
  id: string
  name: string
  /** % from the left of the image. */
  x: number
  /** % from the top of the image. */
  y: number
  /**
   * Which game modes use this location: 1 = every mode (the core),
   * 2 = Normal and Blitz, 3 = Normal only. Defaults to 1.
   */
  ring?: 1 | 2 | 3
  /** Set to "rail" for places that can only be reached in the rail era. */
  era?: 'rail'
  /**
   * Where the plaque or tile group sits relative to the point, in %.
   * When set, the automatic nudging leaves this location alone.
   */
  labelOffset?: Offset
}

/** Buildable town with industry slots. */
export interface CityLocation extends LocationBase {
  type: 'city'
  region: string
  /** One entry per slot: the industries allowed in it (two for a dual slot). */
  slots: Industry[][]
}

/** Not buildable and doesn't trade; routes pass through it. */
export interface StopLocation extends LocationBase {
  type: 'stop'
}

/** Trade hub where goods are sold. Not buildable. */
export interface HubLocation extends LocationBase {
  type: 'hub'
  /** Starting price per goods sold here in a match (£). */
  price: number
  /** The number on the hub's square badge. */
  value: number
  buys: Industry[]
}

export type BoardLocation = CityLocation | StopLocation | HubLocation

export interface BoardLink {
  id: string
  from: string
  to: string
  type: LinkType
  /** Up to 3 bend points in %, set in the editor. Without them the link gets an automatic bend. */
  points?: [number, number][]
}

export interface BoardData {
  version: 3
  regions: Record<string, Region>
  locations: BoardLocation[]
  links: BoardLink[]
}

/** What has been built: rendered on top of the board. */
export interface BuiltState {
  /** Key from slotKey(locationId, slotIndex). */
  slots: Record<string, { player: number; industry: Industry; goods?: number; level?: number }>
  /** Link id → owner. Built links are drawn as the current era's token. */
  links: Record<string, { player: number }>
}

export const EMPTY_BUILT: BuiltState = { slots: {}, links: {} }

export const MAX_SLOTS = 4
export const MAX_BEND_POINTS = 3

export function slotKey(locationId: string, slotIndex: number): string {
  return `${locationId}:${slotIndex}`
}

/**
 * Does this link exist in the era? Canal links only in the canal era, rail
 * links only in the rail era, `both` in both (as a canal, then a railway).
 * Links of the other era aren't drawn at all.
 */
export function isLinkActive(type: LinkType, era: Era): boolean {
  return type === 'both' || type === era
}

/* ------------------------------------------------------------------------ */
/* Validation                                                                */
/* ------------------------------------------------------------------------ */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isIndustry = (v: unknown): v is Industry => INDUSTRY_IDS.includes(v as Industry)
const isPercent = (v: unknown) => isNumber(v) && v >= 0 && v <= 100

/** Every problem found in `raw`, as readable messages. Empty means valid. */
export function validateBoardData(raw: unknown): string[] {
  const errors: string[] = []
  if (!isObject(raw)) return ['Board data must be an object']
  if (raw.version !== 3) errors.push('version must be 3')

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
    if (!isPercent(loc.x) || !isPercent(loc.y)) errors.push(`${where}: x and y must be numbers from 0 to 100`)
    if (loc.ring !== undefined && ![1, 2, 3].includes(loc.ring as number)) errors.push(`${where}: ring must be 1, 2 or 3`)
    if (loc.era !== undefined && loc.era !== 'rail') errors.push(`${where}: era must be "rail" when set`)
    if (loc.labelOffset !== undefined) {
      const o = loc.labelOffset
      if (!isObject(o) || !isNumber(o.x) || !isNumber(o.y) || Math.abs(o.x) > 50 || Math.abs(o.y) > 50) {
        errors.push(`${where}: labelOffset must be { "x": number, "y": number } within ±50`)
      }
    }
    if (loc.type === 'city') {
      if (typeof loc.region !== 'string' || !(loc.region in regions)) errors.push(`${where}: unknown region "${String(loc.region)}"`)
      const slots = loc.slots
      if (!Array.isArray(slots) || slots.length === 0 || slots.length > MAX_SLOTS) errors.push(`${where}: needs 1–${MAX_SLOTS} slots`)
      else if (!slots.every((s) => Array.isArray(s) && s.length >= 1 && s.length <= 2 && s.every(isIndustry))) {
        errors.push(`${where}: each slot lists 1 or 2 known industries`)
      }
    } else if (loc.type === 'hub') {
      if (!Array.isArray(loc.buys) || loc.buys.length === 0 || !loc.buys.every(isIndustry)) {
        errors.push(`${where}: a hub needs a list of industries it buys`)
      }
      if (!isNumber(loc.price) || loc.price < 1) errors.push(`${where}: a hub needs a price of at least 1`)
      if (!isNumber(loc.value)) errors.push(`${where}: a hub needs a badge value`)
    } else if (loc.type !== 'stop') {
      errors.push(`${where}: type must be city, stop or hub`)
    }
  }

  const linkIds = new Set<string>()
  const pairs = new Set<string>()
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
    const pair = [link.from, link.to].sort().join('|')
    if (pairs.has(pair)) errors.push(`${where}: another link already joins these two locations`)
    pairs.add(pair)
    if (!['canal', 'rail', 'both'].includes(link.type as string)) errors.push(`${where}: type must be canal, rail or both`)
    if (link.points !== undefined) {
      const points = link.points
      if (
        !Array.isArray(points) ||
        points.length > MAX_BEND_POINTS ||
        !points.every((p) => Array.isArray(p) && p.length === 2 && isPercent(p[0]) && isPercent(p[1]))
      ) {
        errors.push(`${where}: points must be up to ${MAX_BEND_POINTS} [x, y] pairs from 0 to 100`)
      }
    }
  }
  return errors
}

/** The board if `raw` is valid, otherwise undefined. */
export function parseBoardData(raw: unknown): BoardData | undefined {
  return validateBoardData(raw).length === 0 ? (raw as BoardData) : undefined
}

/* ------------------------------------------------------------------------ */
/* Topology                                                                  */
/* ------------------------------------------------------------------------ */

/** Locations reachable from `start` over links usable in the given era. */
export function reachable(board: BoardData, start: string, era: Era): Set<string> {
  const seen = new Set([start])
  const queue = [start]
  while (queue.length) {
    const at = queue.shift()!
    for (const link of board.links) {
      if (!isLinkActive(link.type, era)) continue
      const next = link.from === at ? link.to : link.to === at ? link.from : null
      if (next && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

/** Number of links touching each location. */
export function degrees(board: BoardData): Map<string, number> {
  const count = new Map(board.locations.map((l) => [l.id, 0]))
  for (const link of board.links) {
    count.set(link.from, (count.get(link.from) ?? 0) + 1)
    count.set(link.to, (count.get(link.to) ?? 0) + 1)
  }
  return count
}

/** What the checked-in board is held to (the checks in the board spec). */
export interface BoardDesign {
  /** Canal-era reachability is measured from here. */
  start: string
  links: Record<LinkType, number>
  /** Number of cities with each tile count. */
  tiles: Record<number, number>
}

export const BOARD_DESIGN: BoardDesign = { start: 'birmingham', links: { both: 16, canal: 6, rail: 17 }, tiles: { 4: 2, 3: 4, 2: 10, 1: 3 } }

/**
 * Everything about the network that breaks its design, as readable messages:
 * 1. from `start`, canal and "both" links reach every location except the
 *    rail-era ones; 2. rail and "both" links reach every location; 3. degrees
 *    add up to twice the link count, with the right number of each type;
 *    4. the right number of cities of each tile count.
 */
export function designProblems(board: BoardData, design: BoardDesign): string[] {
  const problems: string[] = []
  const list = (ids: string[]) => ids.join(', ') || 'nothing'
  const canal = reachable(board, design.start, 'canal')
  const unreached = board.locations.filter((l) => !canal.has(l.id)).map((l) => l.id)
  const railOnly = board.locations.filter((l) => l.era === 'rail').map((l) => l.id)
  if (unreached.join() !== railOnly.join()) {
    problems.push(`Canal era: from ${design.start} everything but ${list(railOnly)} should be reachable; unreachable: ${list(unreached)}`)
  }
  const rail = reachable(board, design.start, 'rail')
  const railMissing = board.locations.filter((l) => !rail.has(l.id)).map((l) => l.id)
  if (railMissing.length) problems.push(`Rail era: can't reach ${list(railMissing)}`)
  const expectedLinks = design.links.both + design.links.canal + design.links.rail
  const total = [...degrees(board).values()].reduce((a, b) => a + b, 0)
  if (total !== expectedLinks * 2) problems.push(`Location degrees add up to ${total}, expected ${expectedLinks * 2} (${expectedLinks} links)`)
  for (const type of ['both', 'canal', 'rail'] as const) {
    const count = board.links.filter((l) => l.type === type).length
    if (count !== design.links[type]) problems.push(`${count} ${type} links, expected ${design.links[type]}`)
  }
  const tiles = new Map<number, number>()
  for (const l of board.locations) if (l.type === 'city') tiles.set(l.slots.length, (tiles.get(l.slots.length) ?? 0) + 1)
  for (const [n, expected] of Object.entries(design.tiles)) {
    const count = tiles.get(Number(n)) ?? 0
    if (count !== expected) problems.push(`${count} cities with ${n} tile${n === '1' ? '' : 's'}, expected ${expected}`)
  }
  return problems
}

/* ------------------------------------------------------------------------ */
/* Export                                                                    */
/* ------------------------------------------------------------------------ */

const LOCATION_KEYS = ['id', 'name', 'type', 'x', 'y', 'region', 'ring', 'era', 'labelOffset', 'slots', 'price', 'value', 'buys']
const LINK_KEYS = ['id', 'from', 'to', 'type', 'points']

/** One object per line, `{ "key": value, ... }` in a fixed key order, as board.json is laid out. */
function inline(obj: object, keys?: string[]): string {
  const record = obj as Record<string, unknown>
  const order = keys ? [...keys.filter((k) => k in record), ...Object.keys(record).filter((k) => !keys.includes(k))] : Object.keys(record)
  const entries = order.filter((k) => record[k] !== undefined).map((key) => `${JSON.stringify(key)}: ${JSON.stringify(record[key])}`)
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
    board.locations.map((l) => `    ${inline(l, LOCATION_KEYS)}`).join(',\n'),
    '  ],',
    '  "links": [',
    board.links.map((l) => `    ${inline(l, LINK_KEYS)}`).join(',\n'),
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

// Development builds refuse to start on a network that breaks the design (the tests check it too).
if (import.meta.env.DEV) {
  const wrong = designProblems(BOARD, BOARD_DESIGN)
  if (wrong.length) throw new Error(`src/data/board.json breaks the board design:\n${wrong.join('\n')}`)
}
