import '@fontsource/cinzel/latin-600.css'
import '@fontsource/cinzel/latin-700.css'
import '@fontsource/cinzel/latin-800.css'
import { useEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import mapUrl from '../../../assets/map.png'
import {
  EMPTY_BUILT,
  INDUSTRY_NAMES,
  isLinkActive,
  slotKey,
  type BoardData,
  type BuiltState,
  type Era,
  type LocationType,
} from '../../data/board'
import { seatColor } from '../game/glyphs'
import { BoardTooltip } from './BoardTooltip'
import { curveForMidpoint, curveMidpoint, curvePath, linkCurve, roundPercent, toView, trimCurve, type Point } from './geometry'
import { boardFont, CITY_WEIGHT, HUB_FONT, HUB_WEIGHT, layoutLocation, STOP_FONT, STOP_WEIGHT, type Rect } from './layout'
import { createTextMeasurer, useFontsReady } from './measure'
import { BoardDefs, CityRibbon, HubPlaque, LinkMarker, RouteGlow, RouteStrokes, SlotBox, StopBanner } from './parts'

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
  /** Calibration mode: drag locations and link bends instead of selecting. */
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

type Hover = { type: 'location'; id: string; slot?: number } | { type: 'link'; id: string }
type Drag = { type: 'location'; id: string; dx: number; dy: number } | { type: 'link'; id: string }

/** How far each route stops short of a location's centre, by location type (view units). */
const TRIM: Record<LocationType, number> = { city: 12, stop: 10, hub: 30 }
const FONTS = [boardFont(14.5, CITY_WEIGHT), boardFont(STOP_FONT, STOP_WEIGHT), boardFont(HUB_FONT, HUB_WEIGHT)]

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

const pad = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 })

/**
 * The illustrated map board: assets/map.png with an SVG overlay (viewBox
 * 0 0 1000 1000) drawn from board data. Layers, bottom to top: routes, link
 * markers, industry slots, location banners, highlights, tooltips.
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
  const [hover, setHover] = useState<Hover | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Last item moved in the editor; its values stay on screen. */
  const [editFocus, setEditFocus] = useState<{ type: 'location' | 'link'; id: string } | null>(null)

  const locations = useMemo(() => new Map(board.locations.map((l) => [l.id, l])), [board.locations])
  // Banners are sized to their names: estimated until Cinzel loads, then measured.
  const measure = useMemo(() => createTextMeasurer(fontsReady), [fontsReady])
  const layouts = useMemo(
    () => new Map(board.locations.map((l) => [l.id, layoutLocation(l, measure)])),
    [board.locations, measure],
  )
  const routes = useMemo(
    () =>
      board.links.map((link) => {
        const a = locations.get(link.from)!
        const b = locations.get(link.to)!
        const full = linkCurve(toView(a), toView(b), link.curve ?? 0)
        return {
          link,
          drawn: trimCurve(full, TRIM[a.type], TRIM[b.type]),
          mid: curveMidpoint(full),
          active: isLinkActive(link.type, era),
          closed: (closed?.has(link.from) || closed?.has(link.to)) ?? false,
        }
      }),
    [board.links, locations, era, closed],
  )
  const recentPath = new Set(recent?.path ?? [])

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

  const startLocationDrag = (event: PointerEvent, id: string) => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    const location = locations.get(id)!
    const p = toViewPoint(event)
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag({ type: 'location', id, dx: p.x - location.x * 10, dy: p.y - location.y * 10 })
    setEditFocus({ type: 'location', id })
  }

  const startLinkDrag = (event: PointerEvent, id: string) => {
    event.preventDefault()
    event.stopPropagation()
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag({ type: 'link', id })
    setEditFocus({ type: 'link', id })
  }

  const moveLocation = (id: string, x: number, y: number) => {
    const location = locations.get(id)
    if (!location || (location.x === x && location.y === y)) return
    onBoardChange?.({ ...board, locations: board.locations.map((l) => (l.id === id ? { ...l, x, y } : l)) })
  }

  const bendLink = (id: string, curve: number) => {
    const link = board.links.find((l) => l.id === id)
    if (!link || (link.curve ?? 0) === curve) return
    onBoardChange?.({ ...board, links: board.links.map((l) => (l.id === id ? { ...l, curve } : l)) })
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return
    const p = toViewPoint(event)
    if (drag.type === 'location') {
      moveLocation(drag.id, roundPercent((p.x - drag.dx) / 10), roundPercent((p.y - drag.dy) / 10))
    } else {
      const link = board.links.find((l) => l.id === drag.id)!
      bendLink(drag.id, curveForMidpoint(toView(locations.get(link.from)!), toView(locations.get(link.to)!), p))
    }
  }

  // Arrow keys fine-tune the last edited item: 0.1 per press, 1 with Shift.
  const nudge = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (!editable || !editFocus || !event.key.startsWith('Arrow')) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    const step = event.shiftKey ? 1 : 0.1
    const round = (n: number) => Math.round(n * 10) / 10
    if (editFocus.type === 'location') {
      const l = locations.get(editFocus.id)
      if (!l) return
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
      moveLocation(l.id, roundPercent(l.x + dx), roundPercent(l.y + dy))
    } else {
      const link = board.links.find((l) => l.id === editFocus.id)
      if (!link) return
      const delta = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? step : -step
      bendLink(link.id, round((link.curve ?? 0) + delta))
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', nudge)
    return () => window.removeEventListener('keydown', nudge)
  }, [])

  /* ---- Rendering --------------------------------------------------------- */

  const hoverHandlers = (next: Hover) => ({
    onPointerEnter: () => setHover(next),
    onPointerLeave: () => setHover(null),
    onFocus: () => setHover(next),
    onBlur: () => setHover(null),
  })

  let tooltip = null
  if (hover && !editable && !drag) {
    if (hover.type === 'location') {
      const location = locations.get(hover.id)
      const layout = layouts.get(hover.id)
      if (location && layout) tooltip = { type: 'location' as const, location, layout, slot: hover.slot }
    } else {
      const route = routes.find((r) => r.link.id === hover.id)
      if (route) tooltip = { type: 'link' as const, link: route.link, at: route.mid }
    }
  }

  const editItem = editFocus?.type === 'location' ? locations.get(editFocus.id) : undefined
  const editRoute = editFocus?.type === 'link' ? routes.find((r) => r.link.id === editFocus.id) : undefined

  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-soot-900 select-none ${className}`}>
      <img
        src={mapUrl}
        alt="Illustrated map of Wales, the Midlands and the South West"
        className="absolute inset-0 size-full"
        draggable={false}
      />
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        className={`absolute inset-0 size-full ${editable ? 'touch-none' : ''}`}
        role="group"
        aria-label="Map board"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <BoardDefs />

        {/* 1. Routes */}
        <g aria-hidden="true">
          {routes.map(({ link, drawn, active, closed: shut }) => {
            // Built links stay bright whatever the era; unbuilt ones of the other era fade.
            const opacity = shut ? 0.12 : active || built.links[link.id] ? 1 : 0.25
            const targeted = targets?.links?.has(link.id) ?? false
            return (
              <g key={link.id} opacity={opacity}>
                {(glow.has(link.id) || targeted) && (
                  <g className={targeted ? 'board-target' : undefined}>
                    <RouteGlow curve={drawn} type={link.type} strong={targeted || glow.get(link.id)!} />
                  </g>
                )}
                <RouteStrokes curve={drawn} type={link.type} />
                {recentPath.has(link.id) && (
                  <path key={recent?.key} d={curvePath(drawn)} className="board-flow-lg fill-none stroke-brass-200" strokeWidth={5} strokeLinecap="round" />
                )}
              </g>
            )
          })}
        </g>

        {/* 2. Link markers */}
        <g>
          {routes.map(({ link, mid, active, closed: shut }) => {
            const owner = built.links[link.id]
            const label = `${locations.get(link.from)!.name} to ${locations.get(link.to)!.name} (${link.type === 'both' ? 'canal and rail' : link.type})`
            const usable = !shut && (active || owner !== undefined)
            // In a match, targets are clicked in the top layer instead.
            const clickable = !editable && !targets && !!onSelectLink && active && !shut
            return (
              <g
                key={link.id}
                opacity={shut ? 0.12 : usable ? 1 : 0.25}
                pointerEvents={usable ? undefined : 'none'}
                className={clickable ? 'cursor-pointer' : undefined}
                aria-disabled={usable ? undefined : true}
                {...(clickable ? asButton(label, () => onSelectLink!(link.id)) : {})}
                {...(usable ? hoverHandlers({ type: 'link', id: link.id }) : {})}
              >
                <circle cx={mid.x} cy={mid.y} r={15} fill="transparent" />
                <LinkMarker at={mid} fill={owner ? playerColor(owner.player) : null} />
                {recent?.link === link.id && (
                  <circle key={recent.key} cx={mid.x} cy={mid.y} r={12} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
                )}
              </g>
            )
          })}
        </g>

        {/* 3. Industry slots */}
        <g>
          {board.locations.map((location) => {
            if (location.type !== 'city') return null
            const layout = layouts.get(location.id)!
            const shut = closed?.has(location.id) ?? false
            return location.slots.map((allowed, index) => {
              const key = slotKey(location.id, index)
              const tile = built.slots[key]
              const label = `${location.name} slot ${index + 1}: ${allowed.map((a) => INDUSTRY_NAMES[a]).join(' or ')}`
              const clickable = !editable && !targets && !shut && !!onSelectSlot
              return (
                <g
                  key={key}
                  opacity={shut ? 0.3 : 1}
                  className={editable ? 'cursor-grab' : clickable ? 'cursor-pointer' : undefined}
                  onPointerDown={(e) => startLocationDrag(e, location.id)}
                  {...(shut ? {} : hoverHandlers({ type: 'location', id: location.id, slot: index }))}
                  {...(clickable ? asButton(label, () => onSelectSlot!(location.id, index)) : {})}
                >
                  <SlotBox
                    rect={layout.slots[index]}
                    allowed={allowed}
                    tile={tile ? { industry: tile.industry, color: playerColor(tile.player), goods: tile.goods ?? 0 } : null}
                  />
                </g>
              )
            })
          })}
        </g>

        {/* 4. Location banners and plaques */}
        <g>
          {board.locations.map((location) => {
            const layout = layouts.get(location.id)!
            const shut = closed?.has(location.id) ?? false
            const clickable = !editable && !targets && !shut && !!onSelectLocation
            return (
              <g
                key={location.id}
                opacity={shut ? 0.35 : 1}
                className={editable ? 'cursor-grab' : clickable ? 'cursor-pointer' : undefined}
                onPointerDown={(e) => startLocationDrag(e, location.id)}
                {...(shut ? {} : hoverHandlers({ type: 'location', id: location.id }))}
                {...(clickable ? asButton(location.name, () => onSelectLocation!(location.id)) : {})}
              >
                <circle cx={layout.center.x} cy={layout.center.y} r={16} fill="transparent" />
                {location.type === 'city' && (
                  <CityRibbon
                    rect={layout.label}
                    color={board.regions[location.region]?.color ?? '#444'}
                    name={location.name}
                    fontSize={layout.fontSize}
                  />
                )}
                {location.type === 'stop' && <StopBanner rect={layout.label} name={location.name} fontSize={layout.fontSize} />}
                {location.type === 'hub' && (
                  <HubPlaque layout={layout} name={location.name} buys={location.buys} price={prices?.[location.id]} />
                )}
              </g>
            )
          })}
        </g>

        {/* 5. Hover, selection and target highlights */}
        <g pointerEvents="none">
          {network &&
            [...network.locations].map((id) => {
              const layout = layouts.get(id)
              if (!layout) return null
              return (
                <circle
                  key={`net-${id}`}
                  cx={layout.center.x}
                  cy={layout.center.y}
                  r={11}
                  fill="none"
                  stroke={network.color}
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                />
              )
            })}
          {targets?.slots &&
            [...targets.slots].map(([key, text]) => {
              const [locationId, index] = key.split(':')
              const rect = layouts.get(locationId)?.slots[Number(index)]
              if (!rect) return null
              const box = pad(rect, 3)
              return (
                <g key={`t-${key}`}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} className="board-target fill-none stroke-board-glow" strokeWidth={2.5} />
                  {text && <TargetTag x={rect.x + rect.w / 2} y={rect.y - 12} text={text} />}
                </g>
              )
            })}
          {targets?.locations &&
            [...targets.locations].map(([id, text]) => {
              const layout = layouts.get(id)
              if (!layout) return null
              const box = pad(layout.label, 7)
              return (
                <g key={`t-${id}`}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} className="board-target fill-none stroke-board-glow" strokeWidth={3} />
                  {text && <TargetTag x={layout.label.x + layout.label.w / 2} y={box.y - 14} text={text} />}
                </g>
              )
            })}
          {targets?.links &&
            [...targets.links].map(([id, text]) => {
              const route = routes.find((r) => r.link.id === id)
              if (!route || !text) return null
              return <TargetTag key={`t-${id}`} x={route.mid.x} y={route.mid.y - 22} text={text} />
            })}
          {recent?.slot &&
            (() => {
              const [locationId, index] = recent.slot.split(':')
              const rect = layouts.get(locationId)?.slots[Number(index)]
              if (!rect) return null
              const box = pad(rect, 2)
              return <rect key={recent.key} x={box.x} y={box.y} width={box.w} height={box.h} rx={4} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
            })()}
          {recent?.location &&
            (() => {
              const layout = layouts.get(recent.location)
              if (!layout) return null
              return <circle key={recent.key} cx={layout.center.x} cy={layout.center.y} r={22} className="board-flash fill-none stroke-brass-200" strokeWidth={3} />
            })()}
          {[
            selectedLocation && { id: selectedLocation, className: 'stroke-brass-200' },
            hover?.type === 'location' && { id: hover.id, className: 'stroke-board-glow' },
          ].map((mark) => {
            if (!mark) return null
            const layout = layouts.get(mark.id)
            if (!layout) return null
            const box = pad(layout.bounds, 6)
            return (
              <g key={`${mark.id}-${mark.className}`} className={`fill-none ${mark.className}`}>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} strokeWidth={8} opacity={0.25} />
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} strokeWidth={2.2} />
                <circle cx={layout.center.x} cy={layout.center.y} r={9} strokeWidth={2.2} />
              </g>
            )
          })}
          {selected?.type === 'slot' &&
            (() => {
              const rect = layouts.get(selected.locationId)?.slots[selected.index]
              if (!rect) return null
              const box = pad(rect, 3.5)
              return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} className="fill-none stroke-brass-200" strokeWidth={2.5} />
            })()}
          {[selected?.type === 'link' ? selected.id : null, hover?.type === 'link' ? hover.id : null].map((id, i) => {
            const route = id ? routes.find((r) => r.link.id === id) : undefined
            if (!route) return null
            return (
              <circle
                key={`${id}-${i}`}
                cx={route.mid.x}
                cy={route.mid.y}
                r={15}
                className={`fill-none ${i === 0 ? 'stroke-brass-200' : 'stroke-board-glow'}`}
                strokeWidth={2.5}
              />
            )
          })}
        </g>

        {/* 6. Match targets: clickable above everything, so a banner never hides one */}
        {targets && !editable && (
          <g>
            {[...(targets.slots ?? new Map<string, string | null>()).keys()].map((key) => {
              const [locationId, index] = key.split(':')
              const location = locations.get(locationId)
              const rect = layouts.get(locationId)?.slots[Number(index)]
              if (!location || location.type !== 'city' || !rect) return null
              const allowed = location.slots[Number(index)] ?? []
              const label = `${location.name} slot ${Number(index) + 1}: ${allowed.map((a) => INDUSTRY_NAMES[a]).join(' or ')}`
              return (
                <rect
                  key={`hit-${key}`}
                  x={rect.x - 3}
                  y={rect.y - 3}
                  width={rect.w + 6}
                  height={rect.h + 6}
                  fill="transparent"
                  className="cursor-pointer"
                  {...asButton(label, () => onSelectSlot?.(locationId, Number(index)))}
                  {...hoverHandlers({ type: 'location', id: locationId, slot: Number(index) })}
                />
              )
            })}
            {[...(targets.locations ?? new Map<string, string | null>()).keys()].map((id) => {
              const layout = layouts.get(id)
              const location = locations.get(id)
              if (!layout || !location) return null
              const box = pad(layout.label, 7)
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
                  {...asButton(location.name, () => onSelectLocation?.(id))}
                  {...hoverHandlers({ type: 'location', id })}
                />
              )
            })}
            {[...(targets.links ?? new Map<string, string | null>()).keys()].map((id) => {
              const route = routes.find((r) => r.link.id === id)
              if (!route) return null
              const label = `${locations.get(route.link.from)!.name} to ${locations.get(route.link.to)!.name} (${route.link.type === 'both' ? 'canal and rail' : route.link.type})`
              return (
                <g
                  key={`hit-${id}`}
                  className="cursor-pointer"
                  {...asButton(label, () => onSelectLink?.(id))}
                  {...hoverHandlers({ type: 'link', id })}
                >
                  <circle cx={route.mid.x} cy={route.mid.y} r={16} fill="transparent" />
                  <LinkMarker at={route.mid} fill={null} />
                  <circle cx={route.mid.x} cy={route.mid.y} r={13} className="board-target fill-none stroke-board-glow" strokeWidth={2.5} />
                </g>
              )
            })}
          </g>
        )}

        {/* Editor: grid, drag handles and the live readout */}
        {editable && (
          <g>
            <EditGrid />
            {routes.map(({ link, mid }) => (
              <g
                key={link.id}
                className="cursor-grab"
                onPointerDown={(e) => startLinkDrag(e, link.id)}
                aria-label={`Bend ${link.id}`}
              >
                <circle cx={mid.x} cy={mid.y} r={13} fill="transparent" />
                <circle
                  cx={mid.x}
                  cy={mid.y}
                  r={6}
                  className={editFocus?.id === link.id ? 'fill-board-glow stroke-board-outline' : 'fill-board-ink/70 stroke-board-outline'}
                  strokeWidth={1.5}
                />
              </g>
            ))}
            {board.locations.map((location) => {
              const c = toView(location)
              const active = editFocus?.id === location.id
              return (
                <g key={location.id} className="cursor-grab" onPointerDown={(e) => startLocationDrag(e, location.id)}>
                  <circle cx={c.x} cy={c.y} r={14} fill="transparent" />
                  <circle cx={c.x} cy={c.y} r={7} fill="#000" fillOpacity={0.55} className={active ? 'stroke-board-glow' : 'stroke-board-ink'} strokeWidth={2} />
                  <path d={`M${c.x - 11} ${c.y}h22M${c.x} ${c.y - 11}v22`} className={active ? 'stroke-board-glow' : 'stroke-board-ink'} strokeWidth={1.2} />
                </g>
              )
            })}
            {editItem && <Readout at={toView(editItem)} text={`${editItem.name}  x ${editItem.x}  y ${editItem.y}`} />}
            {editRoute && <Readout at={editRoute.mid} text={`${editRoute.link.id}  curve ${editRoute.link.curve ?? 0}`} />}
          </g>
        )}
      </svg>

      {tooltip && <BoardTooltip board={board} era={era} built={built} prices={prices} playerName={playerName} target={tooltip} />}
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
  const fontSize = 15
  // Monospace: every character is about 0.6 em wide.
  const width = text.length * fontSize * 0.6 + 18
  const x = Math.min(1000 - width - 4, Math.max(4, at.x - width / 2))
  const y = Math.max(4, at.y - 44)
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={width} height={26} rx={6} fill="#000" fillOpacity={0.82} className="stroke-board-glow" strokeWidth={1.5} />
      <text x={x + width / 2} y={y + 18} textAnchor="middle" className="fill-board-ink" fontSize={fontSize} fontWeight={600} fontFamily="ui-monospace, monospace" style={{ whiteSpace: 'pre' }}>
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
