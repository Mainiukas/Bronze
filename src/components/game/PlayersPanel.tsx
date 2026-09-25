import { currentPlayerId, scoreFor } from '../../game/engine'
import type { GameState } from '../../game/types'
import { seatColor } from './glyphs'

/** Standings: each player's prestige, money, stock and holdings. */
export function PlayersPanel({ game }: { game: GameState }) {
  const active = game.status === 'playing' ? currentPlayerId(game) : null
  return (
    <section className="plate rivets p-4 sm:p-5" aria-label="Players">
      <h2 className="eyebrow mb-3">Players</h2>
      <ul className="flex flex-col gap-2">
        {game.players.map((player) => {
          const score = scoreFor(game, player.id)
          const industries = game.buildings.filter((b) => b.owner === player.id).length
          const links = Object.values(game.links).filter((owner) => owner === player.id).length
          const isActive = player.id === active
          return (
            <li
              key={player.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                isActive ? 'border-bronze-300/60 bg-bronze-500/10' : 'border-bronze-500/15 bg-soot-950/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: seatColor(player.id) }} />
                <span className="min-w-0 flex-1 truncate font-display text-base font-bold tracking-[0.06em] text-parchment-50">
                  {player.name}
                  {player.isAI && <span className="ml-1.5 text-xs font-semibold tracking-wider text-parchment-400">CPU</span>}
                </span>
                {isActive && (
                  <span className="rounded-full bg-ember-500/20 px-2 py-0.5 text-[0.65rem] font-bold tracking-[0.15em] text-ember-300 uppercase">
                    Playing
                  </span>
                )}
                <span className="font-display text-xl font-extrabold text-brass-300 tabular-nums" title="Prestige earned so far">
                  {player.prestige}★
                </span>
              </div>
              <dl className="mt-1.5 grid grid-cols-5 gap-1 text-center text-xs text-parchment-300 tabular-nums">
                <Stat label="Money" value={`£${player.money}`} />
                <Stat label="Coal" value={player.coal} />
                <Stat label="Iron" value={player.iron} />
                <Stat label="Built" value={industries + links} title={`${industries} industries, ${links} links`} />
                <Stat label="If ended" value={`${score.total}★`} title="Score if the match ended now, with money and market bonuses" />
              </dl>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Stat({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div title={title}>
      <dt className="text-[0.6rem] tracking-[0.12em] text-parchment-500 uppercase">{label}</dt>
      <dd className="font-semibold text-parchment-100">{value}</dd>
    </div>
  )
}
