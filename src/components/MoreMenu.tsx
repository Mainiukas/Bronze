import { useEffect, useId, useRef, useState, type ComponentType } from 'react'
import { IconBook, IconCog, IconLogout, IconMap, IconStar, type IconProps } from './icons'

export type MenuAction = 'board' | 'settings' | 'how-to-play' | 'credits' | 'logout'

interface MenuItem {
  action: MenuAction
  label: string
  Icon: ComponentType<IconProps>
  danger?: boolean
}

const ITEMS: MenuItem[] = [
  { action: 'board', label: 'Map board', Icon: IconMap },
  { action: 'settings', label: 'Settings', Icon: IconCog },
  { action: 'how-to-play', label: 'How to Play', Icon: IconBook },
  { action: 'credits', label: 'Credits', Icon: IconStar },
  { action: 'logout', label: 'Log out', Icon: IconLogout, danger: true },
]

/**
 * Hamburger button with a dropdown of secondary actions.
 * Closes on outside click, Escape, or choosing an item.
 */
export function MoreMenu({ onSelect }: { onSelect: (action: MenuAction) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (action: MenuAction) => {
    setOpen(false)
    // Put focus back on the trigger first, so a dialog opened by this action
    // returns focus there (not to a hidden menu item) when it closes.
    buttonRef.current?.focus()
    onSelect(action)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`icon-btn text-xl ${open ? 'border-bronze-300/70 text-parchment-50' : ''}`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="leading-none">
          ☰
        </span>
      </button>

      <div
        id={menuId}
        className={`plate rivets absolute top-full right-0 z-40 mt-3 w-60 origin-top-right bg-soot-900/[0.97] p-2 transition duration-200 ease-out ${
          open ? 'visible scale-100 opacity-100' : 'invisible -translate-y-1 scale-95 opacity-0'
        }`}
      >
        <ul className="flex flex-col gap-0.5">
          {ITEMS.map(({ action, label, Icon, danger }, index) => (
            <li key={action}>
              {danger && index > 0 && <hr className="mx-2 my-1.5 border-bronze-500/20" />}
              <button
                type="button"
                onClick={() => choose(action)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-display text-base font-semibold tracking-[0.1em] uppercase transition-colors ${
                  danger
                    ? 'text-rust-300 hover:bg-rust-500/15 hover:text-rust-300'
                    : 'text-parchment-200 hover:bg-bronze-500/15 hover:text-parchment-50'
                }`}
              >
                <Icon className="size-5 shrink-0 opacity-80 transition-transform duration-200 group-hover:scale-110 group-hover:opacity-100" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
