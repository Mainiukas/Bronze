import { createContext, useContext } from 'react'

/** Shows a short message in the toast area. */
export type Notify = (message: string) => void

export const ToastContext = createContext<Notify | null>(null)

/** Access the toast notifier. Must be used inside <ToastProvider>. */
export function useToast(): Notify {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast must be used inside <ToastProvider>')
  return notify
}
