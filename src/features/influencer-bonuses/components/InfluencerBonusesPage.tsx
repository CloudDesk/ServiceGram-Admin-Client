import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, RefreshCcw, ShieldCheck } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { routePaths } from "../../../config/routes";
import { useAuthStore } from "../../../store/authStore";
import { cn } from "../../../utils/cn";
import { Release2ReasonModal } from "../../release2/components/Release2ReasonModal";
import { influencerBonusService } from "../services/influencerBonus.service";
import type {
  InfluencerBonusAward,
  InfluencerBonusAwardStatus,
  InfluencerBonusReviewDecision,
  InfluencerBonusRule,
  InfluencerBonusRuleStatus,
  InfluencerBonusRuleType,
} from "../types/influencerBonus.types";

type WorkspaceTab = "rules" | "awards";
type RuleAction = "activate" | "pause" | "archive";

type BonusAction =
  | { type: "rule"; rule: InfluencerBonusRule; action: RuleAction }
  | {
      type: "award";
      award: InfluencerBonusAward;
      decision: InfluencerBonusReviewDecision;
    };

const ruleStatuses: (InfluencerBonusRuleStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
];

const awardStatuses: (InfluencerBonusAwardStatus | "ALL")[] = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "HELD",
  "PAID",
];

const ruleTypes: (InfluencerBonusRuleType | "ALL")[] = [
  "ALL",
  "VIEW_MILESTONE",
  "SHARE_MILESTONE",
  "BOOKING_CONVERSION_MILESTONE",
  "CONSISTENCY_BONUS",
  "NEIGHBOURHOOD_CHAMPION",
];

const inputClass =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";
const emptyRules: InfluencerBonusRule[] = [];
const emptyAwards: InfluencerBonusAward[] = [];

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

function formatPaise(value: number | null | undefined, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format((value ?? 0) / 100);
}

function statusTone(status: string) {
  if (["ACTIVE", "APPROVED", "PAID"].includes(status)) return "success" as const;
  if (["DRAFT", "PENDING_REVIEW", "HELD"].includes(status)) {
    return "warning" as const;
  }
  if (["ARCHIVED", "REJECTED"].includes(status)) return "danger" as const;
  return "neutral" as const;
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

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted">
        Adjust filters or seed Phase 4 bonus samples to populate this view.
      </p>
    </div>
  );
}

function actionTitle(action: BonusAction) {
  if (action.type === "award") {
    return action.decision === "APPROVED"
      ? "Approve bonus award"
      : "Reject bonus award";
  }

  if (action.action === "activate") return "Activate bonus rule";
  if (action.action === "pause") return "Pause bonus rule";
  return "Archive bonus rule";
}

function actionConfirmLabel(action: BonusAction) {
  if (action.type === "award") {
    return action.decision === "APPROVED" ? "Approve award" : "Reject award";
  }

  if (action.action === "activate") return "Activate rule";
  if (action.action === "pause") return "Pause rule";
  return "Archive rule";
}

function actionSubtitle(action: BonusAction) {
  if (action.type === "award") {
    return `${action.award.publicAwardId} · ${action.award.influencer.displayName}`;
  }

  return `${action.rule.publicRuleId} · ${action.rule.title}`;
}

export function InfluencerBonusesPage() {
  const queryClient = useQueryClient();
  const canUpdateRules = useAuthStore((state) => state.can("campaigns:update"));
  const canReviewAwards = useAuthStore((state) => state.can("campaigns:review"));
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("rules");
  const [search, setSearch] = useState("");
  const [ruleStatus, setRuleStatus] =
    useState<InfluencerBonusRuleStatus | "ALL">("ALL");
  const [ruleType, setRuleType] =
    useState<InfluencerBonusRuleType | "ALL">("ALL");
  const [awardStatus, setAwardStatus] =
    useState<InfluencerBonusAwardStatus | "ALL">("PENDING_REVIEW");
  const [action, setAction] = useState<BonusAction | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["influencer-bonuses", "rules", search, ruleStatus, ruleType],
    queryFn: () =>
      influencerBonusService.listRules({
        page: 1,
        limit: 50,
        search: search.trim() || undefined,
        status: ruleStatus === "ALL" ? undefined : ruleStatus,
        ruleType: ruleType === "ALL" ? undefined : ruleType,
      }),
  });

  const awardsQuery = useQuery({
    queryKey: ["influencer-bonuses", "awards", awardStatus],
    queryFn: () =>
      influencerBonusService.listAwards({
        page: 1,
        limit: 50,
        status: awardStatus === "ALL" ? undefined : awardStatus,
      }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      currentAction,
      reason,
    }: {
      currentAction: BonusAction;
      reason: string;
    }) => {
      if (currentAction.type === "award") {
        return influencerBonusService.reviewAward(currentAction.award.id, {
          decision: currentAction.decision,
          expectedVersion: currentAction.award.version,
          reason,
        });
      }

      const payload = {
        expectedVersion: currentAction.rule.version,
        reason,
      };

      if (currentAction.action === "activate") {
        return influencerBonusService.activateRule(currentAction.rule.id, payload);
      }

      if (currentAction.action === "pause") {
        return influencerBonusService.pauseRule(currentAction.rule.id, payload);
      }

      return influencerBonusService.archiveRule(currentAction.rule.id, payload);
    },
    onSuccess: async () => {
      setAction(null);
      await queryClient.invalidateQueries({ queryKey: ["influencer-bonuses"] });
    },
  });

  const rules = rulesQuery.data?.data ?? emptyRules;
  const awards = awardsQuery.data?.data ?? emptyAwards;
  const pendingAwards = useMemo(
    () => awards.filter((award) => award.status === "PENDING_REVIEW").length,
    [awards],
  );
  const loadedLiability = useMemo(
    () => awards.reduce((total, award) => total + award.amountPaise, 0),
    [awards],
  );

  const openAction = (nextAction: BonusAction) => {
    actionMutation.reset();
    setAction(nextAction);
  };

  const closeAction = () => {
    actionMutation.reset();
    setAction(null);
  };

  return (
    <PageContainer className="space-y-5">
      <PageContextHeader
        breadcrumbs={[
          { label: "Release 2", href: routePaths.release2Overview },
          { label: "Influencer Bonuses" },
        ]}
        description="Release 2 workspace for influencer bonus rules, award liability, and manual award review."
        title="Influencer Bonuses"
        titleMetaNode={<Badge tone="success">Phase 4 · Bonus operations</Badge>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          hint="Across loaded rule filters"
          label="Rules"
          value={rulesQuery.data?.pagination.totalItems ?? 0}
        />
        <SummaryCard
          hint="Loaded page only"
          label="Active rules"
          value={rules.filter((rule) => rule.status === "ACTIVE").length}
        />
        <SummaryCard
          hint="Loaded award page"
          label="Pending review"
          value={pendingAwards}
        />
        <SummaryCard
          hint="Loaded award page"
          label="Award liability"
          value={formatPaise(loadedLiability)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-xl bg-surface-muted p-1">
            {(["rules", "awards"] as WorkspaceTab[]).map((tab) => (
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
                {tab === "rules" ? "Bonus rules" : "Award review"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {activeTab === "rules" ? (
              <>
                <input
                  className={cn(inputClass, "sm:w-56")}
                  placeholder="Search rule"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  className={cn(inputClass, "sm:w-40")}
                  value={ruleStatus}
                  onChange={(event) =>
                    setRuleStatus(
                      event.target.value as InfluencerBonusRuleStatus | "ALL",
                    )
                  }
                >
                  {ruleStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? "All statuses" : humanize(status)}
                    </option>
                  ))}
                </select>
                <select
                  className={cn(inputClass, "sm:w-64")}
                  value={ruleType}
                  onChange={(event) =>
                    setRuleType(
                      event.target.value as InfluencerBonusRuleType | "ALL",
                    )
                  }
                >
                  {ruleTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "ALL" ? "All rule types" : humanize(type)}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void rulesQuery.refetch()}
                >
                  <RefreshCcw className="size-4" />
                  Refresh
                </Button>
              </>
            ) : (
              <>
                <select
                  className={cn(inputClass, "sm:w-52")}
                  value={awardStatus}
                  onChange={(event) =>
                    setAwardStatus(
                      event.target.value as InfluencerBonusAwardStatus | "ALL",
                    )
                  }
                >
                  {awardStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? "All award statuses" : humanize(status)}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void awardsQuery.refetch()}
                >
                  <RefreshCcw className="size-4" />
                  Refresh
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab === "rules" ? (
        <RulesPanel
          canUpdate={canUpdateRules}
          isError={rulesQuery.isError}
          isLoading={rulesQuery.isLoading}
          rows={rules}
          onAction={openAction}
          onRetry={() => void rulesQuery.refetch()}
        />
      ) : (
        <AwardsPanel
          canReview={canReviewAwards}
          isError={awardsQuery.isError}
          isLoading={awardsQuery.isLoading}
          rows={awards}
          onAction={openAction}
          onRetry={() => void awardsQuery.refetch()}
        />
      )}

      {action ? (
        <BonusActionModal
          action={action}
          error={actionMutation.error}
          isSubmitting={actionMutation.isPending}
          onClose={closeAction}
          onReload={() => {
            void rulesQuery.refetch();
            void awardsQuery.refetch();
          }}
          onSubmit={(reason) =>
            actionMutation.mutate({ currentAction: action, reason })
          }
        />
      ) : null}
    </PageContainer>
  );
}

function RulesPanel({
  canUpdate,
  isError,
  isLoading,
  onAction,
  onRetry,
  rows,
}: {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onAction: (action: BonusAction) => void;
  onRetry: () => void;
  rows: InfluencerBonusRule[];
}) {
  if (isLoading) return <EmptyPanel label="Loading bonus rules…" />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <p className="font-medium text-danger">Bonus rules unavailable</p>
        <p className="mt-1 text-sm text-muted">
          The backend request failed. Check API availability and permissions.
        </p>
        <Button className="mt-3" size="sm" type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (rows.length === 0) return <EmptyPanel label="No bonus rules found" />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <div className="grid min-w-[1120px] grid-cols-[minmax(240px,1fr)_180px_150px_150px_150px_180px] gap-3 border-b border-border bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Rule</span>
        <span>Type</span>
        <span>Threshold</span>
        <span>Amount</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      {rows.map((rule) => (
        <div
          key={rule.id}
          className="grid min-w-[1120px] grid-cols-[minmax(240px,1fr)_180px_150px_150px_150px_180px] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{rule.title}</p>
            <p className="truncate text-xs text-muted">
              {rule.publicRuleId} · {rule.ruleCode}
            </p>
            <p className="mt-1 text-xs text-muted">
              Window {rule.windowDays}d · Max{" "}
              {rule.maxAwardsPerInfluencerPerWindow}/creator/window
            </p>
          </div>
          <span className="text-muted">{humanize(rule.ruleType)}</span>
          <span className="font-semibold text-foreground">
            {new Intl.NumberFormat("en-IN").format(rule.metricThreshold)}
          </span>
          <span className="font-semibold text-foreground">
            {formatPaise(rule.amountPaise, rule.currency)}
          </span>
          <div>
            <Badge tone={statusTone(rule.status)}>{humanize(rule.status)}</Badge>
            <p className="mt-1 text-xs text-muted">
              Updated {formatDate(rule.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canUpdate ? (
              <>
                {rule.status !== "ACTIVE" && rule.status !== "ARCHIVED" ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="primary"
                    onClick={() => onAction({ type: "rule", rule, action: "activate" })}
                  >
                    Activate
                  </Button>
                ) : null}
                {rule.status === "ACTIVE" ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => onAction({ type: "rule", rule, action: "pause" })}
                  >
                    Pause
                  </Button>
                ) : null}
                {rule.status !== "ARCHIVED" ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="danger"
                    onClick={() => onAction({ type: "rule", rule, action: "archive" })}
                  >
                    Archive
                  </Button>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-muted">Read only</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AwardsPanel({
  canReview,
  isError,
  isLoading,
  onAction,
  onRetry,
  rows,
}: {
  canReview: boolean;
  isError: boolean;
  isLoading: boolean;
  onAction: (action: BonusAction) => void;
  onRetry: () => void;
  rows: InfluencerBonusAward[];
}) {
  if (isLoading) return <EmptyPanel label="Loading bonus awards…" />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <p className="font-medium text-danger">Bonus awards unavailable</p>
        <p className="mt-1 text-sm text-muted">
          The backend request failed. Check API availability and permissions.
        </p>
        <Button className="mt-3" size="sm" type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (rows.length === 0) return <EmptyPanel label="No bonus awards found" />;

  return (
    <div className="grid gap-3">
      {rows.map((award) => (
        <article
          key={award.id}
          className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">
                  {award.influencer.displayName}
                </p>
                <Badge tone={statusTone(award.status)}>
                  {humanize(award.status)}
                </Badge>
                {award.status === "PENDING_REVIEW" ? (
                  <Badge tone="warning">
                    <ShieldCheck className="mr-1 size-3" />
                    Needs review
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                {award.influencer.publicInfluencerId}
                {award.influencer.socialHandle
                  ? ` · ${award.influencer.socialHandle}`
                  : ""}
              </p>
              <p className="mt-2 text-sm text-muted">
                {award.rule.title} · {humanize(award.rule.ruleType)} · Period{" "}
                {award.periodKey}
              </p>
              {award.reviewReason ? (
                <p className="mt-2 max-w-3xl text-sm text-muted">
                  {award.reviewReason}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-surface-muted px-4 py-3">
              <Coins className="size-5 text-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Amount
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatPaise(award.amountPaise, award.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <SummaryCard label="Metric" value={award.metricValue} />
            <SummaryCard label="Rule version" value={award.ruleVersion} />
            <SummaryCard label="Window start" value={formatDate(award.windowStart)} />
            <SummaryCard label="Window end" value={formatDate(award.windowEnd)} />
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted">
              {award.publicAwardId} · Created {formatDate(award.createdAt)}
            </p>
            {canReview && award.status === "PENDING_REVIEW" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="primary"
                  onClick={() =>
                    onAction({ type: "award", award, decision: "APPROVED" })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="danger"
                  onClick={() =>
                    onAction({ type: "award", award, decision: "REJECTED" })
                  }
                >
                  Reject
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted">
                {canReview ? "No review action" : "Read only"}
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function BonusActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onReload,
  onSubmit,
}: {
  action: BonusAction;
  error: unknown;
  isSubmitting: boolean;
  onClose: () => void;
  onReload: () => void;
  onSubmit: (reason: string) => void;
}) {
  const isDestructive =
    (action.type === "rule" && action.action === "archive") ||
    (action.type === "award" && action.decision === "REJECTED");

  return (
    <Release2ReasonModal
      confirmLabel={actionConfirmLabel(action)}
      error={error}
      isDestructive={isDestructive}
      isSubmitting={isSubmitting}
      subtitle={actionSubtitle(action)}
      title={actionTitle(action)}
      onClose={onClose}
      onReload={onReload}
      onSubmit={onSubmit}
    >
      <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-muted">
        This action uses version{" "}
        {action.type === "rule" ? action.rule.version : action.award.version} and
        stores the required reason in the audit trail.
      </div>
    </Release2ReasonModal>
  );
}
