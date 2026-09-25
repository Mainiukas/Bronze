import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { FriendsPanel } from './components/FriendsPanel'
import { CreditsModal, HowToPlayModal } from './components/InfoModals'
import type { MenuAction } from './components/MoreMenu'
import { SceneBackground } from './components/SceneBackground'
import { SettingsModal } from './components/SettingsModal'
import { ToastProvider } from './components/ToastProvider'
import { TopBar } from './components/TopBar'
import { DEFAULT_GAME_MODE_ID, isGameModeId } from './data/gameModes'
import { DEFAULT_MAP_ID, isMapId } from './data/maps'
import { PATHS } from './data/navigation'
import { DEFAULT_SETTINGS, parseSettings } from './data/settings'
import { usePersistentState } from './hooks/usePersistentState'
import { useToast } from './hooks/useToast'
import { STORAGE_KEYS } from './lib/storage'
import { Achievements } from './pages/Achievements'
import { Locker } from './pages/Locker'
import { MainMenu } from './pages/MainMenu'
import { Shop } from './pages/Shop'
import { Tournaments } from './pages/Tournaments'

/** Which overlay (drawer or modal) is open. Only one at a time. */
type Overlay = 'friends' | 'settings' | 'how-to-play' | 'credits'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  )
}

/** Layout and app-wide state: lobby selection, settings, open overlay. */
function AppShell() {
  const notify = useToast()
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

  const handleMenuAction = (action: MenuAction) => {
    if (action === 'logout') {
      notify('Accounts are coming soon — nothing to log out of yet')
      return
    }
    setOverlay(action)
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SceneBackground />
      <TopBar onOpenFriends={() => setOverlay('friends')} onMenuAction={handleMenuAction} />

      <main className="flex-1">
        <Routes>
          <Route
            path={PATHS.mainMenu}
            element={<MainMenu modeId={modeId} onModeChange={setModeId} mapId={mapId} onMapChange={setMapId} />}
          />
          <Route path={PATHS.locker} element={<Locker />} />
          <Route path={PATHS.shop} element={<Shop />} />
          <Route path={PATHS.achievements} element={<Achievements />} />
          <Route path={PATHS.tournaments} element={<Tournaments />} />
          <Route path="*" element={<Navigate to={PATHS.mainMenu} replace />} />
        </Routes>
      </main>

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
