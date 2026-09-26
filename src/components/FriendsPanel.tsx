import { Dialog } from './Dialog'
import { IconClose, IconUsers } from './icons'

interface FriendsPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * Slide-in friends drawer. Bronze has no account or online server yet, so
 * this only says so: no friend list, no requests, no online count.
 */
export function FriendsPanel({ open, onClose }: FriendsPanelProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="friends-title" variant="drawer-left">
      <div className="rivets relative flex h-full flex-col border-r border-bronze-500/30 bg-linear-to-b from-soot-850 to-soot-950 shadow-[20px_0_60px_-20px_rgb(0_0_0/0.9)]">
        <header className="flex items-center gap-3 border-b border-bronze-500/20 px-5 py-4">
          <span aria-hidden="true" className="emoji-bronze text-2xl">
            👥
          </span>
          <h2 id="friends-title" className="flex-1 font-display text-2xl font-bold tracking-[0.12em] uppercase">
            Friends & online
          </h2>
          <button type="button" onClick={onClose} className="icon-btn size-10 text-base" aria-label="Close friends">
            <IconClose />
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
          <div className="relative mb-5 grid size-24 place-items-center rounded-full border border-dashed border-bronze-500/40 bg-soot-800/50">
            <IconUsers className="size-11 text-bronze-400/80" />
          </div>
          <p className="inline-flex items-center gap-2 rounded-full border border-bronze-400/40 bg-soot-900/80 px-4 py-1.5 font-display text-sm font-bold tracking-[0.25em] text-brass-300 uppercase">
            Coming soon
          </p>
          <p className="mt-4 max-w-72 text-sm leading-relaxed text-parchment-300">
            Friends and online matches need an account server, and Bronze doesn’t have one yet. Until then, play against the
            computer, or pass &amp; play with friends on this device.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
