import {
  Bell,
  ChevronDown,
  Clock3,
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
import { usePageChrome } from "../../providers/pageChromeContext";
import { GlobalSearch } from "../../features/search/components/GlobalSearch";
import { authService } from "../../features/auth/services/auth.service";
import { buildPathWithQueryParams } from "../../utils/buildQueryParams";

function remainingSecondsUntil(value?: string | null, now = Date.now()) {
  if (!value) {
    return null;
  }

  const expiresAt = Date.parse(value);

  if (Number.isNaN(expiresAt)) {
    return null;
  }

  return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

function formatRemainingTime(seconds: number | null) {
  if (seconds === null) {
    return "Unavailable";
  }

  if (seconds <= 0) {
    return "Expired";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "<1m";
}

function sessionTimeTone(seconds: number | null) {
  if (seconds === null) {
    return "text-adaptive-muted";
  }

  if (seconds <= 0 || seconds <= 15 * 60) {
    return "text-[color:var(--adaptive-danger-text)]";
  }

  if (seconds <= 60 * 60) {
    return "text-[color:var(--adaptive-warning-text)]";
  }

  return "text-[color:var(--adaptive-success-text)]";
}

function accessTokenTimeTone(seconds: number | null) {
  if (seconds === null) {
    return "text-adaptive-muted";
  }

  if (seconds <= 0 || seconds <= 60) {
    return "text-[color:var(--adaptive-danger-text)]";
  }

  if (seconds <= 5 * 60) {
    return "text-[color:var(--adaptive-warning-text)]";
  }

  return "text-[color:var(--adaptive-success-text)]";
}

export function Topbar() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const canOpenNotifications = useAuthStore((state) =>
    state.can("notifications:read"),
  );
  const canOpenSettings = useAuthStore((state) => state.can("settings:read"));
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const { pageChrome } = usePageChrome();
  const [profileOpen, setProfileOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const profileRef = useRef<HTMLDivElement | null>(null);
  const title = pageChrome.title ?? "ServiceGram Admin";
  const description = pageChrome.description ?? "Admin operations console";
  const accessTokenRemainingSeconds = remainingSecondsUntil(
    session?.accessTokenExpiresAt,
    now,
  );
  const accessTokenRemainingLabel = formatRemainingTime(
    accessTokenRemainingSeconds,
  );
  const accessTokenRemainingTone = accessTokenTimeTone(
    accessTokenRemainingSeconds,
  );
  const sessionRemainingSeconds = remainingSecondsUntil(
    session?.refreshTokenExpiresAt,
    now,
  );
  const sessionRemainingLabel = formatRemainingTime(sessionRemainingSeconds);
  const sessionRemainingTone = sessionTimeTone(sessionRemainingSeconds);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 15_000);

    return () => window.clearInterval(intervalId);
  }, []);

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
    setProfileOpen(false);
    void authService.logout().finally(() => {
      clearSession();
      navigate(routePaths.login);
    });
  };

  const handleNavigate = (path: string) => {
    setProfileOpen(false);
    navigate(path);
  };

  return (
    <header className="premium-appbar grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 md:grid-cols-[minmax(12rem,0.9fr)_minmax(16rem,42rem)_auto] lg:px-8 xl:grid-cols-[minmax(16rem,0.9fr)_minmax(26rem,58rem)_minmax(16rem,0.9fr)]">
      <div className="flex min-w-0 items-center justify-start gap-3">
        <Button
          className="lg:hidden"
          size="sm"
          type="button"
          variant="secondary"
          onClick={openMobileSidebar}
        >
          <Menu className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-5 text-adaptive-main sm:text-base">
            {title}
          </h1>
          <p className="hidden truncate text-xs leading-4 text-adaptive-muted sm:block">
            {description}
          </p>
        </div>
      </div>

      <div className="hidden min-w-0 justify-center md:flex">
        <GlobalSearch />
      </div>

      <div className="flex items-center justify-end gap-3">
        {canOpenNotifications ? (
          <Button
            aria-label="Alerts"
            size="sm"
            type="button"
            variant="ghost"
            onClick={() =>
              navigate(
                `${buildPathWithQueryParams(routePaths.notifications, {
                  status: "FAILED",
                })}#notification-events`,
              )
            }
          >
            <Bell className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">Alerts</span>
          </Button>
        ) : null}

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
            <div className="premium-common-surface absolute right-0 top-[calc(100%+0.625rem)] z-[70] w-[min(20rem,calc(100vw-2rem))] overflow-hidden">
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
                <div className="mt-3 grid gap-2 rounded-[0.75rem] border border-adaptive bg-[color:var(--adaptive-search-bg)] px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-adaptive-muted">
                      <Clock3 className="size-3.5 shrink-0" />
                      <span className="truncate">Access token</span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${accessTokenRemainingTone}`}
                    >
                      {accessTokenRemainingLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-adaptive-muted">
                      <Clock3 className="size-3.5 shrink-0" />
                      <span className="truncate">Login session</span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${sessionRemainingTone}`}
                    >
                      {sessionRemainingLabel}
                    </span>
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
                {canOpenSettings ? (
                  <button
                    className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-adaptive-main transition hover:bg-[color:var(--adaptive-search-bg)]"
                    type="button"
                    onClick={() => handleNavigate(routePaths.settings)}
                  >
                    <Settings className="size-4 text-adaptive-mute" />
                    <span>Platform Settings</span>
                  </button>
                ) : null}
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
