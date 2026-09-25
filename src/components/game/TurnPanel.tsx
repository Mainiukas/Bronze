import type { ReactNode } from 'react'
import {
  buildTargets,
  canAfford,
  currentPlayer,
  getTown,
  linkTargets,
  quote,
  shipQuotes,
  shipSources,
  type Quote,
} from '../../game/engine'
import { INDUSTRIES, INDUSTRY_ORDER, LINK_COST, RULES } from '../../game/rules'
import type { GameAction, GameState, IndustryKind } from '../../game/types'
import { Gear } from '../Gear'
import { IconClose } from '../icons'
import { seatColor } from './glyphs'
import { IndustryIcon } from './IndustryIcon'

/** What the current (human) player is in the middle of choosing. */
export type UiMode =
  | { type: 'idle' }
  | { type: 'build'; kind: IndustryKind | null }
  | { type: 'link' }
  | { type: 'ship'; buildingId: number | null }

interface TurnPanelProps {
  game: GameState
  ui: UiMode
  onUiChange: (ui: UiMode) => void
  onAction: (action: GameAction) => void
  error: string | null
  /** The move timer for this turn, if timed. */
  timer?: ReactNode
  onShowResults: () => void
}

/** "£11 (buys 1 iron)" */
function describeQuote(q: Quote): string {
  const bought = [q.coalBought && `${q.coalBought} coal`, q.ironBought && `${q.ironBought} iron`].filter(Boolean)
  const used = [q.coalUsed && `${q.coalUsed} coal`, q.ironUsed && `${q.ironUsed} iron`].filter(Boolean)
  const notes = [bought.length ? `buys ${bought.join(' + ')}` : '', used.length ? `uses ${used.join(' + ')}` : '']
    .filter(Boolean)
    .join(', ')
  return `£${q.total}${notes ? ` (${notes})` : ''}`
}

/** The controls for whoever's turn it is. */
export function TurnPanel({ game, ui, onUiChange, onAction, error, timer, onShowResults }: TurnPanelProps) {
  const player = currentPlayer(game)

  if (game.status === 'finished') {
    return (
      <Panel>
        <p className="font-display text-2xl font-extrabold tracking-[0.12em] text-parchment-50 uppercase">Match over</p>
        <p className="text-sm text-parchment-300">The final round has been played and the scores are in.</p>
        <button type="button" className="btn btn-primary mt-1 w-full" onClick={onShowResults}>
          See results
        </button>
      </Panel>
    )
  }

  const header = (
    <div className="flex items-center gap-3">
      <span className="size-3.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: seatColor(player.id), color: seatColor(player.id) }} />
      <p className="min-w-0 flex-1 font-display text-xl leading-tight font-extrabold tracking-[0.1em] text-parchment-50 uppercase">
        {player.isAI ? player.name : player.id === 0 ? 'Your turn' : `${player.name}’s turn`}
      </p>
      <span className="rounded-full border border-bronze-500/35 bg-soot-950/60 px-2.5 py-0.5 font-display text-sm font-semibold tracking-wide whitespace-nowrap text-bronze-200">
        Action {RULES.actionsPerTurn - game.actionsLeft + 1}/{RULES.actionsPerTurn}
      </span>
      {!player.isAI && timer}
    </div>
  )

  if (player.isAI) {
    return (
      <Panel>
        {header}
        <p className="flex items-center gap-2.5 text-parchment-300">
          <Gear teeth={10} holes={0} className="size-5 animate-[spin_2.5s_linear_infinite] text-bronze-400" />
          Planning the next move…
        </p>
      </Panel>
    )
  }

  return (
    <Panel>
      {header}
      {ui.type === 'idle' && <ActionMenu game={game} onUiChange={onUiChange} onAction={onAction} />}
      {ui.type === 'build' && <BuildPicker game={game} kind={ui.kind} onUiChange={onUiChange} onAction={onAction} />}
      {ui.type === 'link' && <LinkPicker game={game} onUiChange={onUiChange} onAction={onAction} />}
      {ui.type === 'ship' && (
        <ShipPicker game={game} buildingId={ui.buildingId} onUiChange={onUiChange} onAction={onAction} />
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-rust-400/40 bg-rust-500/10 px-3 py-2 text-sm text-rust-300">
          {error}
        </p>
      )}
    </Panel>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="plate rivets flex flex-col gap-4 p-4 sm:p-5">{children}</section>
}

interface PickerProps {
  game: GameState
  onUiChange: (ui: UiMode) => void
  onAction: (action: GameAction) => void
}

function ActionMenu({ game, onUiChange, onAction }: PickerProps) {
  const player = currentPlayer(game)
  const canBuild = INDUSTRY_ORDER.some((kind) => canAfford(player, INDUSTRIES[kind].cost) && buildTargets(game, kind).length > 0)
  const canLink = linkTargets(game).some((route) => canAfford(player, LINK_COST[route.kind]))
  const mills = shipSources(game)
  const cheapest = Math.min(...INDUSTRY_ORDER.map((kind) => quote(player, INDUSTRIES[kind].cost).total))

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <ActionButton title="Build industry" detail={canBuild ? `From £${cheapest}` : 'No plot you can afford'} disabled={!canBuild} onClick={() => onUiChange({ type: 'build', kind: null })} />
        <ActionButton
          title="Build link"
          detail={canLink ? `Canal £${LINK_COST.canal.money} · Rail £${LINK_COST.rail.money}+coal` : 'No route you can afford'}
          disabled={!canLink}
          onClick={() => onUiChange({ type: 'link' })}
        />
        <ActionButton
          title="Ship goods"
          detail={mills.length ? `${mills.length} mill${mills.length > 1 ? 's' : ''} ready` : 'No goods can reach a market'}
          disabled={mills.length === 0}
          highlight={mills.some((m) => m.goods >= RULES.millCapacity)}
          onClick={() => onUiChange({ type: 'ship', buildingId: mills.length === 1 ? mills[0].id : null })}
        />
        <ActionButton title="Raise funds" detail={`+£${RULES.raiseFunds}`} onClick={() => onAction({ type: 'raiseFunds' })} />
      </div>
      <button type="button" className="btn btn-ghost w-full" onClick={() => onAction({ type: 'endTurn' })}>
        End turn{game.actionsLeft > 1 ? ' (skip both actions)' : ''}
      </button>
    </div>
  )
}

function ActionButton({
  title,
  detail,
  disabled,
  highlight,
  onClick,
}: {
  title: string
  detail: string
  disabled?: boolean
  highlight?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex min-h-18 flex-col items-start justify-center gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 ${
        highlight
          ? 'border-brass-300/80 bg-linear-to-b from-bronze-500/30 to-soot-800 shadow-[0_0_20px_-6px_rgb(255_157_77/0.7)]'
          : 'border-bronze-500/35 bg-linear-to-b from-soot-700 to-soot-850 hover:border-bronze-300/70 hover:shadow-[0_0_18px_-6px_rgb(255_157_77/0.6)]'
      }`}
    >
      <span className="font-display text-lg leading-tight font-bold tracking-[0.08em] text-parchment-50 uppercase">{title}</span>
      <span className="text-xs leading-snug text-parchment-300">{detail}</span>
    </button>
  )
}

function PickerHeader({ title, hint, onCancel }: { title: string; hint: string; onCancel: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold tracking-[0.08em] text-parchment-50 uppercase">{title}</p>
        <p className="text-sm text-parchment-300">{hint}</p>
      </div>
      <button type="button" onClick={onCancel} className="icon-btn size-9 text-base" aria-label="Cancel">
        <IconClose />
      </button>
    </div>
  )
}

/** Clickable list item used for plots, routes, mills and markets. */
function Choice({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-bronze-500/30 bg-soot-950/60 px-3 py-2 text-left text-sm text-parchment-100 transition hover:border-ember-400/70 hover:bg-bronze-500/10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  )
}

function BuildPicker({ game, kind, onUiChange, onAction }: PickerProps & { kind: IndustryKind | null }) {
  const player = currentPlayer(game)
  const cancel = () => onUiChange({ type: 'idle' })

  if (kind === null) {
    return (
      <div className="flex flex-col gap-3">
        <PickerHeader title="Build an industry" hint="Choose what to build." onCancel={cancel} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {INDUSTRY_ORDER.map((option) => {
            const def = INDUSTRIES[option]
            const q = quote(player, def.cost)
            const plots = buildTargets(game, option).length
            const affordable = q.total <= player.money
            const reason = plots === 0 ? 'No free plot in your network' : affordable ? null : `Needs £${q.total}`
            return (
              <button
                key={option}
                type="button"
                disabled={reason !== null}
                onClick={() => onUiChange({ type: 'build', kind: option })}
                className="flex items-start gap-3 rounded-xl border border-bronze-500/30 bg-soot-950/60 p-3 text-left transition hover:border-ember-400/70 hover:bg-bronze-500/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-bronze-500/40 bg-soot-800 text-2xl text-bronze-200">
                  <IndustryIcon kind={option} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-base font-bold tracking-[0.06em] text-parchment-50 uppercase">
                    {def.name} <span className="text-brass-300">+{def.prestige}★</span>
                  </span>
                  <span className="text-xs text-parchment-300">{def.output}</span>
                  <span className="mt-0.5 text-xs font-semibold text-bronze-200">{reason ?? describeQuote(q)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const def = INDUSTRIES[kind]
  const plots = buildTargets(game, kind)
  return (
    <div className="flex flex-col gap-3">
      <PickerHeader
        title={`Build a ${def.name}`}
        hint={`${describeQuote(quote(player, def.cost))}. Pick a glowing plot on the board, or a town here.`}
        onCancel={() => onUiChange({ type: 'build', kind: null })}
      />
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
        {plots.map((plot) => {
          const town = getTown(game, plot.townId)
          const twin = plots.filter((p) => p.townId === plot.townId).length > 1
          return (
            <Choice key={`${plot.townId}#${plot.slot}`} onClick={() => onAction({ type: 'build', kind, ...plot })}>
              <span>
                {town.name}
                {twin && <span className="text-parchment-400"> · plot {plot.slot + 1}</span>}
              </span>
              {town.market !== null && <span className="text-xs text-brass-300">market £{game.prices[town.id]}</span>}
            </Choice>
          )
        })}
      </div>
    </div>
  )
}

function LinkPicker({ game, onUiChange, onAction }: PickerProps) {
  const player = currentPlayer(game)
  const routes = linkTargets(game)
  return (
    <div className="flex flex-col gap-3">
      <PickerHeader
        title="Build a link"
        hint={`Canals cost £${LINK_COST.canal.money}; railways £${LINK_COST.rail.money} and 1 coal. +${RULES.linkPrestige}★ each.`}
        onCancel={() => onUiChange({ type: 'idle' })}
      />
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
        {routes.map((route) => {
          const q = quote(player, LINK_COST[route.kind])
          return (
            <Choice key={route.id} disabled={q.total > player.money} onClick={() => onAction({ type: 'link', routeId: route.id })}>
              <span>
                {getTown(game, route.from).name} – {getTown(game, route.to).name}
                <span className="text-parchment-400"> · {route.kind === 'canal' ? 'canal' : 'railway'}</span>
              </span>
              <span className="text-xs font-semibold whitespace-nowrap text-bronze-200">{describeQuote(q)}</span>
            </Choice>
          )
        })}
      </div>
    </div>
  )
}

function ShipPicker({ game, buildingId, onUiChange, onAction }: PickerProps & { buildingId: number | null }) {
  const mills = shipSources(game)
  const cancel = () => onUiChange({ type: 'idle' })

  if (buildingId === null) {
    return (
      <div className="flex flex-col gap-3">
        <PickerHeader title="Ship goods" hint="Pick a mill with goods, on the board or here." onCancel={cancel} />
        <div className="flex flex-col gap-1.5">
          {mills.map((mill) => (
            <Choice key={mill.id} onClick={() => onUiChange({ type: 'ship', buildingId: mill.id })}>
              <span>Mill in {getTown(game, mill.townId).name}</span>
              <span className="text-xs font-semibold text-brass-300">{mill.goods} goods</span>
            </Choice>
          ))}
        </div>
      </div>
    )
  }

  const mill = game.buildings.find((b) => b.id === buildingId)!
  const quotes = shipQuotes(game, buildingId)
  return (
    <div className="flex flex-col gap-3">
      <PickerHeader
        title={`Ship ${mill.goods} goods`}
        hint={`From ${getTown(game, mill.townId).name}. Pick a glowing market. Each goods sold lowers its price by £${RULES.priceDropPerGoods}.`}
        onCancel={mills.length > 1 ? () => onUiChange({ type: 'ship', buildingId: null }) : cancel}
      />
      <div className="flex flex-col gap-1.5">
        {quotes.map((q) => (
          <Choice key={q.marketId} onClick={() => onAction({ type: 'ship', buildingId, marketId: q.marketId })}>
            <span>
              {getTown(game, q.marketId).name}
              <span className="text-parchment-400">
                {' '}
                · {q.routeIds.length === 0 ? 'sold here' : `${q.routeIds.length} link${q.routeIds.length === 1 ? '' : 's'}`}
                {q.tollTotal ? ` · £${q.tollTotal} toll` : ''}
              </span>
            </span>
            <span className="text-xs font-semibold whitespace-nowrap text-brass-300">
              +£{q.revenue - q.tollTotal} · +{q.prestige}★
            </span>
          </Choice>
        ))}
      </div>
    </div>
  )
}
