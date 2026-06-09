import { ChevronLeft, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { navigationItems } from "../../config/navigation";
import { routePaths } from "../../config/routes";
import { storageKeys } from "../../lib/storage";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../utils/cn";

interface SidebarPanelProps {
  isCollapsed: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

function SidebarPanel({
  isCollapsed,
  isMobile = false,
  onClose,
  onToggleCollapse,
}: SidebarPanelProps) {
  const can = useAuthStore((state) => state.can);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "premium-sidebar-panel flex h-full flex-col overflow-hidden transition-[width] duration-300 ease-out",
        isCollapsed && !isMobile ? "w-[5.5rem]" : "w-full",
      )}
    >
      <div
        className={cn(
          "premium-sidebar-header flex items-center gap-3 px-5 py-5",
          isCollapsed && !isMobile ? "justify-center px-3" : "justify-between",
        )}
      >
        <div className={cn("min-w-0", isCollapsed && !isMobile && "hidden")}>
          <h1 className="text-[1.2rem] font-semibold tracking-[-0.04em] text-[color:var(--adaptive-text-main)]">
            ServiceGram
          </h1>
        </div>

        {isMobile ? (
          <button
            aria-label="Close sidebar"
            className="btn-icon"
            type="button"
            onClick={onClose}
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <button
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "p-0 text-[color:var(--adaptive-text-muted)] transition hover:text-[color:var(--adaptive-text-main)]",
              isCollapsed && "mx-auto",
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
            onClick={onToggleCollapse}
          >
            <ChevronLeft
              className={cn(
                "size-5 transition-transform duration-200",
                isCollapsed && "rotate-180",
              )}
            />
          </button>
        )}
      </div>

      <nav className="premium-sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navigationItems
            .filter((item) => item.permission && can(item.permission))
            .map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        "premium-sidebar-link group flex items-center text-sm font-medium",
                        isCollapsed && !isMobile
                          ? "justify-center px-2.5 py-3"
                          : "gap-3 px-3.5 py-3",
                        isActive
                          ? "premium-sidebar-link-active text-[color:var(--adaptive-text-main)]"
                          : "text-[color:var(--adaptive-text-muted)] hover:text-[color:var(--adaptive-text-main)]",
                      )
                    }
                    title={isCollapsed && !isMobile ? item.label : undefined}
                    to={item.href}
                    onClick={() => {
                      if (isMobile) {
                        onClose?.();
                      }
                    }}
                  >
                    <span className="premium-sidebar-icon shrink-0">
                      <Icon className="size-4" />
                    </span>
                    {isCollapsed && !isMobile ? null : (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
        </ul>
      </nav>

      {isMobile ? (
        <div className="border-t border-[color:var(--adaptive-border)] px-3 py-3">
          <button
            className="premium-sidebar-link flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-adaptive-muted"
            type="button"
            onClick={() => {
              window.localStorage.removeItem(storageKeys.authSession);
              logout();
              onClose?.();
              navigate(routePaths.login);
            }}
          >
            <span className="premium-sidebar-icon shrink-0">
              <LogOut className="size-4" />
            </span>
            <span className="truncate">Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        "hidden h-screen lg:sticky lg:top-0 lg:block",
        sidebarCollapsed ? "lg:w-[5.5rem]" : "lg:w-[18rem]",
      )}
    >
      <SidebarPanel
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
    </aside>
  );
}

export { SidebarPanel };
