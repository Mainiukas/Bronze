import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

interface View {
  scale: number
  x: number
  y: number
}

const MIN = 1
const MAX = 4
/** A press that moves further than this pans instead of clicking. */
const DRAG = 6

/**
 * Lets its content (the board) be zoomed with the mouse wheel, a pinch or
 * the + / − buttons, and panned by dragging once zoomed in. A drag never
 * counts as a click on what's underneath. At normal size a one-finger swipe
 * still scrolls the page.
 */
export function ZoomPan({ children, label = 'Board' }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ type: 'pan' | 'pinch' | 'press'; start: View; from: { x: number; y: number }; distance?: number } | null>(null)
  const suppressClick = useRef(false)

  /** Keep the content covering the frame: no gaps at the edges. */
  const apply = (next: View) => {
    const el = ref.current
    const w = el?.clientWidth ?? 0
    const h = el?.clientHeight ?? 0
    const scale = Math.min(MAX, Math.max(MIN, next.scale))
    const clamped = { scale, x: Math.min(0, Math.max(w - w * scale, next.x)), y: Math.min(0, Math.max(h - h * scale, next.y)) }
    viewRef.current = clamped
    setView(clamped)
  }

  /** Zoom by `factor` keeping the point (px, py) inside the frame still. */
  const zoomAt = (factor: number, px: number, py: number) => {
    const v = viewRef.current
    const scale = Math.min(MAX, Math.max(MIN, v.scale * factor))
    const k = scale / v.scale
    apply({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k })
  }

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = ref.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: PointerEvent) => {
    pointers.current.set(event.pointerId, local(event))
    const points = [...pointers.current.values()]
    if (points.length === 2) {
      gesture.current = {
        type: 'pinch',
        start: viewRef.current,
        from: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1,
      }
      ref.current?.setPointerCapture(event.pointerId)
    } else if (points.length === 1) {
      gesture.current = { type: 'press', start: viewRef.current, from: points[0] }
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, local(event))
    const g = gesture.current
    if (!g) return
    const points = [...pointers.current.values()]
    if (g.type === 'pinch' && points.length >= 2) {
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      const scale = Math.min(MAX, Math.max(MIN, (g.start.scale * distance) / g.distance!))
      const k = scale / g.start.scale
      apply({ scale, x: mid.x - (g.from.x - g.start.x) * k, y: mid.y - (g.from.y - g.start.y) * k })
      suppressClick.current = true
      return
    }
    const p = points[0]
    if (g.type === 'press' && g.start.scale > 1 && Math.hypot(p.x - g.from.x, p.y - g.from.y) > DRAG) {
      g.type = 'pan'
      ref.current?.setPointerCapture(event.pointerId)
    }
    if (g.type === 'pan') {
      apply({ scale: g.start.scale, x: g.start.x + p.x - g.from.x, y: g.start.y + p.y - g.from.y })
      suppressClick.current = true
    }
  }

  const onPointerEnd = (event: PointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 0) gesture.current = null
    else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()]
      gesture.current = { type: 'pan', start: viewRef.current, from: p }
    }
  }

  const zoomButton = (factor: number) => {
    const el = ref.current
    zoomAt(factor, (el?.clientWidth ?? 0) / 2, (el?.clientHeight ?? 0) / 2)
  }
  const zoomed = view.scale > 1.001

  return (
    <div className="relative">
      <div
        ref={ref}
        className={`relative overflow-hidden ${zoomed ? 'cursor-grab touch-none active:cursor-grabbing' : 'touch-pan-y'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          // The end of a pan or pinch isn't a click on the board.
          if (suppressClick.current) {
            event.stopPropagation()
            event.preventDefault()
            suppressClick.current = false
          }
        }}
        onPointerDownCapture={() => {
          suppressClick.current = false
        }}
      >
        <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
      <div className="absolute right-2 bottom-2 flex flex-col-reverse gap-1.5" role="group" aria-label={`${label} zoom`}>
        <button type="button" className="icon-btn size-10 text-xl" aria-label="Zoom in" onClick={() => zoomButton(1.5)} disabled={view.scale >= MAX}>
          +
        </button>
        <button type="button" className="icon-btn size-10 text-xl" aria-label="Zoom out" onClick={() => zoomButton(1 / 1.5)} disabled={!zoomed}>
          −
        </button>
        {zoomed && (
          <button type="button" className="icon-btn size-10 text-sm" aria-label="Show the whole board" onClick={() => apply({ scale: 1, x: 0, y: 0 })}>
            ⤢
          </button>
        )}
      </div>
    </div>
  )
}
