import { useState } from 'react'
import { formatDuration, GAME_MODES, getGameMode, type GameModeId } from '../data/gameModes'
import { getMap, MAPS, type MapId } from '../data/maps'
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/engine'
import { AI_NAMES } from '../game/rules'
import { AI_LEVELS, PLAYER_COLORS, type AILevel, type PlayerColor, type SeatSetup } from '../game/types'
import { usePersistentState } from '../hooks/usePersistentState'
import { randomSeed } from '../lib/random'
import { STORAGE_KEYS } from '../lib/storage'
import { PLAYER_STYLE } from './game/glyphs'
import { IconPlay } from './icons'
import { ModalFrame } from './ModalFrame'

/** Everything a new match needs. */
export interface MatchSetup {
  modeId: GameModeId
  mapId: MapId
  seats: SeatSetup[]
  seed: number
}

interface MatchSetupDialogProps {
  open: boolean
  onClose: () => void
  modeId: GameModeId
  onModeChange: (id: GameModeId) => void
  mapId: MapId
  onMapChange: (id: MapId) => void
  /** A saved match will be replaced. */
  replacesMatch: boolean
  onStart: (setup: MatchSetup) => void
}

/** One seat as edited here (all four are kept, so switching the count back restores them). */
interface SeatDraft {
  isAI: boolean
  name: string
  aiLevel: AILevel
  color: PlayerColor
}

const DEFAULT_SEATS: SeatDraft[] = [
  { isAI: false, name: 'You', aiLevel: 'normal', color: PLAYER_COLORS[0] },
  { isAI: true, name: AI_NAMES[0], aiLevel: 'normal', color: PLAYER_COLORS[1] },
  { isAI: true, name: AI_NAMES[1], aiLevel: 'normal', color: PLAYER_COLORS[2] },
  { isAI: true, name: AI_NAMES[2], aiLevel: 'normal', color: PLAYER_COLORS[3] },
]

const MAX_NAME = 18

interface SavedSetup {
  count: number
  seats: SeatDraft[]
}

/** Validate the seats saved from last time. */
function parseSavedSetup(raw: unknown): SavedSetup | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const saved = raw as Partial<SavedSetup>
  if (!Array.isArray(saved.seats) || saved.seats.length !== MAX_PLAYERS || typeof saved.count !== 'number') return undefined
  const seats = saved.seats.map((seat, i): SeatDraft => {
    const s = (typeof seat === 'object' && seat !== null ? seat : {}) as Partial<SeatDraft>
    return {
      isAI: typeof s.isAI === 'boolean' ? s.isAI : DEFAULT_SEATS[i].isAI,
      name: typeof s.name === 'string' ? s.name.slice(0, MAX_NAME) : DEFAULT_SEATS[i].name,
      aiLevel: AI_LEVELS.includes(s.aiLevel as AILevel) ? (s.aiLevel as AILevel) : 'normal',
      color: PLAYER_COLORS.includes(s.color as PlayerColor) ? (s.color as PlayerColor) : DEFAULT_SEATS[i].color,
    }
  })
  if (new Set(seats.map((s) => s.color)).size !== seats.length) return undefined
  return { count: Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, saved.count)), seats }
}

/**
 * New match: mode, map, 2–4 seats (human or computer at a chosen level, each
 * with a name and a colour of their own), and an optional seed for replays.
 */
export function MatchSetupDialog({ open, onClose, modeId, onModeChange, mapId, onMapChange, replacesMatch, onStart }: MatchSetupDialogProps) {
  const map = getMap(mapId)
  const [setup, setSetup] = usePersistentState<SavedSetup>(STORAGE_KEYS.setup, { count: 3, seats: DEFAULT_SEATS }, parseSavedSetup)
  const [seedText, setSeedText] = useState('')
  const count = Math.min(Math.min(MAX_PLAYERS, map.players.max), Math.max(Math.max(MIN_PLAYERS, map.players.min), setup.count))
  const active = setup.seats.slice(0, count)
  const seedValid = seedText.trim() === '' || /^\d{1,9}$/.test(seedText.trim())

  const updateSeat = (index: number, change: Partial<SeatDraft>) =>
    setSetup((prev) => {
      const seats = prev.seats.map((seat, i) => (i === index ? { ...seat, ...change } : seat))
      // Taking a colour another seat has: that seat gets this seat's old colour.
      if (change.color) {
        const other = seats.findIndex((seat, i) => i !== index && seat.color === change.color)
        if (other >= 0) seats[other] = { ...seats[other], color: prev.seats[index].color }
      }
      return { ...prev, seats }
    })

  const start = () => {
    const seats: SeatSetup[] = active.map((seat, i) => ({
      name: seat.name.trim() || (seat.isAI ? AI_NAMES[i] : `Player ${i + 1}`),
      isAI: seat.isAI,
      ...(seat.isAI ? { aiLevel: seat.aiLevel } : {}),
      color: seat.color,
    }))
    onStart({ modeId, mapId, seats, seed: seedText.trim() ? Number(seedText.trim()) : randomSeed() })
  }

  const mode = getGameMode(modeId)
  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      id="match-setup"
      title="New game"
      icon={<IconPlay />}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary px-6" onClick={start} disabled={!seedValid}>
            Start
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="eyebrow mb-2">Mode</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {GAME_MODES.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 transition has-focus-visible:outline-2 has-focus-visible:outline-brass-300 ${
                  m.id === modeId ? 'border-bronze-300/80 bg-bronze-500/20' : 'border-bronze-500/30 bg-soot-950/60 hover:border-bronze-400/60'
                }`}
              >
                <input type="radio" name="mode" value={m.id} checked={m.id === modeId} onChange={() => onModeChange(m.id)} className="sr-only" />
                <span className="font-display text-lg font-bold tracking-[0.1em] text-parchment-50 uppercase">{m.name}</span>
                <span className="text-sm text-brass-300">{formatDuration(m.durationMinutes)}</span>
                <span className="text-xs text-parchment-300">
                  {m.rounds} rounds · £{m.startingMoney} · {m.turnTimerSeconds}s turns
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-parchment-400">
            {mode.mapSize === 'full' ? 'The whole map.' : mode.mapSize === 'reduced' ? 'The outer ring of towns is closed.' : 'Only the core towns are open.'} The rail era
            begins in round {Math.floor(mode.rounds / 2) + 1}.
          </p>
        </fieldset>

        <div>
          <label htmlFor="setup-map" className="eyebrow mb-2 block">
            Map
          </label>
          <select
            id="setup-map"
            value={mapId}
            onChange={(event) => onMapChange(event.target.value as MapId)}
            className="min-h-10 w-full rounded-lg border border-bronze-500/35 bg-soot-950/70 px-3 text-parchment-50 outline-none hover:border-bronze-300/60 focus-visible:border-bronze-300/80"
          >
            {MAPS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.style === 'schematic' ? ' (practice map, no eras)' : ''} · {m.players.min}–{m.players.max} players
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="eyebrow mb-2">Players</legend>
          <div className="flex gap-2">
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => {
              const allowed = n >= map.players.min && n <= map.players.max
              return (
                <label
                  key={n}
                  className={`flex min-h-10 flex-1 items-center justify-center rounded-lg border text-center font-display text-xl font-bold transition has-focus-visible:outline-2 has-focus-visible:outline-brass-300 ${
                    !allowed
                      ? 'cursor-not-allowed border-bronze-500/15 text-parchment-500'
                      : n === count
                        ? 'cursor-pointer border-bronze-300/80 bg-bronze-500/20 text-parchment-50'
                        : 'cursor-pointer border-bronze-500/30 bg-soot-950/60 text-parchment-300 hover:border-bronze-400/60'
                  }`}
                  title={allowed ? undefined : `${map.name} takes ${map.players.min}–${map.players.max} players`}
                >
                  <input
                    type="radio"
                    name="player-count"
                    value={n}
                    checked={n === count}
                    disabled={!allowed}
                    onChange={() => setSetup((prev) => ({ ...prev, count: n }))}
                    className="sr-only"
                  />
                  {n}
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2">Seats</legend>
          <ul className="flex flex-col gap-2">
            {active.map((seat, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-lg border border-bronze-500/20 bg-soot-950/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`seat-name-${i}`}>
                    Seat {i + 1} name
                  </label>
                  <input
                    id={`seat-name-${i}`}
                    type="text"
                    value={seat.name}
                    maxLength={MAX_NAME}
                    placeholder={seat.isAI ? AI_NAMES[i] : `Player ${i + 1}`}
                    onChange={(event) => updateSeat(i, { name: event.target.value })}
                    className="min-h-10 min-w-0 flex-1 basis-40 rounded-lg border border-bronze-500/30 bg-soot-950/70 px-3 text-parchment-50 outline-none placeholder:text-parchment-500 focus:border-bronze-300/70"
                  />
                  <Segmented
                    label={`Seat ${i + 1} is played by`}
                    options={[
                      ['human', 'Human'],
                      ['ai', 'AI'],
                    ]}
                    value={seat.isAI ? 'ai' : 'human'}
                    onChange={(v) => updateSeat(i, { isAI: v === 'ai', name: v === 'ai' && !seat.isAI && seat.name === 'You' ? AI_NAMES[i] : seat.name })}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div role="radiogroup" aria-label={`Seat ${i + 1} colour`} className="flex gap-1.5">
                    {PLAYER_COLORS.map((color) => {
                      const takenBy = active.findIndex((other, j) => j !== i && other.color === color)
                      const style = PLAYER_STYLE[color]
                      return (
                        <button
                          key={color}
                          type="button"
                          role="radio"
                          aria-checked={seat.color === color}
                          aria-label={`${style.name}${takenBy >= 0 ? ` (swap with seat ${takenBy + 1})` : ''}`}
                          title={takenBy >= 0 ? `${style.name}: taken by seat ${takenBy + 1}; picking it swaps colours` : style.name}
                          onClick={() => updateSeat(i, { color })}
                          className={`grid size-10 place-items-center rounded-full border-2 font-display text-xs font-extrabold text-soot-950 transition ${
                            seat.color === color ? 'border-parchment-50 shadow-[0_0_10px_rgb(255_255_255/0.4)]' : takenBy >= 0 ? 'border-transparent opacity-35' : 'border-transparent'
                          }`}
                          style={{ background: style.hex }}
                        >
                          {seat.color === color ? '✓' : style.letter}
                        </button>
                      )
                    })}
                  </div>
                  {seat.isAI && (
                    <Segmented
                      label={`Seat ${i + 1} difficulty`}
                      options={AI_LEVELS.map((level) => [level, level[0].toUpperCase() + level.slice(1)] as const)}
                      value={seat.aiLevel}
                      onChange={(v) => updateSeat(i, { aiLevel: v as AILevel })}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-parchment-400">Human seats take turns on this device (pass & play).</p>
        </fieldset>

        <div>
          <label htmlFor="setup-seed" className="eyebrow mb-2 block">
            Seed (optional)
          </label>
          <input
            id="setup-seed"
            type="text"
            inputMode="numeric"
            value={seedText}
            onChange={(event) => setSeedText(event.target.value)}
            placeholder="Random"
            aria-invalid={!seedValid}
            aria-describedby="setup-seed-help"
            className="min-h-10 w-full rounded-lg border border-bronze-500/30 bg-soot-950/70 px-3 text-parchment-50 outline-none placeholder:text-parchment-500 focus:border-bronze-300/70 aria-invalid:border-rust-400"
          />
          <p id="setup-seed-help" className={`mt-1 text-xs ${seedValid ? 'text-parchment-400' : 'text-rust-300'}`}>
            {seedValid
              ? 'The same seed and seats replay the same computer moves. Leave it empty for a new match.'
              : 'A seed is a whole number of up to 9 digits.'}
          </p>
        </div>

        {replacesMatch && (
          <p className="rounded-lg border border-dashed border-bronze-500/40 px-3 py-2 text-sm text-parchment-300">
            Starting a new game replaces the match in progress.
          </p>
        )}
      </div>
    </ModalFrame>
  )
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly (readonly [string, string])[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-bronze-500/35" role="radiogroup" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={`min-h-10 px-3 text-xs font-semibold tracking-wide uppercase transition ${
            value === key ? 'bg-bronze-500/30 text-parchment-50' : 'text-parchment-400 hover:text-parchment-100'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
