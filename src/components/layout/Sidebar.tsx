import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, LogOut } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  isNavigationItemVisible,
  navigationGroupLabels,
  navigationItems,
  type NavigationGroup,
  type NavigationItem,
} from "../../config/navigation";
import { routePaths } from "../../config/routes";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../utils/cn";

interface SidebarPanelProps {
  isCollapsed: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

interface SidebarLabelPopoverState {
  href: string;
  isActive: boolean;
  label: string;
  left: number;
  top: number;
}

const SIDEBAR_LABEL_POPOVER_ID = "collapsed-sidebar-label-popover";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarPanel({
  isCollapsed,
  isMobile = false,
  onClose,
  onToggleCollapse,
}: SidebarPanelProps) {
  const can = useAuthStore((state) => state.can);
  const clearSession = useAuthStore((state) => state.clearSession);
  const location = useLocation();
  const navigate = useNavigate();
  const [labelPopover, setLabelPopover] =
    useState<SidebarLabelPopoverState | null>(null);

  const showCollapsedLabel = (item: NavigationItem, target: HTMLElement) => {
    if (!isCollapsed || isMobile) return;

    const rect = target.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const top = clamp(rect.top + rect.height / 2, 44, viewportHeight - 44);

    setLabelPopover({
      href: item.href,
      isActive: isNavigationItemActive(location.pathname, item.href),
      label: item.label,
      left: rect.right + 12,
      top,
    });
  };

  const hideCollapsedLabel = () => {
    setLabelPopover(null);
  };

  useEffect(() => {
    if (!labelPopover) return undefined;

    const hide = () => setLabelPopover(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hide();
      }
    };

    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [labelPopover]);

  const shouldRenderLabelPopover =
    isCollapsed &&
    !isMobile &&
    labelPopover &&
    typeof document !== "undefined";

  const visibleItems = useMemo(
    () => navigationItems.filter((item) => isNavigationItemVisible(item, can)),
    [can],
  );

  /**
   * Ungrouped items keep their original flat order; grouped items collect into
   * labelled sections underneath so Release 2 rollout screens read as one set.
   */
  const groupedItems = useMemo(() => {
    const groups = new Map<NavigationGroup, NavigationItem[]>();

    visibleItems.forEach((item) => {
      if (!item.group) return;

      const existing = groups.get(item.group) ?? [];
      existing.push(item);
      groups.set(item.group, existing);
    });

    return [...groups.entries()];
  }, [visibleItems]);

  const renderNavItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const isPopoverActive = labelPopover?.href === item.href;

    return (
      <li key={item.href}>
        <NavLink
          aria-describedby={
            isCollapsed && !isMobile && isPopoverActive
              ? SIDEBAR_LABEL_POPOVER_ID
              : undefined
          }
          aria-label={isCollapsed && !isMobile ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              "premium-sidebar-link group flex items-center text-sm font-medium",
              isCollapsed && !isMobile
                ? "justify-center px-2.5 py-3"
                : "gap-3 px-3.5 py-3",
              isActive
                ? "premium-sidebar-link-active text-[color:var(--sg-sidebar-text-main)]"
                : "text-[color:var(--sg-sidebar-text-muted)] hover:text-[color:var(--sg-sidebar-text-main)]",
            )
          }
          end={item.exactMatch ?? false}
          to={item.href}
          onBlur={hideCollapsedLabel}
          onClick={() => {
            hideCollapsedLabel();

            if (isMobile) {
              onClose?.();
            }
          }}
          onFocus={(event) => showCollapsedLabel(item, event.currentTarget)}
          onMouseEnter={(event) => showCollapsedLabel(item, event.currentTarget)}
          onMouseLeave={hideCollapsedLabel}
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
  };

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
          <h1 className="text-[1.2rem] font-semibold tracking-normal text-[color:var(--sg-sidebar-text-main)]">
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
              "p-0 text-[color:var(--sg-sidebar-text-muted)] transition hover:text-[color:var(--sg-sidebar-text-main)]",
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
          {visibleItems.filter((item) => !item.group).map(renderNavItem)}
        </ul>

        {groupedItems.map(([group, items]) => (
          <div className="mt-5" key={group}>
            {isCollapsed && !isMobile ? (
              <div
                aria-hidden="true"
                className="mx-auto mb-2 h-px w-6 bg-[color:var(--sg-sidebar-border)]"
              />
            ) : (
              <p className="premium-sidebar-section-label mb-2 px-3.5">
                {navigationGroupLabels[group]}
              </p>
            )}
            <ul className="space-y-1">{items.map(renderNavItem)}</ul>
          </div>
        ))}
      </nav>

      {shouldRenderLabelPopover
        ? createPortal(
            <div
              className={cn(
                "premium-sidebar-label-popover",
                labelPopover.isActive && "premium-sidebar-label-popover-active",
              )}
              id={SIDEBAR_LABEL_POPOVER_ID}
              role="tooltip"
              style={{
                left: labelPopover.left,
                top: labelPopover.top,
              }}
            >
              <span className="premium-sidebar-label-popover-dot" />
              <span className="truncate">{labelPopover.label}</span>
            </div>,
            document.body,
          )
        : null}

      {isMobile ? (
        <div className="border-t border-[color:var(--sg-sidebar-border)] px-3 py-3">
          <button
            className="premium-sidebar-link flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-[color:var(--sg-sidebar-text-muted)]"
            type="button"
            onClick={() => {
              clearSession();
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
