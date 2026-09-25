import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from '../hooks/useToast'
import { Gear } from './Gear'
import { IconClose } from './icons'

/** How long a toast stays on screen. */
const TOAST_DURATION_MS = 4000
/** Matches the fade-out transition below. */
const TOAST_EXIT_MS = 250

interface Toast {
  id: number
  message: string
  leaving: boolean
}

/**
 * Provides `useToast()` to the app and renders the toast area.
 * One toast is shown at a time; a new message replaces the current one.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const nextId = useRef(0)

  const notify = useCallback((message: string) => {
    nextId.current += 1
    setToast({ id: nextId.current, message, leaving: false })
  }, [])

  const dismiss = useCallback(() => {
    setToast((current) => (current ? { ...current, leaving: true } : current))
  }, [])

  // Auto-dismiss, then remove the toast once its exit transition has run.
  useEffect(() => {
    if (!toast) return
    const timer = toast.leaving
      ? window.setTimeout(() => setToast(null), TOAST_EXIT_MS)
      : window.setTimeout(dismiss, TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [toast, dismiss])

  return (
    <ToastContext.Provider value={notify}>
      {children}

      {/* The live region is always mounted so screen readers announce new messages. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-32 z-50 flex justify-center px-4 lg:bottom-10"
      >
        {toast && (
          <div
            key={toast.id}
            className={`plate rivets pointer-events-auto flex w-full max-w-lg animate-toast-in items-center gap-3 overflow-hidden border-bronze-400/50 py-3 pr-3 pl-4 transition duration-250 ${
              toast.leaving ? 'translate-y-2 opacity-0' : 'opacity-100'
            }`}
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-ember-400 to-bronze-600" />
            <Gear teeth={10} holes={0} className="size-7 shrink-0 animate-[spin_3s_linear_infinite] text-bronze-400" />
            <p className="flex-1 font-display text-lg leading-tight font-semibold tracking-wide text-parchment-50">
              {toast.message}
            </p>
            <button type="button" onClick={dismiss} className="rounded-full p-1.5 text-parchment-300 hover:text-parchment-50">
              <IconClose className="size-4" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
