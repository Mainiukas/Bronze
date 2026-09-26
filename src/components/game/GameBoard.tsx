import type { KeyboardEvent, ReactNode } from 'react'
import type { MapBoardData } from '../../data/maps'
import { INDUSTRIES } from '../../game/rules'
import type { Board, Building, BoardTown, GameState, IndustryKind } from '../../game/types'
import { INDUSTRY_SHORT } from '../../data/board'
import { INDUSTRY_ICON_URLS } from '../board/assets'

/** Board geometry, in map units (the board is 160 × 100). */
const PLOT = 4.6
const PLOT_GAP = 0.8
const TOWN_R = 2.4
const MARKET_R = 3.2

export interface BoardHighlights {
  /** Plots that can be clicked, keyed "townId#slot". */
  plots?: Set<string>
  /** Routes that can be clicked, with a short cost label. */
  routes?: Map<string, string>
  /** Industries that can be picked to ship from. */
  sources?: Set<number>
  /** The industry currently picked to ship from. */
  selectedSource?: number | null
  /** Markets that can be shipped to, with a short payout label. */
  markets?: Map<string, string>
}

interface GameBoardProps {
  game: GameState
  decor: MapBoardData
  highlights: BoardHighlights
  /** Seat whose network is outlined. */
  viewer: number | null
  networkOfViewer: Set<string>
  /** Each player's colour. */
  colorOf: (player: number) => string
  onPlot?: (townId: string, slot: number) => void
  onRoute?: (routeId: string) => void
  onSource?: (buildingId: number) => void
  onMarket?: (townId: string) => void
}

/** Keyboard support for SVG elements acting as buttons. */
function activate(handler: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handler()
    }
  }
}

function plotOrigin(town: BoardTown, slot: number) {
  const width = town.slots.length * PLOT + (town.slots.length - 1) * PLOT_GAP
  return { x: town.x - width / 2 + slot * (PLOT + PLOT_GAP), y: town.y + (town.market ? 5.2 : 4.4) }
}

/** An industry's picture (assets/icons) in a box of `size` at (x, y); a short label if the picture is missing. */
function Glyph({ kind, x, y, size, opacity }: { kind: IndustryKind; x: number; y: number; size: number; opacity?: number }) {
  const url = INDUSTRY_ICON_URLS[kind]
  if (!url) {
    return (
      <text x={x + size / 2} y={y + size * 0.62} textAnchor="middle" fontSize={size * 0.34} className="fill-parchment-200 font-display font-bold" opacity={opacity}>
        {INDUSTRY_SHORT[kind]}
      </text>
    )
  }
  return <image href={url} x={x} y={y} width={size} height={size} opacity={opacity} />
}

/**
 * The playable board: routes, towns and building plots, drawn from the
 * match's board plus the map's decoration. Clickable targets glow.
 */
export function GameBoard({
  game,
  decor,
  highlights,
  viewer,
  networkOfViewer,
  colorOf,
  onPlot,
  onRoute,
  onSource,
  onMarket,
}: GameBoardProps) {
  const board: Board = game.board
  const towns = new Map(board.towns.map((town) => [town.id, town]))
  const buildings = new Map(game.buildings.map((b) => [`${b.townId}#${b.slot}`, b]))
  const event = game.lastEvent
  const shippedRoutes = new Set(event?.type === 'ship' ? event.routeIds : [])

  return (
    <svg viewBox="0 0 160 100" className="block h-auto w-full select-none" role="group" aria-label="Game board">
      {/* Decoration: hills and water */}
      {decor.hills?.map((hill, i) =>
        [1, 0.68, 0.36].map((k) => (
          <ellipse
            key={`hill-${i}-${k}`}
            cx={hill.x}
            cy={hill.y}
            rx={hill.rx * k}
            ry={hill.ry * k}
            className="fill-none stroke-parchment-300/15"
            strokeWidth={0.4}
          />
        )),
      )}
      {decor.water?.map((water, i) =>
        water.fill ? (
          <path key={`water-${i}`} d={water.path} className="fill-verdigris-500/25 stroke-verdigris-400/40" strokeWidth={0.4} />
        ) : (
          <path
            key={`water-${i}`}
            d={water.path}
            className="fill-none stroke-verdigris-500/45"
            strokeWidth={water.width ?? 3}
            strokeLinecap="round"
          />
        ),
      )}

      {/* Routes */}
      {board.routes.map((route) => {
        const a = towns.get(route.from)!
        const b = towns.get(route.to)!
        const owner = game.links[route.id]?.owner
        const built = owner !== undefined
        const routeKind = route.kinds[0]
        const label = highlights.routes?.get(route.id)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const name = `${a.name} to ${b.name} ${routeKind === 'canal' ? 'canal' : 'railway'}`
        return (
          <g key={route.id}>
            {!built && routeKind === 'canal' && (
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-verdigris-400/45" strokeWidth={0.6} strokeDasharray="1.4 1.1" />
            )}
            {!built && routeKind === 'rail' && (
              <g className="stroke-parchment-300/30">
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1.6} strokeDasharray="0.25 1.2" />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={0.35} />
              </g>
            )}
            {built && (
              <g style={{ color: colorOf(owner) }} stroke="currentColor">
                {routeKind === 'rail' && (
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={2.4} strokeDasharray="0.35 1" opacity={0.85} />
                )}
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={routeKind === 'rail' ? 0.9 : 1.6} />
                {routeKind === 'canal' && (
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-verdigris-300" strokeWidth={0.45} />
                )}
              </g>
            )}
            {shippedRoutes.has(route.id) && event?.type === 'ship' && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="board-flow stroke-brass-200"
                strokeWidth={0.9}
                strokeLinecap="round"
              />
            )}
            {event?.type === 'link' && event.routeId === route.id && (
              <line
                key={game.nextId}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="board-flash stroke-brass-200"
                strokeWidth={2.4}
              />
            )}
            {label && (
              <g
                role="button"
                tabIndex={0}
                aria-label={`Build the ${name}, ${label}`}
                className="group cursor-pointer outline-none"
                onClick={() => onRoute?.(route.id)}
                onKeyDown={activate(() => onRoute?.(route.id))}
              >
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={4} />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="board-target stroke-ember-400 group-hover:stroke-brass-200 group-focus-visible:stroke-brass-200"
                  strokeWidth={1.1}
                  strokeLinecap="round"
                />
                <CostTag x={mid.x} y={mid.y} text={label} />
              </g>
            )}
            <title>{`${a.name} – ${b.name} (${routeKind === 'canal' ? 'canal' : 'railway'}${built ? `, ${game.players[owner].name}` : ''})`}</title>
          </g>
        )
      })}

      {/* Towns */}
      {board.towns.map((town) => {
        const isMarket = town.market !== null
        const inNetwork = viewer !== null && networkOfViewer.has(town.id)
        const marketLabel = highlights.markets?.get(town.id)
        return (
          <g key={town.id}>
            {inNetwork && (
              <circle
                cx={town.x}
                cy={town.y}
                r={(isMarket ? MARKET_R : TOWN_R) + 1.5}
                fill="none"
                stroke={colorOf(viewer)}
                strokeWidth={0.35}
                strokeDasharray="0.9 0.6"
                opacity={0.9}
              />
            )}
            {isMarket && (
              <circle cx={town.x} cy={town.y} r={MARKET_R + 0.9} className="fill-none stroke-brass-300/70" strokeWidth={0.35} />
            )}
            <circle
              cx={town.x}
              cy={town.y}
              r={isMarket ? MARKET_R : TOWN_R}
              className={isMarket ? 'fill-soot-800 stroke-brass-300' : 'fill-soot-900 stroke-bronze-300'}
              strokeWidth={0.5}
            />
            <circle cx={town.x} cy={town.y} r={isMarket ? 1.2 : 0.8} className={isMarket ? 'fill-brass-300' : 'fill-bronze-300'} />
            <text
              x={town.x}
              y={town.y - (isMarket ? 5 : 4)}
              textAnchor="middle"
              className="fill-parchment-100 font-display font-bold"
              fontSize={2.5}
              letterSpacing={0.12}
              paintOrder="stroke"
              stroke="var(--color-soot-950)"
              strokeWidth={0.7}
            >
              {town.name.toUpperCase()}
            </text>
            {isMarket && (
              <g>
                <rect x={town.x + 4.2} y={town.y - 1.7} width={6.6} height={3.4} rx={0.8} className="fill-soot-950 stroke-brass-300/70" strokeWidth={0.3} />
                <text x={town.x + 7.5} y={town.y + 0.85} textAnchor="middle" className="fill-brass-200 font-display font-bold" fontSize={2.3}>
                  £{game.prices[town.id]}
                </text>
              </g>
            )}

            {town.slots.map((allowed, slot) => (
              <Plot
                key={slot}
                town={town}
                slot={slot}
                allowed={allowed}
                building={buildings.get(`${town.id}#${slot}`)}
                clickable={highlights.plots?.has(`${town.id}#${slot}`) ?? false}
                sourcePick={highlights.sources}
                selectedSource={highlights.selectedSource ?? null}
                flash={event?.type === 'build' && event.townId === town.id && event.slot === slot ? game.nextId : null}
                onPlot={onPlot}
                onSource={onSource}
                ownerName={(b) => game.players[b.owner].name}
                colorOf={colorOf}
              />
            ))}

            {marketLabel && (
              <g
                role="button"
                tabIndex={0}
                aria-label={`Ship to ${town.name}: ${marketLabel}`}
                className="group cursor-pointer outline-none"
                onClick={() => onMarket?.(town.id)}
                onKeyDown={activate(() => onMarket?.(town.id))}
              >
                <circle cx={town.x} cy={town.y} r={MARKET_R + 3} fill="transparent" />
                <circle
                  cx={town.x}
                  cy={town.y}
                  r={MARKET_R + 2}
                  className="board-target fill-none stroke-ember-400 group-hover:stroke-brass-200 group-focus-visible:stroke-brass-200"
                  strokeWidth={0.7}
                />
                <CostTag x={town.x} y={town.y - 9} text={marketLabel} />
              </g>
            )}
            {event?.type === 'ship' && event.marketId === town.id && (
              <circle key={game.nextId} cx={town.x} cy={town.y} r={MARKET_R + 1} className="board-flash fill-none stroke-brass-200" strokeWidth={0.8} />
            )}
            <title>
              {`${town.name}${isMarket ? ` — market town, buys cotton, coal and iron at £${game.prices[town.id]} a unit` : ''}`}
            </title>
          </g>
        )
      })}
    </svg>
  )
}

interface PlotProps {
  town: BoardTown
  slot: number
  allowed: IndustryKind[]
  building: Building | undefined
  clickable: boolean
  sourcePick: Set<number> | undefined
  selectedSource: number | null
  flash: number | null
  onPlot?: (townId: string, slot: number) => void
  onSource?: (buildingId: number) => void
  ownerName: (building: Building) => string
  colorOf: (player: number) => string
}

/** One building plot: empty (showing what it allows) or holding an industry. */
function Plot({ town, slot, allowed, building, clickable, sourcePick, selectedSource, flash, onPlot, onSource, ownerName, colorOf }: PlotProps) {
  const { x, y } = plotOrigin(town, slot)
  const pickable = building !== undefined && (sourcePick?.has(building.id) ?? false)
  const selected = building !== undefined && building.id === selectedSource
  const isMill = building !== undefined && INDUSTRIES[building.kind].ships === 'cotton'
  const allowedNames = allowed.map((kind) => INDUSTRIES[kind].name).join(' or ')

  let content: ReactNode
  if (building) {
    content = (
      <g style={{ color: colorOf(building.owner) }}>
        <rect x={x} y={y} width={PLOT} height={PLOT} rx={0.8} fill="currentColor" fillOpacity={0.22} stroke="currentColor" strokeWidth={0.4} />
        <Glyph kind={building.kind} x={x + 0.6} y={y + 0.6} size={PLOT - 1.2} />
        {isMill && building.goods > 0 && (
          <g>
            <circle cx={x + PLOT} cy={y} r={1.35} className="fill-brass-300 stroke-soot-950" strokeWidth={0.3} />
            <text x={x + PLOT} y={y + 0.8} textAnchor="middle" className="fill-soot-950 font-display font-extrabold" fontSize={2.1}>
              {building.goods}
            </text>
          </g>
        )}
      </g>
    )
  } else {
    const size = allowed.length > 1 ? 2.2 : 3.2
    content = (
      <g className="text-parchment-300/40">
        <rect
          x={x}
          y={y}
          width={PLOT}
          height={PLOT}
          rx={0.8}
          className="fill-soot-950/80 stroke-parchment-300/25"
          strokeWidth={0.3}
          strokeDasharray="0.8 0.5"
        />
        {allowed.map((kind, i) => (
          <Glyph
            key={kind}
            kind={kind}
            x={allowed.length > 1 ? x + 0.1 + i * 2.3 : x + (PLOT - size) / 2}
            y={y + (PLOT - size) / 2}
            size={size}
            opacity={0.55}
          />
        ))}
      </g>
    )
  }

  const label = building
    ? `${town.name}, plot ${slot + 1}: ${ownerName(building)}’s ${INDUSTRIES[building.kind].name.toLowerCase()}${isMill ? `, ${building.goods} cotton` : ''}`
    : `${town.name}, plot ${slot + 1}: ${allowedNames.toLowerCase()}, free`

  const interactive = clickable || pickable
  const handle = () => {
    if (clickable) onPlot?.(town.id, slot)
    else if (pickable && building) onSource?.(building.id)
  }

  return (
    <g
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      className={interactive ? 'group cursor-pointer outline-none' : undefined}
      onClick={interactive ? handle : undefined}
      onKeyDown={interactive ? activate(handle) : undefined}
    >
      {content}
      {(interactive || selected) && (
        <rect
          x={x - 0.7}
          y={y - 0.7}
          width={PLOT + 1.4}
          height={PLOT + 1.4}
          rx={1.2}
          className={`fill-none ${selected ? 'stroke-brass-200' : 'board-target stroke-ember-400 group-hover:stroke-brass-200 group-focus-visible:stroke-brass-200'}`}
          strokeWidth={selected ? 0.7 : 0.55}
        />
      )}
      {flash !== null && (
        <rect key={flash} x={x} y={y} width={PLOT} height={PLOT} rx={0.8} className="board-flash fill-none stroke-brass-200" strokeWidth={0.6} />
      )}
      <title>{label}</title>
    </g>
  )
}

/** Small pill with a price or payout, drawn above a target. */
function CostTag({ x, y, text }: { x: number; y: number; text: string }) {
  const width = text.length * 1.25 + 2
  return (
    <g pointerEvents="none">
      <rect x={x - width / 2} y={y - 1.9} width={width} height={3.6} rx={1.8} className="fill-soot-950 stroke-ember-400" strokeWidth={0.3} />
      <text x={x} y={y + 0.75} textAnchor="middle" className="fill-brass-200 font-display font-bold" fontSize={2.2}>
        {text}
      </text>
    </g>
  )
}
