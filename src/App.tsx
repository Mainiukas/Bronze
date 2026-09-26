import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router'
import { FriendsPanel } from './components/FriendsPanel'
import { CreditsModal, HowToPlayModal } from './components/InfoModals'
import { MatchSetupDialog, type MatchSetup } from './components/MatchSetupDialog'
import type { MenuAction } from './components/MoreMenu'
import { SceneBackground } from './components/SceneBackground'
import { SettingsModal } from './components/SettingsModal'
import { ToastProvider } from './components/ToastProvider'
import { TopBar } from './components/TopBar'
import { EMPTY_STATS, parseStats, recordMatch, type Achievement } from './data/achievements'
import { DEFAULT_GAME_MODE_ID, getGameMode, isGameModeId } from './data/gameModes'
import { DEFAULT_MAP_ID, getMap, isMapId } from './data/maps'
import { PATHS } from './data/navigation'
import { ANIMATION_SCALE, DEFAULT_SETTINGS, parseSettings } from './data/settings'
import { createGame, parseSavedGame, readSavedGame } from './game/engine'
import type { GameState } from './game/types'
import { usePersistentState } from './hooks/usePersistentState'
import { useToast } from './hooks/useToast'
import { setVolumes } from './lib/sound'
import { randomSeed } from './lib/random'
import { readStorage, removeStorage, STORAGE_KEYS } from './lib/storage'
import { Achievements } from './pages/Achievements'
import { Game } from './pages/Game'
import { Locker } from './pages/Locker'
import { MainMenu } from './pages/MainMenu'
import { MapBoard } from './pages/MapBoard'
import { Shop } from './pages/Shop'
import { Tournaments } from './pages/Tournaments'

/** Which overlay (drawer or modal) is open. Only one at a time. */
type Overlay = 'friends' | 'settings' | 'how-to-play' | 'credits' | 'setup'

export default function App() {
  // Hash-based URLs (e.g. #/shop) work on any static host without
  // server-side rewrites, and inside embedded or file:// pages.
  return (
    <HashRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </HashRouter>
  )
}

/** App-wide state: lobby selection, settings, the saved match, stats, open overlay. */
function AppShell() {
  const notify = useToast()
  const navigate = useNavigate()
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const closeOverlay = () => setOverlay(null)

  // Saved choices. Stored values are validated, so a removed mode or map
  // falls back to the default instead of breaking the menu.
  const [modeId, setModeId] = usePersistentState(STORAGE_KEYS.gameMode, DEFAULT_GAME_MODE_ID, (raw) =>
    isGameModeId(raw) ? raw : undefined,
  )
  const [mapId, setMapId] = usePersistentState(STORAGE_KEYS.map, DEFAULT_MAP_ID, (raw) =>
    isMapId(raw) ? raw : undefined,
  )
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.settings, DEFAULT_SETTINGS, parseSettings)
  // A save from an older version can't be resumed: say so (once) instead of silently dropping it.
  const [outdatedSave, setOutdatedSave] = useState(() => readSavedGame(readStorage(STORAGE_KEYS.match)).status === 'outdated')
  // Saved after every action (and every state change), so Continue resumes exactly where play stopped.
  const [game, setGame] = usePersistentState<GameState | null>(STORAGE_KEYS.match, null, parseSavedGame)
  const [stats, setStats] = usePersistentState(STORAGE_KEYS.stats, EMPTY_STATS, parseStats)

  useEffect(
    () => setVolumes(settings.soundOn ? settings.masterVolume : 0, settings.soundOn ? settings.musicVolume : 0),
    [settings.soundOn, settings.masterVolume, settings.musicVolume],
  )
  // Board and banner animations read this: 0 turns them off.
  useEffect(() => {
    document.documentElement.style.setProperty('--anim-scale', String(ANIMATION_SCALE[settings.animationSpeed]))
    document.documentElement.dataset.animations = settings.animationSpeed === 'off' ? 'off' : 'on'
  }, [settings.animationSpeed])

  const handleMenuAction = (action: MenuAction) => {
    if (action === 'board') {
      navigate(PATHS.board)
      return
    }
    setOverlay(action)
  }

  // Changes with every new match, so the match screen starts fresh (banners, hand-offs, choices).
  const [matchKey, setMatchKey] = useState(0)
  const startMatch = (setup: MatchSetup) => {
    setGame(createGame(setup))
    setMatchKey((k) => k + 1)
    setOutdatedSave(false)
    setOverlay(null)
    navigate(PATHS.play)
  }

  const handleMatchFinished = useCallback(
    (finished: GameState): Achievement[] => {
      const result = recordMatch(stats, finished)
      setStats(result.stats)
      return result.unlocked
    },
    [stats, setStats],
  )

  const leaveMatch = () => {
    // A finished match has nothing left to resume.
    if (game?.status === 'finished') setGame(null)
    navigate(PATHS.mainMenu)
  }

  /** The same seats (names, colours, AI levels) on the same mode and map, with a new seed. */
  const rematch = () => {
    if (!game) return
    const seats = game.players.map((p) => ({ name: p.name, isAI: p.isAI, color: p.color, ...(p.aiLevel ? { aiLevel: p.aiLevel } : {}) }))
    startMatch({ modeId: game.modeId, mapId: game.mapId, seats, seed: randomSeed() })
  }

  const savedMatch =
    game && game.status === 'playing'
      ? {
          summary: `${getGameMode(game.modeId).name} on ${getMap(game.mapId).name} · round ${game.round} of ${game.totalRounds}`,
        }
      : null

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SceneBackground />

      <Routes>
        <Route
          path={PATHS.play}
          element={
            game ? (
              <Game
                key={matchKey}
                game={game}
                onGameChange={setGame}
                onMatchFinished={handleMatchFinished}
                onLeave={leaveMatch}
                onRematch={rematch}
                settings={settings}
                onOpenRules={() => setOverlay('how-to-play')}
                onOpenSettings={() => setOverlay('settings')}
                overlayOpen={overlay !== null}
              />
            ) : (
              <Navigate to={PATHS.mainMenu} replace />
            )
          }
        />
        <Route element={<LobbyLayout onOpenFriends={() => setOverlay('friends')} onMenuAction={handleMenuAction} />}>
          <Route
            path={PATHS.mainMenu}
            element={
              <MainMenu
                modeId={modeId}
                onModeChange={setModeId}
                mapId={mapId}
                onMapChange={setMapId}
                onNewGame={() => setOverlay('setup')}
                savedMatch={savedMatch}
                onContinue={() => navigate(PATHS.play)}
                onAbandon={() => {
                  setGame(null)
                  notify('Match abandoned')
                }}
                outdatedSave={outdatedSave && !game}
                onDiscardOutdated={() => {
                  removeStorage(STORAGE_KEYS.match)
                  setOutdatedSave(false)
                  setOverlay('setup')
                }}
                onOpenRules={() => setOverlay('how-to-play')}
                onOpenSettings={() => setOverlay('settings')}
              />
            }
          />
          <Route path={PATHS.locker} element={<Locker />} />
          <Route path={PATHS.shop} element={<Shop />} />
          <Route path={PATHS.achievements} element={<Achievements stats={stats} />} />
          <Route path={PATHS.tournaments} element={<Tournaments />} />
          <Route path={PATHS.board} element={<MapBoard />} />
          <Route path="*" element={<Navigate to={PATHS.mainMenu} replace />} />
        </Route>
      </Routes>

      <MatchSetupDialog
        open={overlay === 'setup'}
        onClose={closeOverlay}
        modeId={modeId}
        onModeChange={setModeId}
        mapId={mapId}
        onMapChange={setMapId}
        replacesMatch={savedMatch !== null}
        onStart={startMatch}
      />
      <FriendsPanel open={overlay === 'friends'} onClose={closeOverlay} />
      <SettingsModal
        open={overlay === 'settings'}
        onClose={closeOverlay}
        settings={settings}
        onChange={setSettings}
      />
      <HowToPlayModal open={overlay === 'how-to-play'} onClose={closeOverlay} />
      <CreditsModal open={overlay === 'credits'} onClose={closeOverlay} />
    </div>
  )
}

/** Top bar and tabs around the lobby pages (not shown during a match). */
function LobbyLayout({
  onOpenFriends,
  onMenuAction,
}: {
  onOpenFriends: () => void
  onMenuAction: (action: MenuAction) => void
}) {
  return (
    <>
      <TopBar onOpenFriends={onOpenFriends} onMenuAction={onMenuAction} />
      <main className="flex-1">
        <Outlet />
      </main>
    </>
  )
}
