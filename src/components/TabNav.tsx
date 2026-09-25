import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { NAV_TABS } from '../data/navigation'

/**
 * Horizontal tab bar. The active tab gets a glowing bronze underline.
 * On narrow screens the row scrolls sideways and keeps the active tab
 * centred in view.
 */
export function TabNav({ className = '' }: { className?: string }) {
  const listRef = useRef<HTMLUListElement>(null)
  const { pathname } = useLocation()

  // Scroll the active tab into the middle of the row (only matters on mobile,
  // where the row overflows). Uses scrollTo so the page itself never scrolls.
  useEffect(() => {
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !active) return
    const left = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2
    list.scrollTo({ left, behavior: 'smooth' })
  }, [pathname])

  return (
    <nav aria-label="Main" className={className}>
      <ul
        ref={listRef}
        className="no-scrollbar relative flex snap-x items-stretch gap-1 overflow-x-auto md:justify-center"
      >
        {NAV_TABS.map((tab) => (
          <li key={tab.path} className="shrink-0 snap-center">
            <NavLink
              to={tab.path}
              end
              className={({ isActive }) =>
                `group relative flex h-12 items-center px-3 font-display text-[0.95rem] font-bold tracking-[0.14em] whitespace-nowrap uppercase transition-colors duration-200 sm:px-4 lg:text-base ${
                  isActive ? 'text-parchment-50' : 'text-parchment-300/70 hover:text-parchment-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Soft furnace glow behind the active tab */}
                  <span
                    className={`absolute inset-x-1 inset-y-1.5 rounded-md bg-linear-to-t from-ember-500/20 to-transparent transition-opacity duration-300 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span className="relative">{tab.label}</span>
                  {/* Underline: full and glowing when active, grows in on hover otherwise */}
                  <span
                    className={`absolute inset-x-3 bottom-0 h-[3px] origin-center rounded-full bg-linear-to-r from-bronze-500 via-brass-300 to-bronze-500 transition duration-300 ${
                      isActive
                        ? 'scale-x-100 opacity-100 shadow-[0_0_12px_2px_rgb(255_157_77/0.6)]'
                        : 'scale-x-0 opacity-60 group-hover:scale-x-75'
                    }`}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
