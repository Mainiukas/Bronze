import '@fontsource/cinzel/latin-700.css'
import '@fontsource/cinzel/latin-800.css'
import { useEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  EMPTY_BUILT,
  INDUSTRY_IDS,
  INDUSTRY_NAMES,
  isLinkActive,
  MAX_BEND_POINTS,
  slotKey,
  type BoardData,
  type BoardLink,
  type BuiltState,
  type Era,
  type Industry,
} from '../../data/board'
import { seatColor } from '../game/glyphs'
import { hubSceneUrl, ICON_URLS, MAP_URL, TEXTURE_URLS, useUsableImages } from './assets'
import { BoardTooltip, type TooltipTarget } from './BoardTooltip'
import { inflate, polylinePath, roundPercent, toPercent, toView, trackSlices, type Point, type Rect } from './geometry'
import {
  boardFont,
  CANAL_PIECE,
  CITY_FONT,
  CITY_WEIGHT,
  HUB_FONT,
  HUB_WEIGHT,
  layoutBoard,
  RAIL_PIECE,
  segmentMidpoints,
  STOP_FONT,
  STOP_WEIGHT,
  type RouteLayout,
} from './layout'
import { createTextMeasurer, useFontsReady } from './measure'
import {
  BoardDefs,
  GoodsBadge,
  HubBadges,
  HubGroup,
  LinkMarker,
  NamePlate,
  PriceTag,
  RailEraBadge,
  SlotTile,
  StopPlaque,
  StrokedTrack,
  TexturedTrack,
  TrackShadow,
} from './parts'
import { BOARD_COLORS, DEF } from './style'

export type BoardSelection =
  | { type: 'location'; id: string }
  | { type: 'slot'; locationId: string; index: number }
  | { type: 'link'; id: string }

/**
 * Match mode: what can be clicked right now. When given, only these are
 * interactive and they glow; labels (costs, payouts) are shown beside them.
 * Without it (the sandbox page), every usable item is clickable.
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
  /** Links goods travelled along. */
  path?: readonly string[]
}

export interface IllustratedBoardProps {
  board: BoardData
  era: Era
  /** Who has built what. The board only draws it; the caller owns it. */
  built?: BuiltState
  /** Highlighted until changed by the caller. */
  selected?: BoardSelection | null
  playerColor?: (player: number) => string
  playerName?: (player: number) => string
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
  className?: string
}

type Drag =
  | { type: 'point'; id: string; dx: number; dy: number }
  | { type: 'group'; id: string; dx: number; dy: number }
  | { type: 'bend'; linkId: string; index: number }
type EditFocus = { type: 'point' | 'group'; id: string } | { type: 'bend'; linkId: string; index: number }

const FONTS = [boardFont(CITY_FONT, CITY_WEIGHT), boardFont(STOP_FONT, STOP_WEIGHT), boardFont(HUB_FONT, HUB_WEIGHT)]
/** Inactive links (the other era's) fade to this; locations and everything else stay at full strength. */
const INACTIVE_OPACITY = 0.55
const CLOSED_OPACITY = { link: 0.15, location: 0.35 }

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

const linkLabel = (route: RouteLayout, name: (id: string) => string) =>
  `${name(route.link.from)} to ${name(route.link.to)} (${route.link.type === 'both' ? 'canal and rail' : route.link.type})`
const slotLabel = (name: string, index: number, allowed: Industry[]) => `${name} slot ${index + 1}: ${allowed.map((a) => INDUSTRY_NAMES[a]).join(' or ')}`

/**
 * The illustrated map board: assets/map.webp with an SVG overlay (viewBox
 * 0 0 1000 1000) drawn from board data. Layers, bottom to top: route
 * shadows, canals, rails, link markers, plaques and tiles, badges,
 * hover/selection, then the tooltip.
 *
 * A pure view: what's built, the era and the selection come in as props, and
 * clicks go out through the onSelect* callbacks.
 */
export function IllustratedBoard({
  board,
  era,
  built = EMPTY_BUILT,
  selected = null,
  playerColor = seatColor,
  playerName = (player) => `Player ${player + 1}`,
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
  className = '',
}: IllustratedBoardProps) {
  const fontsReady = useFontsReady(FONTS)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<TooltipTarget | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Last item moved in the editor; its values stay on screen. */
  const [editFocus, setEditFocus] = useState<EditFocus | null>(null)

  // Plaques are sized to their names: estimated until Cinzel loads, then measured.
  const measure = useMemo(() => createTextMeasurer(fontsReady), [fontsReady])
  const layout = useMemo(() => layoutBoard(board, measure), [board, measure])
  // Texture slices, cached per link until the layout changes.
  const slices = useMemo(
    () =>
      new Map(
        [...layout.routes.values()].map((route) => [
          route.link.id,
          route.tracks.map((track) => trackSlices(track.line, track.kind === 'rail' ? RAIL_PIECE : CANAL_PIECE)),
        ]),
      ),
    [layout],
  )

  useEffect(() => {
    if (import.meta.env.DEV && !editable && fontsReady && layout.problems.length) {
      console.warn(`Board layout: ${layout.problems.length} spacing problem(s)\n${layout.problems.join('\n')}`)
    }
  }, [layout, editable, fontsReady])

  const hubs = board.locations.filter((l) => l.type === 'hub')
  const usable = useUsableImages([TEXTURE_URLS.rail, TEXTURE_URLS.canal, ...Object.values(ICON_URLS), ...hubs.map((h) => hubSceneUrl(h.id))])
  const textures = {
    rail: TEXTURE_URLS.rail && usable.has(TEXTURE_URLS.rail) ? TEXTURE_URLS.rail : undefined,
    canal: TEXTURE_URLS.canal && usable.has(TEXTURE_URLS.canal) ? TEXTURE_URLS.canal : undefined,
  }
  const iconUrls: Partial<Record<Industry, string>> = {}
  for (const industry of INDUSTRY_IDS) {
    const url = ICON_URLS[industry]
    if (url && usable.has(url)) iconUrls[industry] = url
  }
  const images = new Set(Object.keys(iconUrls) as Industry[])

  const locations = useMemo(() => new Map(board.locations.map((l) => [l.id, l])), [board.locations])
  const name = (id: string) => locations.get(id)?.name ?? id
  const routes = [...layout.routes.values()]
  const recentPath = new Set(recent?.path ?? [])
  const isShut = (id: string) => closed?.has(id) ?? false
  const linkShut = (link: BoardLink) => isShut(link.from) || isShut(link.to)
  const linkOpacity = (link: BoardLink) =>
    linkShut(link) ? CLOSED_OPACITY.link : isLinkActive(link.type, era) || built.links[link.id] ? 1 : INACTIVE_OPACITY

  // Links to glow: those touching the hovered or selected location, or the hovered/selected link.
  const glow = new Map<string, boolean>()
  const glowLinksOf = (locationId: string, strong: boolean) => {
    for (const l of board.links) if (l.from === locationId || l.to === locationId) glow.set(l.id, strong || (glow.get(l.id) ?? false))
  }
  const selectedLocation = selected?.type === 'location' ? selected.id : selected?.type === 'slot' ? selected.locationId : null
  if (selectedLocation) glowLinksOf(selectedLocation, false)
  if (selected?.type === 'link') glow.set(selected.id, false)
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
    const next = link.points.map((q, i): [number, number] => (i === index ? [roundPercent(pct.x), roundPercent(pct.y)] : q))
    setPoints(linkId, next)
  }

  const beginDrag = (event: PointerEvent, next: Drag, focus: EditFocus) => {
    event.preventDefault()
    event.stopPropagation()
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag(next)
    setEditFocus(focus)
  }
  const startPointDrag = (event: PointerEvent, id: string) => {
    const p = toViewPoint(event)
    const l = locations.get(id)!
    beginDrag(event, { type: 'point', id, dx: p.x - l.x * 10, dy: p.y - l.y * 10 }, { type: 'point', id })
  }
  const startGroupDrag = (event: PointerEvent, id: string) => {
    if (!editable) return
    const p = toViewPoint(event)
    const g = layout.groups.get(id)!
    beginDrag(event, { type: 'group', id, dx: p.x - g.center.x, dy: p.y - g.center.y }, { type: 'group', id })
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

  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return
    const p = toViewPoint(event)
    if (drag.type === 'point') moveLocation(drag.id, roundPercent((p.x - drag.dx) / 10), roundPercent((p.y - drag.dy) / 10))
    else if (drag.type === 'group') {
      const l = locations.get(drag.id)!
      const round = (n: number) => Math.round(n * 10) / 10
      offsetGroup(drag.id, round((p.x - drag.dx) / 10 - l.x), round((p.y - drag.dy) / 10 - l.y))
    } else moveBend(drag.linkId, drag.index, p)
  }

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
      const g = layout.groups.get(l.id)!
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

  const groupOf = (id: string) => layout.groups.get(id)
  const slotRect = (key: string): Rect | undefined => {
    const [locationId, index] = key.split(':')
    const g = groupOf(locationId)
    return g?.parts.type === 'city' ? g.parts.tiles[Number(index)] : undefined
  }
  const builtKind = (link: BoardLink): Era => built.links[link.id]?.kind ?? (link.type === 'both' ? era : link.type)

  const tracksOf = (kind: Era) =>
    routes.map((route) => {
      const i = route.tracks.findIndex((t) => t.kind === kind)
      if (i < 0) return null
      const track = route.tracks[i]
      return (
        <g key={route.link.id} opacity={linkOpacity(route.link)}>
          {textures[kind] ? <TexturedTrack kind={kind} slices={slices.get(route.link.id)![i]} /> : <StrokedTrack kind={kind} line={track.line} />}
        </g>
      )
    })

  const editGroup = editFocus && editFocus.type !== 'bend' ? locations.get(editFocus.id) : undefined
  const editLink = editFocus?.type === 'bend' ? board.links.find((l) => l.id === editFocus.linkId) : undefined

  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-soot-900 select-none ${className}`}>
      <img src={MAP_URL} alt="Illustrated map of Wales, the Midlands and the South West" className="absolute inset-0 size-full" draggable={false} />
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        className={`absolute inset-0 size-full ${editable ? 'touch-none' : ''}`}
        // Exact glyph widths at any zoom, matching how plates were measured.
        textRendering="geometricPrecision"
        role="group"
        aria-label="Map board"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <BoardDefs textures={textures} icons={iconUrls} />

        {/* 1. Route shadows, and glows under highlighted routes */}
        <g aria-hidden="true" pointerEvents="none">
          <g filter={`url(#${DEF.routeShadow})`}>
            {routes.map((route) => (
              <g key={route.link.id} opacity={linkOpacity(route.link)}>
                {route.tracks.map((track) => (
                  <TrackShadow key={track.kind} kind={track.kind} line={track.line} />
                ))}
              </g>
            ))}
          </g>
          {routes.map((route) => {
            const targeted = targets?.links?.has(route.link.id) ?? false
            if (!glow.has(route.link.id) && !targeted) return null
            return (
              <path
                key={route.link.id}
                d={polylinePath(route.centre)}
                className={`fill-none stroke-board-glow ${targeted ? 'board-target' : ''}`}
                strokeWidth={route.link.type === 'both' ? 44 : 28}
                strokeLinecap="round"
                opacity={targeted || glow.get(route.link.id) ? 0.5 : 0.3}
              />
            )
          })}
        </g>

        {/* 2. Canals, then 3. rails */}
        <g aria-hidden="true" pointerEvents="none">{tracksOf('canal')}</g>
        <g aria-hidden="true" pointerEvents="none">{tracksOf('rail')}</g>
        <g aria-hidden="true" pointerEvents="none">
          {routes
            .filter((route) => recentPath.has(route.link.id))
            .map((route) => (
              <path key={`${route.link.id}-${recent?.key}`} d={polylinePath(route.centre)} className="board-flow-lg fill-none stroke-brass-200" strokeWidth={5} strokeLinecap="round" />
            ))}
        </g>

        {/* 4. Link markers */}
        <g>
          {routes.map((route) => {
            const { link, marker } = route
            const owner = built.links[link.id]
            const shut = linkShut(link)
            const usableNow = !shut && (isLinkActive(link.type, era) || owner !== undefined)
            // In a match, targets are clicked in the top layer instead.
            const clickable = !editable && !targets && !!onSelectLink && usableNow
            const hovered = hover?.type === 'link' && hover.id === link.id
            return (
              <g
                key={link.id}
                opacity={linkOpacity(link)}
                pointerEvents={usableNow ? undefined : 'none'}
                className={clickable ? 'cursor-pointer' : undefined}
                aria-disabled={usableNow ? undefined : true}
                {...(clickable ? asButton(linkLabel(route, name), () => onSelectLink!(link.id)) : {})}
                {...(usableNow ? hoverHandlers({ type: 'link', id: link.id }) : {})}
              >
                <circle cx={marker.x} cy={marker.y} r={15} fill="transparent" />
                <LinkMarker
                  x={marker.x}
                  y={marker.y}
                  angle={marker.angle}
                  owner={owner ? playerColor(owner.player) : null}
                  kind={builtKind(link)}
                  glow={hovered && clickable && !owner}
                />
                {recent?.link === link.id && (
                  <circle key={recent.key} cx={marker.x} cy={marker.y} r={16} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
                )}
              </g>
            )
          })}
        </g>

        {/* 5. Locations: tiles and name plates, stop plaques, hubs */}
        <g>
          {board.locations.map((location) => {
            const g = groupOf(location.id)!
            const shut = isShut(location.id)
            const clickable = !editable && !targets && !shut && !!onSelectLocation
            const common = {
              opacity: shut ? CLOSED_OPACITY.location : 1,
              className: editable ? 'cursor-grab' : undefined,
              onPointerDown: (e: PointerEvent) => startGroupDrag(e, location.id),
              onDoubleClick: editable && location.labelOffset ? () => clearOffset(location.id) : undefined,
            }
            if (location.type === 'city' && g.parts.type === 'city') {
              const parts = g.parts
              const plateClickable = clickable
              return (
                <g key={location.id} {...common}>
                  {location.slots.map((allowed, index) => {
                    const key = slotKey(location.id, index)
                    const tile = built.slots[key]
                    const slotClickable = !editable && !targets && !shut && !!onSelectSlot
                    return (
                      <g
                        key={key}
                        className={slotClickable ? 'cursor-pointer' : undefined}
                        {...(shut ? {} : hoverHandlers({ type: 'location', id: location.id, slot: index }))}
                        {...(slotClickable ? asButton(slotLabel(location.name, index, allowed), () => onSelectSlot!(location.id, index)) : {})}
                      >
                        <SlotTile
                          rect={parts.tiles[index]}
                          allowed={allowed}
                          tile={tile ? { industry: tile.industry, color: playerColor(tile.player), level: tile.level } : null}
                          images={images}
                        />
                      </g>
                    )
                  })}
                  <g
                    className={plateClickable ? 'cursor-pointer' : undefined}
                    {...(shut ? {} : hoverHandlers({ type: 'location', id: location.id }))}
                    {...(plateClickable ? asButton(location.name, () => onSelectLocation!(location.id)) : {})}
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
                    scene={(() => {
                      const url = hubSceneUrl(location.id)
                      return url && usable.has(url) ? url : null
                    })()}
                    images={images}
                  />
                )}
              </g>
            )
          })}
        </g>

        {/* 6. Badges */}
        <g>
          {board.locations.map((location) => {
            const g = groupOf(location.id)!
            const opacity = isShut(location.id) ? CLOSED_OPACITY.location : 1
            return (
              <g key={location.id} opacity={opacity}>
                {location.type === 'hub' && g.parts.type === 'hub' && (
                  <g pointerEvents="none">
                    <HubBadges parts={g.parts} value={location.value} />
                    {prices?.[location.id] !== undefined && (
                      <PriceTag at={{ x: g.parts.ribbon.x + g.parts.ribbon.w - 4, y: g.parts.ribbon.y - 8 }} price={prices[location.id]} />
                    )}
                  </g>
                )}
                {g.railBadge && <RailEraBadge at={g.railBadge} />}
                {location.type === 'city' &&
                  g.parts.type === 'city' &&
                  g.parts.tiles.map((rect, index) => {
                    const goods = built.slots[slotKey(location.id, index)]?.goods
                    return goods ? <GoodsBadge key={index} at={{ x: rect.x + rect.w - 1, y: rect.y + 1 }} goods={goods} /> : null
                  })}
              </g>
            )
          })}
        </g>

        {/* 7. Hover, selection and target highlights */}
        <g pointerEvents="none">
          {network &&
            [...network.locations].map((id) => {
              const g = groupOf(id)
              if (!g) return null
              const box = inflate(g.bounds, 4)
              return <rect key={`net-${id}`} x={box.x} y={box.y} width={box.w} height={box.h} rx={5} fill="none" stroke={network.color} strokeWidth={2} strokeDasharray="5 4" />
            })}
          {targets?.slots &&
            [...targets.slots].map(([key, text]) => {
              const rect = slotRect(key)
              if (!rect) return null
              const box = inflate(rect, 2.5)
              return (
                <g key={`t-${key}`}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} className="board-target fill-none stroke-board-glow" strokeWidth={2.2} />
                  {text && <TargetTag x={rect.x + rect.w / 2} y={rect.y - 10} text={text} />}
                </g>
              )
            })}
          {targets?.locations &&
            [...targets.locations].map(([id, text]) => {
              const g = groupOf(id)
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
              const route = layout.routes.get(id)
              if (!route || !text) return null
              return <TargetTag key={`t-${id}`} x={route.marker.x} y={route.marker.y - 20} text={text} />
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
              const g = groupOf(recent.location)
              if (!g) return null
              const box = inflate(g.bounds, 4)
              return <rect key={recent.key} x={box.x} y={box.y} width={box.w} height={box.h} rx={8} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
            })()}
          {[
            selectedLocation && { id: selectedLocation, className: 'stroke-brass-200' },
            hover?.type === 'location' && { id: hover.id, className: 'stroke-board-glow' },
          ].map((mark) => {
            if (!mark) return null
            const g = groupOf(mark.id)
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
              const box = inflate(rect, 3)
              return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} className="fill-none stroke-brass-200" strokeWidth={2.4} />
            })()}
          {[selected?.type === 'link' ? selected.id : null, hover?.type === 'link' ? hover.id : null].map((id, i) => {
            const route = id ? layout.routes.get(id) : undefined
            if (!route) return null
            return (
              <circle
                key={`${id}-${i}`}
                cx={route.marker.x}
                cy={route.marker.y}
                r={17}
                className={`fill-none ${i === 0 ? 'stroke-brass-200' : 'stroke-board-glow'}`}
                strokeWidth={2.2}
              />
            )
          })}
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
                  {...asButton(slotLabel(location.name, Number(index), location.slots[Number(index)] ?? []), () => onSelectSlot?.(locationId, Number(index)))}
                  {...hoverHandlers({ type: 'location', id: locationId, slot: Number(index) })}
                />
              )
            })}
            {[...(targets.locations ?? new Map<string, string | null>()).keys()].map((id) => {
              const g = groupOf(id)
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
                  {...asButton(name(id), () => onSelectLocation?.(id))}
                  {...hoverHandlers({ type: 'location', id })}
                />
              )
            })}
            {[...(targets.links ?? new Map<string, string | null>()).keys()].map((id) => {
              const route = layout.routes.get(id)
              if (!route) return null
              const hovered = hover?.type === 'link' && hover.id === id
              return (
                <g key={`hit-${id}`} className="cursor-pointer" {...asButton(linkLabel(route, name), () => onSelectLink?.(id))} {...hoverHandlers({ type: 'link', id })}>
                  <circle cx={route.marker.x} cy={route.marker.y} r={16} fill="transparent" />
                  <g className={hovered ? undefined : 'board-target'}>
                    <LinkMarker x={route.marker.x} y={route.marker.y} angle={route.marker.angle} owner={null} kind={era} glow />
                  </g>
                </g>
              )
            })}
          </g>
        )}

        {/* Editor: grid, drag handles and the live readout */}
        {editable && (
          <g>
            <EditGrid />
            {[...layout.groups.values()].map((g) =>
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
                    const p = toView({ x, y })
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
              const c = toView(location)
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
            {editGroup && editFocus?.type === 'point' && <Readout at={toView(editGroup)} text={`${editGroup.name}  x ${editGroup.x}%  y ${editGroup.y}%`} />}
            {editGroup && editFocus?.type === 'group' && (
              <Readout
                at={groupOf(editGroup.id)!.center}
                text={`${editGroup.name} plaque  ${editGroup.labelOffset ? `offset x ${editGroup.labelOffset.x}%  y ${editGroup.labelOffset.y}%` : 'automatic'}`}
              />
            )}
            {editLink && editFocus?.type === 'bend' && editLink.points?.[editFocus.index] && (
              <Readout
                at={toView({ x: editLink.points[editFocus.index][0], y: editLink.points[editFocus.index][1] })}
                text={`${editLink.id} bend ${editFocus.index + 1}  x ${editLink.points[editFocus.index][0]}%  y ${editLink.points[editFocus.index][1]}%`}
              />
            )}
          </g>
        )}
      </svg>

      {hover && !editable && !drag && (
        <BoardTooltip board={board} layout={layout} era={era} built={built} prices={prices} playerName={playerName} target={hover} />
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
