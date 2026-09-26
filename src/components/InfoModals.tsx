import type { ReactNode } from 'react'
import { BOARD } from '../data/board'
import { GAME_MODES } from '../data/gameModes'
import { MAPS } from '../data/maps'
import { formatCost, MAX_PLAYERS } from '../game/engine'
import { INDUSTRIES, INDUSTRY_ORDER, LINK_COST, RULES } from '../game/rules'
import { HEX_LINK_URL, LINK_SPACE_URL, TOKEN_URLS } from './board/assets'
import { IndustryIcon } from './game/IndustryIcon'
import { IconBook, IconStar } from './icons'
import { ModalFrame } from './ModalFrame'

interface InfoModalProps {
  open: boolean
  onClose: () => void
}

/**
 * The rules, as the engine plays them. Every number comes from game/rules.ts,
 * the modes and the board data, so this never drifts from the engine.
 */
export function HowToPlayModal({ open, onClose }: InfoModalProps) {
  const hubs = BOARD.locations.filter((l) => l.type === 'hub')
  const stops = BOARD.locations.filter((l) => l.type === 'stop')
  const railOnly = BOARD.locations.filter((l) => l.era === 'rail')
  const names = (list: { name: string }[]) => list.map((l) => l.name).join(', ').replace(/, ([^,]*)$/, ' and $1')
  return (
    <ModalFrame open={open} onClose={onClose} id="how-to-play" title="Rules" icon={<IconBook />} wide>
      <div className="flex flex-col gap-6 text-sm leading-relaxed text-parchment-200">
        <Section title="Goal">
          <p>
            Have the highest total when the last round ends: the <strong className="text-brass-300">★ you earned</strong> in play, plus 1★ for every £
            {RULES.moneyPerPrestige} you hold, plus {RULES.hubBonus}★ for every trade hub in your network. A tie goes to the richer player; if they’re
            level on money too, the victory is shared.
          </p>
        </Section>

        <Section title="Setup and modes">
          <p>
            2–{MAX_PLAYERS} players, each human or computer (Easy, Normal or Hard), each with their own colour. Everyone starts with the mode’s money, no
            coal, no iron and no ★. Round 1 is played in seat order; each round the first seat moves on by one.
          </p>
          <table className="mt-2 w-full text-left text-xs tabular-nums">
            <thead className="text-parchment-400">
              <tr>
                <th className="py-1 font-semibold">Mode</th>
                <th className="py-1 font-semibold">Map</th>
                <th className="py-1 font-semibold">Rounds</th>
                <th className="py-1 font-semibold">Rail era from</th>
                <th className="py-1 font-semibold">Money</th>
                <th className="py-1 font-semibold">Turn timer</th>
              </tr>
            </thead>
            <tbody>
              {GAME_MODES.map((mode) => (
                <tr key={mode.id} className="border-t border-bronze-500/15">
                  <td className="py-1 font-semibold text-parchment-50">{mode.name}</td>
                  <td className="py-1">{mode.mapSize === 'full' ? 'Whole map' : mode.mapSize === 'reduced' ? 'Rings 1–2' : 'Ring 1 only'}</td>
                  <td className="py-1">{mode.rounds}</td>
                  <td className="py-1">round {Math.floor(mode.rounds / 2) + 1}</td>
                  <td className="py-1">£{mode.startingMoney}</td>
                  <td className="py-1">{mode.turnTimerSeconds} s</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-parchment-300">
            Places outside the mode’s rings, and their links, are drawn faded and aren’t part of the match. The timer can be turned off in Settings.
          </p>
        </Section>

        <Section title={`Your turn: ${RULES.actionsPerTurn} actions`}>
          <p className="mb-2">You may end your turn early. If the turn timer runs out, the actions you have left are lost.</p>
          <ul className="flex flex-col gap-2.5">
            <Rule name="Build an industry">
              On a free slot that allows it, in a town in your network. Your very first build of the match can go anywhere. Nothing can be built in{' '}
              {names(railOnly)} during the canal era. Pay the cost and gain the industry’s ★.
            </Rule>
            <Rule name="Build a link">
              An unbuilt route that exists in the current era and touches your network (anywhere, before your first build). A canal costs{' '}
              {formatCost(LINK_COST.canal)}; a railway {formatCost(LINK_COST.rail)}. +{RULES.linkPrestige}★, and the link is yours.
            </Rule>
            <Rule name="Ship">
              Pick one of your industries and a market it can reach:
              <ul className="mt-1 ml-4 list-disc">
                <li>a cotton mill sends all its cotton to a hub that buys cotton, or to any port (yours or another player’s);</li>
                <li>a coal mine sends all the coal in your store to a hub that buys coal;</li>
                <li>an iron works sends all the iron in your store to a hub that buys iron.</li>
              </ul>
              Goods travel over built links of the current era, anyone’s; the industry and the market may be in the same town. The way with the fewest
              opponent links is used, then the shortest. Each opponent link costs a £{RULES.toll} toll, paid to its owner. A hub pays its current price
              for each unit, and the price drops £{RULES.priceDropPerGoods} with each unit sold (never below £{RULES.priceFloor}): at £6, three units
              pay £6 + £5 + £4. A port pays £{RULES.portPrice} a unit; at another player’s port you pay them £{RULES.portFee} a unit. You earn +1★ per
              unit, doubled if the goods used {RULES.longHaulLinks} or more links. You can’t ship if your money plus the revenue won’t cover the tolls
              and fees. Afterwards the mill, or your coal or iron store, is empty.
            </Rule>
            <Rule name="Raise funds">Take £{RULES.raiseFunds}.</Rule>
            <Rule name="End turn">Ends your turn now.</Rule>
          </ul>
        </Section>

        <Section title="Industries">
          <ul className="grid gap-2 sm:grid-cols-2">
            {INDUSTRY_ORDER.map((kind) => {
              const def = INDUSTRIES[kind]
              return (
                <li key={kind} className="flex gap-3 rounded-lg border border-bronze-500/25 bg-soot-950/50 p-2.5">
                  <IndustryIcon kind={kind} className="mt-0.5 size-9 shrink-0" />
                  <div>
                    <p className="font-display font-bold tracking-wide text-parchment-50 uppercase">
                      {def.name} <span className="text-brass-300">+{def.prestige}★</span>
                    </p>
                    <p className="text-xs text-parchment-300">
                      {formatCost(def.cost)}
                      {def.cost.coal || def.cost.iron
                        ? ` (£${def.cost.money + def.cost.coal * RULES.coalPrice + def.cost.iron * RULES.ironPrice} with an empty store)`
                        : ''}
                    </p>
                    <p className="text-xs text-parchment-300">{def.output}.</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-parchment-300">
            Coal and iron you don’t have for a cost are bought for you from the general supply: £{RULES.coalPrice} a coal, £{RULES.ironPrice} an iron.
            Prices shown in the game include this. Your store holds up to {RULES.storeCap} coal and {RULES.storeCap} iron; what your mines and works
            make beyond that is sold for £{RULES.coalOverflowValue} a coal and £{RULES.ironOverflowValue} an iron.
          </p>
        </Section>

        <Section title="Your network">
          <p>
            Every town where you own an industry, plus both ends of every link you own. Hubs and stops count as towns. You may build anywhere only until
            your first build. If your network is later wiped out (say your only links were canals and the rail era removed them) you still build next to
            any town where you own an industry; if you own no industry either, you may build anywhere again, and the log says so.
          </p>
        </Section>

        <Section title="End of each round">
          <ol className="ml-4 list-decimal">
            <li>Industries produce (see above).</li>
            <li>Every player collects £{RULES.baseIncome}.</li>
            <li>Every hub’s price recovers £{RULES.priceRecovery}, up to its starting price.</li>
            <li>
              If the rail era begins next round, every canal link comes off the board. Owners keep the ★ they earned, and industries stay.
            </li>
            <li>After the last round, the match ends and is scored.</li>
          </ol>
        </Section>

        <Section title="Eras and the board">
          <p>
            The match starts in the canal era. Only the current era’s network is on the board: canal routes and “both” routes as canals first, then rail
            routes and “both” routes as railways. {names(railOnly)} (marked with a locomotive) can only be reached by rail, so they open in the rail era.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            <Picture src={LINK_SPACE_URL} alt="An empty connection bubble" wide>
              An empty bubble: a link nobody has built. It glows when you can build it.
            </Picture>
            <Picture src={HEX_LINK_URL} alt="A link hexagon">
              Two hexagons mark stops ({names(stops)}: routes pass through, no building or trade) and hubs.
            </Picture>
            <Picture src={TOKEN_URLS.canal.purple} alt="A built canal token" wide>
              A built canal, in its owner’s colour.
            </Picture>
            <Picture src={TOKEN_URLS.rail.purple} alt="A built rail token" wide>
              A built railway, in its owner’s colour.
            </Picture>
          </ul>
          <p className="mt-3">Trade hubs, and what they buy (the price on the badge is the current one):</p>
          <ul className="mt-1 ml-4 list-disc">
            {hubs.map((hub) => (
              <li key={hub.id}>
                <strong className="text-parchment-50">{hub.name}</strong>: starts at £{hub.price}, buys {hub.buys.join(', ')}
                {hub.era === 'rail' ? ' (rail era only)' : ''}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Practice maps">
          <p>
            {names(MAPS.filter((m) => m.style === 'schematic'))} are drawn maps without eras: canals and railways can be built at any time and nothing
            is removed.
            Their market towns work like hubs and buy cotton, coal and iron. Everything else is the same.
          </p>
        </Section>
      </div>
    </ModalFrame>
  )
}

/** A board piece and what it means. */
function Picture({ src, alt, wide = false, children }: { src: string | undefined; alt: string; wide?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-bronze-500/25 bg-soot-950/50 p-2.5">
      {src ? <img src={src} alt={alt} className={`${wide ? 'h-8 w-auto' : 'size-9'} shrink-0`} /> : <span className="size-9" />}
      <span className="text-xs text-parchment-300">{children}</span>
    </li>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="eyebrow mb-2 flex items-center gap-3">
        {title}
        <span className="h-px flex-1 bg-linear-to-r from-bronze-500/40 to-transparent" />
      </h3>
      {children}
    </section>
  )
}

function Rule({ name, children }: { name: string; children: ReactNode }) {
  return (
    <li>
      <span className="font-display font-bold tracking-wide text-parchment-50 uppercase">{name}.</span> {children}
    </li>
  )
}

/** Credits. */
export function CreditsModal({ open, onClose }: InfoModalProps) {
  return (
    <ModalFrame open={open} onClose={onClose} id="credits" title="Credits" icon={<IconStar />}>
      <div className="flex flex-col gap-5 text-center">
        <div>
          <p className="metal-text font-display text-4xl font-extrabold tracking-[0.2em] uppercase">Bronze</p>
          <p className="text-sm text-parchment-300">An original industrial-era strategy game</p>
        </div>
        <dl className="grid gap-3">
          {[
            ['Game design', 'The Bronze team'],
            ['Art & interface', 'The Bronze team'],
            ['Built with', 'React · TypeScript · Vite · Tailwind CSS'],
          ].map(([role, who]) => (
            <div key={role}>
              <dt className="eyebrow">{role}</dt>
              <dd className="text-parchment-100">{who}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-parchment-400">Thank you for playing the early build.</p>
      </div>
    </ModalFrame>
  )
}
