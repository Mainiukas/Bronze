import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import { IconClose } from './icons'

interface ModalFrameProps {
  open: boolean
  onClose: () => void
  /** Used for the heading's id so the dialog is labelled by it. */
  id: string
  title: string
  icon?: ReactNode
  children: ReactNode
  /** Optional footer, e.g. action buttons. */
  footer?: ReactNode
  /** Wider panel, for forms and long text. */
  wide?: boolean
}

/** Standard riveted modal: header with title and close button, scrolling body, optional footer. */
export function ModalFrame({ open, onClose, id, title, icon, children, footer, wide = false }: ModalFrameProps) {
  const titleId = `${id}-title`
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} className={wide ? 'bz-dialog--wide' : ''}>
      <div className="plate rivets flex max-h-[calc(100dvh-2rem)] flex-col border-bronze-400/40 bg-soot-900/95">
        <header className="flex items-center gap-3 border-b border-bronze-500/20 px-4 py-4 sm:px-6">
          {icon && <span className="text-2xl text-bronze-300">{icon}</span>}
          <h2 id={titleId} className="metal-text flex-1 font-display text-3xl font-extrabold tracking-[0.12em] uppercase">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="icon-btn size-10 text-base" aria-label={`Close ${title}`}>
            <IconClose />
          </button>
        </header>
        <div className="overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-3 border-t border-bronze-500/20 px-6 py-4">{footer}</footer>
        )}
      </div>
    </Dialog>
  )
}
