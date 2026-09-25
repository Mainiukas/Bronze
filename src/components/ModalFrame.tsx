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
}

/** Standard riveted modal: header with title and close button, scrolling body, optional footer. */
export function ModalFrame({ open, onClose, id, title, icon, children, footer }: ModalFrameProps) {
  const titleId = `${id}-title`
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId}>
      <div className="plate rivets flex max-h-[calc(100dvh-2rem)] flex-col border-bronze-400/40 bg-soot-900/95">
        <header className="flex items-center gap-3 border-b border-bronze-500/20 px-6 py-4">
          {icon && <span className="text-2xl text-bronze-300">{icon}</span>}
          <h2 id={titleId} className="metal-text flex-1 font-display text-3xl font-extrabold tracking-[0.12em] uppercase">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="icon-btn size-9 text-base" aria-label={`Close ${title}`}>
            <IconClose />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-3 border-t border-bronze-500/20 px-6 py-4">{footer}</footer>
        )}
      </div>
    </Dialog>
  )
}
