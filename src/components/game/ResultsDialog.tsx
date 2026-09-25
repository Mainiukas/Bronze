import type { Achievement } from '../../data/achievements'
import type { GameState } from '../../game/types'
import { IconStar } from '../icons'
import { ModalFrame } from '../ModalFrame'
import { seatColor } from './glyphs'

interface ResultsDialogProps {
  open: boolean
  onClose: () => void
  game: GameState
  /** Achievements this match unlocked for you. */
  unlocked: Achievement[]
  onRematch: () => void
  onLeave: () => void
}

/** Final standings with the score breakdown, and what to do next. */
export function ResultsDialog({ open, onClose, game, unlocked, onRematch, onLeave }: ResultsDialogProps) {
  const scores = game.scores ?? []
  const winners = scores.filter((s) => s.rank === 1).map((s) => game.players[s.player])
  const youWon = winners.some((p) => p.id === 0 && !p.isAI)
  const headline =
    winners.length > 1 ? 'A shared victory' : youWon ? 'You win!' : `${winners[0]?.name ?? 'Nobody'} wins`

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      id="results"
      title="Results"
      icon={<IconStar />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onLeave}>
            Main menu
          </button>
          <button type="button" className="btn btn-primary px-6" onClick={onRematch}>
            Rematch
          </button>
        </>
      }
    >
      <p className="metal-text text-center font-display text-4xl font-extrabold tracking-[0.1em] uppercase text-balance">
        {headline}
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[0.65rem] tracking-[0.15em] text-parchment-400 uppercase">
              <th className="pb-2 font-semibold">Player</th>
              <th className="pb-2 text-right font-semibold" title="Prestige earned during play">Play</th>
              <th className="pb-2 text-right font-semibold" title="+1 per £5 left">Money</th>
              <th className="pb-2 text-right font-semibold" title="+2 per market in your network">Markets</th>
              <th className="pb-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score) => {
              const player = game.players[score.player]
              return (
                <tr key={score.player} className="border-t border-bronze-500/15">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="w-4 font-display font-bold text-parchment-400">{score.rank}</span>
                      <span className="size-2.5 rounded-full" style={{ background: seatColor(player.id) }} />
                      <span className="font-semibold text-parchment-50">{player.name}</span>
                    </span>
                  </td>
                  <td className="text-right text-parchment-200">{score.prestige}</td>
                  <td className="text-right text-parchment-200">+{score.moneyBonus}</td>
                  <td className="text-right text-parchment-200">+{score.marketBonus}</td>
                  <td className="text-right font-display text-lg font-extrabold text-brass-300">{score.total}★</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {unlocked.length > 0 && (
        <div className="mt-5 rounded-xl border border-brass-300/40 bg-bronze-500/10 px-4 py-3">
          <p className="eyebrow mb-2">Achievements unlocked</p>
          <ul className="flex flex-col gap-1.5">
            {unlocked.map((achievement) => (
              <li key={achievement.id} className="flex items-baseline gap-2 text-sm">
                <span className="font-display text-base font-bold tracking-wide text-brass-200">{achievement.name}</span>
                <span className="text-parchment-300">{achievement.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalFrame>
  )
}
