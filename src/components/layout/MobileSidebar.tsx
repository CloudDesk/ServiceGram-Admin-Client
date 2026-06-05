import { useUiStore } from '../../store/uiStore'
import { SidebarPanel } from './Sidebar'

export function MobileSidebar() {
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen)
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar)

  if (!mobileSidebarOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        aria-label="Close sidebar backdrop"
        className="absolute inset-0 bg-overlay"
        type="button"
        onClick={closeMobileSidebar}
      />
      <div className="relative h-full w-[min(86vw,21rem)]">
        <SidebarPanel
          isCollapsed={false}
          isMobile
          onClose={closeMobileSidebar}
        />
      </div>
    </div>
  )
}
