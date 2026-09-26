import { currentPlayerId, scoreFor } from '../../game/engine'
import type { GameState } from '../../game/types'
import { PlayerSwatch } from './PlayerSwatch'

const LEVEL_NAME = { easy: 'Easy AI', normal: 'Normal AI', hard: 'Hard AI' } as const

/** Every player: colour, name, money, coal, iron, ★, what they own, and whose turn it is. */
export function PlayersPanel({ game, colorBlind }: { game: GameState; colorBlind: boolean }) {
  const active = game.status === 'playing' ? currentPlayerId(game) : null
  return (
    <section className="plate rivets p-3 sm:p-4" aria-label="Players">
      <h2 className="eyebrow mb-2.5">Players</h2>
      <ul className="flex flex-col gap-2">
        {game.players.map((player) => {
          const score = scoreFor(game, player.id)
          const industries = game.buildings.filter((b) => b.owner === player.id).length
          const links = Object.values(game.links).filter((link) => link.owner === player.id).length
          const isActive = player.id === active
          return (
            <li
              key={player.id}
              aria-current={isActive ? 'true' : undefined}
              className={`rounded-xl border px-3 py-2 transition-colors ${
                isActive ? 'border-bronze-300/70 bg-bronze-500/15 shadow-[0_0_16px_-6px_rgb(255_157_77/0.6)]' : 'border-bronze-500/15 bg-soot-950/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PlayerSwatch color={player.color} letter={colorBlind} className="size-4.5" />
                <span className="min-w-0 flex-1 truncate font-display text-base font-bold tracking-[0.06em] text-parchment-50">
                  {player.name}
                  <span className="ml-1.5 text-[0.65rem] font-semibold tracking-wider text-parchment-400 uppercase">
                    {player.aiLevel ? LEVEL_NAME[player.aiLevel] : 'Human'}
                  </span>
                </span>
                {isActive && (
                  <span className="rounded-full bg-ember-500/20 px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.15em] text-ember-300 uppercase">
                    Turn
                  </span>
                )}
                <span className="font-display text-xl font-extrabold text-brass-300 tabular-nums" title="Prestige earned so far">
                  {player.prestige}★
                </span>
              </div>
              <dl className="mt-1 grid grid-cols-6 gap-1 text-center text-xs text-parchment-300 tabular-nums">
                <Stat label="Money" value={`£${player.money}`} />
                <Stat label="Coal" value={player.coal} />
                <Stat label="Iron" value={player.iron} />
                <Stat label="Ind." value={industries} title={`${industries} industries owned`} />
                <Stat label="Links" value={links} title={`${links} links owned now (${player.linksBuilt} built in all)`} />
                <Stat label="If ended" value={`${score.total}★`} title={`Score if the match ended now: ${score.prestige}★ + ${score.moneyBonus} for money + ${score.hubBonus} for hubs`} />
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
      <dt className="text-[0.58rem] tracking-[0.1em] text-parchment-500 uppercase">{label}</dt>
      <dd className="font-semibold text-parchment-100">{value}</dd>
    </div>
  )
}
