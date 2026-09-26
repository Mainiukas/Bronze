/**
 * Drawing pieces for the illustrated board. All purely presentational: they
 * take laid-out geometry (view units) and draw it in the board's style.
 */

import { INDUSTRY_SHORT, type Era, type HubLocation, type Industry } from '../../data/board'
import { HEX_LINK_URL, imageOk, INDUSTRY_ICON_URLS, LINK_SPACE_URL, LINK_SYMBOL_URL, TEXTURE_URLS, TOKEN_ART_URLS } from './assets'
import { upright, type Point, type Rect, type TexturePiece } from './geometry'
import { LOCOMOTIVE_SILHOUETTE } from './icons'
import {
  BUBBLE_H,
  BUBBLE_W,
  CITY_TRACKING,
  CITY_WEIGHT,
  HUB_TRACKING,
  HUB_WEIGHT,
  IRON_RING,
  MEDALLION_R,
  RAIL_BADGE_R,
  RIBBON_TAIL,
  STOP_TRACKING,
  STOP_WEIGHT,
  TEXTURE_PIECE,
  TRACK_H,
  type HubParts,
  type StopParts,
} from './layout'
import { BOARD_COLORS as C, DEF } from './style'

const f = (n: number) => Math.round(n * 100) / 100

/* ---- Shared definitions --------------------------------------------------- */

/** Filters, the tile vignette and the texture images, defined once per board. */
export function BoardDefs() {
  return (
    <defs>
      <filter id={DEF.shadow} x="-20%" y="-30%" width="140%" height="170%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.5" />
      </filter>
      <filter id={DEF.routeShadow} x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="1.5" />
      </filter>
      <filter id={DEF.tokenShadow} x="-30%" y="-60%" width="160%" height="220%">
        <feDropShadow dx="1.5" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.4" />
      </filter>
      <filter id={DEF.glow} x="-50%" y="-80%" width="200%" height="260%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      {/* Turns an image into a flat dark silhouette (the rail-era badge's locomotive). */}
      <filter id={DEF.silhouette}>
        <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.075  0 0 0 0 0.05  0 0 0 1 0" />
      </filter>
      <radialGradient id={DEF.vignette}>
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.5" />
      </radialGradient>
      {(['canal', 'rail'] as const).map((era) =>
        imageOk(TEXTURE_URLS[era]) ? (
          <image key={era} id={DEF.texture(era)} href={TEXTURE_URLS[era]} width={TEXTURE_PIECE[era]} height={TRACK_H[era]} preserveAspectRatio="none" />
        ) : null,
      )}
    </defs>
  )
}

/* ---- Industry icons ------------------------------------------------------- */

/**
 * An industry's picture (assets/icons) in a `size` box centred on (cx, cy).
 * If the picture is missing, a short label on a dark square instead.
 */
export function IndustryIcon({ industry, cx, cy, size }: { industry: Industry; cx: number; cy: number; size: number }) {
  const url = INDUSTRY_ICON_URLS[industry]
  if (imageOk(url)) return <image href={url} x={f(cx - size / 2)} y={f(cy - size / 2)} width={f(size)} height={f(size)} />
  return (
    <g>
      <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={size * 0.15} fill={C.iron} />
      <text x={cx} y={cy} dy="0.36em" textAnchor="middle" fontSize={size * 0.3} fontWeight={700} className="font-board" fill={C.cream}>
        {INDUSTRY_SHORT[industry]}
      </text>
    </g>
  )
}

/* ---- Routes --------------------------------------------------------------- */

/**
 * A route drawn with its texture: pieces laid edge to edge along the curve,
 * each a quad filled with the texture rotated to the route there.
 */
export function RouteTexture({ era, id, pieces }: { era: Era; id: string; pieces: TexturePiece[] }) {
  const h = TRACK_H[era]
  const piece = TEXTURE_PIECE[era]
  return (
    <g>
      <defs>
        {pieces.map((p, i) => (
          <pattern
            key={i}
            id={`${id}-${i}`}
            patternUnits="userSpaceOnUse"
            width={f(piece)}
            height={h + 4}
            patternTransform={`translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.angle)}) translate(${f(-p.u)} ${-(h / 2 + 2)})`}
          >
            <use href={`#${DEF.texture(era)}`} y={2} />
          </pattern>
        ))}
      </defs>
      {pieces.map((p, i) => (
        <polygon key={i} points={p.quad.map((q) => `${f(q.x)},${f(q.y)}`).join(' ')} fill={`url(#${id}-${i})`} shapeRendering="crispEdges" />
      ))}
    </g>
  )
}

/** The route drawn with strokes: the fallback when its texture can't be loaded. */
export function RouteStroke({ era, d }: { era: Era; d: string }) {
  const h = TRACK_H[era]
  if (era === 'rail') {
    return (
      <>
        <path d={d} fill="none" stroke="#2a2118" strokeWidth={h} strokeDasharray="3 5" />
        <path d={d} fill="none" stroke="#c2b494" strokeWidth={h - 4} />
        <path d={d} fill="none" stroke="#3b2f22" strokeWidth={h - 7} />
      </>
    )
  }
  return (
    <>
      <path d={d} fill="none" stroke="#d9d2b8" strokeWidth={h} />
      <path d={d} fill="none" stroke="#5f8f8c" strokeWidth={h - 4} />
    </>
  )
}

/** Soft shadow under a route (the layer adds the blur). */
export function RouteShadow({ era, d }: { era: Era; d: string }) {
  return <path d={d} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={TRACK_H[era]} transform="translate(1.5 1.5)" />
}

/* ---- Link bubbles and tokens --------------------------------------------- */

const bubble = { x: -BUBBLE_W / 2, y: -BUBBLE_H / 2, width: BUBBLE_W, height: BUBBLE_H }

/**
 * An empty link: the connection bubble (link_space.png), centred on the route
 * and turned to it, never upside down. When it can be built it gets a
 * pulsing soft gold glow.
 */
export function LinkBubble({ x, y, angle, glow = false }: { x: number; y: number; angle: number; glow?: boolean }) {
  const pad = 3
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${f(upright(angle))})`}>
      {glow && (
        <rect
          x={-BUBBLE_W / 2 - pad}
          y={-BUBBLE_H / 2 - pad}
          width={BUBBLE_W + pad * 2}
          height={BUBBLE_H + pad * 2}
          rx={BUBBLE_H / 2 + pad}
          fill={C.gold}
          fillOpacity={0.35}
          stroke={C.gold}
          strokeWidth={3}
          filter={`url(#${DEF.glow})`}
          className="board-target"
        />
      )}
      {imageOk(LINK_SPACE_URL) ? <image href={LINK_SPACE_URL} {...bubble} /> : <BubbleFallback />}
    </g>
  )
}

/** Drawn bubble, if link_space.png can't be loaded: a dark stadium with a bronze rim and the link symbol. */
function BubbleFallback() {
  const w = BUBBLE_W
  const h = BUBBLE_H
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill="#3b3a37" stroke={C.bronze} strokeWidth={1.4} />
      {imageOk(LINK_SYMBOL_URL) ? (
        <image href={LINK_SYMBOL_URL} x={-w * 0.3} y={-w * 0.15} width={w * 0.6} height={w * 0.3} />
      ) : (
        <g fill="#f4c42a" stroke="#6b4f10" strokeWidth={0.6}>
          <rect x={-8} y={-2.2} width={16} height={4.4} fill="none" stroke="#f4c42a" strokeWidth={1.2} />
          <circle cx={-10.5} cy={0} r={4.2} />
          <circle cx={10.5} cy={0} r={4.2} />
        </g>
      )}
    </g>
  )
}

/**
 * A built link: the owner's token (a barge on a canal or a locomotive on
 * rails) at the bubble's size and place, turned to the route and never
 * upside down. Colours without a token image get a stadium in that colour
 * with the texture strip and the art on top. `mark` (the colour-blind aid)
 * adds the owner's letter.
 */
export function LinkToken({ x, y, angle, era, token, color, mark }: { x: number; y: number; angle: number; era: Era; token: string | undefined; color: string; mark?: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${f(upright(angle))})`}>
      <g filter={`url(#${DEF.tokenShadow})`}>{imageOk(token) ? <image href={token} {...bubble} /> : <StadiumToken era={era} color={color} />}</g>
      {mark && <Mark x={BUBBLE_W / 2 - 4} y={-BUBBLE_H / 2 + 3} letter={mark} color={color} />}
    </g>
  )
}

function StadiumToken({ era, color }: { era: Era; color: string }) {
  const w = BUBBLE_W
  const h = BUBBLE_H
  const clipId = `ib-stadium-${era}`
  const art = TOKEN_ART_URLS[era]
  const artRatio = era === 'canal' ? 188 / 792 : 296 / 766
  const artW = w * 0.62
  const artH = artW * artRatio
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} style={{ fill: color }} stroke={C.ink} strokeWidth={1.2} />
      <clipPath id={clipId}>
        <rect x={-w / 2 + 2} y={-h / 2 + 2} width={w - 4} height={h - 4} rx={h / 2 - 2} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {imageOk(TEXTURE_URLS[era]) && <use href={`#${DEF.texture(era)}`} transform={`translate(${-w / 2} ${h / 2 - 7}) scale(${f(7 / TRACK_H[era])})`} />}
      </g>
      <rect x={-w / 2 + 1} y={-h / 2 + 1} width={w - 2} height={h / 2 - 1} rx={h / 2 - 1} fill="#fff" fillOpacity={0.18} />
      {imageOk(art) && <image href={art} x={-artW / 2} y={h / 2 - 4 - artH} width={artW} height={artH} />}
    </g>
  )
}

/** A player's letter in a small disc of their colour (the colour-blind aid). */
function Mark({ x, y, letter, color }: { x: number; y: number; letter: string; color: string }) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={5} style={{ fill: color }} stroke={C.ink} strokeWidth={1} />
      <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={7} fontWeight={800} className="font-display" fill={C.ink}>
        {letter}
      </text>
    </g>
  )
}

/* ---- Cities --------------------------------------------------------------- */

/** A built industry: the owner's colour, the icon, its ★ value, and for a mill the cotton waiting as pips (0–3). */
export interface BuiltTile {
  industry: Industry
  color: string
  stars?: number
  /** Cotton waiting at a mill; undefined for other industries. */
  goods?: number
  mark?: string
}

/**
 * One industry slot: a charcoal square with a dark-bronze border, an inner
 * vignette and the picture of what it allows (two smaller pictures and a
 * bronze divider for a dual slot), or the owner's tile once built.
 */
export function SlotTile({ rect, allowed, tile }: { rect: Rect; allowed: Industry[]; tile: BuiltTile | null }) {
  const { x, y, w, h } = rect
  const cx = x + w / 2
  const cy = y + h / 2
  if (tile) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={2} style={{ fill: tile.color }} stroke="#000" strokeOpacity={0.6} strokeWidth={1.5} />
        <rect x={x} y={y} width={w} height={h} rx={2} fill={`url(#${DEF.vignette})`} opacity={0.55} />
        <IndustryIcon industry={tile.industry} cx={cx} cy={cy - 1.5} size={w * 0.78} />
        {tile.stars !== undefined && (
          <g>
            <rect x={x + 1.5} y={y + h - 10} width={15} height={8.5} rx={2} fill={C.ink} fillOpacity={0.85} />
            <text x={x + 9} y={y + h - 5.75} dy="0.36em" textAnchor="middle" fontSize={7} fontWeight={800} className="font-display" fill={C.gold}>
              {tile.stars}★
            </text>
          </g>
        )}
        {tile.goods !== undefined && (
          <g>
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={x + w - 4.5 - (2 - i) * 5.2} cy={y + h - 5.5} r={2.1} fill={i < tile.goods! ? C.cream : C.ink} stroke={C.ink} strokeWidth={0.8} />
            ))}
          </g>
        )}
        {tile.mark && <Mark x={x + 5} y={y + 5} letter={tile.mark} color={tile.color} />}
      </g>
    )
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={C.tile} stroke={C.tileEdge} strokeWidth={1.5} />
      <rect x={x} y={y} width={w} height={h} rx={2} fill={`url(#${DEF.vignette})`} />
      {allowed.length === 1 ? (
        <IndustryIcon industry={allowed[0]} cx={cx} cy={cy} size={w * 0.85} />
      ) : (
        <>
          <IndustryIcon industry={allowed[0]} cx={x + w * 0.26} cy={cy} size={w * 0.48} />
          <IndustryIcon industry={allowed[1]} cx={x + w * 0.74} cy={cy} size={w * 0.48} />
          <line x1={cx} y1={y + 4} x2={cx} y2={y + h - 4} stroke={C.bronze} strokeWidth={1} />
        </>
      )}
    </g>
  )
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
      <text {...text} fill="#000" fillOpacity={0.55} transform="translate(0.6 0.8)">
        {name.toUpperCase()}
      </text>
      <text {...text} fill={C.cream}>
        {name.toUpperCase()}
      </text>
    </g>
  )
}

/* ---- Hexagon emblems ------------------------------------------------------ */

/** The Brass-style link hexagon (hex_link.png) on stops and hubs; drawn if the picture can't be loaded. */
function HexLink({ rect }: { rect: Rect }) {
  if (imageOk(HEX_LINK_URL)) return <image href={HEX_LINK_URL} x={rect.x} y={rect.y} width={rect.w} height={rect.h} />
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const r = rect.w / 2
  const corners = (radius: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2
      return `${f(cx + Math.cos(a) * radius)},${f(cy + Math.sin(a) * radius)}`
    }).join(' ')
  return (
    <g>
      <polygon points={corners(r)} fill="#141414" />
      <polygon points={corners(r * 0.78)} fill="none" stroke="#f4c42a" strokeWidth={1.3} />
      <line x1={cx - 3.5} y1={cy} x2={cx + 3.5} y2={cy} stroke="#f4c42a" strokeWidth={1.2} />
      <circle cx={cx - 3.6} cy={cy} r={1.8} fill="#f4c42a" />
      <circle cx={cx + 3.6} cy={cy} r={1.8} fill="#f4c42a" />
    </g>
  )
}

/* ---- Stops ---------------------------------------------------------------- */

/** Silver-grey plaque with dark letter-spaced capitals and two link hexagons on its top edge. */
export function StopPlaque({ parts, name, fontSize }: { parts: StopParts; name: string; fontSize: number }) {
  const { x, y, w, h } = parts.plaque
  const spacing = fontSize * STOP_TRACKING
  return (
    <g filter={`url(#${DEF.shadow})`}>
      <rect x={x} y={y} width={w} height={h} rx={1} fill={C.plaque} stroke={C.plaqueEdge} strokeWidth={1.2} />
      <rect x={x + 1.6} y={y + 1.6} width={w - 3.2} height={h - 3.2} rx={0.6} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={0.6} />
      <text
        x={x + w / 2 + spacing / 2}
        y={y + h / 2 + 1.5}
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
      {parts.hexes.map((r) => (
        <HexLink key={r.x} rect={r} />
      ))}
    </g>
  )
}

/* ---- Trade hubs ----------------------------------------------------------- */

/**
 * A trade hub: two link hexagons on top of a round medallion with the hub's
 * photo (a thick iron ring and a thin bronze rim), crossed by a pale ribbon
 * with the name, and small icons of what it buys below.
 */
export function HubGroup({ location, parts, fontSize, photo }: { location: HubLocation; parts: HubParts; fontSize: number; photo: string | null }) {
  const m = parts.medallion
  const R = MEDALLION_R
  const inner = R - IRON_RING
  const clipId = `ib-photo-${location.id}`
  const { x, y, w, h } = parts.ribbon
  const tail = RIBBON_TAIL
  const drop = 3
  const notch = 5
  const leftTail = `M${f(x + 5)} ${f(y + drop)}H${f(x - tail)}L${f(x - tail + notch)} ${f(y + drop + h / 2)}L${f(x - tail)} ${f(y + drop + h)}H${f(x + 5)}Z`
  const rightTail = `M${f(x + w - 5)} ${f(y + drop)}H${f(x + w + tail)}L${f(x + w + tail - notch)} ${f(y + drop + h / 2)}L${f(x + w + tail)} ${f(y + drop + h)}H${f(x + w - 5)}Z`
  const folds = [`M${f(x)} ${f(y + h)}L${f(x + 5)} ${f(y + h + drop)}H${f(x)}Z`, `M${f(x + w)} ${f(y + h)}L${f(x + w - 5)} ${f(y + h + drop)}H${f(x + w)}Z`]
  const spacing = fontSize * HUB_TRACKING
  const icons = parts.icons
  const strip = icons.length ? { x: icons[0].x - 2.5, y: icons[0].y - 2, w: icons.at(-1)!.x + icons.at(-1)!.w - icons[0].x + 5, h: icons[0].h + 4 } : null
  return (
    <g filter={`url(#${DEF.shadow})`}>
      {/* Medallion: the hub's photo inside a thick iron ring with a thin bronze rim */}
      <clipPath id={clipId}>
        <circle cx={m.x} cy={m.y} r={inner} />
      </clipPath>
      <circle cx={m.x} cy={m.y} r={inner} fill="#6f6a5c" />
      {photo && <image href={photo} x={m.x - inner - 1} y={m.y - inner - 1} width={inner * 2 + 2} height={inner * 2 + 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />}
      <circle cx={m.x} cy={m.y} r={R - IRON_RING / 2} fill="none" stroke={C.iron} strokeWidth={IRON_RING} />
      <circle cx={m.x} cy={m.y} r={R - IRON_RING / 2} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth={0.7} />
      <circle cx={m.x} cy={m.y} r={R + 0.3} fill="none" stroke={C.bronze} strokeWidth={1} />
      <circle cx={m.x} cy={m.y} r={inner} fill="none" stroke={C.bronze} strokeWidth={0.8} />
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
      {strip && <rect {...strip} rx={2.5} fill={C.tile} fillOpacity={0.85} stroke={C.bronze} strokeOpacity={0.7} strokeWidth={0.6} />}
      {icons.map((r, i) => (
        <IndustryIcon key={location.buys[i]} industry={location.buys[i]} cx={r.x + r.w / 2} cy={r.y + r.h / 2} size={r.w} />
      ))}
      {/* Two link hexagons on the medallion's top edge */}
      {parts.hexes.map((r) => (
        <HexLink key={r.x} rect={r} />
      ))}
    </g>
  )
}

/** The hub's square badge with its current price (drawn in the badges layer, so it updates live). */
export function PriceBadge({ rect, price }: { rect: Rect; price: number }) {
  const { x, y, w, h } = rect
  return (
    <g filter={`url(#${DEF.shadow})`}>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={C.tile} stroke={C.gold} strokeWidth={1.3} />
      <rect x={x + 1.8} y={y + 1.8} width={w - 3.6} height={h - 3.6} rx={1} fill="none" stroke={C.bronze} strokeOpacity={0.6} strokeWidth={0.6} />
      <text x={x + w / 2} y={y + h / 2} dy="0.36em" textAnchor="middle" fontSize={10} fontWeight={800} className="font-display" fill={C.gold}>
        £{price}
      </text>
    </g>
  )
}

/* ---- Badges --------------------------------------------------------------- */

/** "Available in the Rail Era": a locomotive silhouette in a bronze circle on the plaque's top-right corner. */
export function RailEraBadge({ at }: { at: Point }) {
  const art = TOKEN_ART_URLS.rail
  const w = RAIL_BADGE_R * 1.7
  const h = w * (296 / 766)
  return (
    <g>
      <title>Available in the Rail Era</title>
      <circle cx={at.x} cy={at.y} r={RAIL_BADGE_R} fill={C.bronze} stroke={C.ink} strokeWidth={1} />
      {imageOk(art) ? (
        <image href={art} x={at.x - w / 2} y={at.y - h / 2} width={w} height={h} filter={`url(#${DEF.silhouette})`} />
      ) : (
        <path d={LOCOMOTIVE_SILHOUETTE} fill={C.ink} transform={`translate(${f(at.x + 0.3)} ${f(at.y - 0.2)}) scale(0.6)`} />
      )}
    </g>
  )
}
