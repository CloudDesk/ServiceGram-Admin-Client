import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeIndianRupee,
  Banknote,
  CheckCircle2,
  FileCheck2,
  PlayCircle,
  RefreshCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataList } from "../../../components/ui/DataList";
import type {
  DataListColumn,
  DataListQueueTab,
} from "../../../components/ui/DataList";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { routePaths } from "../../../config/routes";
import { usePermission } from "../../../hooks/usePermission";
import { cn } from "../../../utils/cn";
import { influencerPayoutService } from "../services/influencerPayout.service";
import type {
  InfluencerBankAccountReviewRow,
  InfluencerBankAccountStatus,
  InfluencerKycCheckStatus,
  InfluencerKycCheckType,
  InfluencerKycReviewRow,
  InfluencerPayoutBatchResult,
  InfluencerPayoutRow,
  InfluencerPayoutStatus,
} from "../types/influencerPayout.types";

type WorkspaceTab = "banks" | "kyc" | "payouts";
interface QueueConfig<TStatus extends string> {
  label: string;
  status?: TStatus[];
  tone?: "warning" | "danger";
}
type ActionTarget =
  | {
      kind: "VERIFY_BANK" | "REJECT_BANK";
      bankAccount: InfluencerBankAccountReviewRow;
    }
  | { kind: "APPROVE_KYC" | "REJECT_KYC"; kyc: InfluencerKycReviewRow }
  | {
      kind:
        | "APPROVE_PAYOUT"
        | "HOLD_PAYOUT"
        | "RETRY_PAYOUT"
        | "MARK_PAID"
        | "MARK_FAILED"
        | "CANCEL_PAYOUT";
      payout: InfluencerPayoutRow;
    }
  | { kind: "CREATE_BATCH" };

const DEFAULT_PAGE_SIZE = 50;
const STORAGE_KEYS: Record<WorkspaceTab, string> = {
  banks: "servicegram.influencer-payouts.banks.v1",
  kyc: "servicegram.influencer-payouts.kyc.v1",
  payouts: "servicegram.influencer-payouts.payouts.v1",
};

const bankQueues: Record<string, QueueConfig<InfluencerBankAccountStatus>> = {
  all: { label: "All" },
  pending: { label: "Pending verification", status: ["PENDING_VERIFICATION"] },
  verified: { label: "Verified", status: ["VERIFIED"] },
  rejected: { label: "Rejected", status: ["REJECTED"] },
};

const kycQueues: Record<string, QueueConfig<InfluencerKycCheckStatus>> = {
  all: { label: "All" },
  pending: { label: "Pending review", status: ["PENDING_REVIEW"] },
  approved: { label: "Approved", status: ["APPROVED"] },
  rejected: { label: "Rejected", status: ["REJECTED"] },
};

const payoutQueues: Record<string, QueueConfig<InfluencerPayoutStatus>> = {
  all: { label: "All" },
  review: {
    label: "Needs review",
    status: ["PENDING", "UNDER_REVIEW"],
    tone: "warning",
  },
  approved: { label: "Ready to pay", status: ["APPROVED"] },
  held: { label: "Held", status: ["HELD"], tone: "warning" },
  paid: { label: "Paid", status: ["PAID"] },
  exceptions: {
    label: "Exceptions",
    status: ["FAILED", "CANCELLED"],
    tone: "danger",
  },
};

const inputClass =
  "h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";
const textareaClass =
  "min-h-24 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

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

function formatPaise(
  value: number | string | null | undefined,
  currency = "INR",
) {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format((Number.isFinite(parsed) ? parsed : 0) / 100);
}

function statusTone(status: string) {
  if (["VERIFIED", "APPROVED", "PAID"].includes(status))
    return "success" as const;
  if (
    [
      "PENDING_VERIFICATION",
      "PENDING_REVIEW",
      "PENDING",
      "UNDER_REVIEW",
      "HELD",
    ].includes(status)
  ) {
    return "warning" as const;
  }
  if (
    ["REJECTED", "FAILED", "CANCELLED", "DISABLED", "EXPIRED"].includes(status)
  ) {
    return "danger" as const;
  }
  return "neutral" as const;
}

function influencerLink(influencer: { id: string; displayName: string }) {
  return (
    <Link
      className="truncate font-medium text-foreground hover:text-primary"
      to={`${routePaths.influencers}/${influencer.id}`}
    >
      {influencer.displayName}
    </Link>
  );
}

function queueTabs<
  TStatus extends string,
  TSummary extends { total?: number } & Partial<Record<TStatus, number>>,
>(
  queues: Record<string, QueueConfig<TStatus>>,
  summary?: TSummary,
): DataListQueueTab[] {
  return Object.entries(queues).map(([key, queue]) => ({
    key,
    label: queue.label,
    count:
      key === "all"
        ? summary?.total
        : queue.status?.reduce(
            (total, status) => total + (summary?.[status] ?? 0),
            0,
          ),
    tone: queue.tone,
  }));
}

function actionLabel(action: ActionTarget["kind"]) {
  return {
    APPROVE_KYC: "Approve KYC",
    APPROVE_PAYOUT: "Approve",
    CANCEL_PAYOUT: "Cancel",
    CREATE_BATCH: "Create batch",
    HOLD_PAYOUT: "Hold",
    MARK_FAILED: "Mark failed",
    MARK_PAID: "Mark paid",
    REJECT_BANK: "Reject bank",
    REJECT_KYC: "Reject KYC",
    RETRY_PAYOUT: "Retry",
    VERIFY_BANK: "Verify bank",
  }[action];
}

function recordLabel(action: ActionTarget) {
  if ("bankAccount" in action) {
    return `${action.bankAccount.influencer.displayName} · ${action.bankAccount.accountNumberMasked}`;
  }
  if ("kyc" in action) {
    return `${action.kyc.influencer.displayName} · ${action.kyc.checkType}`;
  }
  if ("payout" in action) {
    return `${action.payout.publicPayoutId} · ${formatPaise(action.payout.totalAmountPaise, action.payout.currency)}`;
  }
  return "Create eligible influencer payouts from confirmed commissions";
}

function hasAction(row: { availableActions: string[] }, action: string) {
  return row.availableActions.includes(action);
}

interface ActionModalProps {
  action: ActionTarget | null;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: {
    reason: string;
    batchKey?: string;
    batchLimit?: number;
    dryRun?: boolean;
    failureReason?: string;
    utrReference?: string;
  }) => void;
}

function ActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: ActionModalProps) {
  const [batchKey, setBatchKey] = useState("");
  const [batchLimit, setBatchLimit] = useState("100");
  const [dryRun, setDryRun] = useState(true);
  const [failureReason, setFailureReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [utrReference, setUtrReference] = useState("");

  if (!action) return null;

  const needsFailureReason = action.kind === "MARK_FAILED";
  const needsUtr = action.kind === "MARK_PAID";
  const isBatch = action.kind === "CREATE_BATCH";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!isBatch && reason.trim().length < 5) {
      setFormError("Reason must be at least 5 characters.");
      return;
    }
    if (needsUtr && utrReference.trim().length < 4) {
      setFormError("UTR reference must be at least 4 characters.");
      return;
    }
    if (needsFailureReason && failureReason.trim().length < 5) {
      setFormError("Failure reason must be at least 5 characters.");
      return;
    }

    onSubmit({
      batchKey: batchKey.trim() || undefined,
      batchLimit: Number(batchLimit) || undefined,
      dryRun,
      failureReason: failureReason.trim() || undefined,
      reason: reason.trim(),
      utrReference: utrReference.trim() || undefined,
    });
  };

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {actionLabel(action.kind)}
            </h2>
            <p className="mt-1 text-sm text-muted">{recordLabel(action)}</p>
          </div>
          <button
            aria-label="Close influencer payout action modal"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {isBatch ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Batch key
                </span>
                <input
                  className={inputClass}
                  placeholder="influencer-2026-09-03"
                  value={batchKey}
                  onChange={(event) => setBatchKey(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Limit
                </span>
                <input
                  className={inputClass}
                  max={500}
                  min={1}
                  type="number"
                  value={batchLimit}
                  onChange={(event) => setBatchLimit(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  checked={dryRun}
                  type="checkbox"
                  onChange={(event) => setDryRun(event.target.checked)}
                />
                Dry run first
              </label>
            </>
          ) : null}

          {needsUtr ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                UTR reference *
              </span>
              <input
                className={inputClass}
                value={utrReference}
                onChange={(event) => setUtrReference(event.target.value)}
              />
            </label>
          ) : null}

          {needsFailureReason ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Failure reason *
              </span>
              <textarea
                className={textareaClass}
                value={failureReason}
                onChange={(event) => setFailureReason(event.target.value)}
              />
            </label>
          ) : null}

          {!isBatch ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Reason *
              </span>
              <textarea
                className={textareaClass}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}

          {formError || error ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              size="sm"
              type="submit"
              variant={
                [
                  "REJECT_BANK",
                  "REJECT_KYC",
                  "MARK_FAILED",
                  "CANCEL_PAYOUT",
                ].includes(action.kind)
                  ? "danger"
                  : "primary"
              }
            >
              Submit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InfluencerPayoutsPage() {
  const queryClient = useQueryClient();
  const canReviewInfluencers = usePermission("influencers:review");
  const canApprovePayouts = usePermission("payouts:approve");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("banks");
  const [search, setSearch] = useState("");
  const [bankQueue, setBankQueue] = useState("pending");
  const [kycQueue, setKycQueue] = useState("pending");
  const [kycType, setKycType] = useState<InfluencerKycCheckType | "ALL">("ALL");
  const [payoutQueue, setPayoutQueue] = useState("review");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [action, setAction] = useState<ActionTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const bankQuery = useQuery({
    enabled: activeTab === "banks",
    queryKey: ["influencer-payouts", "banks", page, limit, search, bankQueue],
    queryFn: () =>
      influencerPayoutService.listBankAccounts({
        limit,
        page,
        search: search.trim() || undefined,
        status: bankQueues[bankQueue]?.status,
      }),
  });

  const kycQuery = useQuery({
    enabled: activeTab === "kyc",
    queryKey: [
      "influencer-payouts",
      "kyc",
      page,
      limit,
      search,
      kycQueue,
      kycType,
    ],
    queryFn: () =>
      influencerPayoutService.listKycChecks({
        checkType: kycType === "ALL" ? undefined : [kycType],
        limit,
        page,
        search: search.trim() || undefined,
        status: kycQueues[kycQueue]?.status,
      }),
  });

  const payoutQuery = useQuery({
    enabled: activeTab === "payouts",
    queryKey: [
      "influencer-payouts",
      "payouts",
      page,
      limit,
      search,
      payoutQueue,
    ],
    queryFn: () =>
      influencerPayoutService.listPayouts({
        limit,
        page,
        search: search.trim() || undefined,
        status: payoutQueues[payoutQueue]?.status,
      }),
  });

  const mutation = useMutation({
    mutationFn: async ({
      selected,
      values,
    }: {
      selected: ActionTarget;
      values: {
        reason: string;
        batchKey?: string;
        batchLimit?: number;
        dryRun?: boolean;
        failureReason?: string;
        utrReference?: string;
      };
    }) => {
      if (selected.kind === "CREATE_BATCH") {
        return influencerPayoutService.createPayoutBatch({
          batchKey: values.batchKey,
          dryRun: values.dryRun,
          limit: values.batchLimit,
        });
      }
      if ("bankAccount" in selected) {
        return influencerPayoutService.reviewBankAccount(
          selected.bankAccount.id,
          {
            decision: selected.kind === "VERIFY_BANK" ? "VERIFIED" : "REJECTED",
            expectedVersion: selected.bankAccount.version,
            reason: values.reason,
          },
        );
      }
      if ("kyc" in selected) {
        return influencerPayoutService.reviewKycCheck(selected.kyc.id, {
          decision: selected.kind === "APPROVE_KYC" ? "APPROVED" : "REJECTED",
          expectedVersion: selected.kyc.version,
          reason: values.reason,
        });
      }

      const payload = {
        expectedVersion: selected.payout.version,
        reason: values.reason,
      };

      if (selected.kind === "APPROVE_PAYOUT") {
        return influencerPayoutService.approvePayout(
          selected.payout.id,
          payload,
        );
      }
      if (selected.kind === "HOLD_PAYOUT") {
        return influencerPayoutService.holdPayout(selected.payout.id, payload);
      }
      if (selected.kind === "RETRY_PAYOUT") {
        return influencerPayoutService.retryPayout(selected.payout.id, payload);
      }
      if (selected.kind === "CANCEL_PAYOUT") {
        return influencerPayoutService.cancelPayout(
          selected.payout.id,
          payload,
        );
      }
      if (selected.kind === "MARK_PAID") {
        if (!values.utrReference) throw new Error("UTR reference is required.");
        return influencerPayoutService.markPayoutPaid(selected.payout.id, {
          ...payload,
          utrReference: values.utrReference,
        });
      }
      if (selected.kind === "MARK_FAILED") {
        if (!values.failureReason)
          throw new Error("Failure reason is required.");
        return influencerPayoutService.markPayoutFailed(selected.payout.id, {
          ...payload,
          failureReason: values.failureReason,
        });
      }

      throw new Error("Unsupported influencer payout action.");
    },
    onMutate: () => {
      setActionError(null);
      setBatchNotice(null);
    },
    onSuccess: (response) => {
      if (action?.kind === "CREATE_BATCH" && "data" in response) {
        const result = response.data as InfluencerPayoutBatchResult;
        const created = Array.isArray(result.created)
          ? result.created.length
          : 0;
        const candidates = Array.isArray(result.candidates)
          ? result.candidates.length
          : result.candidates;
        setBatchNotice(
          `${result.dryRun ? "Dry run" : "Batch"} ${result.batchKey}: ${created} created, ${candidates} eligible.`,
        );
      }
      setAction(null);
      void queryClient.invalidateQueries({ queryKey: ["influencer-payouts"] });
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Influencer payout action failed.",
      );
    },
  });

  const bankRows = bankQuery.data?.data ?? [];
  const kycRows = kycQuery.data?.data ?? [];
  const payoutRows = payoutQuery.data?.data ?? [];
  const bankSummary = bankQuery.data?.summary;
  const kycSummary = kycQuery.data?.summary;
  const payoutSummary = payoutQuery.data?.summary;
  const activeRows =
    activeTab === "banks"
      ? bankRows
      : activeTab === "kyc"
        ? kycRows
        : payoutRows;

  const bankColumns = useMemo<DataListColumn<InfluencerBankAccountReviewRow>[]>(
    () => [
      {
        defaultWidth: 210,
        grow: true,
        id: "influencer",
        label: "Influencer",
        minWidth: 160,
        priority: 1,
        render: (row) => (
          <div className="min-w-0">
            {influencerLink(row.influencer)}
            <div className="truncate text-xs text-muted">
              {row.influencer.publicInfluencerId}
            </div>
          </div>
        ),
      },
      {
        defaultWidth: 150,
        id: "status",
        label: "Status",
        minWidth: 120,
        priority: 1,
        render: (row) => (
          <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
        ),
      },
      {
        defaultWidth: 180,
        id: "bank",
        label: "Bank",
        minWidth: 140,
        priority: 1,
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate text-foreground">{row.bankName}</div>
            <div className="truncate text-xs text-muted">
              {row.accountNumberMasked}
            </div>
          </div>
        ),
      },
      {
        defaultWidth: 130,
        id: "ifsc",
        label: "IFSC",
        minWidth: 100,
        priority: 3,
        render: (row) => <span className="text-muted">{row.ifscCode}</span>,
      },
      {
        defaultWidth: 120,
        id: "submitted",
        label: "Submitted",
        minWidth: 96,
        priority: 2,
        render: (row) => (
          <span className="text-muted">{formatDate(row.createdAt)}</span>
        ),
      },
    ],
    [],
  );

  const kycColumns = useMemo<DataListColumn<InfluencerKycReviewRow>[]>(
    () => [
      {
        defaultWidth: 210,
        grow: true,
        id: "influencer",
        label: "Influencer",
        minWidth: 160,
        priority: 1,
        render: (row) => (
          <div className="min-w-0">
            {influencerLink(row.influencer)}
            <div className="truncate text-xs text-muted">
              {row.influencer.publicInfluencerId}
            </div>
          </div>
        ),
      },
      {
        defaultWidth: 120,
        id: "type",
        label: "Type",
        minWidth: 90,
        priority: 1,
        render: (row) => <span>{humanize(row.checkType)}</span>,
      },
      {
        defaultWidth: 150,
        id: "status",
        label: "Status",
        minWidth: 120,
        priority: 1,
        render: (row) => (
          <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
        ),
      },
      {
        defaultWidth: 160,
        id: "document",
        label: "Document",
        minWidth: 120,
        priority: 2,
        render: (row) => (
          <span className="truncate text-muted">
            {row.documentNumberMasked ?? "—"}
          </span>
        ),
      },
      {
        defaultWidth: 120,
        id: "submitted",
        label: "Submitted",
        minWidth: 96,
        priority: 2,
        render: (row) => (
          <span className="text-muted">
            {formatDate(row.submittedAt ?? row.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const payoutColumns = useMemo<DataListColumn<InfluencerPayoutRow>[]>(
    () => [
      {
        defaultWidth: 180,
        grow: true,
        id: "payout",
        label: "Payout",
        minWidth: 150,
        priority: 1,
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {row.publicPayoutId}
            </div>
            <div className="truncate text-xs text-muted">{row.batchKey}</div>
          </div>
        ),
      },
      {
        defaultWidth: 190,
        id: "influencer",
        label: "Influencer",
        minWidth: 140,
        priority: 1,
        render: (row) => influencerLink(row.influencer),
      },
      {
        defaultWidth: 140,
        id: "status",
        label: "Status",
        minWidth: 110,
        priority: 1,
        render: (row) => (
          <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
        ),
      },
      {
        align: "right",
        defaultWidth: 110,
        id: "amount",
        label: "Amount",
        minWidth: 96,
        priority: 1,
        render: (row) => (
          <span>{formatPaise(row.totalAmountPaise, row.currency)}</span>
        ),
      },
      {
        defaultWidth: 150,
        id: "bank",
        label: "Bank",
        minWidth: 120,
        priority: 2,
        render: (row) => (
          <span className="truncate text-muted">
            {row.bankAccount
              ? `${row.bankAccount.bankName} · ${row.bankAccount.accountNumberMasked}`
              : "—"}
          </span>
        ),
      },
      {
        defaultWidth: 130,
        id: "signal",
        label: "Signal",
        minWidth: 110,
        priority: 2,
        render: (row) => (
          <span
            className={cn(
              "truncate text-xs",
              row.warnings.length && "text-warning",
              (row.failureReason || row.holdReason) && "text-danger",
            )}
          >
            {row.failureReason ??
              row.holdReason ??
              row.warnings[0] ??
              row.nextRecommendedAction ??
              "—"}
          </span>
        ),
      },
      {
        defaultWidth: 120,
        id: "updated",
        label: "Updated",
        minWidth: 96,
        priority: 3,
        render: (row) => (
          <span className="text-muted">{formatDate(row.updatedAt)}</span>
        ),
      },
    ],
    [],
  );

  const pageChromeAction = (
    <div className="flex flex-wrap items-center gap-2">
      {canApprovePayouts ? (
        <Button
          className="h-9"
          size="sm"
          type="button"
          variant="primary"
          onClick={() => setAction({ kind: "CREATE_BATCH" })}
        >
          <PlayCircle className="size-4 sm:mr-2" />
          <span className="hidden sm:inline">Create batch</span>
        </Button>
      ) : null}
      <Button
        className="h-9"
        disabled={
          bankQuery.isFetching || kycQuery.isFetching || payoutQuery.isFetching
        }
        size="sm"
        type="button"
        variant="secondary"
        onClick={() => {
          if (activeTab === "banks") void bankQuery.refetch();
          if (activeTab === "kyc") void kycQuery.refetch();
          if (activeTab === "payouts") void payoutQuery.refetch();
        }}
      >
        <RefreshCcw className="size-4 sm:mr-2" />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  );

  const tabs = (
    <div className="flex flex-wrap gap-2">
      {[
        { key: "banks", label: "Bank reviews", icon: Banknote },
        { key: "kyc", label: "KYC reviews", icon: FileCheck2 },
        { key: "payouts", label: "Payout queue", icon: BadgeIndianRupee },
      ].map((item) => {
        const Icon = item.icon;
        const selected = activeTab === item.key;
        return (
          <button
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold transition",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-muted hover:text-foreground",
            )}
            key={item.key}
            type="button"
            onClick={() => {
              setActiveTab(item.key as WorkspaceTab);
              setPage(1);
            }}
          >
            <Icon className="mr-2 size-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );

  const stats = (
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-[0.9rem] border border-border bg-surface p-3">
        <div className="text-xs font-medium text-muted">
          Visible pending amount
        </div>
        <div className="mt-1 text-lg font-semibold text-foreground">
          {formatPaise(payoutSummary?.pendingAmountPaise)}
        </div>
      </div>
      <div className="rounded-[0.9rem] border border-border bg-surface p-3">
        <div className="text-xs font-medium text-muted">
          Visible paid amount
        </div>
        <div className="mt-1 text-lg font-semibold text-foreground">
          {formatPaise(payoutSummary?.paidAmountPaise)}
        </div>
      </div>
      <div className="rounded-[0.9rem] border border-border bg-surface p-3">
        <div className="text-xs font-medium text-muted">Visible rows</div>
        <div className="mt-1 text-lg font-semibold text-foreground">
          {activeRows.length}
        </div>
      </div>
    </div>
  );

  const commonPagination = {
    page,
    pageSize: limit,
    totalItems:
      activeTab === "banks"
        ? (bankQuery.data?.pagination.totalItems ?? 0)
        : activeTab === "kyc"
          ? (kycQuery.data?.pagination.totalItems ?? 0)
          : (payoutQuery.data?.pagination.totalItems ?? 0),
    totalPages:
      activeTab === "banks"
        ? (bankQuery.data?.pagination.totalPages ?? 1)
        : activeTab === "kyc"
          ? (kycQuery.data?.pagination.totalPages ?? 1)
          : (payoutQuery.data?.pagination.totalPages ?? 1),
    onPageChange: setPage,
    onPageSizeChange: (nextLimit: number) => {
      setLimit(nextLimit);
      setPage(1);
    },
  };

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={pageChromeAction}
        description="Review creator bank accounts and KYC, then approve and settle manual influencer payouts."
        layout="workspace"
        placement="body"
        statsNode={stats}
        tabsNode={tabs}
        title="Influencer Payouts"
      />

      {batchNotice ? (
        <div className="mb-3 mt-3 rounded-[0.8rem] border border-success/20 bg-success/5 p-3 text-sm text-success">
          {batchNotice}
        </div>
      ) : null}

      <div className="mt-3 min-h-0 flex-1">
        {activeTab === "banks" ? (
          <DataList
            activeQueue={bankQueue}
            columns={bankColumns}
            emptyHint="Customer-submitted payout accounts will appear here."
            emptyMessage="No influencer bank accounts match these filters"
            errorMessage="Could not load influencer bank accounts."
            getRowId={(row) => row.id}
            isError={bankQuery.isError}
            isLoading={bankQuery.isLoading}
            pagination={commonPagination}
            queueTabs={queueTabs(bankQueues, bankSummary)}
            rowActions={(row) =>
              canReviewInfluencers && hasAction(row, "VERIFY") ? (
                <div className="flex justify-end gap-1">
                  <Button
                    size="xs"
                    type="button"
                    onClick={() =>
                      setAction({ kind: "VERIFY_BANK", bankAccount: row })
                    }
                  >
                    Verify
                  </Button>
                  <Button
                    size="xs"
                    type="button"
                    variant="danger"
                    onClick={() =>
                      setAction({ kind: "REJECT_BANK", bankAccount: row })
                    }
                  >
                    Reject
                  </Button>
                </div>
              ) : null
            }
            rowActionsWidth={130}
            rows={bankRows}
            search={search}
            searchPlaceholder="Search creator or account…"
            storageKey={STORAGE_KEYS.banks}
            onQueueChange={(key) => {
              setBankQueue(key);
              setPage(1);
            }}
            onRetry={() => void bankQuery.refetch()}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        ) : null}

        {activeTab === "kyc" ? (
          <DataList
            activeQueue={kycQueue}
            appliedFilterCount={kycType === "ALL" ? 0 : 1}
            columns={kycColumns}
            emptyHint="Customer-submitted KYC checks will appear here."
            emptyMessage="No influencer KYC checks match these filters"
            errorMessage="Could not load influencer KYC checks."
            filters={
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Check type
                </span>
                <select
                  className={inputClass}
                  value={kycType}
                  onChange={(event) => {
                    setKycType(
                      event.target.value as InfluencerKycCheckType | "ALL",
                    );
                    setPage(1);
                  }}
                >
                  <option value="ALL">All</option>
                  <option value="PAN">PAN</option>
                  <option value="AADHAAR">Aadhaar</option>
                  <option value="MANUAL_ID">Manual ID</option>
                </select>
              </label>
            }
            getRowId={(row) => row.id}
            isError={kycQuery.isError}
            isLoading={kycQuery.isLoading}
            pagination={commonPagination}
            queueTabs={queueTabs(kycQueues, kycSummary)}
            rowActions={(row) =>
              canReviewInfluencers && hasAction(row, "APPROVE") ? (
                <div className="flex justify-end gap-1">
                  <Button
                    size="xs"
                    type="button"
                    onClick={() => setAction({ kind: "APPROVE_KYC", kyc: row })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    type="button"
                    variant="danger"
                    onClick={() => setAction({ kind: "REJECT_KYC", kyc: row })}
                  >
                    Reject
                  </Button>
                </div>
              ) : null
            }
            rowActionsWidth={140}
            rows={kycRows}
            search={search}
            searchPlaceholder="Search creator or document…"
            storageKey={STORAGE_KEYS.kyc}
            onQueueChange={(key) => {
              setKycQueue(key);
              setPage(1);
            }}
            onResetFilters={() => setKycType("ALL")}
            onRetry={() => void kycQuery.refetch()}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        ) : null}

        {activeTab === "payouts" ? (
          <DataList
            activeQueue={payoutQueue}
            columns={payoutColumns}
            emptyHint="Create a batch once creators have payable confirmed commissions."
            emptyMessage="No influencer payouts match these filters"
            errorMessage="Could not load influencer payouts."
            getRowId={(row) => row.id}
            isError={payoutQuery.isError}
            isLoading={payoutQuery.isLoading}
            pagination={commonPagination}
            queueTabs={queueTabs(payoutQueues, payoutSummary)}
            rowActions={(row) =>
              canApprovePayouts ? (
                <div className="flex flex-wrap justify-end gap-1">
                  {hasAction(row, "APPROVE") ? (
                    <Button
                      size="xs"
                      type="button"
                      onClick={() =>
                        setAction({ kind: "APPROVE_PAYOUT", payout: row })
                      }
                    >
                      Approve
                    </Button>
                  ) : null}
                  {hasAction(row, "MARK_PAID") ? (
                    <Button
                      size="xs"
                      type="button"
                      onClick={() =>
                        setAction({ kind: "MARK_PAID", payout: row })
                      }
                    >
                      Paid
                    </Button>
                  ) : null}
                  {hasAction(row, "RETRY") ? (
                    <Button
                      size="xs"
                      type="button"
                      onClick={() =>
                        setAction({ kind: "RETRY_PAYOUT", payout: row })
                      }
                    >
                      Retry
                    </Button>
                  ) : null}
                  {hasAction(row, "HOLD") ? (
                    <Button
                      size="xs"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setAction({ kind: "HOLD_PAYOUT", payout: row })
                      }
                    >
                      Hold
                    </Button>
                  ) : null}
                  {hasAction(row, "MARK_FAILED") ? (
                    <Button
                      size="xs"
                      type="button"
                      variant="danger"
                      onClick={() =>
                        setAction({ kind: "MARK_FAILED", payout: row })
                      }
                    >
                      Fail
                    </Button>
                  ) : null}
                  {hasAction(row, "CANCEL") ? (
                    <Button
                      size="xs"
                      type="button"
                      variant="danger"
                      onClick={() =>
                        setAction({ kind: "CANCEL_PAYOUT", payout: row })
                      }
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null
            }
            rowActionsWidth={210}
            rows={payoutRows}
            search={search}
            searchPlaceholder="Search payout, batch or creator…"
            storageKey={STORAGE_KEYS.payouts}
            toolbarActions={
              payoutSummary?.HELD || payoutSummary?.FAILED ? (
                <div className="hidden items-center gap-2 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning md:flex">
                  <ShieldAlert className="size-3.5" />
                  Visible attention:{" "}
                  {(payoutSummary?.HELD ?? 0) + (payoutSummary?.FAILED ?? 0)}
                </div>
              ) : null
            }
            onQueueChange={(key) => {
              setPayoutQueue(key);
              setPage(1);
            }}
            onRetry={() => void payoutQuery.refetch()}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        ) : null}
      </div>

      {action ? (
        <ActionModal
          action={action}
          error={actionError}
          isSubmitting={mutation.isPending}
          onClose={() => {
            if (!mutation.isPending) {
              setAction(null);
              setActionError(null);
            }
          }}
          onSubmit={(values) =>
            void mutation.mutateAsync({ selected: action, values })
          }
        />
      ) : null}

      {!canReviewInfluencers && activeTab !== "payouts" ? (
        <div className="mt-3 flex items-center gap-2 rounded-[0.8rem] border border-warning/20 bg-warning/5 p-3 text-sm text-warning">
          <CheckCircle2 className="size-4" />
          You can view payout queues, but bank/KYC review actions require
          influencer review permission.
        </div>
      ) : null}
    </PageContainer>
  );
}
