import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router'
import { FriendsPanel } from './components/FriendsPanel'
import { CreditsModal, HowToPlayModal } from './components/InfoModals'
import { MatchSetupDialog } from './components/MatchSetupDialog'
import type { MenuAction } from './components/MoreMenu'
import { SceneBackground } from './components/SceneBackground'
import { SettingsModal } from './components/SettingsModal'
import { ToastProvider } from './components/ToastProvider'
import { TopBar } from './components/TopBar'
import { EMPTY_STATS, parseStats, recordMatch, type Achievement } from './data/achievements'
import { DEFAULT_GAME_MODE_ID, getGameMode, isGameModeId } from './data/gameModes'
import { DEFAULT_MAP_ID, getMap, isMapId } from './data/maps'
import { PATHS } from './data/navigation'
import { DEFAULT_SETTINGS, parseSettings } from './data/settings'
import { createGame, parseSavedGame } from './game/engine'
import type { GameState, SeatSetup } from './game/types'
import { usePersistentState } from './hooks/usePersistentState'
import { useToast } from './hooks/useToast'
import { setVolumes } from './lib/sound'
import { STORAGE_KEYS } from './lib/storage'
import { Achievements } from './pages/Achievements'
import { Game } from './pages/Game'
import { Locker } from './pages/Locker'
import { MainMenu } from './pages/MainMenu'
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
  const [game, setGame] = usePersistentState<GameState | null>(STORAGE_KEYS.match, null, parseSavedGame)
  const [stats, setStats] = usePersistentState(STORAGE_KEYS.stats, EMPTY_STATS, parseStats)
  // Seats of the last match started, for Rematch.
  const [lastSeats, setLastSeats] = useState<SeatSetup[] | null>(null)

  useEffect(() => setVolumes(settings.masterVolume, settings.musicVolume), [settings.masterVolume, settings.musicVolume])

  const handleMenuAction = (action: MenuAction) => {
    if (action === 'logout') {
      notify('Accounts are coming soon — nothing to log out of yet')
      return
    }
    setOverlay(action)
  }

  const startMatch = (seats: SeatSetup[], mode = modeId, map = mapId) => {
    setGame(createGame({ modeId: mode, mapId: map, seats }))
    setLastSeats(seats)
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

  const rematch = () => {
    if (!game) return
    const seats = lastSeats ?? game.players.map((p) => ({ name: p.name, isAI: p.isAI }))
    startMatch(seats, game.modeId, game.mapId)
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
                game={game}
                onGameChange={setGame}
                onMatchFinished={handleMatchFinished}
                onLeave={leaveMatch}
                onRematch={rematch}
                settings={settings}
                onOpenRules={() => setOverlay('how-to-play')}
                onOpenSettings={() => setOverlay('settings')}
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
                onPlay={() => setOverlay('setup')}
                savedMatch={savedMatch}
                onResume={() => navigate(PATHS.play)}
                onAbandon={() => {
                  setGame(null)
                  notify('Match abandoned')
                }}
              />
            }
          />
          <Route path={PATHS.locker} element={<Locker />} />
          <Route path={PATHS.shop} element={<Shop />} />
          <Route path={PATHS.achievements} element={<Achievements stats={stats} />} />
          <Route path={PATHS.tournaments} element={<Tournaments />} />
          <Route path="*" element={<Navigate to={PATHS.mainMenu} replace />} />
        </Route>
      </Routes>

      <MatchSetupDialog
        open={overlay === 'setup'}
        onClose={closeOverlay}
        mode={getGameMode(modeId)}
        map={getMap(mapId)}
        replacesMatch={savedMatch !== null}
        onStart={(seats) => startMatch(seats)}
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
