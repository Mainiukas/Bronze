import { Link } from 'react-router'
import { PATHS } from '../data/navigation'
import { MoreMenu, type MenuAction } from './MoreMenu'
import { TabNav } from './TabNav'

interface TopBarProps {
  onOpenFriends: () => void
  onMenuAction: (action: MenuAction) => void
}

/**
 * Sticky top bar: Friends button (left), tabs (center), menu (right).
 * On small screens the tabs drop to their own scrollable row and a small
 * wordmark fills the center of the first row.
 */
export function TopBar({ onOpenFriends, onMenuAction }: TopBarProps) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-bronze-500/20 bg-soot-950/75 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.9)] backdrop-blur-md">
      {/* Thin brass trim along the bottom edge */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-bronze-400/60 to-transparent"
      />
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 pt-2 sm:px-6 md:py-2">
        <button type="button" onClick={onOpenFriends} className="icon-btn" aria-label="Friends">
          <span aria-hidden="true" className="emoji-bronze leading-none">
            👥
          </span>
        </button>

        <Link
          to={PATHS.mainMenu}
          className="metal-text justify-self-center font-display text-2xl font-extrabold tracking-[0.3em] md:hidden"
        >
          BRONZE
        </Link>

        <TabNav className="min-w-0 col-span-full row-start-2 -mx-4 px-2 sm:-mx-6 md:col-span-1 md:col-start-2 md:row-start-1 md:mx-0 md:px-0" />

        <div className="col-start-3 row-start-1 justify-self-end">
          <MoreMenu onSelect={onMenuAction} />
        </div>
      </div>
    </header>
  )
}
