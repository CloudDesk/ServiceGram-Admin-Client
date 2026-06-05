import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../utils/cn'
import { env } from '../../config/env'

export function Sidebar() {
  const can = useAuthStore((state) => state.can)

  return (
    <aside className="hidden h-screen bg-sidebar text-sidebar-foreground lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">
            {env.appVersion}
          </p>
          <h1 className="mt-2 text-lg font-semibold">{env.appName}</h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navigationItems
              .filter((item) => item.permission && can(item.permission))
              .map((item) => {
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <NavLink
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-white'
                            : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white',
                        )
                      }
                      to={item.href}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                )
              })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
