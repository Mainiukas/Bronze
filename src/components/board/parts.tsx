/**
 * Drawing pieces for the illustrated board. All purely presentational: they
 * take laid-out geometry (view units) and draw it in the board's style.
 */

import type { Era, HubLocation, Industry } from '../../data/board'
import { flatHexagonPath, polylinePath, type Point, type Polyline, type Rect, type TrackSlice } from './geometry'
import { BARREL_HOOPS, BARREL_SILHOUETTE, BOAT_SILHOUETTE, BOARD_ICONS, LOCOMOTIVE_SILHOUETTE } from './icons'
import {
  BADGE,
  BONUS_R,
  CANAL_H,
  CANAL_PIECE,
  CITY_TRACKING,
  CITY_WEIGHT,
  EMBLEM_R,
  HUB_SLOT_H,
  HUB_SLOT_W,
  HUB_TRACKING,
  HUB_WEIGHT,
  MARKER_H,
  MARKER_W,
  MEDALLION_R,
  RAIL_BADGE_R,
  RAIL_H,
  RAIL_PIECE,
  STOP_TRACKING,
  STOP_WEIGHT,
  type HubParts,
  type StopParts,
} from './layout'
import { BOARD_COLORS as C, DEF } from './style'

const f = (n: number) => Math.round(n * 100) / 100

/** Filters, texture patterns, the tile vignette and the icon images, defined once per board. */
export function BoardDefs({ textures, icons }: { textures: Partial<Record<Era, string>>; icons: Partial<Record<Industry, string>> }) {
  return (
    <defs>
      <filter id={DEF.shadow} x="-20%" y="-30%" width="140%" height="170%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.5" />
      </filter>
      <filter id={DEF.routeShadow} x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="1.5" />
      </filter>
      <filter id={DEF.glow} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" />
      </filter>
      <radialGradient id={DEF.vignette}>
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.5" />
      </radialGradient>
      {textures.rail && (
        <pattern id={DEF.texture('rail')} width={RAIL_PIECE} height={RAIL_H} patternUnits="userSpaceOnUse">
          <image href={textures.rail} width={RAIL_PIECE} height={RAIL_H} preserveAspectRatio="none" />
        </pattern>
      )}
      {textures.canal && (
        <pattern id={DEF.texture('canal')} width={CANAL_PIECE} height={CANAL_H} patternUnits="userSpaceOnUse">
          <image href={textures.canal} width={CANAL_PIECE} height={CANAL_H} preserveAspectRatio="none" />
        </pattern>
      )}
      {Object.entries(icons).map(([industry, url]) => (
        <image key={industry} id={DEF.icon(industry as Industry)} href={url} width={100} height={100} />
      ))}
    </defs>
  )
}

/* ---- Icons ---------------------------------------------------------------- */

/** An industry icon in a `size` box centred on (cx, cy): the image if there is one, else the drawn glyph. */
export function IndustryIcon({ industry, cx, cy, size, image }: { industry: Industry; cx: number; cy: number; size: number; image: boolean }) {
  const x = cx - size / 2
  const y = cy - size / 2
  if (image) return <use href={`#${DEF.icon(industry)}`} transform={`translate(${f(x)} ${f(y)}) scale(${f(size / 100)})`} />
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(size / 24)})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={BOARD_ICONS[industry]} stroke={C.ink} strokeWidth={3.4} />
      <path d={BOARD_ICONS[industry]} stroke={C.cream} strokeWidth={2} />
    </g>
  )
}

/* ---- Routes --------------------------------------------------------------- */

const TRACK_H: Record<Era, number> = { rail: RAIL_H, canal: CANAL_H }

/** A track drawn with its texture, as rotated slices of the repeating pattern. */
export function TexturedTrack({ kind, slices }: { kind: Era; slices: TrackSlice[] }) {
  const h = TRACK_H[kind]
  return (
    <g>
      {slices.map((s, i) => (
        <rect
          key={i}
          x={f(s.u)}
          width={f(s.w)}
          height={h}
          fill={`url(#${DEF.texture(kind)})`}
          transform={`translate(${f(s.x)} ${f(s.y)}) rotate(${f(s.angle)}) translate(${f(-s.u)} ${-h / 2})`}
        />
      ))}
    </g>
  )
}

/** The track drawn with strokes: the fallback when its texture can't be loaded. */
export function StrokedTrack({ kind, line }: { kind: Era; line: Polyline }) {
  const d = polylinePath(line)
  if (kind === 'rail') {
    return (
      <>
        <path d={d} fill="none" stroke="#2a2118" strokeWidth={RAIL_H} strokeDasharray="3 5" />
        <path d={d} fill="none" stroke="#c2b494" strokeWidth={RAIL_H - 4} />
        <path d={d} fill="none" stroke="#3b2f22" strokeWidth={RAIL_H - 7} />
      </>
    )
  }
  return (
    <>
      <path d={d} fill="none" stroke="#d9d2b8" strokeWidth={CANAL_H} />
      <path d={d} fill="none" stroke="#5f8f8c" strokeWidth={CANAL_H - 5} />
    </>
  )
}

/** Soft shadow under a track (the layer adds the blur). */
export function TrackShadow({ kind, line }: { kind: Era; line: Polyline }) {
  return <path d={polylinePath(line)} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={TRACK_H[kind]} transform="translate(1.5 1.5)" />
}

/**
 * Hexagonal link marker, rotated to the route. Empty until built; then the
 * owner's colour with a canal boat or a locomotive.
 */
export function LinkMarker({
  x,
  y,
  angle,
  owner,
  kind,
  glow = false,
}: {
  x: number
  y: number
  angle: number
  owner: string | null
  kind: Era
  glow?: boolean
}) {
  // Keep the boat or engine the right way up.
  const upright = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${f(upright)})`}>
      {glow && <path d={flatHexagonPath(0, 0, MARKER_W + 8, MARKER_H + 8, 9)} fill={C.gold} opacity={0.75} filter={`url(#${DEF.glow})`} />}
      <path
        d={flatHexagonPath(0, 0, MARKER_W, MARKER_H, 6.5)}
        fill={owner ?? C.marker}
        fillOpacity={owner ? 1 : 0.7}
        stroke={C.bronze}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d={flatHexagonPath(0, 0, MARKER_W - 5, MARKER_H - 4, 4.8)} fill="none" stroke={C.markerLine} strokeOpacity={0.3} strokeWidth={0.6} />
      {owner && <path d={kind === 'rail' ? LOCOMOTIVE_SILHOUETTE : BOAT_SILHOUETTE} fill={C.ink} fillOpacity={0.85} transform="scale(0.78)" />}
    </g>
  )
}

/* ---- Cities --------------------------------------------------------------- */

/**
 * One industry slot: a charcoal tile with the icon of what it allows (two
 * half-size icons for a dual slot), or the owner's tile once built.
 */
export function SlotTile({
  rect,
  allowed,
  tile,
  images,
}: {
  rect: Rect
  allowed: Industry[]
  tile: { industry: Industry; color: string; level?: number } | null
  images: ReadonlySet<Industry>
}) {
  const { x, y, w, h } = rect
  const cx = x + w / 2
  const cy = y + h / 2
  const icon = (industry: Industry, at: number, size: number) => (
    <IndustryIcon key={`${industry}-${at}`} industry={industry} cx={at} cy={cy} size={size} image={images.has(industry)} />
  )
  if (tile) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={1.5} style={{ fill: tile.color }} stroke="#000" strokeOpacity={0.6} strokeWidth={1.2} />
        <rect x={x} y={y} width={w} height={h} rx={1.5} fill={`url(#${DEF.vignette})`} opacity={0.6} />
        {icon(tile.industry, cx, w * 0.8)}
        {tile.level !== undefined && (
          <text x={x + w - 2.5} y={y + h - 2.5} textAnchor="end" fontSize={6.5} fontWeight={800} className="font-board" fill={C.cream} stroke={C.ink} strokeWidth={1.2} paintOrder="stroke">
            {toRoman(tile.level)}
          </text>
        )}
      </g>
    )
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={C.tile} stroke={C.tileEdge} strokeWidth={0.9} />
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={`url(#${DEF.vignette})`} />
      <rect x={x + 1.2} y={y + 1.2} width={w - 2.4} height={h - 2.4} rx={1} fill="none" stroke="#fff" strokeOpacity={0.05} strokeWidth={0.6} />
      {allowed.length === 1 ? (
        icon(allowed[0], cx, w * 0.8)
      ) : (
        <>
          <line x1={cx} y1={y + 3} x2={cx} y2={y + h - 3} stroke={C.tileEdge} strokeWidth={0.6} />
          {icon(allowed[0], x + w * 0.26, w * 0.45)}
          {icon(allowed[1], x + w * 0.74, w * 0.45)}
        </>
      )}
    </g>
  )
}

function toRoman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] ?? String(n)
}

/** Flat name plate in the region's colour, with a darker bevel and cream capitals. */
export function NamePlate({ rect, color, name, fontSize }: { rect: Rect; color: string; name: string; fontSize: number }) {
  const { x, y, w, h } = rect
  const spacing = fontSize * CITY_TRACKING
  const text = {
    x: x + w / 2 + spacing / 2,
    y: y + h / 2,
    dy: '0.36em',
    textAnchor: 'middle' as const,
    fontSize,
    fontWeight: CITY_WEIGHT,
    letterSpacing: spacing,
    className: 'font-board',
  }
  return (
    <g filter={`url(#${DEF.shadow})`}>
      <rect x={x} y={y} width={w} height={h} fill={color} />
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} fill="none" stroke="#000" strokeOpacity={0.4} strokeWidth={1} />
      <line x1={x + 1.5} y1={y + 1.6} x2={x + w - 1.5} y2={y + 1.6} stroke="#fff" strokeOpacity={0.14} strokeWidth={0.6} />
      <text {...text} fill="#000" fillOpacity={0.55} transform="translate(0.5 0.7)">
        {name.toUpperCase()}
      </text>
      <text {...text} fill={C.cream}>
        {name.toUpperCase()}
      </text>
    </g>
  )
}

/* ---- Stops ---------------------------------------------------------------- */

/** Silver-grey plaque with dark lettering and two decorative hexagon emblems on top. */
export function StopPlaque({ parts, name, fontSize }: { parts: StopParts; name: string; fontSize: number }) {
  const { x, y, w, h } = parts.plaque
  const spacing = fontSize * STOP_TRACKING
  return (
    <g filter={`url(#${DEF.shadow})`}>
      <rect x={x} y={y} width={w} height={h} rx={1} fill={C.plaque} stroke={C.plaqueEdge} strokeWidth={1.2} />
      <rect x={x + 1.6} y={y + 1.6} width={w - 3.2} height={h - 3.2} rx={0.6} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={0.6} />
      {parts.emblems.map((c) => (
        <path key={c.x} d={flatHexagonPath(c.x, c.y, EMBLEM_R * 2, EMBLEM_R * 1.73)} fill={C.tile} stroke="#fff" strokeWidth={0.8} strokeLinejoin="round" />
      ))}
      <text
        x={x + w / 2 + spacing / 2}
        y={y + h / 2 + 1}
        dy="0.36em"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={STOP_WEIGHT}
        letterSpacing={spacing}
        className="font-board"
        fill={C.plaqueInk}
      >
        {name.toUpperCase()}
      </text>
    </g>
  )
}

/* ---- Trade hubs ----------------------------------------------------------- */

/**
 * A trade hub: two merchant slots on top of a round medallion with a painted
 * scene, crossed by a ribbon with the name, and the goods it buys below.
 */
export function HubGroup({
  location,
  parts,
  fontSize,
  scene,
  images,
}: {
  location: HubLocation
  parts: HubParts
  fontSize: number
  /** Image for the medallion, or null to draw the built-in scene. */
  scene: string | null
  images: ReadonlySet<Industry>
}) {
  const m = parts.medallion
  const R = MEDALLION_R
  const inner = R - 5
  const clipId = `ib-scene-${location.id}`
  const { x, y, w, h } = parts.ribbon
  const tail = 8
  const drop = 3
  const notch = 4.5
  const leftTail = `M${f(x + 5)} ${f(y + drop)}H${f(x - tail)}L${f(x - tail + notch)} ${f(y + drop + h / 2)}L${f(x - tail)} ${f(y + drop + h)}H${f(x + 5)}Z`
  const rightTail = `M${f(x + w - 5)} ${f(y + drop)}H${f(x + w + tail)}L${f(x + w + tail - notch)} ${f(y + drop + h / 2)}L${f(x + w + tail)} ${f(y + drop + h)}H${f(x + w - 5)}Z`
  const folds = [`M${f(x)} ${f(y + h)}L${f(x + 5)} ${f(y + h + drop)}H${f(x)}Z`, `M${f(x + w)} ${f(y + h)}L${f(x + w - 5)} ${f(y + h + drop)}H${f(x + w)}Z`]
  const spacing = fontSize * HUB_TRACKING
  const icons = parts.icons
  const strip = icons.length ? { x: icons[0].x - 2, y: icons[0].y - 1.5, w: icons.at(-1)!.x + icons.at(-1)!.w - icons[0].x + 4, h: icons[0].h + 3 } : null
  return (
    <g filter={`url(#${DEF.shadow})`}>
      {/* Merchant slots */}
      {parts.slots.map((r) => (
        <g key={r.x}>
          <path d={flatHexagonPath(r.x + r.w / 2, r.y + r.h / 2, HUB_SLOT_W, HUB_SLOT_H, 7)} fill={C.tile} stroke={C.bronze} strokeWidth={1.3} strokeLinejoin="round" />
          <path d={flatHexagonPath(r.x + r.w / 2, r.y + r.h / 2, HUB_SLOT_W - 5, HUB_SLOT_H - 4, 5.5)} fill="none" stroke={C.markerLine} strokeOpacity={0.25} strokeWidth={0.6} />
        </g>
      ))}
      {/* Medallion: painted scene inside a thick iron ring with a bronze rim */}
      <clipPath id={clipId}>
        <circle cx={m.x} cy={m.y} r={inner} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {scene ? (
          <image href={scene} x={m.x - inner} y={m.y - inner} width={inner * 2} height={inner * 2} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <HubScene id={location.id} c={m} r={inner} />
        )}
      </g>
      <circle cx={m.x} cy={m.y} r={inner + 2.6} fill="none" stroke={C.iron} strokeWidth={5.2} />
      <circle cx={m.x} cy={m.y} r={inner + 2.6} fill="none" stroke="#fff" strokeOpacity={0.08} strokeWidth={0.8} />
      <circle cx={m.x} cy={m.y} r={R + 0.6} fill="none" stroke={C.bronze} strokeWidth={1.2} />
      <circle cx={m.x} cy={m.y} r={inner} fill="none" stroke={C.bronze} strokeOpacity={0.7} strokeWidth={0.6} />
      {/* Ribbon with folded tails */}
      {[leftTail, rightTail].map((d) => (
        <g key={d}>
          <path d={d} fill={C.ribbon} stroke={C.plaqueEdge} strokeWidth={0.8} />
          <path d={d} fill="#000" fillOpacity={0.18} />
        </g>
      ))}
      {folds.map((d) => (
        <path key={d} d={d} fill="#6f6f6a" />
      ))}
      <rect x={x} y={y} width={w} height={h} fill={C.ribbon} stroke={C.plaqueEdge} strokeWidth={0.9} />
      <line x1={x + 1} y1={y + 1.6} x2={x + w - 1} y2={y + 1.6} stroke="#fff" strokeOpacity={0.5} strokeWidth={0.6} />
      <text
        x={x + w / 2 + spacing / 2}
        y={y + h / 2 + 0.5}
        dy="0.36em"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={HUB_WEIGHT}
        letterSpacing={spacing}
        className="font-board"
        fill={C.plaqueInk}
      >
        {location.name.toUpperCase()}
      </text>
      {/* What it buys */}
      {strip && <rect {...strip} rx={2} fill={C.tile} fillOpacity={0.88} stroke={C.bronze} strokeOpacity={0.6} strokeWidth={0.5} />}
      {icons.map((r, i) => (
        <IndustryIcon key={location.buys[i]} industry={location.buys[i]} cx={r.x + r.w / 2} cy={r.y + r.h / 2} size={r.w} image={images.has(location.buys[i])} />
      ))}
    </g>
  )
}

/** The hub's square number badge and round bonus badge (drawn in the badges layer). */
export function HubBadges({ parts, value }: { parts: HubParts; value: number }) {
  const b = parts.badge
  return (
    <g filter={`url(#${DEF.shadow})`}>
      <rect x={b.x} y={b.y} width={BADGE} height={BADGE} rx={1.5} fill={C.tile} stroke={C.bronze} strokeWidth={1.2} />
      <text x={b.x + BADGE / 2} y={b.y + BADGE / 2} dy="0.36em" textAnchor="middle" fontSize={8.5} fontWeight={800} className="font-board" fill={C.cream}>
        {value}
      </text>
      <circle cx={parts.bonus.x} cy={parts.bonus.y} r={BONUS_R} fill={C.bronze} stroke={C.ink} strokeWidth={1} />
      <g transform={`translate(${f(parts.bonus.x)} ${f(parts.bonus.y)})`}>
        <path d={BARREL_SILHOUETTE} fill={C.ink} fillOpacity={0.85} />
        <path d={BARREL_HOOPS} stroke={C.bronze} strokeWidth={0.8} />
      </g>
    </g>
  )
}

/** Simple painted scenes for hubs without an image: hills, a mill town, the city, the sea. */
function HubScene({ id, c, r }: { id: string; c: Point; r: number }) {
  const sky = <rect x={c.x - r} y={c.y - r} width={r * 2} height={r * 2} fill="#d6ccad" />
  const t = (d: string) => `translate(${f(c.x)} ${f(c.y)})` + (d ? ` ${d}` : '')
  if (id === 'london') {
    return (
      <g>
        {sky}
        <g transform={t('')}>
          <path d="M-25 -2h50v27h-50z" fill="#8f8a74" />
          <path d="M-25 -8h6v6h-6zM-18 -11h5v9h-5zM11 -12h5v10h-5zM17 -7h8v5h-8zM-12 -6h4v4h-4z" fill="#7a5a44" />
          <path d="M-7 -4a7 7 0 0 1 14 0z" fill="#9c9684" />
          <path d="M-1 -15h2v4h-2zM-2 -11h4v2h-4z" fill="#7d776a" />
          <path d="M-9 -4h18v2h-18z" fill="#6c665a" />
          <path d="M-25 9q12 -3 25 0t25 0v16h-50z" fill="#4f6f73" />
          <path d="M-18 13h9M3 15h11" stroke="#c7d6cf" strokeOpacity={0.6} strokeWidth={0.8} />
        </g>
      </g>
    )
  }
  if (id === 'west_wales') {
    return (
      <g>
        {sky}
        <g transform={t('')}>
          <path d="M-25 -4q10 -12 22 -6t10 6v29h-32z" fill="#6f7a45" />
          <path d="M-25 2q8 -6 16 -2v23h-16z" fill="#56603a" />
          <path d="M-3 4h28v21h-28z" fill="#4b6a70" />
          <path d="M4 10h14M8 15h10" stroke="#c7d6cf" strokeOpacity={0.6} strokeWidth={0.8} />
          <path d="M11 -9v11h7zM10 -7v9h-5z" fill="#e9e1c9" />
          <path d="M5 3h14l-2 2.5h-10z" fill="#5a3b28" />
        </g>
      </g>
    )
  }
  // The North, and any other hub: rolling hills and a mill with chimneys.
  return (
    <g>
      {sky}
      <g transform={t('')}>
        <path d="M-10 -14a4 4 0 0 1 7 -2a3.5 3.5 0 0 1 6 1" fill="none" stroke="#b9b3a3" strokeWidth={3} strokeLinecap="round" />
        <path d="M-25 2q12 -10 25 -4t25 0v27h-50z" fill="#7b8a4c" />
        <path d="M-25 10q14 -6 28 0t22 -2v17h-50z" fill="#5d6b38" />
        <path d="M-8 -3h16v8h-16z" fill="#8a4b36" />
        <path d="M-8 -3l4 -3v3l4 -3v3l4 -3v3l4 -3v3z" fill="#6e3a2a" />
        <path d="M5 -14h2.5v11h-2.5zM-4 -11h2v8h-2z" fill="#5e3226" />
      </g>
    </g>
  )
}

/* ---- Badges --------------------------------------------------------------- */

/** "Available in the Rail Era": a locomotive in a bronze circle on the plaque corner. */
export function RailEraBadge({ at }: { at: Point }) {
  return (
    <g>
      <title>Available in the Rail Era</title>
      <circle cx={at.x} cy={at.y} r={RAIL_BADGE_R} fill={C.bronze} stroke={C.ink} strokeWidth={1} />
      <path d={LOCOMOTIVE_SILHOUETTE} fill={C.ink} transform={`translate(${f(at.x + 0.3)} ${f(at.y - 0.2)}) scale(0.52)`} />
    </g>
  )
}

/** Goods waiting at a built industry. */
export function GoodsBadge({ at, goods }: { at: Point; goods: number }) {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={5.5} className="fill-brass-300" stroke={C.ink} strokeWidth={1.2} />
      <text x={at.x} y={at.y} dy="0.36em" textAnchor="middle" fontSize={7.5} fontWeight={800} className="font-display" fill={C.ink}>
        {goods}
      </text>
    </g>
  )
}

/** Small price tag (current sale price) above a hub's ribbon. */
export function PriceTag({ at, price }: { at: Point; price: number }) {
  return (
    <g>
      <rect x={at.x - 12} y={at.y - 7.5} width={24} height={15} rx={3} fill={C.tile} stroke={C.gold} strokeWidth={1} />
      <text x={at.x} y={at.y} dy="0.36em" textAnchor="middle" fontSize={9} fontWeight={800} className="font-display" fill={C.gold}>
        £{price}
      </text>
    </g>
  )
}
