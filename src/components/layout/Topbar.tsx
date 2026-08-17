import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  User,
  UserCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { routePaths } from "../../config/routes";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { usePageChrome } from "../../providers/pageChromeContext";
import { useTheme } from "../../providers/themeContext";
import { GlobalSearch } from "../../features/search/components/GlobalSearch";
import { authService } from "../../features/auth/services/auth.service";
import { dashboardApiService } from "../../features/dashboard/services/dashboard.api";

const BANK_ACCOUNT_APPROVAL_QUEUE = "BANK_ACCOUNT_APPROVALS";

function bankAccountApprovalPath() {
  return `${routePaths.vendors}?approvalQueue=${BANK_ACCOUNT_APPROVAL_QUEUE}`;
}

function normalizeApprovalPath(path: string, groupCode?: string) {
  if (groupCode === BANK_ACCOUNT_APPROVAL_QUEUE) {
    return bankAccountApprovalPath();
  }

  const [pathname, queryString = ""] = path.split("?");

  if (pathname !== routePaths.vendorOnboarding) {
    return path;
  }

  const searchParams = new URLSearchParams(queryString);

  if (!searchParams.has("bankAccountStatus")) {
    return path;
  }

  return bankAccountApprovalPath();
}

export function Topbar() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const canOpenApprovalCenter = useAuthStore((state) =>
    state.can("dashboard:read"),
  );
  const canOpenSettings = useAuthStore((state) => state.can("settings:read"));
  const user = useAuthStore((state) => state.user);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const { resolvedMode, toggleResolvedMode } = useTheme();
  const { pageChrome } = usePageChrome();
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const approvalRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const title = pageChrome.title ?? "ServiceGram Admin";
  const description =
    pageChrome.description ?? (pageChrome.title ? undefined : "Admin operations console");
  const isDarkTheme = resolvedMode === "dark";
  const themeToggleLabel = isDarkTheme
    ? "Switch to light theme"
    : "Switch to dark theme";
  const approvalQuery = useQuery({
    enabled: canOpenApprovalCenter,
    queryFn: dashboardApiService.getApprovalCenter,
    queryKey: ["dashboard", "approval-center"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const approvalCenter = approvalQuery.data;
  const approvalGroups =
    approvalCenter?.groups.filter((group) => group.count > 0 && group.path) ?? [];
  const totalPendingApprovals = approvalCenter?.totalPending ?? 0;
  const approvalCountLabel =
    totalPendingApprovals > 99 ? "99+" : String(totalPendingApprovals);

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

  useEffect(() => {
    if (!approvalOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!approvalRef.current?.contains(event.target as Node)) {
        setApprovalOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setApprovalOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [approvalOpen]);

  const handleLogout = () => {
    setProfileOpen(false);
    void authService.logout().finally(() => {
      clearSession();
      navigate(routePaths.login);
    });
  };

  const handleNavigate = (path: string, groupCode?: string) => {
    setApprovalOpen(false);
    setProfileOpen(false);
    navigate(normalizeApprovalPath(path, groupCode));
  };

  return (
    <header className="premium-appbar grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-4 px-4 sm:px-6 lg:px-8">
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
          <h1 className="truncate text-lg font-bold leading-6 text-adaptive-main sm:text-xl">
            {title}
          </h1>
          {description ? (
            <p className="hidden truncate text-xs leading-4 text-adaptive-muted sm:block">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-max items-center justify-end gap-2 sm:gap-3">
        <Button
          aria-label={themeToggleLabel}
          className="topbar-icon-button"
          size="sm"
          title={themeToggleLabel}
          type="button"
          variant="ghost"
          onClick={toggleResolvedMode}
        >
          {isDarkTheme ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>

        <GlobalSearch triggerVariant="icon" />

        {pageChrome.actionNode ? (
          <div className="flex shrink-0 items-center">{pageChrome.actionNode}</div>
        ) : null}

        {canOpenApprovalCenter ? (
          <div className="relative" ref={approvalRef}>
            <Button
              aria-expanded={approvalOpen}
              aria-haspopup="menu"
              aria-label="Approval alerts"
              className="relative"
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setProfileOpen(false);
                setApprovalOpen((current) => !current);
              }}
            >
              <Bell className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Approvals</span>
              {totalPendingApprovals > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--adaptive-primary)] px-1.5 text-[0.68rem] font-bold leading-5 text-white shadow-sm">
                  {approvalCountLabel}
                </span>
              ) : null}
            </Button>

            {approvalOpen ? (
              <div className="premium-common-surface absolute right-0 top-[calc(100%+0.625rem)] z-[70] w-[min(23rem,calc(100vw-2rem))] overflow-hidden">
                <div className="border-b border-adaptive bg-adaptive-surface px-4 py-3">
                  <p className="text-sm font-semibold text-adaptive-main">
                    Pending approvals
                  </p>
                  <p className="text-xs text-adaptive-muted">
                    {totalPendingApprovals > 0
                      ? `${totalPendingApprovals} approval${totalPendingApprovals === 1 ? "" : "s"} need attention`
                      : "No approval queues need attention"}
                  </p>
                </div>

                <div className="max-h-[min(28rem,calc(100vh-7rem))] overflow-y-auto p-2">
                  {approvalQuery.isLoading ? (
                    <p className="px-3 py-3 text-sm text-adaptive-muted">
                      Loading approvals...
                    </p>
                  ) : null}

                  {approvalQuery.isError ? (
                    <div className="space-y-2 px-3 py-3">
                      <p className="text-sm text-adaptive-muted">
                        Unable to load approval queues.
                      </p>
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => void approvalQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : null}

                  {!approvalQuery.isLoading &&
                  !approvalQuery.isError &&
                  approvalGroups.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-adaptive-muted">
                      Everything is clear.
                    </p>
                  ) : null}

                  {approvalGroups.map((group) => (
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-[0.95rem] px-3 py-2.5 text-left transition hover:bg-[color:var(--adaptive-search-bg)]"
                      key={group.code}
                      type="button"
                      onClick={() => {
                        if (group.path) {
                          handleNavigate(group.path, group.code);
                        }
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-adaptive-main">
                          {group.label}
                        </span>
                        <span className="block truncate text-xs text-adaptive-muted">
                          {group.description}
                        </span>
                      </span>
                      <span className="inline-flex min-w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--adaptive-primary-soft)] px-2 py-1 text-xs font-bold text-[color:var(--adaptive-primary)]">
                        {group.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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
