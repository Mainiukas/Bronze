import '@fontsource/cinzel/latin-700.css'
import '@fontsource/cinzel/latin-800.css'
import { useEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  EMPTY_BUILT,
  INDUSTRY_NAMES,
  MAX_BEND_POINTS,
  slotKey,
  type BoardData,
  type BuiltState,
  type Era,
  type Industry,
} from '../../data/board'
import { seatColor, SEATS } from '../game/glyphs'
import { hubPhotoUrl, imageOk, MAP_URL, TEXTURE_URLS, TOKEN_URLS, useBoardImagesReady, type TokenColor } from './assets'
import { BoardTooltip, type TooltipTarget } from './BoardTooltip'
import { cubicPath, inflate, polyline, polylinePath, roundPercent, texturePieces, toPercent, toView, type Point, type Rect, type TexturePiece } from './geometry'
import {
  boardFont,
  CITY_FONT,
  CITY_WEIGHT,
  HUB_FONT,
  HUB_WEIGHT,
  layoutBoard,
  segmentMidpoints,
  STOP_FONT,
  STOP_WEIGHT,
  TEXTURE_PIECE,
  TRACK_H,
  type BoardLayout,
  type GroupLayout,
  type RouteLayout,
} from './layout'
import { createTextMeasurer, useFontsReady, type MeasureText } from './measure'
import {
  BoardDefs,
  HubGroup,
  LinkBubble,
  LinkToken,
  NamePlate,
  PriceBadge,
  RailEraBadge,
  RouteShadow,
  RouteStroke,
  RouteTexture,
  SlotTile,
  StopPlaque,
} from './parts'
import { samplePath } from './sampling'
import { BOARD_COLORS, DEF } from './style'

export type BoardSelection =
  | { type: 'location'; id: string }
  | { type: 'slot'; locationId: string; index: number }
  | { type: 'link'; id: string }

/**
 * Match mode: what can be clicked right now. When given, only these are
 * interactive and they glow; labels (costs, payouts) are shown beside them.
 * Without it (the sandbox page), every visible item is clickable.
 */
export interface BoardTargets {
  /** Keyed by slotKey(locationId, index). */
  slots?: ReadonlyMap<string, string | null>
  links?: ReadonlyMap<string, string | null>
  locations?: ReadonlyMap<string, string | null>
}

/** The last move, to highlight. `key` changes with every move so the flash replays. */
export interface BoardRecent {
  key: number
  slot?: string
  link?: string
  location?: string
  /** Links goods travelled along, in order from `from`: a dot runs along them. */
  path?: readonly string[]
  from?: string
}

export interface IllustratedBoardProps {
  board: BoardData
  /** Only the links of this era are drawn: canals in the canal era, railways in the rail era. */
  era: Era
  /** Who has built what. The board only draws it; the caller owns it. */
  built?: BuiltState
  /** Highlighted until changed by the caller. */
  selected?: BoardSelection | null
  playerColor?: (player: number) => string
  playerName?: (player: number) => string
  /** A letter per player, drawn on their tiles and tokens (the colour-blind aid). */
  playerMark?: (player: number) => string | undefined
  onSelectLocation?: (locationId: string) => void
  onSelectSlot?: (locationId: string, slotIndex: number) => void
  onSelectLink?: (linkId: string) => void
  /** Calibration mode: drag locations, plaques and bend points instead of selecting. */
  editable?: boolean
  /** Receives the edited board while dragging in edit mode. */
  onBoardChange?: (board: BoardData) => void
  targets?: BoardTargets
  /** Current hub prices, shown on their plaques. */
  prices?: Readonly<Record<string, number>>
  /** Locations not in play (smaller game modes): drawn faded. */
  closed?: ReadonlySet<string>
  /** Outline these locations in a player's colour (their network). */
  network?: { locations: ReadonlySet<string>; color: string } | null
  recent?: BoardRecent | null
  /** Multiplies the length of board animations (the animation-speed setting); 0 turns the moving dot off. */
  motion?: number
  className?: string
}

type DragTarget = { type: 'point'; id: string } | { type: 'group'; id: string } | { type: 'bend'; linkId: string; index: number }
/** An editor drag in progress: previewed as it moves, committed to the board on release. */
type Drag = DragTarget & { start: Point; at: Point }
type EditFocus = { type: 'point' | 'group'; id: string } | { type: 'bend'; linkId: string; index: number }

const FONTS = [boardFont(CITY_FONT, CITY_WEIGHT), boardFont(STOP_FONT, STOP_WEIGHT), boardFont(HUB_FONT, HUB_WEIGHT)]
/** Locations outside the mode's rings, and their links, are drawn at 35 %. */
const CLOSED_OPACITY = { link: 0.35, location: 0.35 }

/** Token art for a player colour, if the colour is one the tokens come in. */
function tokenColor(color: string): TokenColor | undefined {
  return SEATS.find((s) => s.color.toLowerCase() === color.toLowerCase())?.token
}

/** Finished layouts per board (and font state), so revisiting a page doesn't lay it out again. */
const layoutCache = new WeakMap<BoardData, BoardLayout>()
function cachedLayout(board: BoardData, measure: MeasureText): BoardLayout {
  let layout = layoutCache.get(board)
  if (!layout) {
    layout = layoutBoard(board, measure)
    layoutCache.set(board, layout)
  }
  return layout
}

/** Texture pieces per era and path, kept between renders (and between boards). */
const pieceCache = new Map<string, TexturePiece[]>()
function piecesFor(route: RouteLayout): TexturePiece[] {
  const d = cubicPath(route.segments)
  const key = `${route.era}|${d}`
  let pieces = pieceCache.get(key)
  if (!pieces) {
    const path = samplePath(d, route.segments)
    pieces = texturePieces(path.at, path.total, TEXTURE_PIECE[route.era], TRACK_H[route.era])
    if (pieceCache.size > 400) pieceCache.delete(pieceCache.keys().next().value!)
    pieceCache.set(key, pieces)
  }
  return pieces
}

/** Make an SVG element behave like a button (click, Enter, Space). */
function asButton(label: string, onActivate: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onActivate()
      }
    },
  }
}

/** "Birmingham, slot 3: cotton mill or iron works, free" */
function slotLabel(name: string, index: number, allowed: Industry[], owner: string | null, built?: Industry): string {
  const kinds = allowed.map((a) => INDUSTRY_NAMES[a].toLowerCase()).join(' or ')
  return `${name}, slot ${index + 1}: ${kinds}, ${built && owner ? `built: ${owner}’s ${INDUSTRY_NAMES[built].toLowerCase()}` : 'free'}`
}

/**
 * The illustrated map board: the painted map with an SVG overlay (viewBox
 * 0 0 1000 1000) drawn from board data. Layers, bottom to top: route
 * shadows, route textures, link spaces, link tokens, plaques and tiles,
 * badges, hover/selection, then the tooltip.
 *
 * Only the current era's links exist on it: canals (and "both" links as
 * canals) in the canal era, railways (and "both" links as railways) in the
 * rail era. A pure view: what's built, the era and the selection come in as
 * props, and clicks go out through the onSelect* callbacks.
 */
export function IllustratedBoard({
  board,
  era,
  built = EMPTY_BUILT,
  selected = null,
  playerColor = seatColor,
  playerName = (player) => `Player ${player + 1}`,
  playerMark,
  onSelectLocation,
  onSelectSlot,
  onSelectLink,
  editable = false,
  onBoardChange,
  targets,
  prices,
  closed,
  network = null,
  recent = null,
  motion = 1,
  className = '',
}: IllustratedBoardProps) {
  const imagesReady = useBoardImagesReady()
  const fontsReady = useFontsReady(FONTS)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<TooltipTarget | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Last item moved in the editor; its values stay on screen. */
  const [editFocus, setEditFocus] = useState<EditFocus | null>(null)

  // Plaques are sized to their names from Cinzel's glyph widths, so the layout never waits for the font
  // (the board still waits before drawing, so labels don't flash in another font).
  const measure = useMemo(() => createTextMeasurer(), [])
  // Both eras are laid out together, so switching era is instant and the towns don't move.
  // Editor drags only preview; the board is laid out again when they're released.
  const layout = useMemo(() => (fontsReady ? cachedLayout(board, measure) : null), [board, measure, fontsReady])
  const routesLayout = layout?.routes[era]
  const groups = layout?.groups ?? new Map<string, GroupLayout>()
  const routes = routesLayout ? [...routesLayout.routes.values()] : []
  const pieces = useMemo(
    () => (routesLayout && imagesReady && imageOk(TEXTURE_URLS[era]) ? new Map([...routesLayout.routes.values()].map((r) => [r.link.id, piecesFor(r)])) : null),
    [routesLayout, imagesReady, era],
  )

  // Route shadows and textures only change with the layout, not with hover or drags: build them once.
  const routeLayers = useMemo(() => {
    if (!routesLayout) return null
    const list = [...routesLayout.routes.values()]
    const opacity = (r: RouteLayout) => (closed?.has(r.link.from) || closed?.has(r.link.to) ? CLOSED_OPACITY.link : 1)
    return {
      shadows: list.map((route) => (
        <g key={route.link.id} opacity={opacity(route)}>
          <RouteShadow era={era} d={cubicPath(route.segments)} />
        </g>
      )),
      textures: list.map((route) => (
        <g key={route.link.id} opacity={opacity(route)}>
          {pieces ? (
            <RouteTexture era={era} id={`ib-${era}-${route.link.id}`} pieces={pieces.get(route.link.id)!} />
          ) : (
            <RouteStroke era={era} d={cubicPath(route.segments)} />
          )}
        </g>
      )),
    }
  }, [routesLayout, pieces, era, closed])

  useEffect(() => {
    if (import.meta.env.DEV && layout && !editable && layout.problems.length) {
      console.warn(`Board layout: ${layout.problems.length} problem(s)\n${layout.problems.join('\n')}`)
    }
  }, [layout, editable])

  const locations = useMemo(() => new Map(board.locations.map((l) => [l.id, l])), [board.locations])
  const name = (id: string) => locations.get(id)?.name ?? id
  const recentPath = new Set(recent?.path ?? [])
  const isShut = (id: string) => closed?.has(id) ?? false
  const routeShut = (route: RouteLayout) => isShut(route.link.from) || isShut(route.link.to)
  const linkLabel = (route: RouteLayout, extra?: string | null) =>
    `${name(route.link.from)} to ${name(route.link.to)} (${era === 'canal' ? 'canal' : 'railway'})${extra ? `: ${extra}` : ''}`
  const labelForSlot = (locationId: string, index: number) => {
    const location = locations.get(locationId)
    if (location?.type !== 'city') return locationId
    const tile = built.slots[slotKey(locationId, index)]
    return slotLabel(location.name, index, location.slots[index] ?? [], tile ? playerName(tile.player) : null, tile?.industry)
  }

  // Links to glow: this era's links touching the hovered or selected location, or the hovered/selected link.
  const glow = new Map<string, boolean>()
  const glowLinksOf = (locationId: string, strong: boolean) => {
    for (const r of routes) if (r.link.from === locationId || r.link.to === locationId) glow.set(r.link.id, strong || (glow.get(r.link.id) ?? false))
  }
  const selectedLocation = selected?.type === 'location' ? selected.id : selected?.type === 'slot' ? selected.locationId : null
  if (selectedLocation) glowLinksOf(selectedLocation, false)
  if (selected?.type === 'link' && routesLayout?.routes.has(selected.id)) glow.set(selected.id, false)
  if (hover?.type === 'location') glowLinksOf(hover.id, true)
  if (hover?.type === 'link') glow.set(hover.id, true)

  /* ---- Editing ----------------------------------------------------------- */

  const toViewPoint = (event: { clientX: number; clientY: number }): Point => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }

  const update = (next: BoardData) => onBoardChange?.(next)
  const setLocation = (id: string, change: (l: BoardData['locations'][number]) => BoardData['locations'][number]) =>
    update({ ...board, locations: board.locations.map((l) => (l.id === id ? change(l) : l)) })
  const setPoints = (linkId: string, points: [number, number][]) =>
    update({
      ...board,
      links: board.links.map((l) => {
        if (l.id !== linkId) return l
        const { points: _old, ...rest } = l
        return points.length ? { ...rest, points } : rest
      }),
    })

  const moveLocation = (id: string, x: number, y: number) => {
    const l = locations.get(id)
    if (l && (l.x !== x || l.y !== y)) setLocation(id, (loc) => ({ ...loc, x, y }))
  }
  const offsetGroup = (id: string, x: number, y: number) => {
    const l = locations.get(id)
    if (l && (l.labelOffset?.x !== x || l.labelOffset?.y !== y)) setLocation(id, (loc) => ({ ...loc, labelOffset: { x, y } }))
  }
  const clearOffset = (id: string) =>
    setLocation(id, (loc) => {
      const { labelOffset: _old, ...rest } = loc
      return rest as typeof loc
    })
  const moveBend = (linkId: string, index: number, p: Point) => {
    const link = board.links.find((l) => l.id === linkId)
    if (!link?.points?.[index]) return
    const pct = toPercent(p)
    setPoints(
      linkId,
      link.points.map((q, i): [number, number] => (i === index ? [roundPercent(pct.x), roundPercent(pct.y)] : q)),
    )
  }

  const beginDrag = (event: PointerEvent, next: DragTarget, focus: EditFocus) => {
    event.preventDefault()
    event.stopPropagation()
    svgRef.current?.setPointerCapture(event.pointerId)
    const p = toViewPoint(event)
    setDrag({ ...next, start: p, at: p })
    setEditFocus(focus)
  }
  const startPointDrag = (event: PointerEvent, id: string) => beginDrag(event, { type: 'point', id }, { type: 'point', id })
  const startGroupDrag = (event: PointerEvent, id: string) => {
    if (editable) beginDrag(event, { type: 'group', id }, { type: 'group', id })
  }
  const startBendDrag = (event: PointerEvent, linkId: string, index: number) => beginDrag(event, { type: 'bend', linkId, index }, { type: 'bend', linkId, index })
  /** Drag from a "+" handle: insert a bend point there and keep dragging it. */
  const startNewBend = (event: PointerEvent, route: RouteLayout, index: number) => {
    const p = toPercent(toViewPoint(event))
    const points = [...(route.link.points ?? [])]
    points.splice(index, 0, [roundPercent(p.x), roundPercent(p.y)])
    setPoints(route.link.id, points)
    startBendDrag(event, route.link.id, index)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  /** Where the dragged item would go if released now (in %). */
  const dragResult = (d: Drag): Point | null => {
    const delta = { x: (d.at.x - d.start.x) / 10, y: (d.at.y - d.start.y) / 10 }
    if (d.type === 'point') {
      const l = locations.get(d.id)
      return l ? { x: roundPercent(l.x + delta.x), y: roundPercent(l.y + delta.y) } : null
    }
    if (d.type === 'group') {
      const g = groups.get(d.id)
      return g ? { x: round1((g.center.x - g.point.x) / 10 + delta.x), y: round1((g.center.y - g.point.y) / 10 + delta.y) } : null
    }
    const q = board.links.find((l) => l.id === d.linkId)?.points?.[d.index]
    return q ? { x: roundPercent(q[0] + delta.x), y: roundPercent(q[1] + delta.y) } : null
  }
  const onPointerMove = (event: PointerEvent) => {
    if (drag) setDrag({ ...drag, at: toViewPoint(event) })
  }
  const endDrag = () => {
    if (!drag) return
    const result = dragResult(drag)
    const moved = drag.at.x !== drag.start.x || drag.at.y !== drag.start.y
    setDrag(null)
    if (!result || !moved) return
    if (drag.type === 'point') moveLocation(drag.id, result.x, result.y)
    else if (drag.type === 'group') offsetGroup(drag.id, result.x, result.y)
    else moveBend(drag.linkId, drag.index, toView(result))
  }
  /** The preview shift for a location's group while it's dragged. */
  const dragShift = (id: string) => (drag?.type === 'group' && drag.id === id ? `translate(${drag.at.x - drag.start.x} ${drag.at.y - drag.start.y})` : undefined)

  // Arrow keys fine-tune the last edited item: 0.1 % per press, 1 % with Shift.
  const nudge = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (!editable || !editFocus || !event.key.startsWith('Arrow')) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    const step = event.shiftKey ? 1 : 0.1
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
    const round = (n: number) => Math.round(n * 10) / 10
    if (editFocus.type === 'bend') {
      const q = board.links.find((l) => l.id === editFocus.linkId)?.points?.[editFocus.index]
      if (q) moveBend(editFocus.linkId, editFocus.index, toView({ x: q[0] + dx, y: q[1] + dy }))
      return
    }
    const l = locations.get(editFocus.id)
    if (!l) return
    if (editFocus.type === 'point') moveLocation(l.id, roundPercent(l.x + dx), roundPercent(l.y + dy))
    else {
      const g = groups.get(l.id)!
      offsetGroup(l.id, round((g.center.x - g.point.x) / 10 + dx), round((g.center.y - g.point.y) / 10 + dy))
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', nudge)
    return () => window.removeEventListener('keydown', nudge)
  }, [])

  /* ---- Rendering --------------------------------------------------------- */

  const hoverHandlers = (next: TooltipTarget) => ({
    onPointerEnter: () => setHover(next),
    onPointerLeave: () => setHover(null),
    onFocus: () => setHover(next),
    onBlur: () => setHover(null),
  })

  const slotRect = (key: string): Rect | undefined => {
    const [locationId, index] = key.split(':')
    const g = groups.get(locationId)
    return g?.parts.type === 'city' ? g.parts.tiles[Number(index)] : undefined
  }

  const map = <img src={MAP_URL} alt="Illustrated map of Wales, the Midlands and the South West" className="absolute inset-0 size-full" draggable={false} />
  if (!imagesReady || !layout || !routesLayout) {
    return (
      <div className={`relative grid aspect-square w-full place-items-center overflow-hidden bg-soot-900 select-none ${className}`}>
        {map}
        <p className="relative rounded-lg bg-soot-950/85 px-4 py-2 font-display text-sm font-bold tracking-[0.15em] text-parchment-200 uppercase" role="status">
          Loading the board…
        </p>
      </div>
    )
  }

  const editGroup = editFocus && editFocus.type !== 'bend' ? locations.get(editFocus.id) : undefined
  const editLink = editFocus?.type === 'bend' ? board.links.find((l) => l.id === editFocus.linkId) : undefined

  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-soot-900 select-none ${className}`}>
      {map}
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        className={`absolute inset-0 size-full ${editable ? 'touch-none' : ''}`}
        // Exact glyph widths at any zoom, matching how plates were measured.
        textRendering="geometricPrecision"
        role="group"
        aria-label="Map board"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(null)}
      >
        <BoardDefs />

        {/* 1. Route shadows, and glows under highlighted routes */}
        <g aria-hidden="true" pointerEvents="none">
          <g filter={`url(#${DEF.routeShadow})`}>{routeLayers?.shadows}</g>
          {routes.map((route) => {
            const targeted = targets?.links?.has(route.link.id) ?? false
            if (!glow.has(route.link.id) && !targeted) return null
            return (
              <path
                key={route.link.id}
                d={polylinePath(route.line)}
                className={`fill-none stroke-board-glow ${targeted ? 'board-target' : ''}`}
                strokeWidth={30}
                strokeLinecap="round"
                opacity={targeted || glow.get(route.link.id) ? 0.5 : 0.3}
              />
            )
          })}
        </g>

        {/* 2. Route textures */}
        <g aria-hidden="true" pointerEvents="none">
          {routeLayers?.textures}
          {routes
            .filter((route) => recentPath.has(route.link.id))
            .map((route) => (
              <path key={`${route.link.id}-${recent?.key}`} d={polylinePath(route.line)} className="board-flow-lg fill-none stroke-brass-200" strokeWidth={5} strokeLinecap="round" />
            ))}
          {recent?.path?.length && recent.from && motion > 0 ? (
            <ShipDot key={recent.key} d={shipPath(recent.path, recent.from, routesLayout.routes)} seconds={0.55 * recent.path.length * motion} />
          ) : null}
        </g>

        {/* 3. Link spaces (empty) and 4. link tokens (built) */}
        {(['spaces', 'tokens'] as const).map((layer) => (
          <g key={layer}>
            {routes.map((route) => {
              const { link, marker } = route
              const owner = built.links[link.id]
              if ((layer === 'tokens') !== (owner !== undefined)) return null
              const shut = routeShut(route)
              // In a match, targets are clicked in the top layer instead.
              const clickable = !editable && !targets && !!onSelectLink && !shut
              const hovered = hover?.type === 'link' && hover.id === link.id
              return (
                <g
                  key={link.id}
                  opacity={shut ? CLOSED_OPACITY.link : 1}
                  pointerEvents={shut ? 'none' : undefined}
                  className={clickable ? 'cursor-pointer' : undefined}
                  {...(clickable ? asButton(linkLabel(route), () => onSelectLink!(link.id)) : {})}
                  {...(shut ? {} : hoverHandlers({ type: 'link', id: link.id }))}
                >
                  <circle cx={marker.x} cy={marker.y} r={20} fill="transparent" />
                  {owner ? (
                    (() => {
                      const color = playerColor(owner.player)
                      const token = tokenColor(color)
                      return (
                        <LinkToken
                          x={marker.x}
                          y={marker.y}
                          angle={marker.angle}
                          era={era}
                          token={token && TOKEN_URLS[era][token]}
                          color={color}
                          mark={playerMark?.(owner.player)}
                        />
                      )
                    })()
                  ) : (
                    <LinkBubble x={marker.x} y={marker.y} angle={marker.angle} glow={hovered && clickable} />
                  )}
                  {recent?.link === link.id && (
                    <circle key={recent.key} cx={marker.x} cy={marker.y} r={24} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
                  )}
                </g>
              )
            })}
          </g>
        ))}

        {/* 5. Locations: tiles and name plates, stop plaques, hubs */}
        <g>
          {board.locations.map((location) => {
            const g = groups.get(location.id)!
            const shut = isShut(location.id)
            const clickable = !editable && !targets && !shut && !!onSelectLocation
            const common = {
              opacity: shut ? CLOSED_OPACITY.location : 1,
              transform: dragShift(location.id),
              onPointerDown: (e: PointerEvent) => startGroupDrag(e, location.id),
              onDoubleClick: editable && location.labelOffset ? () => clearOffset(location.id) : undefined,
            }
            if (location.type === 'city' && g.parts.type === 'city') {
              const parts = g.parts
              return (
                <g key={location.id} {...common} className={editable ? 'cursor-grab' : undefined}>
                  {location.slots.map((allowed, index) => {
                    const key = slotKey(location.id, index)
                    const tile = built.slots[key]
                    const slotClickable = !editable && !targets && !shut && !!onSelectSlot
                    return (
                      <g
                        key={key}
                        className={slotClickable ? 'cursor-pointer' : undefined}
                        {...(shut ? {} : hoverHandlers({ type: 'location', id: location.id, slot: index }))}
                        {...(slotClickable ? asButton(labelForSlot(location.id, index), () => onSelectSlot!(location.id, index)) : {})}
                      >
                        <SlotTile
                          rect={parts.tiles[index]}
                          allowed={allowed}
                          tile={
                            tile
                              ? {
                                  industry: tile.industry,
                                  color: playerColor(tile.player),
                                  stars: tile.stars,
                                  goods: tile.industry === 'cotton' ? (tile.goods ?? 0) : undefined,
                                  mark: playerMark?.(tile.player),
                                }
                              : null
                          }
                        />
                      </g>
                    )
                  })}
                  <g
                    className={clickable ? 'cursor-pointer' : undefined}
                    {...(shut ? {} : hoverHandlers({ type: 'location', id: location.id }))}
                    {...(clickable ? asButton(location.name, () => onSelectLocation!(location.id)) : {})}
                  >
                    <NamePlate rect={parts.plate} color={board.regions[location.region]?.color ?? '#444'} name={location.name} fontSize={g.fontSize} />
                  </g>
                </g>
              )
            }
            return (
              <g
                key={location.id}
                {...common}
                className={editable ? 'cursor-grab' : clickable ? 'cursor-pointer' : undefined}
                {...(shut ? {} : hoverHandlers({ type: 'location', id: location.id }))}
                {...(clickable ? asButton(location.name, () => onSelectLocation!(location.id)) : {})}
              >
                {location.type === 'stop' && g.parts.type === 'stop' && <StopPlaque parts={g.parts} name={location.name} fontSize={g.fontSize} />}
                {location.type === 'hub' && g.parts.type === 'hub' && (
                  <HubGroup
                    location={location}
                    parts={g.parts}
                    fontSize={g.fontSize}
                    photo={(() => {
                      const url = hubPhotoUrl(location.id)
                      return imageOk(url) ? url : null
                    })()}
                  />
                )}
              </g>
            )
          })}
        </g>

        {/* 6. Badges */}
        <g>
          {board.locations.map((location) => {
            const g = groups.get(location.id)!
            return (
              <g key={location.id} opacity={isShut(location.id) ? CLOSED_OPACITY.location : 1} transform={dragShift(location.id)}>
                {location.type === 'hub' && g.parts.type === 'hub' && (
                  <g pointerEvents="none">
                    <PriceBadge rect={g.parts.badge} price={prices?.[location.id] ?? location.price} />
                  </g>
                )}
                {g.railBadge && era === 'canal' && <RailEraBadge at={g.railBadge} />}
              </g>
            )
          })}
        </g>

        {/* 7. Hover, selection and target highlights */}
        <g pointerEvents="none">
          {network &&
            [...network.locations].map((id) => {
              const g = groups.get(id)
              if (!g) return null
              const box = inflate(g.bounds, 4)
              return (
                <rect key={`net-${id}`} x={box.x} y={box.y} width={box.w} height={box.h} rx={10} fill="none" stroke={network.color} strokeWidth={2.2} strokeDasharray="6 4" />
              )
            })}
          {targets?.slots &&
            [...targets.slots].map(([key, text]) => {
              const rect = slotRect(key)
              if (!rect) return null
              const box = inflate(rect, 3)
              return (
                <g key={`t-${key}`}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} className="board-target fill-none stroke-board-glow" strokeWidth={2.5} />
                  {text && <TargetTag x={rect.x + rect.w / 2} y={rect.y - 12} text={text} />}
                </g>
              )
            })}
          {targets?.locations &&
            [...targets.locations].map(([id, text]) => {
              const g = groups.get(id)
              if (!g) return null
              const box = inflate(g.bounds, 5)
              return (
                <g key={`t-${id}`}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} className="board-target fill-none stroke-board-glow" strokeWidth={3} />
                  {text && <TargetTag x={g.center.x} y={box.y - 12} text={text} />}
                </g>
              )
            })}
          {targets?.links &&
            [...targets.links].map(([id, text]) => {
              const route = routesLayout.routes.get(id)
              if (!route || !text) return null
              return <TargetTag key={`t-${id}`} x={route.marker.x} y={route.marker.y - 24} text={text} />
            })}
          {recent?.slot &&
            (() => {
              const rect = slotRect(recent.slot)
              if (!rect) return null
              const box = inflate(rect, 2)
              return <rect key={recent.key} x={box.x} y={box.y} width={box.w} height={box.h} rx={3} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
            })()}
          {recent?.location &&
            (() => {
              const g = groups.get(recent.location)
              if (!g) return null
              const box = inflate(g.bounds, 4)
              return <rect key={recent.key} x={box.x} y={box.y} width={box.w} height={box.h} rx={8} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
            })()}
          {[
            selectedLocation && { id: selectedLocation, className: 'stroke-brass-200' },
            hover?.type === 'location' && { id: hover.id, className: 'stroke-board-glow' },
          ].map((mark) => {
            if (!mark) return null
            const g = groups.get(mark.id)
            if (!g) return null
            const box = inflate(g.bounds, 5)
            return (
              <g key={`${mark.id}-${mark.className}`} className={`fill-none ${mark.className}`}>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} strokeWidth={8} opacity={0.25} />
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} strokeWidth={2} />
              </g>
            )
          })}
          {selected?.type === 'slot' &&
            (() => {
              const rect = slotRect(slotKey(selected.locationId, selected.index))
              if (!rect) return null
              const box = inflate(rect, 3.5)
              return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} className="fill-none stroke-brass-200" strokeWidth={2.5} />
            })()}
          {selected?.type === 'link' &&
            (() => {
              const route = routesLayout.routes.get(selected.id)
              if (!route) return null
              return <circle cx={route.marker.x} cy={route.marker.y} r={25} className="fill-none stroke-brass-200" strokeWidth={2.4} />
            })()}
        </g>

        {/* Match targets: clickable above everything, so nothing hides one */}
        {targets && !editable && (
          <g>
            {[...(targets.slots ?? new Map<string, string | null>()).keys()].map((key) => {
              const [locationId, index] = key.split(':')
              const location = locations.get(locationId)
              const rect = slotRect(key)
              if (!location || location.type !== 'city' || !rect) return null
              return (
                <rect
                  key={`hit-${key}`}
                  x={rect.x - 2}
                  y={rect.y - 2}
                  width={rect.w + 4}
                  height={rect.h + 4}
                  fill="transparent"
                  className="cursor-pointer"
                  {...asButton(`${labelForSlot(locationId, Number(index))}${targets.slots?.get(key) ? `. ${targets.slots.get(key)}` : ''}`, () => onSelectSlot?.(locationId, Number(index)))}
                  {...hoverHandlers({ type: 'location', id: locationId, slot: Number(index) })}
                />
              )
            })}
            {[...(targets.locations ?? new Map<string, string | null>()).keys()].map((id) => {
              const g = groups.get(id)
              if (!g) return null
              const box = inflate(g.bounds, 5)
              return (
                <rect
                  key={`hit-${id}`}
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  rx={8}
                  fill="transparent"
                  className="cursor-pointer"
                  {...asButton(`${name(id)}${targets.locations?.get(id) ? `: ${targets.locations.get(id)}` : ''}`, () => onSelectLocation?.(id))}
                  {...hoverHandlers({ type: 'location', id })}
                />
              )
            })}
            {[...(targets.links ?? new Map<string, string | null>()).keys()].map((id) => {
              const route = routesLayout.routes.get(id)
              if (!route) return null
              const hovered = hover?.type === 'link' && hover.id === id
              return (
                <g key={`hit-${id}`} className="cursor-pointer" {...asButton(linkLabel(route, targets.links?.get(id)), () => onSelectLink?.(id))} {...hoverHandlers({ type: 'link', id })}>
                  <circle cx={route.marker.x} cy={route.marker.y} r={24} fill="transparent" />
                  <LinkBubble x={route.marker.x} y={route.marker.y} angle={route.marker.angle} glow />
                  {hovered && (
                    <circle cx={route.marker.x} cy={route.marker.y} r={27} fill="none" className="stroke-brass-200" strokeWidth={2} />
                  )}
                </g>
              )
            })}
          </g>
        )}

        {/* Editor: grid, drag handles and the live readout */}
        {editable && (
          <g>
            <EditGrid />
            {[...groups.values()].map((g) =>
              Math.hypot(g.center.x - g.point.x, g.center.y - g.point.y) > 3 ? (
                <line key={`tie-${g.location.id}`} x1={g.point.x} y1={g.point.y} x2={g.center.x} y2={g.center.y} className="stroke-board-glow" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
              ) : null,
            )}
            {routes.map((route) => {
              const points = route.link.points ?? []
              return (
                <g key={route.link.id}>
                  {points.length < MAX_BEND_POINTS &&
                    segmentMidpoints(route).map((m, i) => (
                      <g key={`add-${i}`} className="cursor-copy" onPointerDown={(e) => startNewBend(e, route, i)}>
                        <title>Drag to add a bend point</title>
                        <circle cx={m.x} cy={m.y} r={9} fill="transparent" />
                        <circle cx={m.x} cy={m.y} r={4.5} fill="#000" fillOpacity={0.6} className="stroke-board-ink" strokeWidth={1.2} />
                        <path d={`M${m.x - 2.5} ${m.y}h5M${m.x} ${m.y - 2.5}v5`} className="stroke-board-ink" strokeWidth={1.2} />
                      </g>
                    ))}
                  {points.map(([x, y], i) => {
                    const moving = drag?.type === 'bend' && drag.linkId === route.link.id && drag.index === i ? dragResult(drag) : null
                    const p = toView(moving ?? { x, y })
                    const focused = editFocus?.type === 'bend' && editFocus.linkId === route.link.id && editFocus.index === i
                    return (
                      <g key={`bend-${i}`} className="cursor-grab" onPointerDown={(e) => startBendDrag(e, route.link.id, i)} onDoubleClick={() => setPoints(route.link.id, points.filter((_, k) => k !== i))}>
                        <title>Drag to bend; double-click to remove</title>
                        <rect x={p.x - 10} y={p.y - 10} width={20} height={20} fill="transparent" />
                        <rect x={p.x - 4.5} y={p.y - 4.5} width={9} height={9} fill={focused ? BOARD_COLORS.glow : BOARD_COLORS.cream} stroke="#000" strokeWidth={1.2} />
                      </g>
                    )
                  })}
                </g>
              )
            })}
            {board.locations.map((location) => {
              const moving = drag?.type === 'point' && drag.id === location.id ? dragResult(drag) : null
              const c = toView(moving ?? location)
              const active = editFocus?.type === 'point' && editFocus.id === location.id
              return (
                <g key={location.id} className="cursor-move" onPointerDown={(e) => startPointDrag(e, location.id)}>
                  <title>{`${location.name}: drag to move the location`}</title>
                  <circle cx={c.x} cy={c.y} r={12} fill="transparent" />
                  <circle cx={c.x} cy={c.y} r={5.5} fill="#000" fillOpacity={0.6} className={active ? 'stroke-board-glow' : 'stroke-board-ink'} strokeWidth={1.8} />
                  <path d={`M${c.x - 9} ${c.y}h18M${c.x} ${c.y - 9}v18`} className={active ? 'stroke-board-glow' : 'stroke-board-ink'} strokeWidth={1.2} />
                </g>
              )
            })}
            {(() => {
              // The live values: where a drag would land, or the last edited item's.
              const live = drag ? dragResult(drag) : null
              if (editGroup && editFocus?.type === 'point') {
                const at = live ?? editGroup
                return <Readout at={toView(at)} text={`${editGroup.name}  x ${at.x}%  y ${at.y}%`} />
              }
              if (editGroup && editFocus?.type === 'group') {
                const offset = live ?? editGroup.labelOffset
                const g = groups.get(editGroup.id)!
                return <Readout at={g.center} text={`${editGroup.name} plaque  ${offset ? `offset x ${offset.x}%  y ${offset.y}%` : 'automatic'}`} />
              }
              const q = editLink && editFocus?.type === 'bend' ? editLink.points?.[editFocus.index] : undefined
              if (editLink && editFocus?.type === 'bend' && q) {
                const at = live ?? { x: q[0], y: q[1] }
                return <Readout at={toView(at)} text={`${editLink.id} bend ${editFocus.index + 1}  x ${at.x}%  y ${at.y}%`} />
              }
              return null
            })()}
          </g>
        )}
      </svg>

      {hover && !editable && !drag && (
        <BoardTooltip board={board} groups={groups} routes={routesLayout.routes} era={era} built={built} prices={prices} playerName={playerName} target={hover} />
      )}
    </div>
  )
}

/** 5 % grid with labels every 10 %, to help line things up with the painting. */
function EditGrid() {
  const lines = Array.from({ length: 19 }, (_, i) => (i + 1) * 50)
  return (
    <g pointerEvents="none">
      {lines.map((v) => (
        <g key={v} className="stroke-board-ink" opacity={v % 100 === 0 ? 0.35 : 0.15}>
          <line x1={v} y1={0} x2={v} y2={1000} strokeWidth={v % 100 === 0 ? 1.2 : 0.8} />
          <line x1={0} y1={v} x2={1000} y2={v} strokeWidth={v % 100 === 0 ? 1.2 : 0.8} />
        </g>
      ))}
      {lines
        .filter((v) => v % 100 === 0)
        .map((v) => (
          <g key={`label-${v}`} className="fill-board-ink stroke-board-outline font-board" fontSize={14} fontWeight={700} paintOrder="stroke" strokeWidth={3}>
            <text x={v + 4} y={16}>{v / 10}</text>
            <text x={4} y={v - 4}>{v / 10}</text>
          </g>
        ))}
    </g>
  )
}

/** Small dark label with the edited item's values, shown above it. */
function Readout({ at, text }: { at: Point; text: string }) {
  const fontSize = 14
  // Monospace: every character is about 0.6 em wide.
  const width = text.length * fontSize * 0.6 + 18
  const x = Math.min(1000 - width - 4, Math.max(4, at.x - width / 2))
  const y = Math.max(4, at.y - 48)
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={width} height={25} rx={6} fill="#000" fillOpacity={0.82} className="stroke-board-glow" strokeWidth={1.5} />
      <text x={x + width / 2} y={y + 17} textAnchor="middle" className="fill-board-ink" fontSize={fontSize} fontWeight={600} fontFamily="ui-monospace, monospace" style={{ whiteSpace: 'pre' }}>
        {text}
      </text>
    </g>
  )
}

/** Small pill with a cost or payout, drawn above a clickable target. */
function TargetTag({ x, y, text }: { x: number; y: number; text: string }) {
  const width = text.length * 7.4 + 16
  const left = Math.min(1000 - width - 4, Math.max(4, x - width / 2))
  return (
    <g pointerEvents="none">
      <rect x={left} y={y - 11} width={width} height={22} rx={11} fill="#120d0a" fillOpacity={0.92} className="stroke-board-glow" strokeWidth={1.5} />
      <text x={left + width / 2} y={y + 4.5} textAnchor="middle" className="fill-brass-200 font-display" fontSize={13} fontWeight={700}>
        {text}
      </text>
    </g>
  )
}

/** One path through the shipped links, in travel order from `from` (each link's curve turned to match). */
function shipPath(ids: readonly string[], from: string, routes: ReadonlyMap<string, RouteLayout>): string {
  const points: Point[] = []
  let at = from
  for (const id of ids) {
    const route = routes.get(id)
    if (!route) continue
    const forward = route.link.from === at
    points.push(...(forward ? route.line.points : [...route.line.points].reverse()))
    at = forward ? route.link.to : route.link.from
  }
  return points.length ? polylinePath(polyline(points)) : ''
}

/** The goods of the last shipment: a gold dot running along the links it used, then fading. */
function ShipDot({ d, seconds }: { d: string; seconds: number }) {
  const motion = useRef<SVGAnimateMotionElement>(null)
  const fade = useRef<SVGAnimateElement>(null)
  // Started by hand: an animation added after the SVG loaded would otherwise count from the page's start and be over already.
  useEffect(() => {
    motion.current?.beginElement()
    fade.current?.beginElement()
  }, [])
  if (!d) return null
  return (
    <circle r={6.5} opacity={0} fill={BOARD_COLORS.gold} stroke={BOARD_COLORS.ink} strokeWidth={1.6} pointerEvents="none">
      <animateMotion ref={motion} begin="indefinite" dur={`${seconds}s`} path={d} fill="freeze" />
      <animate ref={fade} attributeName="opacity" begin="indefinite" dur={`${seconds + 0.4}s`} values="1;1;0" keyTimes="0;0.8;1" fill="freeze" />
    </circle>
  )
}
