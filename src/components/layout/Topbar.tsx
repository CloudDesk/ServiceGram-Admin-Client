import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  User,
  UserCircle2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { routePaths } from "../../config/routes";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { GlobalSearch } from "../../features/search/components/GlobalSearch";

export function Topbar() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const handleLogout = () => {
    clearSession();
    setProfileOpen(false);
    navigate(routePaths.login);
  };

  const handleNavigate = (path: string) => {
    setProfileOpen(false);
    navigate(path);
  };

  return (
    <header className="premium-appbar grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-8 xl:grid-cols-[minmax(12rem,1fr)_minmax(20rem,58rem)_minmax(12rem,1fr)]">
      <div className="flex min-w-0 items-center justify-start">
        <Button
          className="lg:hidden"
          size="sm"
          type="button"
          variant="secondary"
          onClick={openMobileSidebar}
        >
          <Menu className="size-4" />
        </Button>
      </div>

      <div className="flex min-w-0 justify-center">
        <GlobalSearch />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button aria-label="Alerts" size="sm" type="button" variant="ghost">
          <Bell className="size-4 sm:mr-2" />
          <span className="hidden sm:inline">Alerts</span>
        </Button>

        <div className="relative" ref={profileRef}>
          <button
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="btn-secondary flex items-center gap-2 px-3 py-2 text-left"
            type="button"
            onClick={() => setProfileOpen((current) => !current)}
          >
            <UserCircle2 className="size-4 shrink-0 text-[color:var(--adaptive-primary)]" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate font-medium text-adaptive-main">
                {user?.name ?? "Guest"}
              </p>
              <p className="truncate text-xs text-adaptive-muted">
                {user?.role ?? "No role"}
              </p>
            </div>
            <ChevronDown
              className={`hidden size-4 text-adaptive-muted transition-transform sm:block ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>

          {profileOpen ? (
            <div className="premium-common-surface absolute right-0 top-[calc(100%+0.625rem)] z-40 w-[min(20rem,calc(100vw-2rem))] overflow-hidden">
              <div className="border-b border-adaptive bg-adaptive-surface px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="premium-avatar size-10 shrink-0 text-[color:var(--adaptive-primary)]">
                    {" "}
                    <UserCircle2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-adaptive-muted">
                      {user?.name ?? "Guest"}
                    </p>
                    <p className="truncate text-sm text-adaptive-muted">
                      {user?.role ?? "No role"}
                    </p>
                    <p className="truncate text-xs text-adaptive-muted">
                      {user?.email ?? "No email available"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-adaptive-main transition hover:bg-[color:var(--adaptive-search-bg)]"
                  type="button"
                  onClick={() => handleNavigate(routePaths.profile)}
                >
                  <User className="size-4 text-adaptive-mute" />
                  <span>View Profile</span>
                </button>
                <button
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-adaptive-main transition hover:bg-[color:var(--adaptive-search-bg)]"
                  type="button"
                  onClick={() => handleNavigate(routePaths.settings)}
                >
                  <Settings className="size-4 text-adaptive-mute" />
                  <span>Account Settings</span>
                </button>
              </div>
              <div className="border-t border-adaptive p-2">
                <button
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-[color:var(--adaptive-danger-text)] transition hover:bg-[color:var(--adaptive-danger-bg)]"
                  type="button"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
