import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgePercent,
  RefreshCcw,
  Search,
  ShieldCheck,
  TicketPercent,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "../../../components/layout/PageContainer";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Input } from "../../../components/ui/Input";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { RecordMetricStrip } from "../../../components/ui/RecordPage";
import {
  DynamicTable,
  type DynamicTableColumn,
} from "../../../components/ui/Table";
import { routePaths } from "../../../config/routes";
import { useAuthStore } from "../../../store/authStore";
import type { StatusTone } from "../../../types/status.types";
import { cn } from "../../../utils/cn";
import { formatDate } from "../../../utils/formatDate";
import { formatMoney } from "../../../utils/formatMoney";
import { customerRetentionService } from "../services/customerRetention.service";
import type {
  LoyaltyLedgerEntry,
  PrivacyDeletionRequest,
  PrivacyExportRequest,
  PromoAbuseFinding,
  PromoCode,
  PromoCodeFormPayload,
  ReferralAbuseFinding,
  WalletLedgerEntry,
} from "../types/customerRetention.types";
import { VendorOffersPanel } from "./VendorOffersPanel";

type RetentionTab = "privacy" | "rewards" | "promos" | "vendor-offers" | "abuse";

const tabs: {
  id: RetentionTab;
  label: string;
  icon: typeof ShieldCheck;
  permissions: string[];
}[] = [
  {
    id: "privacy",
    label: "Privacy",
    icon: ShieldCheck,
    permissions: ["privacy-requests:read"],
  },
  {
    id: "rewards",
    label: "Wallet & loyalty",
    icon: WalletCards,
    permissions: ["wallet:read", "loyalty:read"],
  },
  {
    id: "promos",
    label: "Promo codes",
    icon: TicketPercent,
    permissions: ["promotions:read"],
  },
  {
    id: "vendor-offers",
    label: "Vendor offers",
    icon: BadgePercent,
    permissions: ["promotions:read"],
  },
  {
    id: "abuse",
    label: "Abuse review",
    icon: AlertTriangle,
    permissions: ["promotions:read", "loyalty:read"],
  },
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

function statusTone(value: string): StatusTone {
  if (["ACTIVE", "COMPLETED", "SETTLED"].includes(value)) return "success";
  if (["FAILED", "REJECTED", "EXPIRED"].includes(value)) return "danger";
  if (["PROCESSING", "UNDER_REVIEW", "SCHEDULED", "PAUSED"].includes(value)) {
    return "warning";
  }
  return "neutral";
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function SafeDate({ value }: { value: string | null }) {
  return <>{value ? formatDate(value, true) : "—"}</>;
}

function DialogShell({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="premium-overlay flex items-end justify-center p-0 sm:items-center sm:p-4">
      <section
        aria-modal="true"
        className="w-full max-w-xl rounded-t-[1rem] border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:rounded-[0.875rem] sm:p-5"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>
          <button
            aria-label="Close dialog"
            className="btn-icon"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ReasonField({
  reason,
  setReason,
}: {
  reason: string;
  setReason: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground">Reason *</span>
      <textarea
        className="form-input min-h-20 resize-y"
        maxLength={500}
        placeholder="Explain why this operation is required."
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <span className="text-xs text-muted">
        Stored in the audit trail. Minimum 3 characters.
      </span>
    </label>
  );
}

function PrivacyPanel() {
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((state) =>
    state.can("privacy-requests:update"),
  );
  const [exportStatus, setExportStatus] = useState("");
  const [deletionStatus, setDeletionStatus] = useState("");
  const [reviewTarget, setReviewTarget] =
    useState<PrivacyDeletionRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState("UNDER_REVIEW");
  const [reason, setReason] = useState("");

  const exportQuery = useQuery({
    queryKey: ["release2", "retention", "privacy-exports", exportStatus],
    queryFn: () =>
      customerRetentionService.listPrivacyExports({
        limit: 20,
        status: exportStatus || undefined,
      }),
    retry: false,
  });
  const deletionQuery = useQuery({
    queryKey: ["release2", "retention", "privacy-deletions", deletionStatus],
    queryFn: () =>
      customerRetentionService.listPrivacyDeletions({
        limit: 20,
        status: deletionStatus || undefined,
      }),
    retry: false,
  });
  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewTarget) throw new Error("No deletion request selected.");
      return customerRetentionService.reviewDeletion(
        reviewTarget.customer.customerId,
        reviewTarget.deletionRequestId,
        { status: reviewStatus, reason: reason.trim() },
      );
    },
    onSuccess: async () => {
      setReviewTarget(null);
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: ["release2", "retention", "privacy-deletions"],
      });
    },
  });

  const exportColumns: DynamicTableColumn<PrivacyExportRequest>[] = [
    {
      key: "customer",
      label: "Customer",
      minWidth: 220,
      renderCell: (row) => (
        <div>
          <Link
            className="font-medium text-foreground hover:underline"
            to={`${routePaths.customers}/${row.customer.customerId}`}
          >
            {row.customer.fullName}
          </Link>
          <p className="text-xs text-muted">{row.customer.mobileNumber}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      minWidth: 130,
      renderCell: (row) => (
        <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
      ),
    },
    {
      key: "requested",
      label: "Requested",
      minWidth: 180,
      renderCell: (row) => <SafeDate value={row.createdAt} />,
    },
    {
      key: "warnings",
      label: "Attention",
      minWidth: 220,
      renderCell: (row) =>
        (row.failureReason ?? row.warnings.map(humanize).join(", ")) || "—",
    },
  ];

  const deletionColumns: DynamicTableColumn<PrivacyDeletionRequest>[] = [
    {
      key: "customer",
      label: "Customer",
      minWidth: 220,
      renderCell: (row) => (
        <div>
          <Link
            className="font-medium text-foreground hover:underline"
            to={`${routePaths.customers}/${row.customer.customerId}`}
          >
            {row.customer.fullName}
          </Link>
          <p className="text-xs text-muted">{row.customer.mobileNumber}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      minWidth: 160,
      renderCell: (row) => (
        <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
      ),
    },
    {
      key: "reason",
      label: "Customer reason",
      minWidth: 260,
      getValue: (row) => row.reason ?? "—",
    },
    {
      key: "createdAt",
      label: "Requested",
      minWidth: 180,
      renderCell: (row) => <SafeDate value={row.createdAt} />,
    },
  ];

  const summary = deletionQuery.data?.summary;

  return (
    <div className="space-y-5">
      {summary ? (
        <RecordMetricStrip
          ariaLabel="Deletion queue summary"
          metrics={[
            {
              label: "Total deletion requests",
              value: String(summary.total ?? 0),
            },
            {
              label: "Awaiting review",
              value: String(
                (summary.requested ?? 0) + (summary.underReview ?? 0),
              ),
              tone: "warning",
            },
            { label: "Scheduled", value: String(summary.scheduled ?? 0) },
            {
              label: "Completed",
              value: String(summary.completed ?? 0),
              tone: "success",
            },
          ]}
        />
      ) : null}

      <DynamicTable
        columns={exportColumns}
        data={exportQuery.data?.data ?? []}
        description="Cross-customer export jobs, including failures and expired links."
        emptyDescription="New export requests will appear here."
        emptyTitle="No export requests"
        error={exportQuery.isError ? errorMessage(exportQuery.error) : false}
        loading={exportQuery.isLoading}
        title="Data export queue"
        toolbar={
          <select
            className="form-input w-full sm:w-48"
            value={exportStatus}
            onChange={(event) => setExportStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED"].map(
              (status) => (
                <option key={status}>{status}</option>
              ),
            )}
          </select>
        }
        onRetry={() => void exportQuery.refetch()}
      />

      <DynamicTable
        columns={deletionColumns}
        data={deletionQuery.data?.data ?? []}
        description="Review customer deletion requests without losing required legal or transaction records."
        emptyDescription="New deletion requests will appear here."
        emptyTitle="No deletion requests"
        error={
          deletionQuery.isError ? errorMessage(deletionQuery.error) : false
        }
        loading={deletionQuery.isLoading}
        rowActions={(row) => [
          {
            key: "review",
            label: "Review",
            placement: "inline",
            isVisible: canUpdate && row.availableActions.includes("REVIEW"),
            onClick: () => {
              setReviewTarget(row);
              setReviewStatus("UNDER_REVIEW");
              setReason("");
            },
          },
        ]}
        title="Account deletion queue"
        toolbar={
          <select
            className="form-input w-full sm:w-56"
            value={deletionStatus}
            onChange={(event) => setDeletionStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "REQUESTED",
              "UNDER_REVIEW",
              "SCHEDULED",
              "COMPLETED",
              "REJECTED",
              "RETAINED_FOR_LEGAL_REASON",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        }
        onRetry={() => void deletionQuery.refetch()}
      />

      {reviewTarget ? (
        <DialogShell
          title="Review deletion request"
          subtitle={`${reviewTarget.customer.fullName} · ${reviewTarget.customer.mobileNumber}`}
          onClose={() => setReviewTarget(null)}
        >
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length >= 3) reviewMutation.mutate();
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-foreground">
                Decision *
              </span>
              <select
                className="form-input"
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value)}
              >
                {[
                  "UNDER_REVIEW",
                  "SCHEDULED",
                  "REJECTED",
                  "RETAINED_FOR_LEGAL_REASON",
                ].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <ReasonField reason={reason} setReason={setReason} />
            {reviewMutation.isError ? (
              <p className="text-sm text-danger">
                {errorMessage(reviewMutation.error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReviewTarget(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={reason.trim().length < 3}
                isLoading={reviewMutation.isPending}
                type="submit"
              >
                Save review
              </Button>
            </div>
          </form>
        </DialogShell>
      ) : null}
    </div>
  );
}

function RewardsPanel() {
  const queryClient = useQueryClient();
  const canWalletUpdate = useAuthStore((state) => state.can("wallet:update"));
  const canLoyaltyUpdate = useAuthStore((state) => state.can("loyalty:update"));
  const [input, setInput] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [adjustment, setAdjustment] = useState<"wallet" | "loyalty" | null>(
    null,
  );
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const validCustomerId = uuidPattern.test(customerId);

  const walletQuery = useQuery({
    enabled: validCustomerId,
    queryKey: ["release2", "retention", "wallet", customerId],
    queryFn: () => customerRetentionService.getWalletLedger(customerId),
    retry: false,
  });
  const loyaltyQuery = useQuery({
    enabled: validCustomerId,
    queryKey: ["release2", "retention", "loyalty", customerId],
    queryFn: () => customerRetentionService.getLoyaltyLedger(customerId),
    retry: false,
  });
  const adjustmentMutation = useMutation<unknown, Error>({
    mutationFn: () => {
      const numericAmount = Number(amount);
      if (adjustment === "wallet") {
        return customerRetentionService.adjustWallet(customerId, {
          direction,
          amountPaise: Math.round(numericAmount * 100),
          reason: reason.trim(),
        });
      }
      return customerRetentionService.adjustLoyalty(customerId, {
        direction,
        points: Math.round(numericAmount),
        reason: reason.trim(),
      });
    },
    onSuccess: async () => {
      setAdjustment(null);
      setAmount("");
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: ["release2", "retention"],
      });
    },
  });

  const walletColumns: DynamicTableColumn<WalletLedgerEntry>[] = [
    {
      key: "createdAt",
      label: "Date",
      minWidth: 170,
      renderCell: (row) => <SafeDate value={row.createdAt} />,
    },
    {
      key: "entryType",
      label: "Movement",
      minWidth: 170,
      renderCell: (row) => (
        <Badge tone={row.direction === "CREDIT" ? "success" : "warning"}>
          {humanize(row.entryType)}
        </Badge>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      minWidth: 130,
      renderCell: (row) => (
        <span className="font-medium tabular-nums">
          {row.direction === "DEBIT" ? "−" : "+"}
          {formatMoney(row.amountPaise / 100, row.currency)}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Balance after",
      minWidth: 150,
      renderCell: (row) =>
        formatMoney(row.balanceAfterPaise / 100, row.currency),
    },
    {
      key: "reason",
      label: "Reason",
      minWidth: 260,
      getValue: (row) => row.reason ?? "—",
    },
  ];
  const loyaltyColumns: DynamicTableColumn<LoyaltyLedgerEntry>[] = [
    {
      key: "createdAt",
      label: "Date",
      minWidth: 170,
      renderCell: (row) => <SafeDate value={row.createdAt} />,
    },
    {
      key: "entryType",
      label: "Movement",
      minWidth: 170,
      renderCell: (row) => (
        <Badge tone={row.direction === "CREDIT" ? "success" : "warning"}>
          {humanize(row.entryType)}
        </Badge>
      ),
    },
    {
      key: "points",
      label: "Points",
      minWidth: 120,
      renderCell: (row) => (
        <span className="font-medium tabular-nums">
          {row.direction === "DEBIT" ? "−" : "+"}
          {row.points.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Balance after",
      minWidth: 140,
      getValue: (row) => row.balanceAfterPoints.toLocaleString("en-IN"),
    },
    {
      key: "reason",
      label: "Reason",
      minWidth: 260,
      getValue: (row) => row.reason ?? "—",
    },
  ];

  const wallet = walletQuery.data?.data;
  const loyalty = loyaltyQuery.data?.data;

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (uuidPattern.test(input.trim())) setCustomerId(input.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Customer UUID"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </div>
          <Button disabled={!uuidPattern.test(input.trim())} type="submit">
            Load ledgers
          </Button>
        </form>
        {input && !uuidPattern.test(input.trim()) ? (
          <p className="mt-2 text-xs text-danger">
            Enter a valid customer UUID.
          </p>
        ) : null}
      </Card>

      {!customerId ? (
        <EmptyState
          title="Choose a customer"
          description="Enter the customer UUID to inspect wallet and loyalty history without exposing balances in broad customer lists."
        />
      ) : null}

      {wallet || loyalty ? (
        <RecordMetricStrip
          ariaLabel="Customer rewards summary"
          metrics={[
            {
              label: "Wallet available",
              value: wallet
                ? formatMoney(
                    wallet.account.availableBalancePaise / 100,
                    wallet.account.currency,
                  )
                : "—",
            },
            {
              label: "Wallet reserved",
              value: wallet
                ? formatMoney(
                    wallet.account.reservedBalancePaise / 100,
                    wallet.account.currency,
                  )
                : "—",
            },
            {
              label: "Points balance",
              value: loyalty
                ? loyalty.account.pointsBalance.toLocaleString("en-IN")
                : "—",
            },
            {
              label: "Points expired",
              value: loyalty
                ? loyalty.account.lifetimeExpiredPoints.toLocaleString("en-IN")
                : "—",
            },
          ]}
        />
      ) : null}

      {customerId ? (
        <DynamicTable
          columns={walletColumns}
          data={wallet?.data ?? []}
          description="Ledger-backed wallet movements; adjustments require recent authentication and an audit reason."
          emptyDescription="This customer has no wallet movements."
          emptyTitle="No wallet entries"
          error={walletQuery.isError ? errorMessage(walletQuery.error) : false}
          loading={walletQuery.isLoading}
          title="Wallet ledger"
          toolbar={
            canWalletUpdate ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAdjustment("wallet");
                  setAmount("");
                  setReason("");
                }}
              >
                Adjust wallet
              </Button>
            ) : null
          }
          onRetry={() => void walletQuery.refetch()}
        />
      ) : null}

      {customerId ? (
        <DynamicTable
          columns={loyaltyColumns}
          data={loyalty?.data ?? []}
          description="Point earnings, redemptions, reversals, expiry and manual corrections."
          emptyDescription="This customer has no loyalty movements."
          emptyTitle="No loyalty entries"
          error={
            loyaltyQuery.isError ? errorMessage(loyaltyQuery.error) : false
          }
          loading={loyaltyQuery.isLoading}
          title="Loyalty ledger"
          toolbar={
            canLoyaltyUpdate ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAdjustment("loyalty");
                  setAmount("");
                  setReason("");
                }}
              >
                Adjust points
              </Button>
            ) : null
          }
          onRetry={() => void loyaltyQuery.refetch()}
        />
      ) : null}

      {adjustment ? (
        <DialogShell
          title={
            adjustment === "wallet"
              ? "Adjust wallet balance"
              : "Adjust loyalty points"
          }
          subtitle={customerId}
          onClose={() => setAdjustment(null)}
        >
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (Number(amount) > 0 && reason.trim().length >= 6)
                adjustmentMutation.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Direction *
                </span>
                <select
                  className="form-input"
                  value={direction}
                  onChange={(event) =>
                    setDirection(event.target.value as "CREDIT" | "DEBIT")
                  }
                >
                  <option value="CREDIT">Credit</option>
                  <option value="DEBIT">Debit</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">
                  {adjustment === "wallet" ? "Amount (INR)" : "Points"} *
                </span>
                <Input
                  min="1"
                  step={adjustment === "wallet" ? "0.01" : "1"}
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            </div>
            <ReasonField reason={reason} setReason={setReason} />
            <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
              Debits cannot take a balance below zero. Wallet adjustments are
              also capped by the Release 2 finance setting.
            </p>
            {adjustmentMutation.isError ? (
              <p className="text-sm text-danger">
                {errorMessage(adjustmentMutation.error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAdjustment(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={Number(amount) <= 0 || reason.trim().length < 6}
                isLoading={adjustmentMutation.isPending}
                type="submit"
              >
                Apply adjustment
              </Button>
            </div>
          </form>
        </DialogShell>
      ) : null}
    </div>
  );
}

const blankPromo: PromoCodeFormPayload = {
  code: "",
  displayName: "",
  description: "",
  source: "PLATFORM",
  discountType: "PERCENTAGE",
  discountBps: 1000,
  maxDiscountPaise: 0,
  minOrderValuePaise: 0,
  maxRedemptionsGlobal: 1000,
  maxRedemptionsPerCustomer: 1,
  stackable: true,
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16),
  reason: "",
};

function PromoForm({
  initial,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  initial?: PromoCode;
  onClose: () => void;
  onSubmit: (payload: PromoCodeFormPayload) => void;
  submitting: boolean;
  error?: unknown;
}) {
  const [form, setForm] = useState<PromoCodeFormPayload>(() =>
    initial
      ? {
          ...blankPromo,
          code: initial.code,
          displayName: initial.displayName,
          description: initial.description ?? "",
          source: initial.source,
          discountType: initial.discountType,
          discountBps: initial.discountBps ?? undefined,
          discountPaise: initial.discountPaise ?? undefined,
          maxDiscountPaise: initial.maxDiscountPaise,
          minOrderValuePaise: initial.minOrderValuePaise,
          maxRedemptionsGlobal: initial.maxRedemptionsGlobal,
          maxRedemptionsPerCustomer: initial.maxRedemptionsPerCustomer,
          stackable: initial.stackable,
          startsAt: initial.startsAt.slice(0, 16),
          endsAt: initial.endsAt.slice(0, 16),
          reason: "",
        }
      : blankPromo,
  );
  const set = <K extends keyof PromoCodeFormPayload>(
    key: K,
    value: PromoCodeFormPayload[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const valid =
    form.code.trim().length >= 3 &&
    form.displayName.trim().length >= 3 &&
    form.maxRedemptionsGlobal > 0 &&
    form.reason.trim().length >= 3 &&
    new Date(form.endsAt) > new Date(form.startsAt);

  return (
    <DialogShell
      title={initial ? `Edit ${initial.code}` : "Create promo code"}
      subtitle="The promo is created as a draft and must be activated separately."
      onClose={onClose}
    >
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSubmit(form);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">Code *</span>
            <Input
              disabled={Boolean(initial)}
              value={form.code}
              onChange={(event) =>
                set("code", event.target.value.toUpperCase())
              }
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">Display name *</span>
            <Input
              value={form.displayName}
              onChange={(event) => set("displayName", event.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">Source *</span>
            <select
              className="form-input"
              disabled={Boolean(initial)}
              value={form.source}
              onChange={(event) =>
                set("source", event.target.value as PromoCode["source"])
              }
            >
              {["PLATFORM", "VENDOR", "INFLUENCER"].map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">Discount type *</span>
            <select
              className="form-input"
              disabled={Boolean(initial)}
              value={form.discountType}
              onChange={(event) =>
                set(
                  "discountType",
                  event.target.value as PromoCode["discountType"],
                )
              }
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">
              {form.discountType === "PERCENTAGE"
                ? "Discount (basis points)"
                : "Discount (paise)"}{" "}
              *
            </span>
            <Input
              min="1"
              type="number"
              value={
                form.discountType === "PERCENTAGE"
                  ? (form.discountBps ?? "")
                  : (form.discountPaise ?? "")
              }
              onChange={(event) =>
                form.discountType === "PERCENTAGE"
                  ? set("discountBps", Number(event.target.value))
                  : set("discountPaise", Number(event.target.value))
              }
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">
              Global redemption cap *
            </span>
            <Input
              min="1"
              type="number"
              value={form.maxRedemptionsGlobal}
              onChange={(event) =>
                set("maxRedemptionsGlobal", Number(event.target.value))
              }
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">Starts *</span>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => set("startsAt", event.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold">Ends *</span>
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => set("endsAt", event.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold">Description</span>
          <textarea
            className="form-input min-h-16 resize-y"
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={form.stackable}
            type="checkbox"
            onChange={(event) => set("stackable", event.target.checked)}
          />{" "}
          Allow stacking with loyalty and wallet
        </label>
        <ReasonField
          reason={form.reason}
          setReason={(value) => set("reason", value)}
        />
        {form.source !== "PLATFORM" ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
            Vendor and influencer promo funding settlement is not implemented.
            Do not activate these codes until funding is explicitly approved.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-danger">{errorMessage(error)}</p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} isLoading={submitting} type="submit">
            {initial ? "Save changes" : "Create draft"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

function PromosPanel() {
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((state) => state.can("promotions:update"));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<PromoCode | "new" | null>(null);
  const [statusAction, setStatusAction] = useState<{
    promo: PromoCode;
    status: "ACTIVE" | "PAUSED" | "EXPIRED";
  } | null>(null);
  const [reason, setReason] = useState("");

  const promosQuery = useQuery({
    queryKey: ["release2", "retention", "promos", status, search],
    queryFn: () =>
      customerRetentionService.listPromoCodes({
        limit: 50,
        status: status || undefined,
        search: search.trim().length >= 2 ? search.trim() : undefined,
      }),
    retry: false,
  });
  const saveMutation = useMutation({
    mutationFn: (payload: PromoCodeFormPayload) => {
      if (editing && editing !== "new") {
        const {
          code: _code,
          source: _source,
          discountType: _discountType,
          discountBps: _discountBps,
          discountPaise: _discountPaise,
          ...update
        } = payload;
        return customerRetentionService.updatePromoCode(editing.promoCodeId, {
          ...update,
          startsAt: new Date(payload.startsAt).toISOString(),
          endsAt: new Date(payload.endsAt).toISOString(),
        });
      }
      return customerRetentionService.createPromoCode({
        ...payload,
        startsAt: new Date(payload.startsAt).toISOString(),
        endsAt: new Date(payload.endsAt).toISOString(),
      });
    },
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({
        queryKey: ["release2", "retention", "promos"],
      });
    },
  });
  const statusMutation = useMutation({
    mutationFn: async () => {
      if (!statusAction) throw new Error("No promo selected.");
      if (statusAction.status === "EXPIRED")
        return customerRetentionService.deletePromoCode(
          statusAction.promo.promoCodeId,
          reason.trim(),
        );
      return customerRetentionService.changePromoStatus(
        statusAction.promo.promoCodeId,
        { status: statusAction.status, reason: reason.trim() },
      );
    },
    onSuccess: async () => {
      setStatusAction(null);
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: ["release2", "retention", "promos"],
      });
    },
  });

  const columns: DynamicTableColumn<PromoCode>[] = [
    {
      key: "promo",
      label: "Promo",
      minWidth: 240,
      renderCell: (row) => (
        <div>
          <p className="font-semibold text-foreground">{row.code}</p>
          <p className="text-xs text-muted">{row.displayName}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      minWidth: 120,
      renderCell: (row) => (
        <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
      ),
    },
    {
      key: "discount",
      label: "Discount",
      minWidth: 150,
      renderCell: (row) =>
        row.discountType === "PERCENTAGE"
          ? `${((row.discountBps ?? 0) / 100).toFixed(2)}%`
          : formatMoney((row.discountPaise ?? 0) / 100),
    },
    {
      key: "usage",
      label: "Usage",
      minWidth: 150,
      renderCell: (row) => (
        <span className="tabular-nums">
          {row.redemptionCount.toLocaleString("en-IN")} /{" "}
          {row.maxRedemptionsGlobal.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "window",
      label: "Window",
      minWidth: 210,
      renderCell: (row) => (
        <div>
          <SafeDate value={row.startsAt} />
          <span className="mx-1">–</span>
          <SafeDate value={row.endsAt} />
        </div>
      ),
    },
    {
      key: "warnings",
      label: "Attention",
      minWidth: 260,
      renderCell: (row) =>
        row.warnings.length ? (
          <span className="text-warning">
            {row.warnings.map(humanize).join(", ")}
          </span>
        ) : (
          "—"
        ),
    },
  ];
  const summary = promosQuery.data?.summary;

  return (
    <div className="space-y-5">
      {summary ? (
        <RecordMetricStrip
          metrics={Object.entries(summary)
            .slice(0, 5)
            .map(([label, value]) => ({
              label: humanize(label),
              value: String(value),
            }))}
        />
      ) : null}
      <DynamicTable
        columns={columns}
        data={promosQuery.data?.data ?? []}
        description="Create drafts, review live usage and change availability with recent authentication and an audit reason."
        emptyDescription="Create a draft promo when an approved offer is ready."
        emptyTitle="No promo codes"
        error={promosQuery.isError ? errorMessage(promosQuery.error) : false}
        loading={promosQuery.isLoading}
        rowActions={(promo) =>
          canUpdate
            ? [
                {
                  key: "edit",
                  label: "Edit",
                  onClick: () => setEditing(promo),
                },
                {
                  key: "activate",
                  label: "Activate",
                  isVisible: promo.availableActions.includes("ACTIVATE"),
                  onClick: () => {
                    setStatusAction({ promo, status: "ACTIVE" });
                    setReason("");
                  },
                },
                {
                  key: "pause",
                  label: "Pause",
                  isVisible: promo.availableActions.includes("PAUSE"),
                  onClick: () => {
                    setStatusAction({ promo, status: "PAUSED" });
                    setReason("");
                  },
                },
                {
                  key: "delete",
                  label: "Delete",
                  variant: "danger",
                  onClick: () => {
                    setStatusAction({ promo, status: "EXPIRED" });
                    setReason("");
                  },
                },
              ]
            : []
        }
        title="Promo codes"
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                placeholder="Search code or name"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select
              className="form-input sm:w-40"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            {canUpdate ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                Create promo
              </Button>
            ) : null}
          </div>
        }
        onRetry={() => void promosQuery.refetch()}
      />
      {editing ? (
        <PromoForm
          initial={editing === "new" ? undefined : editing}
          error={saveMutation.error}
          submitting={saveMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      ) : null}
      {statusAction ? (
        <DialogShell
          title={`${humanize(statusAction.status)} ${statusAction.promo.code}`}
          subtitle="This action changes customer availability and is audited."
          onClose={() => setStatusAction(null)}
        >
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length >= 3) statusMutation.mutate();
            }}
          >
            <ReasonField reason={reason} setReason={setReason} />
            {statusMutation.isError ? (
              <p className="text-sm text-danger">
                {errorMessage(statusMutation.error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStatusAction(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={reason.trim().length < 3}
                isLoading={statusMutation.isPending}
                type="submit"
                variant={
                  statusAction.status === "EXPIRED" ? "danger" : "primary"
                }
              >
                Confirm
              </Button>
            </div>
          </form>
        </DialogShell>
      ) : null}
    </div>
  );
}

function AbusePanel() {
  const promoQuery = useQuery({
    queryKey: ["release2", "retention", "abuse", "promos"],
    queryFn: () =>
      customerRetentionService.listPromoAbuse({ limit: 50, windowHours: 168 }),
    retry: false,
  });
  const referralQuery = useQuery({
    queryKey: ["release2", "retention", "abuse", "referrals"],
    queryFn: () =>
      customerRetentionService.listReferralAbuse({
        limit: 50,
        windowHours: 168,
      }),
    retry: false,
  });
  const promoColumns: DynamicTableColumn<PromoAbuseFinding>[] = [
    {
      key: "customer",
      label: "Customer",
      minWidth: 220,
      renderCell: (row) => (
        <div>
          <Link
            className="font-medium hover:underline"
            to={`${routePaths.customers}/${row.customerId}`}
          >
            {row.customer.fullName}
          </Link>
          <p className="text-xs text-muted">{row.customer.mobileNumber}</p>
        </div>
      ),
    },
    {
      key: "promo",
      label: "Promo",
      minWidth: 130,
      getValue: (row) => row.code,
    },
    {
      key: "window",
      label: "Last 7 days",
      minWidth: 130,
      getValue: (row) => row.redemptionsInWindow,
    },
    {
      key: "total",
      label: "Total",
      minWidth: 100,
      getValue: (row) => row.redemptions,
    },
    {
      key: "reversed",
      label: "Reversed",
      minWidth: 110,
      getValue: (row) => row.reversedRedemptions,
    },
    {
      key: "warning",
      label: "Finding",
      minWidth: 250,
      renderCell: (row) => (
        <span className="text-warning">
          {row.warnings.map(humanize).join(", ") || "Review threshold reached"}
        </span>
      ),
    },
  ];
  const referralColumns: DynamicTableColumn<ReferralAbuseFinding>[] = [
    {
      key: "customer",
      label: "Referrer",
      minWidth: 220,
      renderCell: (row) => (
        <div>
          <Link
            className="font-medium hover:underline"
            to={`${routePaths.customers}/${row.referrerCustomerId}`}
          >
            {row.customer.fullName}
          </Link>
          <p className="text-xs text-muted">{row.customer.mobileNumber}</p>
        </div>
      ),
    },
    {
      key: "window",
      label: "Last 7 days",
      minWidth: 130,
      getValue: (row) => row.settledInWindow,
    },
    {
      key: "settled",
      label: "Settled total",
      minWidth: 130,
      getValue: (row) => row.settledTotal,
    },
    {
      key: "pending",
      label: "Pending",
      minWidth: 100,
      getValue: (row) => row.pendingTotal,
    },
    {
      key: "reward",
      label: "Rewarded",
      minWidth: 130,
      getValue: (row) => row.rewardedLabel,
    },
    {
      key: "warning",
      label: "Finding",
      minWidth: 250,
      renderCell: (row) => (
        <span className="text-warning">
          {row.warnings.map(humanize).join(", ") || "Review threshold reached"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-muted">
        These queues expose server-backed rule signals only. They do not
        auto-block customers or invent a risk score.
      </p>
      <DynamicTable
        columns={promoColumns}
        data={promoQuery.data?.data ?? []}
        description="Customer/promo pairs ranked against each promo's own redemption cap."
        emptyDescription="No customer/promo pair crossed the review threshold."
        emptyTitle="No promo findings"
        error={promoQuery.isError ? errorMessage(promoQuery.error) : false}
        loading={promoQuery.isLoading}
        title="Promo redemption review"
        onRetry={() => void promoQuery.refetch()}
      />
      <DynamicTable
        columns={referralColumns}
        data={referralQuery.data?.data ?? []}
        description="Referrers ranked against the configured settlement velocity cap."
        emptyDescription="No referrer crossed the review threshold."
        emptyTitle="No referral findings"
        error={
          referralQuery.isError ? errorMessage(referralQuery.error) : false
        }
        loading={referralQuery.isLoading}
        title="Referral review"
        onRetry={() => void referralQuery.refetch()}
      />
    </div>
  );
}

export function CustomerRetentionPage() {
  const can = useAuthStore((state) => state.can);
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) =>
        tab.permissions.some((permission) => can(permission)),
      ),
    [can],
  );
  const requestedTab = searchParams.get("tab") as RetentionTab | null;
  const activeTab =
    visibleTabs.find((tab) => tab.id === requestedTab)?.id ??
    visibleTabs[0]?.id;

  if (!activeTab) {
    return (
      <PageContainer>
        <PageContextHeader
          layout="document"
          placement="topbar"
          title="Customer Retention"
        />
        <ErrorState
          title="Permission required"
          description="You need privacy, wallet, loyalty or promotions read permission to open this operating area."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-4">
      <PageContextHeader
        layout="document"
        placement="topbar"
        title="Customer Retention"
        actionNode={
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
        }
      />
      <div
        className="flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Customer retention operations"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.id === activeTab;
          return (
            <button
              aria-selected={selected}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition",
                selected
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground",
              )}
              key={tab.id}
              role="tab"
              type="button"
              onClick={() => setSearchParams({ tab: tab.id })}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "privacy" ? <PrivacyPanel /> : null}
      {activeTab === "rewards" ? <RewardsPanel /> : null}
      {activeTab === "promos" ? <PromosPanel /> : null}
      {activeTab === "vendor-offers" ? <VendorOffersPanel /> : null}
      {activeTab === "abuse" ? <AbusePanel /> : null}
    </PageContainer>
  );
}
