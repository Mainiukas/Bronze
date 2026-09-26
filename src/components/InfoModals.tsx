import type { ReactNode } from 'react'
import { formatCost } from '../game/engine'
import { INDUSTRIES, INDUSTRY_ORDER, LINK_COST, RULES } from '../game/rules'
import { IndustryIcon } from './game/IndustryIcon'
import { IconBook, IconStar } from './icons'
import { ModalFrame } from './ModalFrame'

interface InfoModalProps {
  open: boolean
  onClose: () => void
}

/** The rules. Numbers come from game/rules.ts so this never drifts from the engine. */
export function HowToPlayModal({ open, onClose }: InfoModalProps) {
  return (
    <ModalFrame open={open} onClose={onClose} id="how-to-play" title="How to Play" icon={<IconBook />}>
      <div className="flex flex-col gap-6 text-sm leading-relaxed text-parchment-200">
        <Section title="Goal">
          <p>
            Earn the most <strong className="text-brass-300">prestige ★</strong> by the end of the last round. You get
            it by building industries and links, and above all by shipping goods from your mills to market towns.
          </p>
        </Section>

        <Section title={`Your turn: ${RULES.actionsPerTurn} actions`}>
          <ul className="flex flex-col gap-2.5">
            <Rule name="Build an industry">
              In a town in your network. Your very first build can go anywhere. Each plot shows what it allows.
            </Rule>
            <Rule name="Build a link">
              A canal ({formatCost(LINK_COST.canal)}) or railway ({formatCost(LINK_COST.rail)}) on a route touching your
              network. +{RULES.linkPrestige}★.
            </Rule>
            <Rule name="Ship goods">
              Send all goods from one of your goods industries to a market that buys them, over built links (anyone’s).
              Market towns and hubs pay their current price, which drops £{RULES.priceDropPerGoods} per goods sold and
              recovers £1 a round. +1★ per goods, doubled when the goods travel {RULES.longHaulLinks} or more links. Using
              an opponent’s link costs a £{RULES.toll} toll, paid to them.
            </Rule>
            <Rule name="Raise funds">Take £{RULES.raiseFunds}.</Rule>
          </ul>
          <p className="mt-3 text-parchment-300">
            Your <strong className="text-parchment-100">network</strong> is every town where you own an industry or that
            one of your links touches. Missing coal or iron is bought automatically (£{RULES.coalPrice} coal, £
            {RULES.ironPrice} iron).
          </p>
        </Section>

        <Section title="Industries">
          <ul className="grid gap-2 sm:grid-cols-2">
            {INDUSTRY_ORDER.map((kind) => {
              const def = INDUSTRIES[kind]
              return (
                <li key={kind} className="flex gap-3 rounded-lg border border-bronze-500/25 bg-soot-950/50 p-2.5">
                  <IndustryIcon kind={kind} className="mt-0.5 size-6 shrink-0 text-bronze-300" />
                  <div>
                    <p className="font-display font-bold tracking-wide text-parchment-50 uppercase">
                      {def.name} <span className="text-brass-300">+{def.prestige}★</span>
                    </p>
                    <p className="text-xs text-parchment-300">
                      {formatCost(def.cost)} · {def.output}
                      {kind === 'works' ? ' (original maps only)' : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section title="Wales & the West">
          <ul className="flex flex-col gap-2.5">
            <Rule name="Eras">
              The match starts in the canal era and switches to the rail era half way through. You can only build routes
              of the current era: canal-only routes early, rail-only routes late, and routes drawn with both tracks as
              whichever the era allows. Links already built keep carrying goods.
            </Rule>
            <Rule name="Trade hubs">
              The North, London and West Wales buy only the goods shown on their plaques, at the price in the corner.
              They can’t be built in, but links to them count toward your network.
            </Rule>
            <Rule name="Ports">
              Buy any goods for a flat £{RULES.portPrice}. If you sell at someone else’s port, they get £{RULES.portFee} per
              goods. A shipyard needs a port in the same town.
            </Rule>
            <Rule name="Stops">Brecon, Lichfield and Taunton carry routes but have no building plots.</Rule>
            <Rule name="Smaller modes">Blitz and Bullet close the outer towns; they’re drawn faded.</Rule>
          </ul>
        </Section>

        <Section title="End of each round">
          <p>
            Industries produce, everyone collects £{RULES.baseIncome}, and market prices recover by £1. You can store up
            to {RULES.storeCap} coal and {RULES.storeCap} iron; extra output is sold for £{RULES.coalOverflowValue} per
            coal and £{RULES.ironOverflowValue} per iron.
          </p>
        </Section>

        <Section title="End of the match">
          <p>
            After the last round, add +1★ per £{RULES.moneyPerPrestige} you have and +{RULES.marketBonus}★ for each
            market town in your network. Highest total wins; ties go to the richer player.
          </p>
        </Section>

        <p className="rounded-lg border border-dashed border-bronze-500/30 bg-soot-950/50 px-4 py-3 text-parchment-300">
          Modes change the board size, the number of rounds and the move timer. Turn the timer off in Settings to play
          at your own pace.
        </p>
      </div>
    </ModalFrame>
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
