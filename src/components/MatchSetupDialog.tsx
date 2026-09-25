import { useState } from 'react'
import type { GameMode } from '../data/gameModes'
import type { GameMap } from '../data/maps'
import { AI_NAMES } from '../game/rules'
import type { SeatSetup } from '../game/types'
import { seatColor } from './game/glyphs'
import { IconPlay } from './icons'
import { ModalFrame } from './ModalFrame'

interface MatchSetupDialogProps {
  open: boolean
  onClose: () => void
  mode: GameMode
  map: GameMap
  /** A saved match will be replaced. */
  replacesMatch: boolean
  onStart: (seats: SeatSetup[]) => void
}

type SeatKind = 'computer' | 'human'

/** Choose how many players and who controls each seat, then start. */
export function MatchSetupDialog({ open, onClose, mode, map, replacesMatch, onStart }: MatchSetupDialogProps) {
  const { min, max } = map.players
  const [requested, setRequested] = useState(3)
  const [kinds, setKinds] = useState<SeatKind[]>(['human', 'computer', 'computer', 'computer'])
  // Clamp to what this map supports (the map can change while the dialog is closed).
  const count = Math.min(max, Math.max(min, requested))

  const seats: SeatSetup[] = Array.from({ length: count }, (_, i) =>
    i === 0
      ? { name: 'You', isAI: false }
      : kinds[i] === 'computer'
        ? { name: AI_NAMES[i - 1], isAI: true }
        : { name: `Player ${i + 1}`, isAI: false },
  )

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      id="match-setup"
      title="New match"
      icon={<IconPlay />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary px-6" onClick={() => onStart(seats)}>
            Start match
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-parchment-200">
          <span className="font-semibold text-parchment-50">{mode.name}</span> on{' '}
          <span className="font-semibold text-parchment-50">{map.name}</span>: {mode.rounds} rounds, £
          {mode.startingMoney} to start, {mode.turnTimerSeconds}s per turn with the move timer on.
        </p>

        <fieldset>
          <legend className="eyebrow mb-2">Players</legend>
          <div className="flex gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <label
                key={n}
                className={`flex-1 cursor-pointer rounded-lg border py-2 text-center font-display text-xl font-bold transition has-focus-visible:outline-2 has-focus-visible:outline-brass-300 ${
                  n === count
                    ? 'border-bronze-300/80 bg-bronze-500/20 text-parchment-50'
                    : 'border-bronze-500/30 bg-soot-950/60 text-parchment-300 hover:border-bronze-400/60'
                }`}
              >
                <input type="radio" name="player-count" value={n} checked={n === count} onChange={() => setRequested(n)} className="sr-only" />
                {n}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2">Seats</legend>
          <ul className="flex flex-col gap-2">
            {seats.map((seat, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-bronze-500/20 bg-soot-950/50 px-3 py-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: seatColor(i) }} />
                <span className="min-w-0 flex-1 truncate font-semibold text-parchment-50">{seat.name}</span>
                {i === 0 ? (
                  <span className="text-sm text-parchment-400">This device</span>
                ) : (
                  <div className="flex overflow-hidden rounded-md border border-bronze-500/35" role="group" aria-label={`Seat ${i + 1} is played by`}>
                    {(['computer', 'human'] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={kinds[i] === kind}
                        onClick={() => setKinds((prev) => prev.map((k, j) => (j === i ? kind : k)))}
                        className={`px-2.5 py-1 text-xs font-semibold tracking-wide uppercase transition ${
                          kinds[i] === kind ? 'bg-bronze-500/30 text-parchment-50' : 'text-parchment-400 hover:text-parchment-100'
                        }`}
                      >
                        {kind === 'computer' ? 'Computer' : 'Pass & play'}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-parchment-400">Pass & play seats take turns on this device.</p>
        </fieldset>

        {replacesMatch && (
          <p className="rounded-lg border border-dashed border-bronze-500/40 px-3 py-2 text-sm text-parchment-300">
            Starting a new match replaces the one in progress.
          </p>
        )}
      </div>
    </ModalFrame>
  )
}
