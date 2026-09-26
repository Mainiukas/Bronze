import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { IllustratedBoard, type BoardRecent, type BoardTargets } from '../components/board/IllustratedBoard'
import { imageOk, TOKEN_ART_URLS } from '../components/board/assets'
import { Dialog } from '../components/Dialog'
import { ActionBar, type UiMode } from '../components/game/ActionBar'
import { EraBanner } from '../components/game/EraBanner'
import { payoutLabel } from '../components/game/format'
import { GameBoard, type BoardHighlights } from '../components/game/GameBoard'
import { GameLog } from '../components/game/GameLog'
import { colorHex, PLAYER_STYLE } from '../components/game/glyphs'
import { MarketPanel } from '../components/game/MarketPanel'
import { MoveTimer } from '../components/game/MoveTimer'
import { PlayersPanel } from '../components/game/PlayersPanel'
import { PlayerSwatch } from '../components/game/PlayerSwatch'
import { ResultsDialog } from '../components/game/ResultsDialog'
import { ZoomPan } from '../components/game/ZoomPan'
import { IconBook, IconClose, IconCog } from '../components/icons'
import { Gear } from '../components/Gear'
import type { Achievement } from '../data/achievements'
import { BOARD, parseBoardData, slotKey, type BoardData, type BuiltState } from '../data/board'
import { getGameMode } from '../data/gameModes'
import { getMap } from '../data/maps'
import { AI_DELAY_SCALE, ANIMATION_SCALE, type GameSettings } from '../data/settings'
import { chooseAIAction } from '../game/ai'
import {
  applyAction,
  buildingAt,
  buildTargets,
  canAfford,
  currentPlayer,
  IllegalActionError,
  linkCost,
  linkTargets,
  networkTowns,
  quote,
  shipment,
  shipQuotes,
  shipSources,
  type ShipQuote,
} from '../game/engine'
import { INDUSTRIES, RULES } from '../game/rules'
import type { GameAction, GameState } from '../game/types'
import { usePersistentState } from '../hooks/usePersistentState'
import { useToast } from '../hooks/useToast'
import { playSound, startMusic, stopMusic, type SoundEffect } from '../lib/sound'
import { STORAGE_KEYS } from '../lib/storage'

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
  /** Rules or settings are open over the match: the clock and the computer players wait. */
  overlayOpen: boolean
}

const SOUND_FOR: Record<GameAction['type'], SoundEffect> = {
  build: 'build',
  link: 'link',
  ship: 'ship',
  raiseFunds: 'coins',
  endTurn: 'click',
}

/** Pause between computer actions with fast-forward on (ms). */
const FAST_FORWARD_MS = 40

/**
 * A match in progress: the board, the active player's controls, players,
 * markets and the log. The engine does the rules; this only renders the
 * state and dispatches actions. Computer players act on their own after a
 * short pause, which fast-forward shortens.
 */
export function Game({ game, onGameChange, onMatchFinished, onLeave, onRematch, settings, onOpenRules, onOpenSettings, overlayOpen }: GameProps) {
  const notify = useToast()
  const mode = getGameMode(game.modeId)
  const map = getMap(game.mapId)
  const [ui, setUi] = useState<UiMode>({ type: 'idle' })
  const [resultsOpen, setResultsOpen] = useState(game.status === 'finished')
  const [unlocked, setUnlocked] = useState<Achievement[]>([])
  const [fastForward, setFastForward] = useState(false)
  const [drawer, setDrawer] = useState<'players' | 'markets' | 'log' | null>(null)
  // The rail-era banner shows once, when the era changes during play.
  const [bannerSeen, setBannerSeen] = useState<number | null>(game.eraChange?.round ?? null)
  const colorBlind = settings.colorBlindAid

  const playing = game.status === 'playing'
  const current = playing ? currentPlayer(game) : null
  const humans = game.players.filter((p) => !p.isAI)
  const turnKey = `${game.round}-${game.turnIndex}`

  // Pass & play: when the turn moves to a different human, show "Pass to …" first.
  const [seatAtDevice, setSeatAtDevice] = useState<number | null>(humans.length === 1 ? humans[0].id : null)
  const needsHandoff = current !== null && !current.isAI && humans.length > 1 && seatAtDevice !== current.id
  const banner = playing && game.eraChange && game.eraChange.round !== bannerSeen ? game.eraChange : null
  const humanTurn = current !== null && !current.isAI && !needsHandoff && !banner
  const paused = overlayOpen || needsHandoff || banner !== null || resultsOpen || drawer !== null

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
      commit(next)
    } catch (e) {
      if (!(e instanceof IllegalActionError)) throw e
      notify(e.message)
      playSound('error')
    }
  }

  // Computer players: one action after a short pause, so moves can be followed (fast-forward shortens it).
  const playComputerAction = useEffectEvent(() => act(chooseAIAction(game)))
  const aiDelay = fastForward ? FAST_FORWARD_MS : mode.aiDelayMs * AI_DELAY_SCALE[settings.aiSpeed]
  useEffect(() => {
    if (!current?.isAI || paused) return
    const timer = window.setTimeout(playComputerAction, aiDelay)
    return () => window.clearTimeout(timer)
  }, [game, current?.isAI, aiDelay, paused])

  // A soft bell when a human turn starts.
  useEffect(() => {
    if (humanTurn) playSound('turn')
  }, [turnKey, humanTurn])

  // Ambient music while a match is open.
  useEffect(() => {
    startMusic()
    return () => stopMusic()
  }, [])

  // Escape backs out of whatever is being chosen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setUi({ type: 'idle' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---- What can be clicked on the board, given the current choice ---- */

  const activeUi: UiMode = humanTurn ? ui : { type: 'idle' }
  const sources = humanTurn ? shipSources(game) : []
  const buildPlots =
    humanTurn && current && activeUi.type === 'build' && activeUi.kind && canAfford(current, INDUSTRIES[activeUi.kind].cost) ? buildTargets(game, activeUi.kind) : []
  const linkOffers = new Map<string, string>(
    humanTurn && current && activeUi.type === 'link'
      ? linkTargets(game)
          .filter((r) => canAfford(current, linkCost(game, r)))
          .map((r) => [r.id, `£${quote(current, linkCost(game, r)).total}`])
      : [],
  )
  const shipSource = activeUi.type === 'ship' ? activeUi.buildingId : null
  const quotes: ShipQuote[] = humanTurn && shipSource !== null ? shipQuotes(game, shipSource) : []
  const pickingSource = humanTurn && activeUi.type === 'ship' && shipSource === null

  const setShip = (buildingId: number | null, marketId: string | null = null) => setUi({ type: 'ship', buildingId, marketId })
  const portAt = (townId: string, slot: number) => {
    const b = buildingAt(game, townId, slot)
    return b && quotes.find((q) => q.marketId === `port:${b.id}`)
  }

  const onBoardSlot = (townId: string, slot: number) => {
    if (!humanTurn) return
    if (activeUi.type === 'build' && activeUi.kind) return act({ type: 'build', kind: activeUi.kind, townId, slot })
    const port = portAt(townId, slot)
    if (port) return setShip(shipSource, port.marketId)
    const building = buildingAt(game, townId, slot)
    if (building && sources.some((s) => s.id === building.id)) setShip(building.id)
  }
  const onBoardMarket = (townId: string) => {
    if (humanTurn && shipSource !== null && quotes.some((q) => q.marketId === townId)) setShip(shipSource, townId)
  }

  const sourceLabel = (id: number) => {
    const b = game.buildings.find((x) => x.id === id)!
    const load = shipment(game, b)!
    return `${load.amount} ${load.goods}`
  }

  // The painted board: targets keyed by slot, link and location.
  const targets: BoardTargets = { slots: new Map(), links: linkOffers, locations: new Map() }
  const slotTargets = targets.slots as Map<string, string | null>
  for (const plot of buildPlots) slotTargets.set(slotKey(plot.townId, plot.slot), null)
  if (pickingSource) for (const b of sources) slotTargets.set(slotKey(b.townId, b.slot), sourceLabel(b.id))
  for (const q of quotes) {
    if (q.portOwner !== null) {
      const port = game.buildings.find((b) => `port:${b.id}` === q.marketId)
      if (port) slotTargets.set(slotKey(port.townId, port.slot), payoutLabel(q))
    } else (targets.locations as Map<string, string | null>).set(q.marketId, payoutLabel(q))
  }

  // Schematic maps: the SVG board.
  const highlights: BoardHighlights = {
    plots: new Set(buildPlots.map((p) => `${p.townId}#${p.slot}`)),
    routes: linkOffers,
    sources: pickingSource ? new Set(sources.map((b) => b.id)) : undefined,
    selectedSource: shipSource,
    markets: new Map(quotes.filter((q) => q.portOwner === null).map((q) => [q.marketId, payoutLabel(q)])),
  }

  const network = current ? networkTowns(game, current.id) : new Set<string>()
  const colorOf = (player: number) => colorHex(game.players[player].color)

  /* ---- Layout ---- */

  const panels = (
    <>
      <PlayersPanel game={game} colorBlind={colorBlind} />
      <MarketPanel game={game} />
      {settings.showLog && <GameLog game={game} colorBlind={colorBlind} />}
    </>
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-bronze-500/20 bg-soot-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[100rem] items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4">
          <GameMenu onRules={onOpenRules} onSettings={onOpenSettings} onLeave={onLeave} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base leading-tight font-extrabold tracking-[0.1em] text-parchment-50 uppercase sm:text-lg">{map.name}</p>
            <p className="truncate text-xs text-parchment-400">
              {mode.name} · {game.status === 'finished' ? 'Final' : `Round ${game.round}/${game.totalRounds}`}
            </p>
          </div>
          {game.era && <EraChip era={game.era} railRound={game.railEraRound} />}
          {playing && (
            <span className="flex items-center gap-1" role="img" aria-label={`${game.actionsLeft} of ${RULES.actionsPerTurn} actions left`} title="Actions left this turn">
              {Array.from({ length: RULES.actionsPerTurn }, (_, i) => (
                <span key={i} className={`size-3 rounded-full border ${i < game.actionsLeft ? 'border-brass-200 bg-brass-300' : 'border-bronze-500/50 bg-soot-800'}`} />
              ))}
            </span>
          )}
          {settings.showMoveTimer && humanTurn && (
            <MoveTimer key={turnKey} seconds={mode.turnTimerSeconds} paused={paused} onExpire={() => act({ type: 'endTurn', timedOut: true })} />
          )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[112rem] grid-cols-[minmax(0,1fr)] items-start gap-3 px-2 py-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="min-w-0 lg:sticky lg:top-[4.5rem]">
          <section className="plate relative mx-auto w-full overflow-hidden p-1 lg:max-w-[calc(100dvh-5.75rem)]" aria-label="Board">
            <ZoomPan>
              {map.style === 'illustrated' ? (
                <PaintedBoard
                  game={game}
                  network={network}
                  targets={targets}
                  selectedSource={shipSource}
                  colorBlind={colorBlind}
                  motion={ANIMATION_SCALE[settings.animationSpeed]}
                  onSelectSlot={onBoardSlot}
                  onSelectLocation={onBoardMarket}
                  onSelectLink={(routeId) => act({ type: 'link', routeId })}
                />
              ) : (
                <div className="bg-[linear-gradient(to_right,rgb(232_181_124/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(232_181_124/0.04)_1px,transparent_1px)] bg-size-[5%_8%] p-2">
                  <GameBoard
                    game={game}
                    decor={map.board}
                    highlights={highlights}
                    viewer={current?.id ?? null}
                    networkOfViewer={network}
                    colorOf={colorOf}
                    onPlot={(townId, slot) => onBoardSlot(townId, slot)}
                    onRoute={(routeId) => act({ type: 'link', routeId })}
                    onSource={(buildingId) => setShip(buildingId)}
                    onMarket={onBoardMarket}
                  />
                </div>
              )}
            </ZoomPan>
            {banner && <EraBanner removed={banner.removed} onDismiss={() => setBannerSeen(banner.round)} />}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <section className="plate rivets p-3 sm:p-4" aria-label="Actions">
            <TurnHeader game={game} colorBlind={colorBlind} fastForward={fastForward} onFastForward={setFastForward} />
            <div className="mt-3">
              {game.status === 'finished' ? (
                <button type="button" className="btn btn-primary w-full" onClick={() => setResultsOpen(true)}>
                  See results
                </button>
              ) : humanTurn ? (
                <ActionBar game={game} ui={ui} onUiChange={setUi} onAction={act} />
              ) : current?.isAI ? (
                <AiStatus game={game} />
              ) : (
                <p className="text-sm text-parchment-300">Waiting for {current?.name} to take the device…</p>
              )}
            </div>
          </section>

          {/* Phones and tablets: the panels open as drawers. */}
          <nav className="grid grid-cols-3 gap-2 lg:hidden" aria-label="Match panels">
            {(
              [
                ['players', 'Players'],
                ['markets', 'Markets'],
                ...(settings.showLog ? ([['log', 'Log']] as const) : []),
              ] as const
            ).map(([key, text]) => (
              <button key={key} type="button" className="btn btn-ghost" onClick={() => setDrawer(key)} aria-haspopup="dialog">
                {text}
              </button>
            ))}
          </nav>

          <div className="hidden flex-col gap-3 lg:flex">{panels}</div>
        </div>
      </main>

      <Dialog open={drawer !== null} onClose={() => setDrawer(null)} labelledBy="drawer-title" variant="drawer-left">
        <div className="flex h-full flex-col gap-3 overflow-y-auto border-r border-bronze-500/30 bg-linear-to-b from-soot-850 to-soot-950 p-3">
          <div className="flex items-center justify-between">
            <h2 id="drawer-title" className="font-display text-xl font-bold tracking-[0.12em] text-parchment-50 uppercase">
              {drawer === 'players' ? 'Players' : drawer === 'markets' ? 'Markets' : 'Match log'}
            </h2>
            <button type="button" className="icon-btn size-10 text-base" aria-label="Close" onClick={() => setDrawer(null)}>
              <IconClose />
            </button>
          </div>
          {drawer === 'players' && <PlayersPanel game={game} colorBlind={colorBlind} />}
          {drawer === 'markets' && <MarketPanel game={game} />}
          {drawer === 'log' && <GameLog game={game} colorBlind={colorBlind} />}
        </div>
      </Dialog>

      <Dialog open={needsHandoff && !overlayOpen} onClose={() => setSeatAtDevice(current?.id ?? null)} labelledBy="handoff-title">
        <div className="plate rivets flex flex-col items-center gap-4 border-bronze-400/40 bg-soot-900/95 px-6 py-8 text-center">
          {current && <PlayerSwatch color={current.color} letter={colorBlind} className="size-8 text-sm" />}
          <h2 id="handoff-title" className="font-display text-3xl font-extrabold tracking-[0.1em] text-parchment-50 uppercase">
            {current?.name === 'You' ? 'Your turn' : `Pass to ${current?.name}`}
          </h2>
          <p className="text-parchment-300">Hand the device over, then start the turn. The timer waits.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-ghost" onClick={onLeave}>
              Main menu
            </button>
            <button type="button" className="btn btn-primary px-8" onClick={() => setSeatAtDevice(current?.id ?? null)}>
              {current?.name === 'You' ? 'Start your turn' : `Start ${current?.name}’s turn`}
            </button>
          </div>
        </div>
      </Dialog>

      <ResultsDialog
        open={resultsOpen && game.status === 'finished'}
        onClose={() => setResultsOpen(false)}
        game={game}
        unlocked={unlocked}
        colorBlind={colorBlind}
        onRematch={onRematch}
        onLeave={onLeave}
      />
    </div>
  )
}

/** Whose turn it is, and (with computer players) the fast-forward switch. */
function TurnHeader({ game, colorBlind, fastForward, onFastForward }: { game: GameState; colorBlind: boolean; fastForward: boolean; onFastForward: (on: boolean) => void }) {
  if (game.status === 'finished') {
    return <p className="font-display text-xl font-extrabold tracking-[0.12em] text-parchment-50 uppercase">Match over</p>
  }
  const player = currentPlayer(game)
  const hasAI = game.players.some((p) => p.isAI)
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <PlayerSwatch color={player.color} letter={colorBlind} className="size-5 shadow-[0_0_10px_currentColor]" />
      <p className="min-w-0 flex-1 font-display text-lg leading-tight font-extrabold tracking-[0.08em] text-parchment-50 uppercase">
        {player.isAI ? `${player.name} is playing` : player.name === 'You' ? 'Your turn' : `${player.name}’s turn`}
        <span className="block font-body text-xs font-semibold tracking-normal text-parchment-400 normal-case">
          action {RULES.actionsPerTurn - game.actionsLeft + 1} of {RULES.actionsPerTurn} · £{player.money} · {player.coal} coal · {player.iron} iron
        </span>
      </p>
      {hasAI && (
        <button
          type="button"
          aria-pressed={fastForward}
          onClick={() => onFastForward(!fastForward)}
          className={`btn px-3 text-sm ${fastForward ? 'btn-primary' : 'btn-ghost'}`}
          title="Let the computer players act without pausing"
        >
          ⏩ Fast-forward
        </button>
      )}
    </div>
  )
}

/** While a computer player acts: what it just did (the board flashes it too). */
function AiStatus({ game }: { game: GameState }) {
  const player = currentPlayer(game)
  const last = [...game.log].reverse().find((e) => e.player !== null)
  return (
    <div className="flex items-center gap-3 text-sm text-parchment-300">
      <Gear teeth={10} holes={0} className="size-6 shrink-0 animate-[spin_2.5s_linear_infinite] text-bronze-400" />
      <p className="min-w-0">
        <span className="font-semibold text-parchment-100">
          {player.name} ({player.aiLevel} AI)
        </span>{' '}
        is choosing an action.
        {last && <span className="block truncate text-parchment-400">Last: {last.text}</span>}
      </p>
    </div>
  )
}

/** The era, with its vehicle. */
function EraChip({ era, railRound }: { era: 'canal' | 'rail'; railRound: number | null }) {
  const art = TOKEN_ART_URLS[era]
  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-xs font-bold tracking-[0.12em] uppercase sm:flex ${
        era === 'canal' ? 'border-verdigris-400/50 bg-board-water/25 text-verdigris-200' : 'border-brass-300/50 bg-bronze-500/20 text-brass-200'
      }`}
      title={era === 'canal' ? `Canal era: the rail era begins in round ${railRound}` : 'Rail era: the canals have closed'}
    >
      {imageOk(art) && <img src={art} alt="" aria-hidden="true" className="h-3.5 w-auto" />}
      {era === 'canal' ? 'Canal era' : 'Rail era'}
    </span>
  )
}

/** The match menu: rules, settings, back to the main menu (the match is saved). */
function GameMenu({ onRules, onSettings, onLeave }: { onRules: () => void; onSettings: () => void; onLeave: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  const item = (label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false)
        onClick()
      }}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-display text-base font-semibold tracking-[0.1em] text-parchment-200 uppercase hover:bg-bronze-500/15 hover:text-parchment-50"
    >
      {icon}
      {label}
    </button>
  )
  return (
    <div ref={root} className="relative">
      <button type="button" className="icon-btn text-xl" aria-label="Match menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <div role="menu" className="plate rivets absolute top-full left-0 z-40 mt-2 w-60 bg-soot-900/[0.97] p-2">
          {item('Rules', <IconBook className="size-5" />, onRules)}
          {item('Settings', <IconCog className="size-5" />, onSettings)}
          {item('Main menu', <span className="w-5 text-center">⌂</span>, onLeave)}
          <p className="px-3 pt-1 text-xs text-parchment-400">The match is saved after every action.</p>
        </div>
      )}
    </div>
  )
}

interface PaintedBoardProps {
  game: GameState
  network: Set<string>
  targets: BoardTargets
  selectedSource: number | null
  colorBlind: boolean
  motion: number
  onSelectSlot: (townId: string, slot: number) => void
  onSelectLocation: (townId: string) => void
  onSelectLink: (routeId: string) => void
}

/** The match drawn on the painted board: game state translated into the board's props. */
function PaintedBoard({ game, network, targets, selectedSource, colorBlind, motion, onSelectSlot, onSelectLocation, onSelectLink }: PaintedBoardProps) {
  // Positions calibrated in the map editor (not yet pasted into board.json) apply here too.
  const [draft] = usePersistentState<BoardData | null>(STORAGE_KEYS.boardDraft, null, parseBoardData)
  const board = draft ?? BOARD
  const inPlay = new Set(game.board.towns.map((t) => t.id))
  const built: BuiltState = { slots: {}, links: {} }
  for (const b of game.buildings) {
    built.slots[slotKey(b.townId, b.slot)] = {
      player: b.owner,
      industry: b.kind,
      stars: INDUSTRIES[b.kind].prestige,
      ...(INDUSTRIES[b.kind].ships === 'cotton' ? { goods: b.goods } : {}),
    }
  }
  for (const [id, link] of Object.entries(game.links)) built.links[id] = { player: link.owner }
  const source = selectedSource === null ? undefined : game.buildings.find((b) => b.id === selectedSource)
  const event = game.lastEvent
  const recent: BoardRecent | null =
    event?.type === 'build'
      ? { key: game.nextId, slot: slotKey(event.townId, event.slot) }
      : event?.type === 'link'
        ? { key: game.nextId, link: event.routeId }
        : event?.type === 'ship'
          ? { key: game.nextId, path: event.routeIds, from: event.fromTownId, location: event.marketTownId }
          : null
  const current = game.status === 'playing' ? currentPlayer(game) : null

  return (
    <IllustratedBoard
      board={board}
      era={game.era ?? 'canal'}
      built={built}
      playerColor={(p) => colorHex(game.players[p].color)}
      playerName={(p) => game.players[p]?.name ?? `Player ${p + 1}`}
      playerMark={colorBlind ? (p) => PLAYER_STYLE[game.players[p].color].letter : undefined}
      selected={source ? { type: 'slot', locationId: source.townId, index: source.slot } : null}
      targets={targets}
      prices={game.prices}
      closed={new Set(board.locations.filter((l) => !inPlay.has(l.id)).map((l) => l.id))}
      network={current ? { locations: network, color: colorHex(current.color) } : null}
      recent={recent}
      motion={motion}
      onSelectSlot={onSelectSlot}
      onSelectLocation={onSelectLocation}
      onSelectLink={onSelectLink}
      className="rounded-md"
    />
  )
}

