import type { CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { MobileSidebar } from '../components/layout/MobileSidebar'
import { Topbar } from '../components/layout/Topbar'
import { useUiStore } from '../store/uiStore'

export function AdminLayout() {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)

  return (
    <div
      className="app-shell-grid"
      style={
        {
          '--desktop-sidebar-width': sidebarCollapsed ? '5.5rem' : '18rem',
        } as CSSProperties
      }
    >
      <Sidebar />
      <MobileSidebar />
      <div className="min-w-0">
        <Topbar />
        <main className="page-scroll-region">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
