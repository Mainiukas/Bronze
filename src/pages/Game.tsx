import { useEffect, useEffectEvent, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { GameBoard, type BoardHighlights } from '../components/game/GameBoard'
import { GameLog } from '../components/game/GameLog'
import { seatColor } from '../components/game/glyphs'
import { IndustryIcon } from '../components/game/IndustryIcon'
import { MoveTimer } from '../components/game/MoveTimer'
import { PlayersPanel } from '../components/game/PlayersPanel'
import { ResultsDialog } from '../components/game/ResultsDialog'
import { TurnPanel, type UiMode } from '../components/game/TurnPanel'
import { IconArrowLeft, IconBook, IconCog } from '../components/icons'
import type { Achievement } from '../data/achievements'
import { getGameMode } from '../data/gameModes'
import { getMap } from '../data/maps'
import type { GameSettings } from '../data/settings'
import { chooseAIAction } from '../game/ai'
import {
  applyAction,
  buildTargets,
  canAfford,
  currentPlayer,
  IllegalActionError,
  linkTargets,
  networkTowns,
  quote,
  shipQuotes,
  shipSources,
} from '../game/engine'
import { INDUSTRIES, INDUSTRY_ORDER, LINK_COST } from '../game/rules'
import type { GameAction, GameState } from '../game/types'
import { playSound, startMusic, stopMusic, type SoundEffect } from '../lib/sound'

interface GameProps {
  game: GameState
  onGameChange: (next: GameState) => void
  /** Called once when a match ends; returns achievements it unlocked. */
  onMatchFinished: (game: GameState) => Achievement[]
  onLeave: () => void
  onRematch: () => void
  settings: GameSettings
  onOpenRules: () => void
  onOpenSettings: () => void
}

const SOUND_FOR: Record<GameAction['type'], SoundEffect> = {
  build: 'build',
  link: 'link',
  ship: 'ship',
  raiseFunds: 'coins',
  endTurn: 'click',
}

/**
 * A match in progress: the board, the current player's controls, standings
 * and log. Computer players act on their own after a short pause.
 */
export function Game({ game, onGameChange, onMatchFinished, onLeave, onRematch, settings, onOpenRules, onOpenSettings }: GameProps) {
  const mode = getGameMode(game.modeId)
  const map = getMap(game.mapId)
  const [ui, setUi] = useState<UiMode>({ type: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [resultsOpen, setResultsOpen] = useState(game.status === 'finished')
  const [unlocked, setUnlocked] = useState<Achievement[]>([])

  const current = game.status === 'playing' ? currentPlayer(game) : null
  const humanSeats = game.players.filter((p) => !p.isAI)
  const turnKey = `${game.round}-${game.turnIndex}`

  // Pass & play: when the turn moves to a different human, hide the board
  // behind a "ready" screen so players don't see each other's plans.
  const [seatAtDevice, setSeatAtDevice] = useState<number | null>(null)
  const needsHandoff = current !== null && !current.isAI && humanSeats.length > 1 && seatAtDevice !== current.id
  const humanTurn = current !== null && !current.isAI && !needsHandoff

  /** Apply a new state; notice when it ends the match. */
  const commit = (next: GameState) => {
    if (game.status === 'playing' && next.status === 'finished') {
      setUnlocked(onMatchFinished(next))
      setResultsOpen(true)
      playSound('end')
    }
    onGameChange(next)
  }

  const act = (action: GameAction) => {
    try {
      const next = applyAction(game, action)
      playSound(SOUND_FOR[action.type])
      setUi({ type: 'idle' })
      setError(null)
      commit(next)
    } catch (e) {
      if (!(e instanceof IllegalActionError)) throw e
      setError(e.message)
      playSound('error')
    }
  }

  // Computer players: one action after a short pause, so moves can be followed.
  const playComputerAction = useEffectEvent(() => act(chooseAIAction(game)))
  useEffect(() => {
    if (!current?.isAI) return
    const timer = window.setTimeout(playComputerAction, mode.aiDelayMs)
    return () => window.clearTimeout(timer)
  }, [game, current?.isAI, mode.aiDelayMs])

  // A soft bell when a human turn starts.
  useEffect(() => {
    if (humanTurn) playSound('turn')
  }, [turnKey, humanTurn])

  // Ambient music while a match is open.
  useEffect(() => {
    startMusic()
    return () => stopMusic()
  }, [])

  // Escape backs out of whatever is being picked.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setUi({ type: 'idle' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // What the board should offer as clickable, given the current choice.
  const highlights: BoardHighlights = {}
  if (humanTurn && current) {
    const readyMills = new Set(shipSources(game).map((b) => b.id))
    if (ui.type === 'build' && ui.kind && canAfford(current, INDUSTRIES[ui.kind].cost)) {
      highlights.plots = new Set(buildTargets(game, ui.kind).map((p) => `${p.townId}#${p.slot}`))
    } else if (ui.type === 'link') {
      highlights.routes = new Map(
        linkTargets(game)
          .filter((r) => canAfford(current, LINK_COST[r.kind]))
          .map((r) => [r.id, `£${quote(current, LINK_COST[r.kind]).total}`]),
      )
    } else if (ui.type === 'ship') {
      highlights.mills = readyMills
      if (ui.buildingId !== null) {
        highlights.selectedMill = ui.buildingId
        highlights.markets = new Map(
          shipQuotes(game, ui.buildingId).map((q) => [q.marketId, `+£${q.revenue - q.tollTotal} +${q.prestige}★`]),
        )
      }
    } else if (ui.type === 'idle') {
      // Mills with goods ready glow; clicking one starts shipping from it.
      highlights.mills = readyMills
    }
  }

  const viewer = current && !current.isAI ? current.id : 0
  const network = networkTowns(game, viewer)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-bronze-500/20 bg-soot-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[96rem] items-center gap-3 px-4 py-2.5 sm:px-6">
          <button type="button" className="btn btn-ghost px-3" onClick={onLeave}>
            <IconArrowLeft className="size-5" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight font-extrabold tracking-[0.12em] text-parchment-50 uppercase">
              {map.name}
            </p>
            <p className="text-xs text-parchment-400">
              {mode.name} · {game.status === 'finished' ? 'Final' : `Round ${game.round} of ${game.totalRounds}`}
            </p>
          </div>
          <RoundTrack round={game.round} total={game.totalRounds} finished={game.status === 'finished'} />
          <button type="button" className="icon-btn" aria-label="How to play" onClick={onOpenRules}>
            <IconBook />
          </button>
          <button type="button" className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
            <IconCog />
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[96rem] flex-1 grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 [grid-template-areas:'turn'_'board'_'players'_'log'] sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:[grid-template-areas:'board_turn'_'board_players'_'board_log']">
        <div className="flex min-w-0 flex-col gap-3 [grid-area:board] lg:sticky lg:top-20">
          <section className="plate overflow-hidden" aria-label="Board">
            <div className="overflow-x-auto">
              <div className="min-w-[44rem] bg-[linear-gradient(to_right,rgb(232_181_124/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(232_181_124/0.04)_1px,transparent_1px)] bg-size-[5%_8%] p-2 sm:p-3">
                <GameBoard
                  game={game}
                  decor={map.board}
                  highlights={highlights}
                  viewer={viewer}
                  networkOfViewer={network}
                  onPlot={(townId, slot) => ui.type === 'build' && ui.kind && act({ type: 'build', kind: ui.kind, townId, slot })}
                  onRoute={(routeId) => act({ type: 'link', routeId })}
                  onMill={(buildingId) => setUi({ type: 'ship', buildingId })}
                  onMarket={(marketId) =>
                    ui.type === 'ship' && ui.buildingId !== null && act({ type: 'ship', buildingId: ui.buildingId, marketId })
                  }
                />
              </div>
            </div>
          </section>
          <Legend viewer={viewer} />
        </div>

        <div className="[grid-area:turn]">
          <TurnPanel
            game={game}
            ui={humanTurn ? ui : { type: 'idle' }}
            onUiChange={(next) => {
              setUi(next)
              setError(null)
            }}
            onAction={act}
            error={error}
            timer={
              settings.showMoveTimer && humanTurn ? (
                <MoveTimer key={turnKey} seconds={mode.turnTimerSeconds} onExpire={() => act({ type: 'endTurn', timedOut: true })} />
              ) : null
            }
            onShowResults={() => setResultsOpen(true)}
          />
        </div>
        <div className="[grid-area:players]">
          <PlayersPanel game={game} />
        </div>
        <div className="[grid-area:log]">
          <GameLog game={game} />
        </div>
      </main>

      <Dialog
        open={needsHandoff}
        onClose={() => setSeatAtDevice(current?.id ?? null)}
        labelledBy="handoff-title"
      >
        <div className="plate rivets flex flex-col items-center gap-4 border-bronze-400/40 bg-soot-900/95 px-6 py-8 text-center">
          <span className="size-5 rounded-full shadow-[0_0_14px_currentColor]" style={{ background: seatColor(current?.id ?? 0), color: seatColor(current?.id ?? 0) }} />
          <h2 id="handoff-title" className="font-display text-3xl font-extrabold tracking-[0.1em] text-parchment-50 uppercase">
            {current?.name}, you’re up
          </h2>
          <p className="text-parchment-300">Pass the device, then start your turn.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-ghost" onClick={onLeave}>
              Lobby
            </button>
            <button type="button" className="btn btn-primary px-8" onClick={() => setSeatAtDevice(current?.id ?? null)}>
              Start turn
            </button>
          </div>
        </div>
      </Dialog>

      <ResultsDialog
        open={resultsOpen && game.status === 'finished'}
        onClose={() => setResultsOpen(false)}
        game={game}
        unlocked={unlocked}
        onRematch={onRematch}
        onLeave={onLeave}
      />
    </div>
  )
}

/** Pips showing how far through the match we are. */
function RoundTrack({ round, total, finished }: { round: number; total: number; finished: boolean }) {
  return (
    <ol className="hidden items-center gap-1 md:flex" aria-label={`Round ${round} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const done = finished || i + 1 < round
        const now = !finished && i + 1 === round
        return (
          <li
            key={i}
            className={`h-2 w-4 rounded-full ${
              now ? 'bg-ember-400 shadow-[0_0_8px_rgb(255_157_77/0.8)]' : done ? 'bg-bronze-500' : 'bg-soot-600'
            }`}
          />
        )
      })}
    </ol>
  )
}

/** Key to the board's symbols. */
function Legend({ viewer }: { viewer: number }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-parchment-300">
      {INDUSTRY_ORDER.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <IndustryIcon kind={kind} className="size-4 text-bronze-300" />
          {INDUSTRIES[kind].name}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <svg viewBox="0 0 20 6" className="h-2 w-5" aria-hidden="true">
          <line x1="0" y1="3" x2="20" y2="3" className="stroke-verdigris-400" strokeWidth="1.6" strokeDasharray="3 2" />
        </svg>
        Canal
      </li>
      <li className="flex items-center gap-1.5">
        <svg viewBox="0 0 20 6" className="h-2 w-5" aria-hidden="true">
          <line x1="0" y1="3" x2="20" y2="3" className="stroke-parchment-300" strokeWidth="4" strokeDasharray="0.8 2.4" />
          <line x1="0" y1="3" x2="20" y2="3" className="stroke-parchment-300" strokeWidth="1" />
        </svg>
        Railway
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border border-brass-300 bg-soot-800 ring-1 ring-brass-300/60 ring-offset-1 ring-offset-soot-900" />
        Market
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border border-dashed" style={{ borderColor: seatColor(viewer) }} />
        Your network
      </li>
    </ul>
  )
}
