import type { ReactNode } from 'react'
import {
  buildBlocker,
  buildTargets,
  currentPlayer,
  getRoute,
  getTown,
  industriesOn,
  linkBlocker,
  linkCost,
  linkKindNow,
  linkTargets,
  quote,
  routeName,
  shipBlocker,
  shipment,
  shipOptions,
  shipSources,
} from '../../game/engine'
import { GOODS_NAMES, INDUSTRIES, LINK_COST, RULES } from '../../game/rules'
import type { GameAction, GameState, IndustryKind } from '../../game/types'
import { IconClose } from '../icons'
import { describeQuote, payoutLabel } from './format'
import { IndustryIcon } from './IndustryIcon'

/** What the current (human) player is in the middle of choosing. Nothing happens until it's confirmed. */
export type UiMode =
  | { type: 'idle' }
  | { type: 'build'; kind: IndustryKind | null }
  | { type: 'link' }
  | { type: 'ship'; buildingId: number | null; marketId: string | null }

interface ActionBarProps {
  game: GameState
  ui: UiMode
  onUiChange: (ui: UiMode) => void
  onAction: (action: GameAction) => void
}

/** The action controls for the active human player. */
export function ActionBar({ game, ui, onUiChange, onAction }: ActionBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {ui.type === 'idle' && <ActionMenu game={game} onUiChange={onUiChange} onAction={onAction} />}
      {ui.type === 'build' && <BuildPicker game={game} kind={ui.kind} onUiChange={onUiChange} onAction={onAction} />}
      {ui.type === 'link' && <LinkPicker game={game} onUiChange={onUiChange} onAction={onAction} />}
      {ui.type === 'ship' && <ShipPicker game={game} buildingId={ui.buildingId} marketId={ui.marketId} onUiChange={onUiChange} onAction={onAction} />}
    </div>
  )
}

interface PickerProps {
  game: GameState
  onUiChange: (ui: UiMode) => void
  onAction: (action: GameAction) => void
}

function ActionMenu({ game, onUiChange, onAction }: PickerProps) {
  const player = currentPlayer(game)
  const kinds = industriesOn(game.board)
  const buildReasons = kinds.map((kind) => buildBlocker(game, kind))
  const canBuild = buildReasons.some((r) => r === null)
  const cheapest = Math.min(...kinds.filter((_, i) => buildReasons[i] === null).map((kind) => quote(player, INDUSTRIES[kind].cost).total))
  // The most useful reason to show when nothing can be built: the cheapest "Needs £…", else the first.
  const needs = buildReasons.filter((r): r is string => !!r && r.startsWith('Needs')).sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
  const buildReason = needs[0] ?? buildReasons.find((r) => r) ?? ''
  const linkReason = linkBlocker(game)
  const linkDetail =
    game.era === 'canal'
      ? `Canal £${LINK_COST.canal.money}`
      : game.era === 'rail'
        ? `Railway ${describeQuote(quote(player, LINK_COST.rail))}`
        : `Canal £${LINK_COST.canal.money} · Railway £${LINK_COST.rail.money} + coal`
  const shipReason = shipBlocker(game)
  const sources = shipSources(game)
  const actionsWord = game.actionsLeft === 1 ? 'the last action' : 'both actions'

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
      <ActionButton title="Build industry" detail={canBuild ? `From £${cheapest}` : buildReason} disabled={!canBuild} onClick={() => onUiChange({ type: 'build', kind: null })} />
      <ActionButton title="Build link" detail={linkReason ?? linkDetail} disabled={linkReason !== null} onClick={() => onUiChange({ type: 'link' })} />
      <ActionButton
        title="Ship"
        detail={shipReason ?? `${sources.length} source${sources.length === 1 ? '' : 's'} ready`}
        disabled={shipReason !== null}
        highlight={sources.some((b) => INDUSTRIES[b.kind].ships === 'cotton' && b.goods >= RULES.goodsCapacity)}
        onClick={() => onUiChange({ type: 'ship', buildingId: sources.length === 1 ? sources[0].id : null, marketId: null })}
      />
      <ActionButton title="Raise funds" detail={`+£${RULES.raiseFunds}`} onClick={() => onAction({ type: 'raiseFunds' })} />
      <ActionButton title="End turn" detail={`Skips ${actionsWord}`} quiet onClick={() => onAction({ type: 'endTurn' })} />
    </div>
  )
}

function ActionButton({
  title,
  detail,
  disabled,
  highlight,
  quiet,
  onClick,
  className = '',
}: {
  title: string
  detail: string
  disabled?: boolean
  highlight?: boolean
  quiet?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${
        highlight
          ? 'border-brass-300/80 bg-linear-to-b from-bronze-500/30 to-soot-800 shadow-[0_0_20px_-6px_rgb(255_157_77/0.7)]'
          : quiet
            ? 'border-bronze-500/25 bg-soot-900/80 hover:border-bronze-300/60'
            : 'border-bronze-500/35 bg-linear-to-b from-soot-700 to-soot-850 hover:border-bronze-300/70 hover:shadow-[0_0_18px_-6px_rgb(255_157_77/0.6)]'
      } ${className}`}
    >
      <span className="font-display text-base leading-tight font-bold tracking-[0.08em] text-parchment-50 uppercase">{title}</span>
      <span className={`text-xs leading-snug ${disabled ? 'text-rust-300' : 'text-parchment-300'}`}>{detail}</span>
    </button>
  )
}

function PickerHeader({ title, hint, onBack, onCancel }: { title: string; hint: ReactNode; onBack?: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight font-bold tracking-[0.08em] text-parchment-50 uppercase">{title}</p>
        <p className="text-sm text-parchment-300">{hint}</p>
      </div>
      {onBack && (
        <button type="button" onClick={onBack} className="btn btn-ghost px-3 text-sm">
          Back
        </button>
      )}
      <button type="button" onClick={onCancel} className="btn btn-ghost px-3 text-sm" aria-label="Cancel this action">
        <IconClose className="size-4" />
        <span>Cancel</span>
      </button>
    </div>
  )
}

/** A choice in a list (plots, routes, sources, markets). */
function Choice({ children, onClick, disabled, selected, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; selected?: boolean; title?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-left text-sm text-parchment-100 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? 'border-brass-300 bg-bronze-500/25' : 'border-bronze-500/30 bg-soot-950/60 hover:border-ember-400/70 hover:bg-bronze-500/10'
      }`}
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
      <>
        <PickerHeader title="Build an industry" hint="Choose what to build. Prices include any coal or iron bought for you." onCancel={cancel} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {industriesOn(game.board).map((option) => {
            const def = INDUSTRIES[option]
            const q = quote(player, def.cost)
            const reason = buildBlocker(game, option)
            return (
              <button
                key={option}
                type="button"
                disabled={reason !== null}
                onClick={() => onUiChange({ type: 'build', kind: option })}
                className="flex items-start gap-3 rounded-xl border border-bronze-500/30 bg-soot-950/60 p-2.5 text-left transition hover:border-ember-400/70 hover:bg-bronze-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IndustryIcon kind={option} className="size-10 shrink-0 rounded-lg border border-bronze-500/40 bg-soot-800" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-sm font-bold tracking-[0.06em] text-parchment-50 uppercase">
                    {def.name} <span className="text-brass-300">+{def.prestige}★</span>
                  </span>
                  <span className="text-xs text-parchment-300">{def.output}</span>
                  <span className={`mt-0.5 text-xs font-semibold ${reason ? 'text-rust-300' : 'text-bronze-200'}`}>{reason ?? describeQuote(q)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </>
    )
  }

  const def = INDUSTRIES[kind]
  const plots = buildTargets(game, kind)
  return (
    <>
      <PickerHeader
        title={`Build a ${def.name}`}
        hint={
          <>
            {describeQuote(quote(player, def.cost))}, +{def.prestige}★. <strong className="text-brass-200">Click a glowing slot</strong> on the board, or pick one here.
          </>
        }
        onBack={() => onUiChange({ type: 'build', kind: null })}
        onCancel={cancel}
      />
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {plots.map((plot) => {
          const town = getTown(game, plot.townId)
          return (
            <button
              key={`${plot.townId}#${plot.slot}`}
              type="button"
              onClick={() => onAction({ type: 'build', kind, ...plot })}
              className="min-h-10 rounded-lg border border-bronze-500/30 bg-soot-950/60 px-3 text-sm text-parchment-100 transition hover:border-ember-400/70"
            >
              {town.name} <span className="text-parchment-400">· slot {plot.slot + 1}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function LinkPicker({ game, onUiChange, onAction }: PickerProps) {
  const player = currentPlayer(game)
  const routes = linkTargets(game)
  return (
    <>
      <PickerHeader
        title="Build a link"
        hint={
          <>
            {game.era === 'canal'
              ? `Canal era: canals cost £${LINK_COST.canal.money}.`
              : game.era === 'rail'
                ? `Rail era: railways cost £${LINK_COST.rail.money} + 1 coal (bought for £${RULES.coalPrice} if you have none).`
                : `Canals £${LINK_COST.canal.money}; railways £${LINK_COST.rail.money} + 1 coal.`}{' '}
            +{RULES.linkPrestige}★. <strong className="text-brass-200">Click a glowing bubble</strong>, or pick one here.
          </>
        }
        onCancel={() => onUiChange({ type: 'idle' })}
      />
      <div className="grid max-h-60 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-1">
        {routes.map((route) => {
          const q = quote(player, linkCost(game, route))
          return (
            <Choice key={route.id} disabled={q.total > player.money} onClick={() => onAction({ type: 'link', routeId: route.id })} title={q.total > player.money ? `Needs £${q.total}` : undefined}>
              <span>
                {routeName(game, route)}
                <span className="text-parchment-400"> · {linkKindNow(game, route) === 'canal' ? 'canal' : 'railway'}</span>
              </span>
              <span className={`text-xs font-semibold whitespace-nowrap ${q.total > player.money ? 'text-rust-300' : 'text-bronze-200'}`}>
                {q.total > player.money ? `Needs £${q.total}` : describeQuote(q)}
              </span>
            </Choice>
          )
        })}
      </div>
    </>
  )
}

/** "Cotton mill, Birmingham · 3 cotton" / "Coal mine, Stoke · 4 coal in your store" */
function sourceLabel(game: GameState, buildingId: number): { name: string; load: string } {
  const b = game.buildings.find((x) => x.id === buildingId)!
  const load = shipment(game, b)!
  return {
    name: `${INDUSTRIES[b.kind].name}, ${getTown(game, b.townId).name}`,
    load: `${load.amount} ${GOODS_NAMES[load.goods]}${load.goods === 'cotton' ? '' : ' in your store'}`,
  }
}

function ShipPicker({ game, buildingId, marketId, onUiChange, onAction }: PickerProps & { buildingId: number | null; marketId: string | null }) {
  const sources = shipSources(game)
  const cancel = () => onUiChange({ type: 'idle' })

  if (buildingId === null) {
    return (
      <>
        <PickerHeader
          title="Ship"
          hint={
            <>
              Choose what to ship: a mill’s cotton, or all the coal or iron in your store from one of your mines or works.{' '}
              <strong className="text-brass-200">Glowing tiles</strong> on the board work too.
            </>
          }
          onCancel={cancel}
        />
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {sources.map((source) => {
            const label = sourceLabel(game, source.id)
            return (
              <Choice key={source.id} onClick={() => onUiChange({ type: 'ship', buildingId: source.id, marketId: null })}>
                <span className="flex items-center gap-2">
                  <IndustryIcon kind={source.kind} className="size-6" />
                  {label.name}
                </span>
                <span className="text-xs font-semibold text-brass-300">{label.load}</span>
              </Choice>
            )
          })}
        </div>
      </>
    )
  }

  const label = sourceLabel(game, buildingId)
  const options = shipOptions(game, buildingId)
  const back = sources.length > 1 ? () => onUiChange({ type: 'ship', buildingId: null, marketId: null }) : undefined
  const chosen = options.find((q) => q.marketId === marketId)

  if (!chosen) {
    return (
      <>
        <PickerHeader
          title={`Ship ${label.load.replace(' in your store', '')}`}
          hint={
            <>
              From {label.name}. <strong className="text-brass-200">Click a glowing market</strong> on the board, or pick one here, to see what it pays.
            </>
          }
          onBack={back}
          onCancel={cancel}
        />
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {options.map((q) => (
            <Choice
              key={q.marketId}
              disabled={!q.affordable}
              onClick={() => onUiChange({ type: 'ship', buildingId, marketId: q.marketId })}
              title={q.affordable ? undefined : `You can’t pay the £${q.tollTotal + q.fee} in tolls and fees`}
            >
              <span>
                {q.marketName}
                <span className="text-parchment-400"> · {q.routeIds.length === 0 ? 'same town' : `${q.routeIds.length} link${q.routeIds.length === 1 ? '' : 's'}`}</span>
              </span>
              <span className={`text-xs font-semibold whitespace-nowrap ${q.affordable ? 'text-brass-300' : 'text-rust-300'}`}>
                {q.affordable ? payoutLabel(q) : 'Can’t afford tolls'}
              </span>
            </Choice>
          ))}
        </div>
      </>
    )
  }

  const hub = chosen.portOwner === null
  const price = hub ? game.prices[chosen.marketId] : RULES.portPrice
  const units = Array.from({ length: chosen.amount }, (_, i) => (hub ? Math.max(RULES.priceFloor, price - i * RULES.priceDropPerGoods) : price))
  const rows: [string, string, string?][] = [
    ['Revenue', `+£${chosen.revenue}`, `${chosen.amount} × ${GOODS_NAMES[chosen.goods]}: ${units.map((u) => `£${u}`).join(' + ')}`],
    [
      'Tolls',
      chosen.tollTotal ? `−£${chosen.tollTotal}` : '£0',
      Object.entries(chosen.tollsByOwner)
        .map(([owner, n]) => `${game.players[Number(owner)].name} £${n * RULES.toll}`)
        .join(', ') || 'Only your own links',
    ],
    ['Port fee', chosen.fee ? `−£${chosen.fee}` : '£0', chosen.feeOwner !== null ? `£${RULES.portFee} a unit to ${game.players[chosen.feeOwner].name}` : undefined],
    ['You get', `${chosen.net >= 0 ? '+' : '−'}£${Math.abs(chosen.net)}`],
    [
      'Prestige',
      `+${chosen.prestige}★`,
      chosen.routeIds.length >= RULES.longHaulLinks ? `doubled: ${chosen.routeIds.length} links` : `${chosen.routeIds.length} link${chosen.routeIds.length === 1 ? '' : 's'}`,
    ],
  ]
  return (
    <>
      <PickerHeader
        title={`Ship to ${chosen.marketName}`}
        hint={
          <>
            {label.load.replace(' in your store', '')} from {label.name}
            {chosen.routeIds.length ? ` via ${chosen.routeIds.map((id) => routeName(game, getRoute(game, id))).join(', ')}` : ''}.
            {hub && ` ${chosen.marketName}’s price then drops to £${Math.max(RULES.priceFloor, price - chosen.amount * RULES.priceDropPerGoods)}.`}
          </>
        }
        onBack={() => onUiChange({ type: 'ship', buildingId, marketId: null })}
        onCancel={cancel}
      />
      <dl className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-3 gap-y-1 rounded-lg border border-bronze-500/25 bg-soot-950/60 px-3 py-2 text-sm tabular-nums">
        {rows.map(([name, value, note]) => (
          <div key={name} className="contents">
            <dt className="text-parchment-400">{name}</dt>
            <dd className={`text-right font-display font-bold ${name === 'You get' || name === 'Prestige' ? 'text-brass-200' : 'text-parchment-100'}`}>{value}</dd>
            <dd className="text-xs text-parchment-400">{note}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn btn-primary w-full" onClick={() => onAction({ type: 'ship', buildingId, marketId: chosen.marketId })}>
        Confirm shipment
      </button>
    </>
  )
}
