import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Topbar } from '../components/layout/Topbar'

export function AdminLayout() {
  return (
    <div className="app-shell-grid">
      <Sidebar />
      <div className="min-w-0">
        <Topbar />
        <main className="page-scroll-region">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
