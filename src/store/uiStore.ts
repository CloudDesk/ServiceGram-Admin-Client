import { create } from 'zustand'
import type { ReactNode } from 'react'

interface ToastItem {
  id: string
  tone: 'success' | 'warning' | 'danger' | 'info'
  title: string
  description?: string
}

interface OverlayState {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  toasts: ToastItem[]
  modalContent: ReactNode | null
  drawerContent: ReactNode | null
  toggleSidebar: () => void
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
  toggleMobileSidebar: () => void
  pushToast: (toast: Omit<ToastItem, 'id'>) => void
  dismissToast: (id: string) => void
  openModal: (content: ReactNode) => void
  closeModal: () => void
  openDrawer: (content: ReactNode) => void
  closeDrawer: () => void
}

export const useUiStore = create<OverlayState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  toasts: [],
  modalContent: null,
  drawerContent: null,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleMobileSidebar: () =>
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: crypto.randomUUID() },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  openModal: (modalContent) => set({ modalContent }),
  closeModal: () => set({ modalContent: null }),
  openDrawer: (drawerContent) => set({ drawerContent }),
  closeDrawer: () => set({ drawerContent: null }),
}))
