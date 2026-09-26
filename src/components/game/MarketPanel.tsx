import { GOODS_NAMES, INDUSTRIES, RULES } from '../../game/rules'
import type { GameState } from '../../game/types'
import { IndustryIcon } from './IndustryIcon'

/** Every hub's current price and what it buys, and the ports that are open for cotton. */
export function MarketPanel({ game }: { game: GameState }) {
  const hubs = game.board.towns.filter((town) => town.market)
  const ports = game.buildings.filter((b) => INDUSTRIES[b.kind].market)
  const townName = (id: string) => game.board.towns.find((t) => t.id === id)?.name ?? id
  return (
    <section className="plate rivets p-3 sm:p-4" aria-label="Markets">
      <h2 className="eyebrow mb-2.5">Markets</h2>
      <ul className="flex flex-col gap-1.5">
        {hubs.map((town) => {
          const price = game.prices[town.id]
          const base = town.market!.price
          return (
            <li key={town.id} className="flex items-center gap-2 rounded-lg border border-bronze-500/15 bg-soot-950/40 px-2.5 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-bold tracking-[0.06em] text-parchment-50">{town.name}</span>
                <span className="text-[0.7rem] text-parchment-400">
                  Buys {town.market!.buys.map((g) => GOODS_NAMES[g]).join(', ')}
                </span>
              </span>
              <span className="flex gap-0.5" aria-hidden="true">
                {town.market!.buys.map((goods) => (
                  <IndustryIcon key={goods} kind={goods} className="size-5" />
                ))}
              </span>
              <span
                className={`min-w-11 rounded-md border px-1.5 py-0.5 text-center font-display text-base font-extrabold tabular-nums ${
                  price < base ? 'border-rust-400/50 text-rust-300' : 'border-brass-300/50 text-brass-200'
                }`}
                title={price < base ? `Down from £${base}; recovers £${RULES.priceRecovery} a round` : 'At its full price'}
              >
                £{price}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-parchment-400">
        Each unit sold drops a hub’s price by £{RULES.priceDropPerGoods} (not below £{RULES.priceFloor}). Ports buy cotton at a flat £
        {RULES.portPrice}
        {ports.length ? `: ${ports.map((p) => `${townName(p.townId)} (${game.players[p.owner].name})`).join(', ')}.` : '; none built yet.'}
      </p>
    </section>
  )
}
