import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Megaphone,
  RefreshCcw,
  Send,
  Trophy,
  XCircle,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { usePermission } from "../../../hooks/usePermission";
import { formatDate } from "../../../utils/formatDate";
import { influencerCampaignService } from "../services/influencerCampaign.service";
import type {
  InfluencerCampaign,
  InfluencerCampaignObjective,
  InfluencerCampaignPayload,
  InfluencerCampaignStatus,
} from "../types/influencerCampaign.types";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const statuses: ("ALL" | InfluencerCampaignStatus)[] = [
  "ALL",
  "DRAFT",
  "PENDING_REVIEW",
  "UPCOMING",
  "ACTIVE",
  "CLOSED",
  "REWARD_PROCESSING",
  "COMPLETED",
  "CANCELLED",
];

const objectives: InfluencerCampaignObjective[] = [
  "AWARENESS",
  "BOOKING_GROWTH",
  "RETENTION",
  "VENDOR_PROMOTION",
];

const emptyForm: InfluencerCampaignPayload = {
  campaignCode: `creator-campaign-${Date.now()}`,
  title: "Creator campaign",
  summary: "Promote a focused ServiceGram growth campaign.",
  brief:
    "Create one clear service-focused reel that follows the campaign content requirements.",
  objective: "BOOKING_GROWTH",
  startsAt: null,
  endsAt: null,
  submissionDeadlineAt: null,
  maxParticipants: 100,
  budgetPaise: 1000000,
  currency: "INR",
  rewardSummary: "Top creators receive cash rewards after review.",
  rewards: [
    {
      rewardType: "CASH",
      title: "Winner reward",
      amountPaise: 1000000,
      rankFrom: 1,
      rankTo: 1,
      maxWinners: 1,
      metadata: {},
    },
  ],
  contentRequirements: { minDurationSeconds: 15, hashtags: ["#ServiceGram"] },
  eligibilitySummary: "Approved influencers only.",
  eligibilityRules: [
    {
      ruleType: "APPROVED_INFLUENCER",
      value: {},
      description: "Approved influencers only.",
      isRequired: true,
      displayOrder: 1,
    },
  ],
  visibilityRules: {},
  metadata: {},
  reason: "Create Phase 4 influencer campaign draft.",
};

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTone(status: InfluencerCampaignStatus) {
  if (["ACTIVE", "COMPLETED"].includes(status)) return "success" as const;
  if (status === "UPCOMING") return "info" as const;
  if (["PENDING_REVIEW", "REWARD_PROCESSING"].includes(status))
    return "warning" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "neutral" as const;
}

function dateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function fromDateInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function currency(value: number, code = "INR") {
  return new Intl.NumberFormat("en-IN", {
    currency: code,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value / 100);
}

function campaignToForm(campaign: InfluencerCampaign): InfluencerCampaignPayload {
  return {
    campaignCode: campaign.campaignCode,
    title: campaign.title,
    summary: campaign.summary,
    brief: campaign.brief,
    objective: campaign.objective,
    startsAt: campaign.schedule.startsAt,
    endsAt: campaign.schedule.endsAt,
    submissionDeadlineAt: campaign.schedule.submissionDeadlineAt,
    maxParticipants: campaign.maxParticipants,
    budgetPaise: campaign.budget.amountPaise,
    currency: campaign.budget.currency,
    rewardSummary: campaign.rewardSummary,
    rewards: campaign.rewards.map(({ rewardId: _rewardId, ...reward }) => reward),
    contentRequirements: campaign.contentRequirements,
    eligibilitySummary: campaign.eligibilitySummary,
    eligibilityRules: campaign.eligibilityRules.map(
      ({ ruleId: _ruleId, ...rule }) => rule,
    ),
    visibilityRules: campaign.visibilityRules,
    metadata: {},
    reason: "Update influencer campaign draft.",
  };
}

export function InfluencerCampaignsPage() {
  const queryClient = useQueryClient();
  const canUpdate = usePermission("campaigns:update");
  const canReview = usePermission("campaigns:review");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | InfluencerCampaignStatus>("ALL");
  const [editing, setEditing] = useState<InfluencerCampaign | null>(null);
  const [form, setForm] = useState<InfluencerCampaignPayload>(emptyForm);
  const [contentJson, setContentJson] = useState(
    JSON.stringify(emptyForm.contentRequirements, null, 2),
  );
  const [visibilityJson, setVisibilityJson] = useState(
    JSON.stringify(emptyForm.visibilityRules, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ["influencer-campaigns", search, status],
    queryFn: () => influencerCampaignService.list({ search, status }),
  });

  const campaigns = useMemo(
    () => campaignsQuery.data?.data ?? [],
    [campaignsQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        contentRequirements: JSON.parse(contentJson) as Record<string, unknown>,
        visibilityRules: JSON.parse(visibilityJson) as Record<string, unknown>,
      };
      return editing
        ? influencerCampaignService.update(editing.campaignId, body)
        : influencerCampaignService.create(body);
    },
    onSuccess: async () => {
      setEditing(null);
      setForm({ ...emptyForm, campaignCode: `creator-campaign-${Date.now()}` });
      setContentJson(JSON.stringify(emptyForm.contentRequirements, null, 2));
      setVisibilityJson(JSON.stringify(emptyForm.visibilityRules, null, 2));
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["influencer-campaigns"] });
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Save failed."),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({
      action,
      campaign,
      reason,
    }: {
      action: "submit" | "approve" | "cancel";
      campaign: InfluencerCampaign;
      reason: string;
    }) => {
      if (action === "submit")
        return influencerCampaignService.submitForReview(
          campaign.campaignId,
          reason,
        );
      if (action === "approve")
        return influencerCampaignService.approve(campaign.campaignId, reason);
      return influencerCampaignService.cancel(campaign.campaignId, reason);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["influencer-campaigns"] }),
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Action failed."),
  });

  const startEdit = async (campaign: InfluencerCampaign) => {
    setError(null);
    const detail = (await influencerCampaignService.detail(campaign.campaignId))
      .data;
    setEditing(detail);
    setForm(campaignToForm(detail));
    setContentJson(JSON.stringify(detail.contentRequirements, null, 2));
    setVisibilityJson(JSON.stringify(detail.visibilityRules, null, 2));
  };

  const runLifecycle = (
    campaign: InfluencerCampaign,
    action: "submit" | "approve" | "cancel",
  ) => {
    const reason = window.prompt(`Reason to ${action} this campaign:`)?.trim();
    if (reason) lifecycleMutation.mutate({ action, campaign, reason });
  };

  const summary = campaignsQuery.data?.summary;

  return (
    <PageContainer className="space-y-5">
      <PageContextHeader
        title="Influencer Campaign Centre"
        description="Phase 4 campaign planning, review, and creator visibility controls."
        actionNode={
          <Button variant="secondary" onClick={() => void campaignsQuery.refetch()}>
            <RefreshCcw className="mr-2 size-4" /> Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Total" value={summary?.total ?? campaigns.length} />
        <Metric label="Draft" value={summary?.draft ?? 0} />
        <Metric label="Pending review" value={summary?.pendingReview ?? 0} />
        <Metric label="Active/upcoming" value={(summary?.active ?? 0) + (summary?.upcoming ?? 0)} />
      </section>

      {canUpdate ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {editing
                  ? `Edit ${editing.publicCampaignId}`
                  : "New influencer campaign"}
              </h2>
              <p className="text-sm text-muted">
                Campaigns must pass review before creators can see them.
              </p>
            </div>
            {editing ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm({ ...emptyForm, campaignCode: `creator-campaign-${Date.now()}` });
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Campaign code">
              <input
                className={inputClass}
                value={form.campaignCode}
                onChange={(event) =>
                  setForm({ ...form, campaignCode: event.target.value })
                }
              />
            </Field>
            <Field label="Title">
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <Field label="Objective">
              <select
                className={inputClass}
                value={form.objective}
                onChange={(event) =>
                  setForm({
                    ...form,
                    objective: event.target.value as InfluencerCampaignObjective,
                  })
                }
              >
                {objectives.map((objective) => (
                  <option key={objective} value={objective}>
                    {humanize(objective)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Summary">
              <input
                className={inputClass}
                value={form.summary}
                onChange={(event) =>
                  setForm({ ...form, summary: event.target.value })
                }
              />
            </Field>
            <Field label="Budget paise">
              <input
                className={inputClass}
                type="number"
                value={form.budgetPaise}
                onChange={(event) =>
                  setForm({ ...form, budgetPaise: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Max participants">
              <input
                className={inputClass}
                type="number"
                value={form.maxParticipants ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    maxParticipants: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </Field>
            <Field label="Starts at">
              <input
                className={inputClass}
                type="datetime-local"
                value={dateInput(form.startsAt)}
                onChange={(event) =>
                  setForm({ ...form, startsAt: fromDateInput(event.target.value) })
                }
              />
            </Field>
            <Field label="Ends at">
              <input
                className={inputClass}
                type="datetime-local"
                value={dateInput(form.endsAt)}
                onChange={(event) =>
                  setForm({ ...form, endsAt: fromDateInput(event.target.value) })
                }
              />
            </Field>
            <Field label="Submission deadline">
              <input
                className={inputClass}
                type="datetime-local"
                value={dateInput(form.submissionDeadlineAt)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    submissionDeadlineAt: fromDateInput(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Reward summary">
              <input
                className={inputClass}
                value={form.rewardSummary}
                onChange={(event) =>
                  setForm({ ...form, rewardSummary: event.target.value })
                }
              />
            </Field>
            <Field label="Reason">
              <input
                className={inputClass}
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </Field>
            <Field label="Brief">
              <textarea
                className={textareaClass}
                value={form.brief}
                onChange={(event) => setForm({ ...form, brief: event.target.value })}
              />
            </Field>
            <Field label="Content requirements JSON">
              <textarea
                className={textareaClass}
                value={contentJson}
                onChange={(event) => setContentJson(event.target.value)}
              />
            </Field>
            <Field label="Visibility rules JSON">
              <textarea
                className={textareaClass}
                value={visibilityJson}
                onChange={(event) => setVisibilityJson(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              isLoading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {editing ? "Save campaign" : "Create draft"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className={inputClass + " max-w-xs"}
            placeholder="Search campaigns"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={inputClass + " max-w-56"}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "ALL" | InfluencerCampaignStatus)
            }
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All statuses" : humanize(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3">
          {campaignsQuery.isLoading ? (
            <p className="text-sm text-muted">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Megaphone className="mx-auto mb-2 size-6 text-muted" />
              <p className="font-medium">No influencer campaigns found</p>
              <p className="text-sm text-muted">
                Create a draft to start Phase 4 campaign testing.
              </p>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <CampaignCard
                campaign={campaign}
                canReview={canReview}
                canUpdate={canUpdate}
                key={campaign.campaignId}
                onApprove={() => runLifecycle(campaign, "approve")}
                onCancel={() => runLifecycle(campaign, "cancel")}
                onEdit={() => void startEdit(campaign)}
                onSubmit={() => runLifecycle(campaign, "submit")}
              />
            ))
          )}
        </div>
      </section>
    </PageContainer>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function CampaignCard({
  campaign,
  canReview,
  canUpdate,
  onApprove,
  onCancel,
  onEdit,
  onSubmit,
}: {
  campaign: InfluencerCampaign;
  canReview: boolean;
  canUpdate: boolean;
  onApprove: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onSubmit: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(campaign.status)}>
              {humanize(campaign.status)}
            </Badge>
            <span className="text-xs font-medium text-muted">
              {campaign.publicCampaignId}
            </span>
          </div>
          <h3 className="text-lg font-semibold">{campaign.title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted">{campaign.summary}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">
            {currency(campaign.budget.amountPaise, campaign.budget.currency)}
          </p>
          <p className="text-muted">{campaign.rewardSummary}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <Fact
          icon={<CalendarClock className="size-4" />}
          label="Window"
          value={`${campaign.schedule.startsAt ? formatDate(campaign.schedule.startsAt, true) : "No start"} → ${
            campaign.schedule.endsAt ? formatDate(campaign.schedule.endsAt, true) : "No end"
          }`}
        />
        <Fact
          icon={<Trophy className="size-4" />}
          label="Rewards"
          value={`${campaign.rewards.length} reward rule(s)`}
        />
        <Fact
          icon={<Send className="size-4" />}
          label="Next"
          value={campaign.nextRecommendedAction ?? "No action required"}
        />
      </div>

      {campaign.blockingReasons.length || campaign.warnings.length ? (
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {campaign.blockingReasons.length ? (
            <div className="rounded-lg border border-danger/25 bg-danger/10 p-3 text-danger">
              {campaign.blockingReasons.join(" ")}
            </div>
          ) : null}
          {campaign.warnings.length ? (
            <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-warning">
              {campaign.warnings.join(" ")}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {canUpdate && campaign.availableActions.edit ? (
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {canUpdate && campaign.availableActions.submitForReview ? (
          <Button variant="secondary" onClick={onSubmit}>
            <Send className="mr-2 size-4" /> Submit
          </Button>
        ) : null}
        {canReview && campaign.availableActions.approve ? (
          <Button onClick={onApprove}>
            <CheckCircle2 className="mr-2 size-4" /> Approve
          </Button>
        ) : null}
        {canReview && campaign.availableActions.cancel ? (
          <Button variant="danger" onClick={onCancel}>
            <XCircle className="mr-2 size-4" /> Cancel
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-1 flex items-center gap-2 text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
