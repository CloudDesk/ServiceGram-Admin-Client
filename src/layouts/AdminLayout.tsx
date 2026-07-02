import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileSidebar } from "../components/layout/MobileSidebar";
import { Topbar } from "../components/layout/Topbar";
import { usePageChrome } from "../providers/pageChromeContext";
import { useUiStore } from "../store/uiStore";
import { cn } from "../utils/cn";

export function AdminLayout() {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const { pageChrome } = usePageChrome();
  const location = useLocation();
  const scrollRegionRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (pageChrome.layout === "workspace") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      scrollRegionRef.current?.scrollTo({ top: 0, left: 0 });
    }
  }, [location.pathname, pageChrome.layout]);

  useLayoutEffect(() => {
    const isWorkspace = pageChrome.layout === "workspace";
    const root = document.getElementById("root");

    document.documentElement.classList.toggle(
      "admin-workspace-scroll-lock",
      isWorkspace,
    );
    document.body.classList.toggle("admin-workspace-scroll-lock", isWorkspace);
    root?.classList.toggle("admin-workspace-scroll-lock", isWorkspace);

    return () => {
      document.documentElement.classList.remove("admin-workspace-scroll-lock");
      document.body.classList.remove("admin-workspace-scroll-lock");
      root?.classList.remove("admin-workspace-scroll-lock");
    };
  }, [pageChrome.layout]);

  return (
    <div
      className={cn(
        "app-shell-grid premium-page-surface",
        pageChrome.layout === "workspace" && "app-shell-grid--workspace",
      )}
      style={
        {
          "--desktop-sidebar-width": sidebarCollapsed ? "5.5rem" : "18rem",
        } as CSSProperties
      }
    >
      <Sidebar />
      <MobileSidebar />

      <div className="app-main-shell min-w-0">
        <Topbar />

        <main
          className={cn(
            "page-scroll-region premium-page-surface",
            pageChrome.layout === "workspace" &&
              "page-scroll-region--workspace",
          )}
          ref={scrollRegionRef}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
