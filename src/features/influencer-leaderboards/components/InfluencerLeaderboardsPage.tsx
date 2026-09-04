import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Medal, RefreshCcw, ShieldAlert, Trophy } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { routePaths } from "../../../config/routes";
import { useAuthStore } from "../../../store/authStore";
import { cn } from "../../../utils/cn";
import { Release2ReasonModal } from "../../release2/components/Release2ReasonModal";
import { influencerLeaderboardService } from "../services/influencerLeaderboard.service";
import type {
  InfluencerBadgeDefinition,
  InfluencerBadgeSummary,
  InfluencerFraudReviewStatus,
  InfluencerLeaderboardCategory,
  InfluencerLeaderboardRow,
  InfluencerReputationGrade,
  InfluencerReputationRow,
} from "../types/influencerLeaderboard.types";

type WorkspaceTab = "leaderboards" | "reputation";

const leaderboardCategories: InfluencerLeaderboardCategory[] = [
  "BOOKINGS_GENERATED",
  "HIGHEST_VIEWS",
  "MOST_SHARED_REEL",
  "FASTEST_GROWING",
];

const reputationGrades: InfluencerReputationGrade[] = [
  "NEW",
  "RISING",
  "TRUSTED",
  "ELITE",
  "UNDER_REVIEW",
];

const fraudReviewStatuses: InfluencerFraudReviewStatus[] = [
  "CLEAR",
  "REVIEW_REQUIRED",
  "SUSPICIOUS",
  "RESTRICTED",
];

type LeaderboardAction =
  | {
      type: "visibility";
      row: InfluencerLeaderboardRow;
      visible: boolean;
    }
  | {
      type: "review";
      row: InfluencerReputationRow;
      fraudReviewStatus: InfluencerFraudReviewStatus;
    }
  | {
      type: "awardBadge";
      row: InfluencerReputationRow;
      badgeId: string;
      expiresAt: string;
    }
  | {
      type: "revokeBadge";
      row: InfluencerReputationRow;
      badge: InfluencerBadgeSummary;
    };

const inputClass =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";
const emptyLeaderboardRows: InfluencerLeaderboardRow[] = [];
const emptyReputationRows: InfluencerReputationRow[] = [];

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function gradeTone(grade: string) {
  if (["ELITE", "TRUSTED"].includes(grade)) return "success" as const;
  if (grade === "UNDER_REVIEW") return "warning" as const;
  if (grade === "RISING") return "info" as const;
  return "neutral" as const;
}

function visibilityTone(row: InfluencerLeaderboardRow) {
  if (row.isVisible && row.minSampleMet) return "success" as const;
  if (!row.minSampleMet) return "warning" as const;
  return "neutral" as const;
}

function rankDeltaLabel(delta: number | null) {
  if (delta === null) return "New";
  if (delta > 0) return `↑ ${delta}`;
  if (delta < 0) return `↓ ${Math.abs(delta)}`;
  return "—";
}

function metricLabel(category: InfluencerLeaderboardCategory, value: number) {
  if (category === "HIGHEST_VIEWS") {
    return new Intl.NumberFormat("en-IN", {
      notation: value >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-IN").format(value);
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function InfluencerLink({
  influencer,
}: {
  influencer: { id: string; displayName: string; publicInfluencerId: string };
}) {
  return (
    <Link
      className="font-semibold text-foreground hover:text-primary"
      to={`${routePaths.influencers}/${influencer.id}`}
    >
      {influencer.displayName}
    </Link>
  );
}

function BadgeRail({
  badges,
  canRevoke = false,
  onRevoke,
}: {
  badges: InfluencerBadgeSummary[];
  canRevoke?: boolean;
  onRevoke?: (badge: InfluencerBadgeSummary) => void;
}) {
  if (badges.length === 0) {
    return <span className="text-sm text-muted">No badges</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span key={badge.awardId} className="inline-flex items-center gap-1">
          <Badge tone={badge.status === "REVOKED" ? "neutral" : "info"}>
            {badge.title}
          </Badge>
          {canRevoke && badge.status !== "REVOKED" && badge.version ? (
            <button
              className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold text-danger hover:bg-danger/10"
              type="button"
              onClick={() => onRevoke?.(badge)}
            >
              Revoke
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted">
        Adjust filters or run the admin sample seed to populate this view.
      </p>
    </div>
  );
}

export function InfluencerLeaderboardsPage() {
  const queryClient = useQueryClient();
  const canUpdateLeaderboards = useAuthStore((state) =>
    state.can("leaderboards:update"),
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("leaderboards");
  const [search, setSearch] = useState("");
  const [periodMonth, setPeriodMonth] = useState("2026-08");
  const [category, setCategory] = useState<InfluencerLeaderboardCategory | "ALL">(
    "ALL",
  );
  const [grade, setGrade] = useState<InfluencerReputationGrade | "ALL">("ALL");
  const [fraudReviewStatus, setFraudReviewStatus] = useState("ALL");
  const [action, setAction] = useState<LeaderboardAction | null>(null);

  const leaderboardQuery = useQuery({
    queryKey: ["influencer-leaderboards", search, periodMonth, category],
    queryFn: () =>
      influencerLeaderboardService.listLeaderboards({
        page: 1,
        limit: 50,
        search: search.trim() || undefined,
        periodMonth: periodMonth || undefined,
        category: category === "ALL" ? undefined : [category],
      }),
  });

  const reputationQuery = useQuery({
    queryKey: ["influencer-reputation", search, grade, fraudReviewStatus],
    queryFn: () =>
      influencerLeaderboardService.listReputations({
        page: 1,
        limit: 50,
        search: search.trim() || undefined,
        grade: grade === "ALL" ? undefined : [grade],
        fraudReviewStatus:
          fraudReviewStatus === "ALL" ? undefined : fraudReviewStatus,
      }),
  });

  const badgesQuery = useQuery({
    enabled: canUpdateLeaderboards,
    queryKey: ["influencer-badges", "active"],
    queryFn: () => influencerLeaderboardService.listBadges(),
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      currentAction,
      reason,
    }: {
      currentAction: LeaderboardAction;
      reason: string;
    }) => {
      if (currentAction.type === "visibility") {
        return influencerLeaderboardService.updateLeaderboardVisibility(
          currentAction.row.id,
          {
            visible: currentAction.visible,
            reason,
          },
        );
      }

      if (currentAction.type === "review") {
        const expectedVersion = currentAction.row.reputation.version;

        if (!expectedVersion) {
          throw new Error("Reload this row before changing review status.");
        }

        return influencerLeaderboardService.reviewReputation(
          currentAction.row.influencer.id,
          {
            fraudReviewStatus: currentAction.fraudReviewStatus,
            expectedVersion,
            reason,
          },
        );
      }

      if (currentAction.type === "awardBadge") {
        return influencerLeaderboardService.awardBadge(
          currentAction.row.influencer.id,
          {
            badgeId: currentAction.badgeId,
            expiresAt: currentAction.expiresAt || null,
            reason,
          },
        );
      }

      const expectedVersion = currentAction.badge.version;

      if (!expectedVersion) {
        throw new Error("Reload this row before revoking the badge.");
      }

      return influencerLeaderboardService.revokeBadge(
        currentAction.badge.awardId,
        {
          expectedVersion,
          reason,
        },
      );
    },
    onSuccess: async () => {
      setAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["influencer-leaderboards"] }),
        queryClient.invalidateQueries({ queryKey: ["influencer-reputation"] }),
      ]);
    },
  });

  const openAction = (nextAction: LeaderboardAction) => {
    actionMutation.reset();
    setAction(nextAction);
  };
  const closeAction = () => {
    actionMutation.reset();
    setAction(null);
  };

  const leaderboardRows = leaderboardQuery.data?.data ?? emptyLeaderboardRows;
  const reputationRows = reputationQuery.data?.data ?? emptyReputationRows;
  const badgeDefinitions = badgesQuery.data?.data ?? [];
  const visibleLeaderboardCount = useMemo(
    () => leaderboardRows.filter((row) => row.isVisible && row.minSampleMet).length,
    [leaderboardRows],
  );
  const reviewRequiredCount = useMemo(
    () =>
      reputationRows.filter(
        (row) => row.reputation.fraudReviewStatus === "REVIEW_REQUIRED",
      ).length,
    [reputationRows],
  );

  return (
    <PageContainer className="space-y-5">
      <PageContextHeader
        breadcrumbs={[
          { label: "Release 2", href: routePaths.release2Overview },
          { label: "Influencer Leaderboards" },
        ]}
        description="Release 2 workspace for monthly influencer rankings, reputation scores, badge awards, and fraud-review visibility."
        title="Influencer Leaderboards"
        titleMetaNode={<Badge tone="success">Phase 4 · Admin controls</Badge>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          hint="Across loaded ranking filters"
          label="Leaderboard rows"
          value={leaderboardQuery.data?.pagination.totalItems ?? 0}
        />
        <SummaryCard
          hint="Visible and sample-qualified"
          label="Public rows"
          value={visibleLeaderboardCount}
        />
        <SummaryCard
          hint="Across loaded reputation filters"
          label="Reputation rows"
          value={reputationQuery.data?.pagination.totalItems ?? 0}
        />
        <SummaryCard
          hint="Needs admin attention"
          label="Review required"
          value={reviewRequiredCount}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-xl bg-surface-muted p-1">
            {(["leaderboards", "reputation"] as WorkspaceTab[]).map((tab) => (
              <button
                key={tab}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition",
                  activeTab === tab
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
                type="button"
                onClick={() => setActiveTab(tab)}
              >
                {tab === "leaderboards" ? "Monthly rankings" : "Reputation"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className={cn(inputClass, "sm:w-64")}
              placeholder="Search influencer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {activeTab === "leaderboards" ? (
              <>
                <input
                  className={cn(inputClass, "sm:w-36")}
                  type="month"
                  value={periodMonth}
                  onChange={(event) => setPeriodMonth(event.target.value)}
                />
                <select
                  className={cn(inputClass, "sm:w-56")}
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value as InfluencerLeaderboardCategory | "ALL",
                    )
                  }
                >
                  <option value="ALL">All categories</option>
                  {leaderboardCategories.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void leaderboardQuery.refetch()}
                >
                  <RefreshCcw className="size-4" />
                  Refresh
                </Button>
              </>
            ) : (
              <>
                <select
                  className={cn(inputClass, "sm:w-44")}
                  value={grade}
                  onChange={(event) =>
                    setGrade(
                      event.target.value as InfluencerReputationGrade | "ALL",
                    )
                  }
                >
                  <option value="ALL">All grades</option>
                  {reputationGrades.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
                <select
                  className={cn(inputClass, "sm:w-48")}
                  value={fraudReviewStatus}
                  onChange={(event) =>
                    setFraudReviewStatus(event.target.value)
                  }
                >
                  <option value="ALL">All fraud statuses</option>
                  <option value="CLEAR">Clear</option>
                  <option value="REVIEW_REQUIRED">Review required</option>
                </select>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void reputationQuery.refetch()}
                >
                  <RefreshCcw className="size-4" />
                  Refresh
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab === "leaderboards" ? (
        <LeaderboardPanel
          canUpdate={canUpdateLeaderboards}
          isError={leaderboardQuery.isError}
          isLoading={leaderboardQuery.isLoading}
          rows={leaderboardRows}
          onChangeVisibility={(row, visible) =>
            openAction({ type: "visibility", row, visible })
          }
          onRetry={() => void leaderboardQuery.refetch()}
        />
      ) : (
        <ReputationPanel
          badgeDefinitions={badgeDefinitions}
          badgesLoading={badgesQuery.isLoading}
          canUpdate={canUpdateLeaderboards}
          isError={reputationQuery.isError}
          isLoading={reputationQuery.isLoading}
          rows={reputationRows}
          onAwardBadge={(row) =>
            openAction({
              type: "awardBadge",
              row,
              badgeId: badgeDefinitions[0]?.id ?? "",
              expiresAt: "",
            })
          }
          onChangeReview={(row) =>
            openAction({
              type: "review",
              row,
              fraudReviewStatus:
                row.reputation.fraudReviewStatus === "CLEAR"
                  ? "REVIEW_REQUIRED"
                  : "CLEAR",
            })
          }
          onRevokeBadge={(row, badge) =>
            openAction({ type: "revokeBadge", row, badge })
          }
          onRetry={() => void reputationQuery.refetch()}
        />
      )}

      {action ? (
        <InfluencerLeaderboardActionModal
          action={action}
          badgeDefinitions={badgeDefinitions}
          error={actionMutation.error}
          isSubmitting={actionMutation.isPending}
          onActionChange={setAction}
          onClose={closeAction}
          onReload={() => {
            void leaderboardQuery.refetch();
            void reputationQuery.refetch();
          }}
          onSubmit={(reason) =>
            actionMutation.mutate({ currentAction: action, reason })
          }
        />
      ) : null}
    </PageContainer>
  );
}

function LeaderboardPanel({
  canUpdate,
  isError,
  isLoading,
  onChangeVisibility,
  rows,
  onRetry,
}: {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onChangeVisibility: (row: InfluencerLeaderboardRow, visible: boolean) => void;
  rows: InfluencerLeaderboardRow[];
  onRetry: () => void;
}) {
  if (isLoading) {
    return <EmptyPanel label="Loading leaderboard rows…" />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <p className="font-medium text-danger">Leaderboards unavailable</p>
        <p className="mt-1 text-sm text-muted">
          The backend request failed. Check API availability and permissions.
        </p>
        <Button className="mt-3" size="sm" type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyPanel label="No leaderboard rows found" />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <div className="grid min-w-[1120px] grid-cols-[80px_minmax(220px,1fr)_160px_140px_180px_180px_140px] gap-3 border-b border-border bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Rank</span>
        <span>Influencer</span>
        <span>Category</span>
        <span>Metric</span>
        <span>Reputation</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid min-w-[1120px] grid-cols-[80px_minmax(220px,1fr)_160px_140px_180px_180px_140px] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
        >
          <div>
            <p className="font-semibold text-foreground">#{row.rank}</p>
            <p className="text-xs text-muted">{rankDeltaLabel(row.rankDelta)}</p>
          </div>
          <div className="min-w-0">
            <InfluencerLink influencer={row.influencer} />
            <p className="truncate text-xs text-muted">
              {row.influencer.publicInfluencerId}
              {row.influencer.socialHandle ? ` · ${row.influencer.socialHandle}` : ""}
            </p>
            <div className="mt-2">
              <BadgeRail badges={row.badges} />
            </div>
          </div>
          <span className="text-muted">{humanize(row.category)}</span>
          <div>
            <p className="font-semibold text-foreground">
              {metricLabel(row.category, row.metricValue)}
            </p>
            <p className="text-xs text-muted">
              Sample {row.sampleSize}/{row.minimumSampleSize}
            </p>
          </div>
          <div>
            {row.reputation ? (
              <>
                <Badge tone={gradeTone(row.reputation.grade)}>
                  {humanize(row.reputation.grade)}
                </Badge>
                <p className="mt-1 text-xs text-muted">
                  Score {row.reputation.score ?? "provisional"}
                </p>
              </>
            ) : (
              <span className="text-muted">No score</span>
            )}
          </div>
          <div>
            <Badge tone={visibilityTone(row)}>
              {row.isVisible ? "Visible" : "Private"}
            </Badge>
            <p className="mt-1 text-xs text-muted">
              Generated {formatDate(row.generatedAt)}
            </p>
            {row.warnings.length > 0 ? (
              <p className="mt-1 text-xs text-warning">
                {row.warnings.map(humanize).join(", ")}
              </p>
            ) : null}
          </div>
          <div>
            {canUpdate ? (
              <Button
                disabled={!row.isVisible && !row.minSampleMet}
                size="sm"
                title={
                  !row.isVisible && !row.minSampleMet
                    ? "Minimum sample size must be met before a row can be public."
                    : undefined
                }
                type="button"
                variant={row.isVisible ? "secondary" : "primary"}
                onClick={() => onChangeVisibility(row, !row.isVisible)}
              >
                {row.isVisible ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
                {row.isVisible ? "Hide" : "Show"}
              </Button>
            ) : (
              <span className="text-xs text-muted">Read only</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReputationPanel({
  badgeDefinitions,
  badgesLoading,
  canUpdate,
  isError,
  isLoading,
  onAwardBadge,
  onChangeReview,
  onRevokeBadge,
  rows,
  onRetry,
}: {
  badgeDefinitions: InfluencerBadgeDefinition[];
  badgesLoading: boolean;
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onAwardBadge: (row: InfluencerReputationRow) => void;
  onChangeReview: (row: InfluencerReputationRow) => void;
  onRevokeBadge: (
    row: InfluencerReputationRow,
    badge: InfluencerBadgeSummary,
  ) => void;
  rows: InfluencerReputationRow[];
  onRetry: () => void;
}) {
  if (isLoading) {
    return <EmptyPanel label="Loading reputation rows…" />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <p className="font-medium text-danger">Reputation queue unavailable</p>
        <p className="mt-1 text-sm text-muted">
          The backend request failed. Check API availability and permissions.
        </p>
        <Button className="mt-3" size="sm" type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyPanel label="No reputation rows found" />;
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <article
          key={row.influencer.id}
          className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <InfluencerLink influencer={row.influencer} />
                <Badge tone={gradeTone(row.reputation.grade)}>
                  {humanize(row.reputation.grade)}
                </Badge>
                {row.reputation.fraudReviewStatus === "REVIEW_REQUIRED" ? (
                  <Badge tone="warning">
                    <ShieldAlert className="mr-1 size-3" />
                    Review required
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                {row.influencer.publicInfluencerId}
                {row.influencer.socialHandle ? ` · ${row.influencer.socialHandle}` : ""}
              </p>
              {row.reputation.reviewReason ? (
                <p className="mt-2 max-w-3xl text-sm text-muted">
                  {row.reputation.reviewReason}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-surface-muted px-4 py-3">
              <Trophy className="size-5 text-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Score
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {row.reputation.score ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <SummaryCard
              label="Content"
              value={row.reputation.components?.contentQualityScore ?? "—"}
            />
            <SummaryCard
              hint="Basis points"
              label="Conversion"
              value={row.reputation.components?.bookingConversionBps ?? "—"}
            />
            <SummaryCard
              hint="Basis points"
              label="Engagement"
              value={row.reputation.components?.audienceEngagementBps ?? "—"}
            />
            <SummaryCard
              label="Vendor feedback"
              value={row.reputation.components?.vendorFeedbackScore ?? "—"}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <Medal className="size-4" />
              <BadgeRail
                badges={row.badges}
                canRevoke={canUpdate}
                onRevoke={(badge) => onRevokeBadge(row, badge)}
              />
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <p className="text-sm text-muted">
                Sample {row.reputation.sampleSize}/
                {row.reputation.minimumSampleSize} · Last calculated{" "}
                {formatDate(row.reputation.lastCalculatedAt)}
              </p>
              {canUpdate ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    disabled={!row.reputation.version}
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => onChangeReview(row)}
                  >
                    Review status
                  </Button>
                  <Button
                    disabled={badgesLoading || badgeDefinitions.length === 0}
                    size="sm"
                    title={
                      badgeDefinitions.length === 0
                        ? "No active badge definitions are available."
                        : undefined
                    }
                    type="button"
                    variant="primary"
                    onClick={() => onAwardBadge(row)}
                  >
                    Award badge
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted">Read only</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function actionTitle(action: LeaderboardAction) {
  if (action.type === "visibility") {
    return action.visible ? "Show leaderboard row" : "Hide leaderboard row";
  }

  if (action.type === "review") {
    return "Update fraud review status";
  }

  if (action.type === "awardBadge") {
    return "Award influencer badge";
  }

  return "Revoke influencer badge";
}

function actionConfirmLabel(action: LeaderboardAction) {
  if (action.type === "visibility") {
    return action.visible ? "Show row" : "Hide row";
  }

  if (action.type === "review") return "Save review";
  if (action.type === "awardBadge") return "Award badge";
  return "Revoke badge";
}

function actionSubtitle(action: LeaderboardAction) {
  const influencer = action.row.influencer;

  if (action.type === "revokeBadge") {
    return `${influencer.displayName} · ${action.badge.title}`;
  }

  return `${influencer.displayName} · ${influencer.publicInfluencerId}`;
}

function InfluencerLeaderboardActionModal({
  action,
  badgeDefinitions,
  error,
  isSubmitting,
  onActionChange,
  onClose,
  onReload,
  onSubmit,
}: {
  action: LeaderboardAction;
  badgeDefinitions: InfluencerBadgeDefinition[];
  error: unknown;
  isSubmitting: boolean;
  onActionChange: (action: LeaderboardAction) => void;
  onClose: () => void;
  onReload: () => void;
  onSubmit: (reason: string) => void;
}) {
  return (
    <Release2ReasonModal
      confirmLabel={actionConfirmLabel(action)}
      error={error}
      isDestructive={action.type === "revokeBadge"}
      isSubmitting={isSubmitting}
      subtitle={actionSubtitle(action)}
      title={actionTitle(action)}
      warnings={
        action.type === "visibility" && action.visible
          ? action.row.warnings
          : undefined
      }
      onClose={onClose}
      onReload={onReload}
      onSubmit={onSubmit}
    >
      {action.type === "visibility" ? (
        <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-muted">
          This row will become {action.visible ? "public" : "private"} after the
          reason is saved to the audit trail.
        </div>
      ) : null}

      {action.type === "review" ? (
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-foreground">
            Fraud review status
          </span>
          <select
            className="form-input"
            disabled={isSubmitting}
            value={action.fraudReviewStatus}
            onChange={(event) =>
              onActionChange({
                ...action,
                fraudReviewStatus: event.target
                  .value as InfluencerFraudReviewStatus,
              })
            }
          >
            {fraudReviewStatuses.map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">
            Uses version {action.row.reputation.version ?? "—"} to prevent stale
            review updates.
          </span>
        </label>
      ) : null}

      {action.type === "awardBadge" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Badge</span>
            <select
              className="form-input"
              disabled={isSubmitting}
              value={action.badgeId}
              onChange={(event) =>
                onActionChange({
                  ...action,
                  badgeId: event.target.value,
                })
              }
            >
              {badgeDefinitions.map((badge) => (
                <option key={badge.id} value={badge.id}>
                  {badge.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground">
              Expires at
            </span>
            <input
              className="form-input"
              disabled={isSubmitting}
              type="datetime-local"
              value={action.expiresAt}
              onChange={(event) =>
                onActionChange({
                  ...action,
                  expiresAt: event.target.value,
                })
              }
            />
            <span className="text-xs text-muted">
              Leave empty for no expiry.
            </span>
          </label>
        </div>
      ) : null}

      {action.type === "revokeBadge" ? (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-muted">
          Revoking <span className="font-semibold">{action.badge.title}</span>{" "}
          will remove it from the active badge rail after the audit reason is
          saved.
        </div>
      ) : null}
    </Release2ReasonModal>
  );
}
