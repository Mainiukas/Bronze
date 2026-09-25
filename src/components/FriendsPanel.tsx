import { useState, type FormEvent } from 'react'
import { Dialog } from './Dialog'
import { IconClose, IconUserPlus, IconUsers } from './icons'

interface FriendsPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * Slide-in friends drawer. Placeholder until accounts exist: the list is
 * always empty and "Add" only acknowledges the name.
 */
export function FriendsPanel({ open, onClose }: FriendsPanelProps) {
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setNotice(`Friend requests aren't live yet — we couldn't send one to “${trimmed}”.`)
    setName('')
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="friends-title" variant="drawer-left">
      <div className="rivets relative flex h-full flex-col border-r border-bronze-500/30 bg-linear-to-b from-soot-850 to-soot-950 shadow-[20px_0_60px_-20px_rgb(0_0_0/0.9)]">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-bronze-500/20 px-5 py-4">
          <span aria-hidden="true" className="emoji-bronze text-2xl">
            👥
          </span>
          <h2 id="friends-title" className="flex-1 font-display text-2xl font-bold tracking-[0.12em] uppercase">
            Friends <span className="text-bronze-300">(0)</span>
          </h2>
          <button type="button" onClick={onClose} className="icon-btn size-9 text-base" aria-label="Close friends">
            <IconClose />
          </button>
        </header>

        {/* Add friend */}
        <form onSubmit={handleSubmit} className="border-b border-bronze-500/20 px-5 py-4">
          <label htmlFor="add-friend" className="eyebrow">
            Add friend
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="add-friend"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setNotice(null)
              }}
              placeholder="Enter a username"
              autoComplete="off"
              maxLength={24}
              className="min-w-0 flex-1 rounded-lg border border-bronze-500/30 bg-soot-950/70 px-3 py-2.5 text-parchment-50 shadow-[inset_0_2px_4px_rgb(0_0_0/0.5)] transition outline-none placeholder:text-parchment-500 focus:border-bronze-300/70 focus:shadow-[inset_0_2px_4px_rgb(0_0_0/0.5),0_0_0_3px_rgb(217_150_79/0.2)]"
            />
            <button type="submit" className="btn btn-primary px-3.5" disabled={!name.trim()}>
              <IconUserPlus className="size-5" />
              <span className="sr-only sm:not-sr-only">Add</span>
            </button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 text-sm text-parchment-300">
            {notice}
          </p>
        </form>

        {/* Empty state */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
          <div className="relative mb-5 grid size-24 place-items-center rounded-full border border-dashed border-bronze-500/40 bg-soot-800/50">
            <IconUsers className="size-11 text-bronze-400/80" />
            <span className="absolute inset-0 rounded-full shadow-[0_0_40px_-8px_rgb(255_122_26/0.35)]" />
          </div>
          <p className="font-display text-xl font-bold tracking-[0.1em] text-parchment-100 uppercase">
            No friends yet
          </p>
          <p className="mt-2 max-w-64 text-sm leading-relaxed text-parchment-300">
            Add a fellow industrialist by username to invite them to private matches.
          </p>
        </div>

        <footer className="border-t border-bronze-500/20 px-5 py-3 text-center text-xs tracking-wide text-parchment-400">
          Online: 0 · Pending requests: 0
        </footer>
      </div>
    </Dialog>
  )
}
