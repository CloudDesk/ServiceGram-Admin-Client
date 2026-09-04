import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Eye,
  Megaphone,
  RefreshCcw,
  Send,
  ShieldCheck,
  Trophy,
  UsersRound,
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
  InfluencerCampaignAnalyticsPeriod,
  InfluencerCampaignObjective,
  InfluencerCampaignParticipant,
  InfluencerCampaignParticipantStatus,
  InfluencerCampaignPayload,
  InfluencerCampaignRewardAward,
  InfluencerCampaignRewardAwardStatus,
  InfluencerCampaignRewardType,
  InfluencerCampaignSponsorship,
  InfluencerCampaignSponsorshipReviewDecision,
  InfluencerCampaignSponsorshipStatus,
  InfluencerCampaignSubmission,
  InfluencerCampaignSubmissionStatus,
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

const submissionStatuses: ("ALL" | InfluencerCampaignSubmissionStatus)[] = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

const rewardAwardStatuses: ("ALL" | InfluencerCampaignRewardAwardStatus)[] = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "HELD",
  "PAID",
];

const rewardTypes: ("ALL" | InfluencerCampaignRewardType)[] = [
  "ALL",
  "CASH",
  "COMMISSION_BOOST",
  "BADGE",
  "FEATURED_PLACEMENT",
];

const participantStatuses: ("ALL" | InfluencerCampaignParticipantStatus)[] = [
  "ALL",
  "JOINED",
  "WITHDRAWN",
  "DISQUALIFIED",
];

const sponsorshipStatuses: ("ALL" | InfluencerCampaignSponsorshipStatus)[] = [
  "ALL",
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "ADMIN_RESTRICTED",
];

const analyticsPeriods: {
  label: string;
  value: InfluencerCampaignAnalyticsPeriod;
}[] = [
  { label: "7 days", value: "7D" },
  { label: "30 days", value: "30D" },
  { label: "90 days", value: "90D" },
  { label: "This month", value: "THIS_MONTH" },
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

function sponsorshipTone(status: InfluencerCampaignSponsorshipStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "PENDING_REVIEW" || status === "CHANGES_REQUESTED")
    return "warning" as const;
  if (["REJECTED", "CANCELLED", "ADMIN_RESTRICTED"].includes(status))
    return "danger" as const;
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

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: number | string | null | undefined, code = "INR") {
  return new Intl.NumberFormat("en-IN", {
    currency: code,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(numberValue(value) / 100);
}

function integer(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function percent(value: unknown) {
  return `${numberValue(value).toFixed(1)}%`;
}

function watchTime(value: unknown) {
  return `${(numberValue(value) / 1000).toFixed(1)}s`;
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
  const [submissionStatus, setSubmissionStatus] = useState<
    "ALL" | InfluencerCampaignSubmissionStatus
  >("PENDING_REVIEW");
  const [rewardAwardStatus, setRewardAwardStatus] = useState<
    "ALL" | InfluencerCampaignRewardAwardStatus
  >("PENDING_REVIEW");
  const [rewardType, setRewardType] = useState<
    "ALL" | InfluencerCampaignRewardType
  >("ALL");
  const [sponsorshipStatus, setSponsorshipStatus] = useState<
    "ALL" | InfluencerCampaignSponsorshipStatus
  >("PENDING_REVIEW");
  const [participantStatus, setParticipantStatus] = useState<
    "ALL" | InfluencerCampaignParticipantStatus
  >("JOINED");
  const [participantCampaignId, setParticipantCampaignId] = useState("");
  const [performanceCampaignId, setPerformanceCampaignId] = useState("");
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
  const submissionsQuery = useQuery({
    queryKey: ["influencer-campaign-submissions", submissionStatus],
    queryFn: () =>
      influencerCampaignService.listSubmissions({ status: submissionStatus }),
    enabled: canReview,
  });
  const rewardAwardsQuery = useQuery({
    queryKey: [
      "influencer-campaign-reward-awards",
      rewardAwardStatus,
      rewardType,
    ],
    queryFn: () =>
      influencerCampaignService.listRewardAwards({
        rewardType,
        status: rewardAwardStatus,
      }),
    enabled: canReview,
  });
  const sponsorshipsQuery = useQuery({
    queryKey: ["influencer-campaign-sponsorships", search, sponsorshipStatus],
    queryFn: () =>
      influencerCampaignService.listSponsorships({
        search,
        status: sponsorshipStatus,
      }),
    enabled: canReview,
  });
  const participantsQuery = useQuery({
    queryKey: [
      "influencer-campaign-participants",
      participantCampaignId,
      participantStatus,
    ],
    queryFn: () =>
      influencerCampaignService.listParticipants(participantCampaignId, {
        status: participantStatus,
      }),
    enabled: canReview && Boolean(participantCampaignId),
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

  const submissionReviewMutation = useMutation({
    mutationFn: ({
      decision,
      reason,
      submission,
    }: {
      decision: "APPROVED" | "REJECTED";
      reason: string;
      submission: InfluencerCampaignSubmission;
    }) =>
      influencerCampaignService.reviewSubmission(submission.submissionId, {
        decision,
        reason,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["influencer-campaign-submissions"],
        }),
        queryClient.invalidateQueries({ queryKey: ["influencer-campaigns"] }),
      ]);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error ? cause.message : "Submission review failed.",
      ),
  });

  const rewardAwardReviewMutation = useMutation({
    mutationFn: ({
      award,
      decision,
      reason,
    }: {
      award: InfluencerCampaignRewardAward;
      decision: "APPROVED" | "REJECTED";
      reason: string;
    }) =>
      influencerCampaignService.reviewRewardAward(award.awardId, {
        decision,
        expectedVersion: award.lifecycle.version,
        reason,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["influencer-campaign-reward-awards"],
        }),
        queryClient.invalidateQueries({ queryKey: ["influencer-campaigns"] }),
      ]);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error ? cause.message : "Reward award review failed.",
      ),
  });

  const sponsorshipReviewMutation = useMutation({
    mutationFn: ({
      decision,
      reason,
      sponsorship,
    }: {
      decision: InfluencerCampaignSponsorshipReviewDecision;
      reason: string;
      sponsorship: InfluencerCampaignSponsorship;
    }) =>
      influencerCampaignService.reviewSponsorship(
        sponsorship.sponsorshipRequestId,
        {
          decision,
          expectedVersion: sponsorship.lifecycle.version,
          reason,
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["influencer-campaign-sponsorships"],
        }),
        queryClient.invalidateQueries({ queryKey: ["influencer-campaigns"] }),
      ]);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error ? cause.message : "Sponsorship review failed.",
      ),
  });

  const sponsorshipActionMutation = useMutation({
    mutationFn: ({
      action,
      reason,
      sponsorship,
    }: {
      action: "CANCEL" | "RESTRICT";
      reason: string;
      sponsorship: InfluencerCampaignSponsorship;
    }) =>
      influencerCampaignService.actionSponsorship(
        sponsorship.sponsorshipRequestId,
        {
          action,
          expectedVersion: sponsorship.lifecycle.version,
          reason,
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["influencer-campaign-sponsorships"],
        }),
        queryClient.invalidateQueries({ queryKey: ["influencer-campaigns"] }),
      ]);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error ? cause.message : "Sponsorship action failed.",
      ),
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

  const runSubmissionReview = (
    submission: InfluencerCampaignSubmission,
    decision: "APPROVED" | "REJECTED",
  ) => {
    const verb = decision === "APPROVED" ? "approve" : "reject";
    const reason = window.prompt(`Reason to ${verb} this submission:`)?.trim();
    if (reason) submissionReviewMutation.mutate({ decision, reason, submission });
  };

  const runRewardAwardReview = (
    award: InfluencerCampaignRewardAward,
    decision: "APPROVED" | "REJECTED",
  ) => {
    const verb = decision === "APPROVED" ? "approve" : "reject";
    const reason = window
      .prompt(`Reason to ${verb} this campaign reward award:`)
      ?.trim();
    if (reason) rewardAwardReviewMutation.mutate({ award, decision, reason });
  };

  const runSponsorshipReview = (
    sponsorship: InfluencerCampaignSponsorship,
    decision: InfluencerCampaignSponsorshipReviewDecision,
  ) => {
    const verb =
      decision === "APPROVED"
        ? "approve"
        : decision === "REJECTED"
          ? "reject"
          : "request changes for";
    const reason = window.prompt(`Reason to ${verb} this sponsorship:`)?.trim();
    if (reason) sponsorshipReviewMutation.mutate({ decision, reason, sponsorship });
  };

  const runSponsorshipAction = (
    sponsorship: InfluencerCampaignSponsorship,
    action: "CANCEL" | "RESTRICT",
  ) => {
    const verb = action === "RESTRICT" ? "restrict" : "cancel";
    const reason = window.prompt(`Reason to ${verb} this sponsorship:`)?.trim();
    if (reason) sponsorshipActionMutation.mutate({ action, reason, sponsorship });
  };

  const summary = campaignsQuery.data?.summary;
  const submissionSummary = submissionsQuery.data?.summary;
  const submissions = submissionsQuery.data?.data ?? [];
  const rewardAwardSummary = rewardAwardsQuery.data?.summary;
  const rewardAwards = rewardAwardsQuery.data?.data ?? [];
  const rewardAwardWarnings = rewardAwardsQuery.data?.warnings ?? [];
  const sponsorshipSummary = sponsorshipsQuery.data?.summary;
  const sponsorships = sponsorshipsQuery.data?.data ?? [];
  const participantSummary = participantsQuery.data?.summary;
  const participants = participantsQuery.data?.data ?? [];
  const performanceCampaign = campaigns.find(
    (campaign) => campaign.campaignId === performanceCampaignId,
  );

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

      {canReview ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Vendor-sponsored campaign proposals</h2>
              <p className="text-sm text-muted">
                Review vendor-funded campaign drafts before they become public creator campaigns.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-4">
              <MiniMetric label="Total" value={sponsorshipSummary?.total ?? 0} />
              <MiniMetric
                label="Pending"
                value={sponsorshipSummary?.pendingReview ?? 0}
              />
              <MiniMetric
                label="Changes"
                value={sponsorshipSummary?.changesRequested ?? 0}
              />
              <MiniMetric label="Approved" value={sponsorshipSummary?.approved ?? 0} />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              className={inputClass + " max-w-56"}
              value={sponsorshipStatus}
              onChange={(event) =>
                setSponsorshipStatus(
                  event.target.value as
                    | "ALL"
                    | InfluencerCampaignSponsorshipStatus,
                )
              }
            >
              {sponsorshipStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All sponsorships" : humanize(item)}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => void sponsorshipsQuery.refetch()}
            >
              <RefreshCcw className="mr-2 size-4" /> Refresh sponsorships
            </Button>
          </div>

          <div className="grid gap-3">
            {sponsorshipsQuery.isLoading ? (
              <p className="text-sm text-muted">Loading sponsorship proposals…</p>
            ) : sponsorships.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Megaphone className="mx-auto mb-2 size-6 text-muted" />
                <p className="font-medium">No sponsorship proposals found</p>
                <p className="text-sm text-muted">
                  Vendor-submitted proposals will appear here for approval, change requests, or restriction.
                </p>
              </div>
            ) : (
              sponsorships.map((sponsorship) => (
                <SponsorshipCard
                  isActing={
                    sponsorshipReviewMutation.isPending ||
                    sponsorshipActionMutation.isPending
                  }
                  key={sponsorship.sponsorshipRequestId}
                  onApprove={() =>
                    runSponsorshipReview(sponsorship, "APPROVED")
                  }
                  onCancel={() => runSponsorshipAction(sponsorship, "CANCEL")}
                  onReject={() =>
                    runSponsorshipReview(sponsorship, "REJECTED")
                  }
                  onRequestChanges={() =>
                    runSponsorshipReview(sponsorship, "CHANGES_REQUESTED")
                  }
                  onRestrict={() => runSponsorshipAction(sponsorship, "RESTRICT")}
                  sponsorship={sponsorship}
                />
              ))
            )}
          </div>
        </section>
      ) : null}

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
                onParticipants={() =>
                  setParticipantCampaignId(campaign.campaignId)
                }
                onPerformance={() =>
                  setPerformanceCampaignId(campaign.campaignId)
                }
                onSubmit={() => runLifecycle(campaign, "submit")}
              />
            ))
          )}
        </div>
      </section>

      {canReview && performanceCampaignId ? (
        <CampaignPerformancePanel
          campaign={performanceCampaign}
          campaignId={performanceCampaignId}
          onClose={() => setPerformanceCampaignId("")}
        />
      ) : null}

      {canReview ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Campaign submission review</h2>
              <p className="text-sm text-muted">
                Phase 4 creator reel submissions awaiting admin moderation.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-5">
              <MiniMetric label="Total" value={submissionSummary?.total ?? 0} />
              <MiniMetric
                label="Pending"
                value={submissionSummary?.pendingReview ?? 0}
              />
              <MiniMetric label="Approved" value={submissionSummary?.approved ?? 0} />
              <MiniMetric label="Rejected" value={submissionSummary?.rejected ?? 0} />
              <MiniMetric label="Withdrawn" value={submissionSummary?.withdrawn ?? 0} />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              className={inputClass + " max-w-56"}
              value={submissionStatus}
              onChange={(event) =>
                setSubmissionStatus(
                  event.target.value as
                    | "ALL"
                    | InfluencerCampaignSubmissionStatus,
                )
              }
            >
              {submissionStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All submissions" : humanize(item)}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => void submissionsQuery.refetch()}
            >
              <RefreshCcw className="mr-2 size-4" /> Refresh submissions
            </Button>
          </div>

          <div className="grid gap-3">
            {submissionsQuery.isLoading ? (
              <p className="text-sm text-muted">Loading submissions…</p>
            ) : submissions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Send className="mx-auto mb-2 size-6 text-muted" />
                <p className="font-medium">No campaign submissions found</p>
                <p className="text-sm text-muted">
                  Creator submissions will appear here after joined creators submit reels.
                </p>
              </div>
            ) : (
              submissions.map((submission) => (
                <SubmissionCard
                  isReviewing={submissionReviewMutation.isPending}
                  key={submission.submissionId}
                  onApprove={() => runSubmissionReview(submission, "APPROVED")}
                  onReject={() => runSubmissionReview(submission, "REJECTED")}
                  submission={submission}
                />
              ))
            )}
          </div>
        </section>
      ) : null}

      {canReview ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Campaign reward awards</h2>
              <p className="text-sm text-muted">
                Calculated campaign rewards awaiting admin review before any
                payout workflow.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-5">
              <MiniMetric label="Total" value={rewardAwardSummary?.total ?? 0} />
              <MiniMetric
                label="Pending"
                value={rewardAwardSummary?.pendingReview ?? 0}
              />
              <MiniMetric
                label="Approved"
                value={rewardAwardSummary?.approved ?? 0}
              />
              <MiniMetric
                label="Rejected"
                value={rewardAwardSummary?.rejected ?? 0}
              />
              <MiniMetric label="Held" value={rewardAwardSummary?.held ?? 0} />
            </div>
          </div>

          {rewardAwardWarnings.length ? (
            <div className="mb-4 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
              {rewardAwardWarnings.join(" ")}
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
              Payout settlement and provider handoff are not triggered from this
              queue.
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              className={inputClass + " max-w-56"}
              value={rewardAwardStatus}
              onChange={(event) =>
                setRewardAwardStatus(
                  event.target.value as
                    | "ALL"
                    | InfluencerCampaignRewardAwardStatus,
                )
              }
            >
              {rewardAwardStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All reward awards" : humanize(item)}
                </option>
              ))}
            </select>
            <select
              className={inputClass + " max-w-56"}
              value={rewardType}
              onChange={(event) =>
                setRewardType(
                  event.target.value as "ALL" | InfluencerCampaignRewardType,
                )
              }
            >
              {rewardTypes.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All reward types" : humanize(item)}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => void rewardAwardsQuery.refetch()}
            >
              <RefreshCcw className="mr-2 size-4" /> Refresh rewards
            </Button>
          </div>

          <div className="grid gap-3">
            {rewardAwardsQuery.isLoading ? (
              <p className="text-sm text-muted">Loading reward awards…</p>
            ) : rewardAwards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Trophy className="mx-auto mb-2 size-6 text-muted" />
                <p className="font-medium">No campaign reward awards found</p>
                <p className="text-sm text-muted">
                  Run the backend reward calculation task after submissions are
                  approved; generated awards will appear here.
                </p>
              </div>
            ) : (
              rewardAwards.map((award) => (
                <RewardAwardCard
                  award={award}
                  isReviewing={rewardAwardReviewMutation.isPending}
                  key={award.awardId}
                  onApprove={() => runRewardAwardReview(award, "APPROVED")}
                  onReject={() => runRewardAwardReview(award, "REJECTED")}
                />
              ))
            )}
          </div>
        </section>
      ) : null}

      {canReview ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Campaign participants</h2>
              <p className="text-sm text-muted">
                Joined creators for the selected campaign, with exact status rails.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-4">
              <MiniMetric label="Total" value={participantSummary?.total ?? 0} />
              <MiniMetric label="Joined" value={participantSummary?.joined ?? 0} />
              <MiniMetric
                label="Withdrawn"
                value={participantSummary?.withdrawn ?? 0}
              />
              <MiniMetric
                label="Disqualified"
                value={participantSummary?.disqualified ?? 0}
              />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              className={inputClass + " max-w-sm"}
              value={participantCampaignId}
              onChange={(event) => setParticipantCampaignId(event.target.value)}
            >
              <option value="">Choose a campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.campaignId} value={campaign.campaignId}>
                  {campaign.title}
                </option>
              ))}
            </select>
            <select
              className={inputClass + " max-w-56"}
              value={participantStatus}
              onChange={(event) =>
                setParticipantStatus(
                  event.target.value as
                    | "ALL"
                    | InfluencerCampaignParticipantStatus,
                )
              }
            >
              {participantStatuses.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All participants" : humanize(item)}
                </option>
              ))}
            </select>
            <Button
              disabled={!participantCampaignId}
              variant="secondary"
              onClick={() => void participantsQuery.refetch()}
            >
              <RefreshCcw className="mr-2 size-4" /> Refresh participants
            </Button>
          </div>

          <div className="grid gap-3">
            {!participantCampaignId ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Trophy className="mx-auto mb-2 size-6 text-muted" />
                <p className="font-medium">Choose a campaign to view participants</p>
                <p className="text-sm text-muted">
                  Use a campaign card's participants button or the selector above.
                </p>
              </div>
            ) : participantsQuery.isLoading ? (
              <p className="text-sm text-muted">Loading participants…</p>
            ) : participants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Trophy className="mx-auto mb-2 size-6 text-muted" />
                <p className="font-medium">No participants found</p>
                <p className="text-sm text-muted">
                  Joined creators will appear here after the customer app join flow runs.
                </p>
              </div>
            ) : (
              participants.map((participant) => (
                <ParticipantCard
                  key={participant.participationId}
                  participant={participant}
                />
              ))
            )}
          </div>
        </section>
      ) : null}
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-muted">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
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
  onParticipants,
  onPerformance,
  onSubmit,
}: {
  campaign: InfluencerCampaign;
  canReview: boolean;
  canUpdate: boolean;
  onApprove: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onParticipants: () => void;
  onPerformance: () => void;
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
        {canReview && campaign.availableActions.viewSubmissions ? (
          <Button variant="secondary" onClick={onParticipants}>
            View participants
          </Button>
        ) : null}
        {canReview ? (
          <Button variant="secondary" onClick={onPerformance}>
            <BarChart3 className="mr-2 size-4" /> Performance
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

function CampaignPerformancePanel({
  campaign,
  campaignId,
  onClose,
}: {
  campaign?: InfluencerCampaign;
  campaignId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [period, setPeriod] =
    useState<InfluencerCampaignAnalyticsPeriod>("30D");
  const performanceQuery = useQuery({
    queryKey: ["influencer-campaign-performance", campaignId, period],
    queryFn: () => influencerCampaignService.performance(campaignId, period),
    staleTime: 60_000,
  });
  const refreshMutation = useMutation({
    mutationFn: () => influencerCampaignService.performance(campaignId, period, true),
    onSuccess: (result) => {
      queryClient.setQueryData(
        ["influencer-campaign-performance", campaignId, period],
        result,
      );
    },
  });
  const analytics = performanceQuery.data?.data;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Campaign performance</h2>
          <p className="mt-1 text-sm text-muted">
            {campaign?.title ?? campaignId} · backend-counted participant,
            submission, and reel engagement metrics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={performanceQuery.isFetching || refreshMutation.isPending}
            variant="secondary"
            onClick={() => refreshMutation.mutate()}
          >
            <RefreshCcw className="mr-2 size-4" />
            {refreshMutation.isPending ? "Refreshing…" : "Refresh snapshot"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {refreshMutation.isError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          Snapshot refresh failed. Existing analytics remain available.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Performance period">
        {analyticsPeriods.map((option) => (
          <Button
            aria-pressed={period === option.value}
            key={option.value}
            size="sm"
            type="button"
            variant={period === option.value ? "primary" : "secondary"}
            onClick={() => {
              refreshMutation.reset();
              setPeriod(option.value);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {performanceQuery.isLoading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="h-28 animate-pulse rounded-xl border border-border bg-background"
              key={index}
            />
          ))}
        </div>
      ) : performanceQuery.isError ? (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Campaign performance could not be loaded.
        </div>
      ) : analytics ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<UsersRound className="size-5" />}
              label="Participants"
              value={integer(analytics.participants.total)}
              helper={`${integer(analytics.participants.joined)} joined`}
            />
            <MetricCard
              icon={<Send className="size-5" />}
              label="Submissions"
              value={integer(analytics.submissions.total)}
              helper={`${percent(
                analytics.submissions.approvalRatePercent,
              )} approved`}
            />
            <MetricCard
              icon={<Eye className="size-5" />}
              label="Views"
              value={integer(analytics.engagement.views)}
              helper={`${integer(analytics.engagement.uniqueViewers)} viewers`}
            />
            <MetricCard
              icon={<BarChart3 className="size-5" />}
              label="Avg watch"
              value={watchTime(analytics.engagement.averageWatchTimeMs)}
              helper={`${integer(analytics.engagement.likes)} likes`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <section className="rounded-xl border border-border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">Top submissions</h3>
                  <p className="text-sm text-muted">
                    Ranked by backend engagement for submitted campaign reels.
                  </p>
                </div>
                <Badge tone="info">
                  {analytics.window.dateFrom} – {analytics.window.dateTo}
                </Badge>
              </div>
              {analytics.submissions.topSubmissions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
                  No submitted reel engagement in this period.
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.submissions.topSubmissions.map((submission, index) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
                      key={submission.submissionId}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={submissionTone(
                            submission.status as InfluencerCampaignSubmissionStatus,
                          )}>
                            {humanize(submission.status)}
                          </Badge>
                          <span className="text-xs font-medium text-muted">
                            #{index + 1} · {submission.publicReelId}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted">
                          Influencer {submission.influencerProfileId}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-right text-sm">
                        <MiniMetric label="Views" value={submission.views} />
                        <MiniMetric label="Likes" value={submission.likes} />
                        <MiniMetric label="Shares" value={submission.shares} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-background p-4">
              <h3 className="font-semibold text-foreground">Operational readout</h3>
              <div className="mt-3">
                <DetailRow label="Campaign status" value={humanize(analytics.campaign.status)} />
                <DetailRow
                  label="Budget"
                  value={currency(
                    analytics.campaign.budgetPaise,
                    analytics.campaign.currency,
                  )}
                />
                <DetailRow label="Pending review" value={integer(analytics.submissions.pendingReview)} />
                <DetailRow label="Rejected" value={integer(analytics.submissions.rejected)} />
                <DetailRow label="Withdrawn creators" value={integer(analytics.participants.withdrawn)} />
                <DetailRow label="Shares" value={integer(analytics.engagement.shares)} />
              </div>
              <div className="mt-4 flex gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  {analytics.privacy.thresholdApplied
                    ? `Audience is below ${analytics.privacy.minimumAudienceSize}; treat conversion reads as directional.`
                    : "Viewer and booking identities stay hidden; this dashboard uses aggregate backend counts."}
                </p>
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                Snapshot {analytics.snapshot.cacheStatus.toLowerCase()} ·
                generated{" "}
                {new Date(analytics.snapshot.generatedAt).toLocaleString("en-IN")}
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  helper,
  icon,
  label,
  value,
}: {
  helper: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-4 truncate text-2xl font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-border/70 py-2 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function SponsorshipCard({
  isActing,
  onApprove,
  onCancel,
  onReject,
  onRequestChanges,
  onRestrict,
  sponsorship,
}: {
  isActing: boolean;
  onApprove: () => void;
  onCancel: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onRestrict: () => void;
  sponsorship: InfluencerCampaignSponsorship;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={sponsorshipTone(sponsorship.status)}>
              {humanize(sponsorship.status)}
            </Badge>
            <span className="text-xs font-medium text-muted">
              {sponsorship.publicSponsorshipId}
            </span>
            {sponsorship.linkedCampaign ? (
              <span className="text-xs font-medium text-muted">
                Linked: {sponsorship.linkedCampaign.publicCampaignId}
              </span>
            ) : null}
          </div>
          <h3 className="text-lg font-semibold">{sponsorship.title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            {sponsorship.summary}
          </p>
          <p className="mt-2 text-sm">
            <span className="font-medium">
              {sponsorship.vendor?.shopName ?? "Unknown vendor"}
            </span>
            <span className="text-muted">
              {sponsorship.vendor?.city ? ` · ${sponsorship.vendor.city}` : ""}
            </span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">
            {currency(
              sponsorship.budget.amountPaise,
              sponsorship.budget.currency,
            )}
          </p>
          <p className="text-muted">
            Min {currency(sponsorship.budget.minimumBudgetPaise)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <Fact
          icon={<CalendarClock className="size-4" />}
          label="Window"
          value={`${sponsorship.schedule.startsAt ? formatDate(sponsorship.schedule.startsAt, true) : "No start"} → ${
            sponsorship.schedule.endsAt
              ? formatDate(sponsorship.schedule.endsAt, true)
              : "No end"
          }`}
        />
        <Fact
          icon={<Trophy className="size-4" />}
          label="Eligibility"
          value={sponsorship.eligibilitySummary}
        />
        <Fact
          icon={<Send className="size-4" />}
          label="Next"
          value={sponsorship.nextRecommendedAction ?? "No action required"}
        />
      </div>

      {sponsorship.blockingReasons.length || sponsorship.warnings.length ? (
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {sponsorship.blockingReasons.length ? (
            <div className="rounded-lg border border-danger/25 bg-danger/10 p-3 text-danger">
              {sponsorship.blockingReasons.join(" ")}
            </div>
          ) : null}
          {sponsorship.warnings.length ? (
            <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-warning">
              {sponsorship.warnings.join(" ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {sponsorship.paymentTerms ? (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          {sponsorship.paymentTerms}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {sponsorship.availableActions.requestChanges ? (
          <Button
            disabled={isActing}
            variant="secondary"
            onClick={onRequestChanges}
          >
            Request changes
          </Button>
        ) : null}
        {sponsorship.availableActions.reject ? (
          <Button disabled={isActing} variant="danger" onClick={onReject}>
            <XCircle className="mr-2 size-4" /> Reject
          </Button>
        ) : null}
        {sponsorship.availableActions.cancel ? (
          <Button disabled={isActing} variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {sponsorship.availableActions.restrict ? (
          <Button disabled={isActing} variant="danger" onClick={onRestrict}>
            Restrict
          </Button>
        ) : null}
        {sponsorship.availableActions.approve ? (
          <Button disabled={isActing} onClick={onApprove}>
            <CheckCircle2 className="mr-2 size-4" /> Approve & create campaign
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function SubmissionCard({
  isReviewing,
  onApprove,
  onReject,
  submission,
}: {
  isReviewing: boolean;
  onApprove: () => void;
  onReject: () => void;
  submission: InfluencerCampaignSubmission;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={submissionTone(submission.status)}>
              {humanize(submission.status)}
            </Badge>
            <span className="text-xs font-medium text-muted">
              {submission.campaign.publicCampaignId}
            </span>
          </div>
          <h3 className="text-lg font-semibold">{submission.campaign.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {submission.influencer.displayName}
            {submission.influencer.socialHandle
              ? ` · ${submission.influencer.socialHandle}`
              : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">Reel</p>
          <p className="text-muted">{submission.reelId}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <Fact
          icon={<Send className="size-4" />}
          label="Submitted"
          value={
            submission.submittedAt
              ? formatDate(submission.submittedAt, true)
              : "Not submitted"
          }
        />
        <Fact
          icon={<Trophy className="size-4" />}
          label="Campaign"
          value={humanize(submission.campaign.status)}
        />
        <Fact
          icon={<CheckCircle2 className="size-4" />}
          label="Review"
          value={submission.review.reason ?? "Pending review"}
        />
      </div>

      {submission.creatorNotes ? (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          {submission.creatorNotes}
        </div>
      ) : null}

      {submission.availableActions.review ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            isLoading={isReviewing}
            onClick={onApprove}
          >
            <CheckCircle2 className="mr-2 size-4" /> Approve submission
          </Button>
          <Button
            isLoading={isReviewing}
            variant="danger"
            onClick={onReject}
          >
            <XCircle className="mr-2 size-4" /> Reject
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function RewardAwardCard({
  award,
  isReviewing,
  onApprove,
  onReject,
}: {
  award: InfluencerCampaignRewardAward;
  isReviewing: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const views =
    typeof award.calculationSnapshot.views === "number"
      ? award.calculationSnapshot.views
      : award.metricValue;
  const likes =
    typeof award.calculationSnapshot.likes === "number"
      ? award.calculationSnapshot.likes
      : 0;
  const shares =
    typeof award.calculationSnapshot.shares === "number"
      ? award.calculationSnapshot.shares
      : 0;

  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={rewardAwardTone(award.status)}>
              {humanize(award.status)}
            </Badge>
            {award.status === "PENDING_REVIEW" ? (
              <Badge tone="warning">
                <ShieldCheck className="mr-1 size-3" />
                Needs reward review
              </Badge>
            ) : null}
            <span className="text-xs font-medium text-muted">
              {award.publicAwardId}
            </span>
          </div>
          <h3 className="text-lg font-semibold">{award.campaign.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {award.influencer.displayName}
            {award.influencer.socialHandle
              ? ` · ${award.influencer.socialHandle}`
              : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">
            {currency(award.amountPaise, award.currency)}
          </p>
          <p className="text-muted">{humanize(award.rewardType)}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
        <Fact
          icon={<Trophy className="size-4" />}
          label="Rank"
          value={`#${integer(award.rank)}`}
        />
        <Fact
          icon={<Eye className="size-4" />}
          label="Views"
          value={integer(views)}
        />
        <Fact
          icon={<CheckCircle2 className="size-4" />}
          label="Likes / shares"
          value={`${integer(likes)} / ${integer(shares)}`}
        />
        <Fact
          icon={<CalendarClock className="size-4" />}
          label="Created"
          value={formatDate(award.lifecycle.createdAt, true)}
        />
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        Reward rule: {award.reward.title}
        {award.reward.rankFrom || award.reward.rankTo
          ? ` · Rank ${award.reward.rankFrom ?? "?"}–${award.reward.rankTo ?? "?"}`
          : ""}
        . Submission status: {humanize(award.submission.status)}.
      </div>

      {award.review.reason ? (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          Review note: {award.review.reason}
        </div>
      ) : null}

      {award.availableActions.approve || award.availableActions.reject ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {award.availableActions.approve ? (
            <Button isLoading={isReviewing} onClick={onApprove}>
              <CheckCircle2 className="mr-2 size-4" /> Approve reward
            </Button>
          ) : null}
          {award.availableActions.reject ? (
            <Button isLoading={isReviewing} variant="danger" onClick={onReject}>
              <XCircle className="mr-2 size-4" /> Reject
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-right text-xs text-muted">
          No reward review action available.
        </p>
      )}
    </article>
  );
}

function ParticipantCard({
  participant,
}: {
  participant: InfluencerCampaignParticipant;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={participantTone(participant.status)}>
              {humanize(participant.status)}
            </Badge>
            <span className="text-xs font-medium text-muted">
              {participant.influencer.publicInfluencerId}
            </span>
          </div>
          <h3 className="text-lg font-semibold">
            {participant.influencer.displayName}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {participant.influencer.socialHandle ?? "No social handle"}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{participant.campaign.title}</p>
          <p className="text-muted">{participant.campaign.publicCampaignId}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <Fact
          icon={<Trophy className="size-4" />}
          label="Joined"
          value={
            participant.joinedAt
              ? formatDate(participant.joinedAt, true)
              : "Not joined"
          }
        />
        <Fact
          icon={<XCircle className="size-4" />}
          label="Withdrawn"
          value={
            participant.withdrawnAt
              ? formatDate(participant.withdrawnAt, true)
              : "Not withdrawn"
          }
        />
        <Fact
          icon={<Send className="size-4" />}
          label="Next"
          value={
            participant.availableActions.viewSubmissions
              ? "Review submitted reels in the queue above"
              : "No action required"
          }
        />
      </div>

      {participant.withdrawalReason ? (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          {participant.withdrawalReason}
        </div>
      ) : null}
    </article>
  );
}

function submissionTone(status: InfluencerCampaignSubmissionStatus) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger";
  return "warning";
}

function rewardAwardTone(status: InfluencerCampaignRewardAwardStatus) {
  if (status === "APPROVED" || status === "PAID") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "HELD" || status === "PENDING_REVIEW") return "warning";
  return "neutral";
}

function participantTone(status: InfluencerCampaignParticipantStatus) {
  if (status === "JOINED") return "success";
  if (status === "DISQUALIFIED") return "danger";
  return "warning";
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
