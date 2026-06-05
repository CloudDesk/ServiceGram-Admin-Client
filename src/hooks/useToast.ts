import { useUiStore } from '../store/uiStore'

export function useToast() {
  const pushToast = useUiStore((state) => state.pushToast)
  const dismissToast = useUiStore((state) => state.dismissToast)

  return {
    pushToast,
    dismissToast,
  }
}
