import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DrawerRoot } from '../components/ui/Drawer/Drawer'
import { ModalRoot } from '../components/ui/Modal/Modal'
import { ToastViewport } from '../components/ui/Toast/Toast'
import { useUiStore } from '../store/uiStore'

export function ToastProvider({ children }: PropsWithChildren) {
  const toasts = useUiStore((state) => state.toasts)
  const dismissToast = useUiStore((state) => state.dismissToast)

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), 4000),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismissToast, toasts])

  return (
    <>
      {children}
      {createPortal(
        <>
          <ToastViewport />
          <ModalRoot />
          <DrawerRoot />
        </>,
        document.body,
      )}
    </>
  )
}
