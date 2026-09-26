/**
 * Drawing pieces for the illustrated board. All purely presentational: they
 * take view-unit geometry and draw it in the board's Victorian style.
 */

import type { Industry, LinkType } from '../../data/board'
import { curvePath, hexagonPath, offsetCurve, type Curve, type Point } from './geometry'
import { BOARD_ICONS } from './icons'
import { CITY_WEIGHT, HUB_WEIGHT, LETTER_SPACING, STOP_WEIGHT, type LocationLayout, type Rect } from './layout'

/** Distance of each track from the centre line on a `both` link. */
const PARALLEL_OFFSET = 7

/** An industry icon scaled into a `size` box centred on (cx, cy). */
export function IndustryGlyph({
  industry,
  cx,
  cy,
  size,
  className,
  opacity,
}: {
  industry: Industry
  cx: number
  cy: number
  size: number
  className: string
  opacity?: number
}) {
  const k = size / 24
  return (
    <path
      d={BOARD_ICONS[industry]}
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`}
      className={`fill-none ${className}`}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  )
}

function RailStrokes({ d }: { d: string }) {
  return (
    <>
      <path d={d} className="fill-none stroke-board-sleeper" strokeWidth={14} strokeDasharray="3 5" />
      <path d={d} className="fill-none stroke-board-rail" strokeWidth={10} />
      <path d={d} className="fill-none stroke-board-bed" strokeWidth={7} />
    </>
  )
}

function CanalStrokes({ d }: { d: string }) {
  return (
    <>
      <path d={d} className="fill-none stroke-board-bank" strokeWidth={12} strokeLinecap="round" />
      <path d={d} className="fill-none stroke-board-water" strokeWidth={8} strokeLinecap="round" />
    </>
  )
}

/** A route in its era style: rail, canal, or both side by side. */
export function RouteStrokes({ curve, type }: { curve: Curve; type: LinkType }) {
  if (type === 'rail') return <RailStrokes d={curvePath(curve)} />
  if (type === 'canal') return <CanalStrokes d={curvePath(curve)} />
  return (
    <>
      <CanalStrokes d={curvePath(offsetCurve(curve, -PARALLEL_OFFSET))} />
      <RailStrokes d={curvePath(offsetCurve(curve, PARALLEL_OFFSET))} />
    </>
  )
}

/** Soft glow under a highlighted route. */
export function RouteGlow({ curve, type, strong }: { curve: Curve; type: LinkType; strong: boolean }) {
  return (
    <path
      d={curvePath(curve)}
      className="fill-none stroke-board-glow"
      strokeWidth={type === 'both' ? 34 : 24}
      strokeLinecap="round"
      opacity={strong ? 0.55 : 0.35}
    />
  )
}

/** Hexagonal link marker: empty until built, then the owner's colour. */
export function LinkMarker({ at, fill }: { at: Point; fill: string | null }) {
  return (
    <path
      d={hexagonPath(at.x, at.y, 9)}
      className={fill ? 'stroke-board-bronze' : 'fill-board-marker stroke-board-bronze'}
      style={fill ? { fill } : undefined}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  )
}

const textStyle = {
  className: 'fill-board-ink stroke-board-outline font-board',
  paintOrder: 'stroke' as const,
  strokeLinejoin: 'round' as const,
  textAnchor: 'middle' as const,
}

/** Ribbon banner with folded, swallow-tailed ends, for cities. */
export function CityRibbon({ rect, color, name, fontSize }: { rect: Rect; color: string; name: string; fontSize: number }) {
  const { x, y, w, h } = rect
  const tail = h * 0.8
  const drop = h * 0.3
  const notch = h * 0.34
  const inner = tail * 0.4
  const leftTail = `M${x + inner} ${y + drop}H${x - tail}L${x - tail + notch} ${y + drop + h / 2}L${x - tail} ${y + drop + h}H${x + inner}Z`
  const rightTail = `M${x + w - inner} ${y + drop}H${x + w + tail}L${x + w + tail - notch} ${y + drop + h / 2}L${x + w + tail} ${y + drop + h}H${x + w - inner}Z`
  const leftFold = `M${x} ${y + h}L${x + inner} ${y + h + drop}H${x}Z`
  const rightFold = `M${x + w} ${y + h}L${x + w - inner} ${y + h + drop}H${x + w}Z`
  return (
    <g filter="url(#illustrated-board-shadow)">
      {[leftTail, rightTail].map((d) => (
        <g key={d}>
          <path d={d} fill={color} />
          <path d={d} fill="#000" fillOpacity={0.3} />
        </g>
      ))}
      {[leftFold, rightFold].map((d) => (
        <g key={d}>
          <path d={d} fill={color} />
          <path d={d} fill="#000" fillOpacity={0.55} />
        </g>
      ))}
      <rect x={x} y={y} width={w} height={h} fill={color} stroke="#000" strokeOpacity={0.45} strokeWidth={1.2} />
      <rect x={x + 2.5} y={y + 2.5} width={w - 5} height={h - 5} className="fill-none stroke-board-ink" strokeOpacity={0.3} strokeWidth={0.8} />
      <text
        {...textStyle}
        x={x + w / 2}
        y={y + h / 2}
        dy="0.36em"
        fontSize={fontSize}
        fontWeight={CITY_WEIGHT}
        letterSpacing={fontSize * LETTER_SPACING}
        strokeWidth={fontSize * 0.16}
      >
        {name}
      </text>
    </g>
  )
}

/** Plain slate banner for stops, with notched ends. */
export function StopBanner({ rect, name, fontSize }: { rect: Rect; name: string; fontSize: number }) {
  const { x, y, w, h } = rect
  const n = h * 0.3
  const d = `M${x} ${y}H${x + w}L${x + w - n} ${y + h / 2}L${x + w} ${y + h}H${x}L${x + n} ${y + h / 2}Z`
  return (
    <g filter="url(#illustrated-board-shadow)">
      <path d={d} className="fill-board-stop" stroke="#000" strokeOpacity={0.45} strokeWidth={1} />
      <text
        {...textStyle}
        x={x + w / 2}
        y={y + h / 2}
        dy="0.36em"
        fontSize={fontSize}
        fontWeight={STOP_WEIGHT}
        letterSpacing={fontSize * LETTER_SPACING}
        strokeWidth={fontSize * 0.14}
      >
        {name}
      </text>
    </g>
  )
}

/** Stone plaque for trade hubs, with icons of the goods they buy. */
export function HubPlaque({ layout, name, buys }: { layout: LocationLayout; name: string; buys: Industry[] }) {
  const { x, y, w, h } = layout.label
  const bolts = [
    [x + 7, y + 7],
    [x + w - 7, y + 7],
    [x + 7, y + h - 7],
    [x + w - 7, y + h - 7],
  ]
  return (
    <g filter="url(#illustrated-board-shadow)">
      <rect x={x} y={y} width={w} height={h} rx={7} className="fill-board-hub stroke-board-bronze" strokeWidth={3} />
      <rect x={x + 4.5} y={y + 4.5} width={w - 9} height={h - 9} rx={4} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={1} />
      <rect x={x + 5.5} y={y + 5.5} width={w - 11} height={h - 11} rx={3.5} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={1} />
      {bolts.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} className="fill-board-bronze" />
      ))}
      <text
        {...textStyle}
        x={x + w / 2}
        y={y + 14 + layout.fontSize * 0.78}
        fontSize={layout.fontSize}
        fontWeight={HUB_WEIGHT}
        letterSpacing={layout.fontSize * 0.1}
        strokeWidth={layout.fontSize * 0.16}
      >
        {name.toUpperCase()}
      </text>
      {layout.icons.map((icon, i) => (
        <g key={buys[i]}>
          <circle cx={icon.x + icon.w / 2} cy={icon.y + icon.h / 2} r={icon.w / 2} fill="#2e2c28" className="stroke-board-bronze" strokeWidth={1.2} />
          <IndustryGlyph industry={buys[i]} cx={icon.x + icon.w / 2} cy={icon.y + icon.h / 2} size={icon.w * 0.66} className="stroke-board-ink" />
        </g>
      ))}
    </g>
  )
}

/** A building slot: faint icons of what it allows, or the owner's tile. */
export function SlotBox({
  rect,
  allowed,
  tile,
}: {
  rect: Rect
  allowed: Industry[]
  tile: { industry: Industry; color: string } | null
}) {
  const { x, y, w, h } = rect
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} className="fill-board-slot stroke-board-bronze" strokeWidth={1.6} />
      {allowed.length === 1 ? (
        <IndustryGlyph industry={allowed[0]} cx={x + w / 2} cy={y + h / 2} size={w * 0.66} className="stroke-board-ink" opacity={0.5} />
      ) : (
        <>
          <line x1={x + w - 2} y1={y + 2} x2={x + 2} y2={y + h - 2} className="stroke-board-bronze" strokeWidth={0.9} opacity={0.8} />
          <IndustryGlyph industry={allowed[0]} cx={x + w * 0.3} cy={y + h * 0.3} size={w * 0.42} className="stroke-board-ink" opacity={0.55} />
          <IndustryGlyph industry={allowed[1]} cx={x + w * 0.7} cy={y + h * 0.7} size={w * 0.42} className="stroke-board-ink" opacity={0.55} />
        </>
      )}
      {tile && (
        <g>
          <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} rx={2.5} style={{ fill: tile.color }} stroke="#000" strokeOpacity={0.55} strokeWidth={1.2} />
          <IndustryGlyph industry={tile.industry} cx={x + w / 2} cy={y + h / 2} size={w * 0.68} className="stroke-board-slot" />
        </g>
      )}
    </g>
  )
}

/** Board-wide SVG definitions (drop shadow for banners and plaques). */
export function BoardDefs() {
  return (
    <defs>
      <filter id="illustrated-board-shadow" x="-20%" y="-30%" width="140%" height="170%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.55" />
      </filter>
    </defs>
  )
}

