import {
  GOODS_NAMES,
  INDUSTRY_NAMES,
  isLinkActive,
  slotKey,
  type BoardData,
  type BoardLink,
  type BoardLocation,
  type BuiltState,
  type Era,
} from '../../data/board'
import type { Point } from './geometry'
import type { LocationLayout } from './layout'

interface BoardTooltipProps {
  board: BoardData
  era: Era
  built: BuiltState
  prices?: Readonly<Record<string, number>>
  playerName: (player: number) => string
  /** Location or link to describe. */
  target: { type: 'location'; location: BoardLocation; layout: LocationLayout; slot?: number } | { type: 'link'; link: BoardLink; at: Point }
}

/** "Ada’s", but "Your" for the local player. */
const possessive = (name: string) => (name === 'You' ? 'Your' : `${name}’s`)

const LINK_TYPE_LABEL = { canal: 'Canal only', rail: 'Rail only', both: 'Canal and rail' } as const

/**
 * Hover card for a location or link, positioned over the board in % so it
 * follows the board at any size. Flips below the target near the top edge.
 */
export function BoardTooltip({ board, era, built, prices, playerName, target }: BoardTooltipProps) {
  const anchor =
    target.type === 'location'
      ? { x: target.layout.center.x, top: target.layout.bounds.y, bottom: target.layout.bounds.y + target.layout.bounds.h }
      : { x: target.at.x, top: target.at.y - 12, bottom: target.at.y + 12 }
  const below = anchor.top < 260
  const style = {
    left: `${Math.min(84, Math.max(16, anchor.x / 10))}%`,
    top: `${(below ? anchor.bottom + 10 : anchor.top - 10) / 10}%`,
    transform: `translate(-50%, ${below ? '0' : '-100%'})`,
  }

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max max-w-64 rounded-lg border border-bronze-400/60 bg-soot-950/95 px-3 py-2.5 text-left text-xs text-parchment-200 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.9)]"
      style={style}
    >
      {target.type === 'location' ? (
        <LocationDetails board={board} era={era} built={built} prices={prices} playerName={playerName} location={target.location} slot={target.slot} />
      ) : (
        <LinkDetails board={board} era={era} built={built} playerName={playerName} link={target.link} />
      )}
    </div>
  )
}

type DetailsProps = Omit<BoardTooltipProps, 'target'>

function LocationDetails({ board, era, built, prices, playerName, location, slot }: DetailsProps & { location: BoardLocation; slot?: number }) {
  const links = board.links.filter((l) => l.from === location.id || l.to === location.id)
  const active = links.filter((l) => isLinkActive(l.type, era)).length
  const kind =
    location.type === 'city'
      ? `City · ${board.regions[location.region]?.name ?? location.region}`
      : location.type === 'stop'
        ? 'Stop · routes pass through, no building'
        : 'Trade hub · goods are sold here'

  return (
    <>
      <p className="font-board text-sm font-bold tracking-wide text-parchment-50">{location.name}</p>
      <p className="mb-1.5 text-parchment-400">{kind}</p>
      {location.type === 'city' && (
        <ol className="mb-1.5 flex flex-col gap-0.5">
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
        <p className="mb-1.5">
          <span className="text-parchment-400">Buys:</span> {location.buys.map((b) => GOODS_NAMES[b]).join(', ')}
          {prices?.[location.id] !== undefined && <span className="text-brass-200"> · £{prices[location.id]} each</span>}
        </p>
      )}
      <p className="text-parchment-400">
        {links.length} link{links.length === 1 ? '' : 's'}, {active} usable in the {era} era
      </p>
    </>
  )
}

function LinkDetails({ board, era, built, playerName, link }: DetailsProps & { link: BoardLink }) {
  const name = (id: string) => board.locations.find((l) => l.id === id)?.name ?? id
  const owner = built.links[link.id]
  const active = isLinkActive(link.type, era)
  return (
    <>
      <p className="font-board text-sm font-bold tracking-wide text-parchment-50">
        {name(link.from)} – {name(link.to)}
      </p>
      <p className="text-parchment-400">
        {LINK_TYPE_LABEL[link.type]}
        {active ? '' : ` · not usable in the ${era} era`}
      </p>
      {owner && <p className="mt-1 text-parchment-50">Built by {playerName(owner.player)}</p>}
    </>
  )
}
