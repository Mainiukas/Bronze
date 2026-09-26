import {
  GOODS_NAMES,
  INDUSTRY_IDS,
  INDUSTRY_NAMES,
  isLinkActive,
  slotKey,
  type BoardData,
  type BoardLink,
  type BoardLocation,
  type BuiltState,
  type Era,
} from '../../data/board'
import type { BoardLayout } from './layout'

export type TooltipTarget = { type: 'location'; id: string; slot?: number } | { type: 'link'; id: string }

interface BoardTooltipProps {
  board: BoardData
  layout: BoardLayout
  era: Era
  built: BuiltState
  prices?: Readonly<Record<string, number>>
  playerName: (player: number) => string
  target: TooltipTarget
}

/** "Ada’s", but "Your" for the local player. */
const possessive = (name: string) => (name === 'You' ? 'Your' : `${name}’s`)

const LINK_TYPE_LABEL = { canal: 'Canal', rail: 'Rail', both: 'Canal and rail' } as const

/**
 * Hover card for a location or link, positioned over the board in % so it
 * follows the board at any size. Flips below the target near the top edge.
 */
export function BoardTooltip({ board, layout, era, built, prices, playerName, target }: BoardTooltipProps) {
  let anchor: { x: number; top: number; bottom: number } | null = null
  let body = null
  if (target.type === 'location') {
    const location = board.locations.find((l) => l.id === target.id)
    const g = layout.groups.get(target.id)
    if (location && g) {
      anchor = { x: g.center.x, top: g.bounds.y, bottom: g.bounds.y + g.bounds.h }
      body = <LocationDetails board={board} era={era} built={built} prices={prices} playerName={playerName} location={location} slot={target.slot} />
    }
  } else {
    const route = layout.routes.get(target.id)
    if (route) {
      anchor = { x: route.marker.x, top: route.marker.y - 12, bottom: route.marker.y + 12 }
      body = <LinkDetails board={board} era={era} built={built} playerName={playerName} link={route.link} />
    }
  }
  if (!anchor) return null
  const below = anchor.top < 300
  const style = {
    left: `${Math.min(84, Math.max(16, anchor.x / 10))}%`,
    top: `${(below ? anchor.bottom + 10 : anchor.top - 10) / 10}%`,
    transform: `translate(-50%, ${below ? '0' : '-100%'})`,
  }
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max max-w-72 rounded-lg border border-bronze-400/60 bg-soot-950/95 px-3 py-2.5 text-left text-xs text-parchment-200 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.9)]"
      style={style}
    >
      {body}
    </div>
  )
}

type DetailsProps = Omit<BoardTooltipProps, 'target' | 'layout'>

function Connections({ board, era, location }: { board: BoardData; era: Era; location: BoardLocation }) {
  const name = (id: string) => board.locations.find((l) => l.id === id)?.name ?? id
  const links = board.links.filter((l) => l.from === location.id || l.to === location.id)
  return (
    <div className="mt-1.5">
      <p className="text-parchment-400">Connections</p>
      <ul className="grid grid-cols-[auto_auto] gap-x-3">
        {links.map((l) => {
          const active = isLinkActive(l.type, era)
          return (
            <li key={l.id} className={`contents ${active ? '' : 'text-parchment-500'}`}>
              <span>{name(l.from === location.id ? l.to : l.from)}</span>
              <span>
                {LINK_TYPE_LABEL[l.type]}
                {active ? '' : ` (${l.type} era)`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function LocationDetails({ board, era, built, prices, playerName, location, slot }: DetailsProps & { location: BoardLocation; slot?: number }) {
  const style =
    location.type === 'city'
      ? `City · ${board.regions[location.region]?.name ?? location.region}`
      : location.type === 'stop'
        ? 'Stop · routes pass through; no building or trade'
        : 'Trade hub · goods are sold here'
  return (
    <>
      <p className="font-board text-sm font-bold tracking-wide text-parchment-50">{location.name}</p>
      <p className="text-parchment-400">{style}</p>
      {location.era === 'rail' && <p className="font-semibold text-brass-200">Available in the Rail Era</p>}
      {location.type === 'city' && (
        <ol className="mt-1.5 flex flex-col gap-0.5">
          {location.slots.map((allowed, i) => {
            const tile = built.slots[slotKey(location.id, i)]
            return (
              <li key={i} className={i === slot ? 'text-brass-200' : undefined}>
                <span className="text-parchment-400">Slot {i + 1}:</span> {allowed.map((a) => INDUSTRY_NAMES[a]).join(' or ')}
                {tile && (
                  <span className="text-parchment-50">
                    {' '}
                    — {possessive(playerName(tile.player))} {INDUSTRY_NAMES[tile.industry]}
                    {tile.goods ? ` (${tile.goods} goods)` : ''}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {location.type === 'hub' && (
        <p className="mt-1.5">
          <span className="text-parchment-400">Buys:</span>{' '}
          {INDUSTRY_IDS.every((i) => location.buys.includes(i)) ? 'Everything' : location.buys.map((b) => GOODS_NAMES[b]).join(', ')}
          {prices?.[location.id] !== undefined && <span className="text-brass-200"> · £{prices[location.id]} each</span>}
        </p>
      )}
      <Connections board={board} era={era} location={location} />
    </>
  )
}

function LinkDetails({ board, era, built, playerName, link }: DetailsProps & { link: BoardLink }) {
  const name = (id: string) => board.locations.find((l) => l.id === id)?.name ?? id
  const owner = built.links[link.id]
  const active = isLinkActive(link.type, era)
  const kind = owner?.kind ?? (link.type === 'both' ? era : link.type)
  return (
    <>
      <p className="font-board text-sm font-bold tracking-wide text-parchment-50">
        {name(link.from)} – {name(link.to)}
      </p>
      <p className="text-parchment-400">
        {link.type === 'both' ? 'Canal and rail' : `${LINK_TYPE_LABEL[link.type]} only`}
        {active ? '' : ` · not usable in the ${era} era`}
      </p>
      {owner && (
        <p className="mt-1 text-parchment-50">
          {kind === 'canal' ? 'Canal dug' : 'Railway laid'} by {playerName(owner.player)}
        </p>
      )}
    </>
  )
}
