import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Search, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { RecordMetricStrip } from "../../../components/ui/RecordPage";
import { DynamicTable, type DynamicTableColumn } from "../../../components/ui/Table";
import { useAuthStore } from "../../../store/authStore";
import type { StatusTone } from "../../../types/status.types";
import { formatDate } from "../../../utils/formatDate";
import { formatMoney } from "../../../utils/formatMoney";
import { customerRetentionService } from "../services/customerRetention.service";
import type { AdminVendorOffer } from "../types/customerRetention.types";

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function statusTone(status: string): StatusTone {
  if (status === "ACTIVE") return "success";
  if (["ADMIN_RESTRICTED", "REMOVED", "EXPIRED"].includes(status)) return "danger";
  if (["DRAFT", "PAUSED"].includes(status)) return "warning";
  return "neutral";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function discountLabel(offer: AdminVendorOffer) {
  return offer.discountType === "PERCENTAGE"
    ? `${(offer.discountBps / 100).toFixed(offer.discountBps % 100 ? 2 : 0)}%`
    : formatMoney(offer.discountPaise / 100);
}

function RestrictionDialog({
  action,
  error,
  isSubmitting,
  offer,
  onClose,
  onConfirm,
}: {
  action: "RESTRICT" | "RESTORE";
  error?: string;
  isSubmitting: boolean;
  offer: AdminVendorOffer;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="premium-overlay flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div aria-labelledby="vendor-offer-action-title" aria-modal="true" className="premium-modal-surface max-w-lg" role="dialog">
        <div className="flex items-start justify-between gap-4 border-b border-adaptive p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground" id="vendor-offer-action-title">
              {action === "RESTRICT" ? "Restrict vendor offer" : "Restore vendor offer"}
            </h2>
            <p className="mt-1 text-sm text-muted">{offer.title} · {offer.vendorName}</p>
          </div>
          <button aria-label="Close" className="btn-icon" onClick={onClose} type="button"><X className="size-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-control border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
            <AlertTriangle className="mr-2 inline size-4 text-warning" />
            {action === "RESTRICT"
              ? "Customers will stop seeing and applying this offer immediately."
              : "The offer returns to paused so the vendor must deliberately reactivate it."}
          </div>
          <label className="block text-sm font-medium text-foreground" htmlFor="vendor-offer-action-reason">Audit reason</label>
          <textarea
            autoFocus
            className="form-input min-h-28 w-full resize-y"
            id="vendor-offer-action-reason"
            maxLength={500}
            placeholder="Explain the policy, abuse, support, or review reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              isLoading={isSubmitting}
              variant={action === "RESTRICT" ? "danger" : "primary"}
              disabled={reason.trim().length < 3}
              onClick={() => onConfirm(reason.trim())}
            >
              {action === "RESTRICT" ? "Restrict offer" : "Restore to paused"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VendorOffersPanel() {
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((state) => state.can("promotions:update"));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [actionState, setActionState] = useState<{
    offer: AdminVendorOffer;
    action: "RESTRICT" | "RESTORE";
  } | null>(null);

  const offersQuery = useQuery({
    queryKey: ["release2", "vendor-offers", status, search, riskOnly],
    queryFn: () => customerRetentionService.listVendorOffers({
      limit: 100,
      status: status || undefined,
      search: search.trim().length >= 2 ? search.trim() : undefined,
      riskOnly: riskOnly || undefined,
    }),
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!actionState) throw new Error("No vendor offer selected.");
      return customerRetentionService.updateVendorOfferRestriction(actionState.offer.id, {
        action: actionState.action,
        expectedVersion: actionState.offer.version,
        reason,
      });
    },
    onSuccess: async () => {
      setActionState(null);
      await queryClient.invalidateQueries({ queryKey: ["release2", "vendor-offers"] });
    },
  });

  const columns: DynamicTableColumn<AdminVendorOffer>[] = [
    {
      key: "offer",
      label: "Offer",
      minWidth: 260,
      renderCell: (offer) => <div><p className="font-semibold text-foreground">{offer.title}</p><p className="text-xs text-muted">{humanize(offer.offerType)} · {offer.categoryName}</p></div>,
    },
    {
      key: "vendor",
      label: "Vendor",
      minWidth: 180,
      renderCell: (offer) => <div><p className="text-sm text-foreground">{offer.vendorName}</p><p className="font-mono text-[11px] text-muted">{offer.vendorId.slice(0, 8)}</p></div>,
    },
    {
      key: "status",
      label: "Status",
      minWidth: 140,
      renderCell: (offer) => <div><Badge tone={statusTone(offer.status)}>{humanize(offer.status)}</Badge>{offer.restrictionReason ? <p className="mt-1 max-w-48 text-xs text-danger">{offer.restrictionReason}</p> : null}</div>,
    },
    { key: "discount", label: "Discount", minWidth: 120, renderCell: discountLabel },
    {
      key: "usage",
      label: "Usage",
      minWidth: 140,
      renderCell: (offer) => <span className="tabular-nums">{offer.redemptionCount.toLocaleString("en-IN")} / {offer.maxRedemptions.toLocaleString("en-IN")}</span>,
    },
    {
      key: "window",
      label: "Window",
      minWidth: 220,
      renderCell: (offer) => <div><span>{formatDate(offer.startsAt, true)}</span><span className="mx-1">–</span><span>{formatDate(offer.endsAt, true)}</span></div>,
    },
    {
      key: "risk",
      label: "Risk signals",
      minWidth: 190,
      renderCell: (offer) => {
        const utilization = offer.maxRedemptions ? offer.redemptionCount / offer.maxRedemptions : 0;
        const signals = [offer.discountBps >= 1500 ? "High discount" : "", utilization >= 0.8 ? "High utilization" : "", offer.countdownSeconds > 0 && offer.countdownSeconds <= 259200 ? "Expiring soon" : ""].filter(Boolean);
        return signals.length ? <span className="text-warning">{signals.join(", ")}</span> : "—";
      },
    },
  ];

  const summary = offersQuery.data?.summary;
  return (
    <div className="space-y-5">
      {summary ? <RecordMetricStrip metrics={[
        { label: "Active", value: String(summary.active) },
        { label: "Restricted", value: String(summary.restricted) },
        { label: "Expiring soon", value: String(summary.expiringSoon) },
        { label: "Redemptions", value: summary.redemptions.toLocaleString("en-IN") },
        { label: "Maximum exposure", value: formatMoney(summary.discountExposurePaise / 100) },
      ]} /> : null}
      <DynamicTable
        columns={columns}
        data={offersQuery.data?.data ?? []}
        description="Review vendor-funded offer exposure and intervene only when policy, abuse, or support review requires it."
        emptyDescription="Vendor-created offers will appear here after the Release 2 feature is enabled."
        emptyTitle="No vendor offers"
        error={offersQuery.isError ? errorMessage(offersQuery.error) : false}
        loading={offersQuery.isLoading}
        onRetry={() => void offersQuery.refetch()}
        rowActions={(offer) => canUpdate ? [{
          key: offer.status === "ADMIN_RESTRICTED" ? "restore" : "restrict",
          label: offer.status === "ADMIN_RESTRICTED" ? "Restore to paused" : "Restrict",
          variant: offer.status === "ADMIN_RESTRICTED" ? "secondary" : "danger",
          isVisible: offer.availableActions.includes(offer.status === "ADMIN_RESTRICTED" ? "RESTORE" : "RESTRICT"),
          onClick: () => { actionMutation.reset(); setActionState({ offer, action: offer.status === "ADMIN_RESTRICTED" ? "RESTORE" : "RESTRICT" }); },
        }] : []}
        title="Vendor offers"
        toolbar={<div className="flex w-full flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" placeholder="Search offer title or description" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <select className="form-input sm:w-44" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "ADMIN_RESTRICTED"].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select>
          <label className="flex min-h-10 items-center gap-2 rounded-control border border-border px-3 text-sm text-foreground"><input checked={riskOnly} type="checkbox" onChange={(event) => setRiskOnly(event.target.checked)} /> Risk only</label>
        </div>}
      />
      {actionState ? <RestrictionDialog action={actionState.action} offer={actionState.offer} error={actionMutation.isError ? errorMessage(actionMutation.error) : undefined} isSubmitting={actionMutation.isPending} onClose={() => setActionState(null)} onConfirm={(reason) => actionMutation.mutate(reason)} /> : null}
    </div>
  );
}
