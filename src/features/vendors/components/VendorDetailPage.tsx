import {
  ArrowUpRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Eye,
  FileCheck2,
  FileWarning,
  Film,
  History,
  Landmark,
  MessageSquarePlus,
  Package,
  PauseCircle,
  Pencil,
  PencilLine,
  Plus,
  RotateCcw,
  Tags,
  Trash2,
  Truck,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Skeleton } from "../../../components/ui/Skeleton";
import {
  DynamicTable,
  type DynamicTableColumn,
} from "../../../components/ui/Table";
import {
  inferMediaViewerKind,
  isOpenableMediaUrl,
  useMediaViewer,
  type MediaViewerItem,
} from "../../../components/media";
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from "../../../components/layout/DetailPageHeader";
import { PageContainer } from "../../../components/layout/PageContainer";
import { routePaths } from "../../../config/routes";
import { useAuthStore } from "../../../store/authStore";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import { cn } from "../../../utils/cn";
import { formatMoney } from "../../../utils/formatMoney";
import { orderService } from "../../orders/services/order.service";
import {
  OrderActionModal,
  type OrderActionFormValues,
  type OrderActionSelection,
} from "../../orders/components/OrderActionModal";
import type {
  AdminOrderPaymentStatus,
  AdminOrderStatus,
  AdminOrderSummary,
} from "../../orders/types/order.types";
import {
  PayoutActionModal,
  type PayoutActionFormValues,
  type PayoutActionKind,
  type PayoutActionSelection,
} from "../../payouts/components/PayoutActionModal";
import { payoutService } from "../../payouts/services/payout.service";
import type {
  AdminPayoutStatus,
  AdminPayoutSummary,
} from "../../payouts/types/payout.types";
import { reelService } from "../../reels/services/reel.service";
import {
  ReelActionModal,
  type ReelActionFormValues,
  type ReelActionKind,
  type ReelActionSelection,
} from "../../reels/components/ReelActionModal";
import type {
  AdminReel,
  ReelModerationStatus,
  ReelUploadStatus,
} from "../../reels/types/reel.types";
import { vendorService } from "../services/vendor.service";
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
  type VendorActionSelection,
} from "./VendorActionModal";
import { VendorProfileEditModal } from "./VendorProfileEditModal";
import {
  VendorServiceActionModal,
  type VendorServiceActionFormValues,
  type VendorServiceActionKind,
  type VendorServiceActionSelection,
} from "./VendorServiceActionModal";
import type {
  VendorBankAccount,
  VendorBankAccountSummary,
  VendorBrandLogoMimeType,
  VendorContactPerson,
  VendorActionResult,
  VendorDetail,
  VendorDocument,
  VendorDocumentSummary,
  VendorOverviewResponse,
  VendorProfileUpdatePayload,
  VendorServiceRecord,
  VendorReviewTimelineItem,
  VendorStatus,
  VendorOnboardingStatus,
} from "../types/vendor.types";

const hiddenVendorDetailActions = ["REQUEST_DOCUMENTS"] as const;
const vendorProfileActions = ["EDIT_PROFILE"] as const;
const vendorReviewActions = [
  "ADD_NOTE",
  "APPROVE",
  "REACTIVATE",
  "REJECT",
  "REJECT_BANK_ACCOUNT",
  "REJECT_DOCUMENT",
  "REQUEST_DOCUMENTS",
  "SUSPEND",
  "VERIFY_BANK_ACCOUNT",
  "VERIFY_DOCUMENT",
] as const;

type VendorDetailActionContext = Pick<
  VendorDetail,
  "availableActions" | "onboardingStatus" | "vendorStatus"
>;
type VendorHeaderActionKind = Extract<
  VendorActionKind,
  "ADD_NOTE" | "APPROVE" | "REACTIVATE" | "REJECT" | "SUSPEND"
>;

function isRejectedVendor(vendor: VendorDetailActionContext) {
  return (
    vendor.onboardingStatus === "REJECTED" &&
    vendor.vendorStatus === "INACTIVE"
  );
}

function getVendorDetailActionSource(vendor: VendorDetailActionContext) {
  if (
    !isRejectedVendor(vendor) ||
    vendor.availableActions.includes("REACTIVATE")
  ) {
    return vendor.availableActions;
  }

  return [...vendor.availableActions, "REACTIVATE"];
}

const vendorDetailSectionIds = {
  overview: "vendor-detail-overview",
  documents: "vendor-detail-documents",
  payoutAccount: "vendor-detail-payout-account",
  activity: "vendor-detail-activity",
  payouts: "vendor-detail-payouts",
  orders: "vendor-detail-orders",
  services: "vendor-detail-services",
  reels: "vendor-detail-reels",
  profile: "vendor-detail-profile",
} as const;

interface VendorActionVisibility {
  canApproveVendors: boolean;
  canUpdateProfile: boolean;
}

type VendorTone = "success" | "warning" | "danger" | "info" | "neutral";

type VendorBrandLogoAction = "change" | "remove";
type VendorDetailSectionKey = keyof typeof vendorDetailSectionIds;

interface VendorReviewJumpTarget {
  description: string;
  icon: ReactNode;
  label: string;
  section: VendorDetailSectionKey;
}

interface VendorBrandLogoMutationInput {
  action: VendorBrandLogoAction;
  file?: File;
  reason: string;
}

const vendorBrandLogoMimeTypes: VendorBrandLogoMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
const vendorBrandLogoMaxSizeBytes = 2 * 1024 * 1024;
const vendorBrandLogoAccept = vendorBrandLogoMimeTypes.join(",");

const orderStatuses: AdminOrderStatus[] = [
  "ORDER_PLACED",
  "VENDOR_ACCEPTANCE_PENDING",
  "PRICE_REVISION_PENDING_CUSTOMER",
  "VENDOR_ACCEPTED",
  "VENDOR_DECLINED",
  "PICKUP_SCHEDULED",
  "PICKED_UP_FROM_CUSTOMER",
  "HANDED_OVER_TO_VENDOR",
  "ITEM_RECEIVED_BY_VENDOR",
  "SERVICE_IN_PROGRESS",
  "SERVICE_COMPLETED",
  "COLLECTED_FROM_VENDOR",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "DELIVERY_FAILED",
  "CUSTOMER_UNAVAILABLE",
  "ITEM_DAMAGED",
  "ITEM_LOST",
  "WRONG_ITEM",
];

interface VendorOrderActionTarget {
  action: OrderActionSelection;
  order: AdminOrderSummary;
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return "Not available";

  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-IN");
}

function getUploadStatusTone(status: ReelUploadStatus): VendorTone {
  if (status === "READY") return "success";
  if (status === "FAILED" || status === "DELETED") return "danger";
  if (status === "PROCESSING" || status === "UPLOADING") return "warning";
  return "neutral";
}

function getModerationStatusTone(status: ReelModerationStatus): VendorTone {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED" || status === "REMOVED") return "danger";
  if (status === "PENDING_REVIEW" || status === "EDIT_REQUESTED")
    return "warning";
  if (status === "PAUSED") return "info";
  return "neutral";
}

function getOrderStatusTone(status: AdminOrderStatus): VendorTone {
  if (status === "DELIVERED") return "success";

  if (
    status === "CANCELLED" ||
    status === "ITEM_DAMAGED" ||
    status === "ITEM_LOST" ||
    status === "WRONG_ITEM"
  ) {
    return "danger";
  }

  if (
    status === "PRICE_REVISION_PENDING_CUSTOMER" ||
    status === "VENDOR_ACCEPTANCE_PENDING" ||
    status === "DELIVERY_FAILED" ||
    status === "CUSTOMER_UNAVAILABLE"
  ) {
    return "warning";
  }

  return "info";
}

function getPaymentStatusTone(status: AdminOrderPaymentStatus): VendorTone {
  if (status === "PAID" || status === "REFUNDED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PARTIALLY_REFUNDED") return "info";
  return "warning";
}

function getPayoutStatusTone(status: AdminPayoutStatus): VendorTone {
  if (status === "PAID" || status === "ADJUSTED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "HELD" || status === "PENDING") return "warning";
  return "info";
}

function formatPaise(value: number | null | undefined, currency = "INR") {
  return value == null ? "Not available" : formatMoney(value / 100, currency);
}

function orderDisplayValue(order: AdminOrderSummary) {
  const pendingRevision = order.pricing.pendingPriceRevision;

  if (pendingRevision) {
    return {
      meta: `Was ${formatPaise(
        pendingRevision.previousPricePaise,
        pendingRevision.currency,
      )}`,
      value: formatPaise(
        pendingRevision.revisedPricePaise,
        pendingRevision.currency,
      ),
    };
  }

  const amountPaise =
    order.pricing.finalPricePaise ??
    order.pricing.payableAmountPaise ??
    order.pricing.priceEstimatePaise;

  return {
    meta: order.pricing.finalPricePaise ? "Final value" : "Estimate",
    value: formatPaise(amountPaise, order.pricing.currency),
  };
}

function hasOrderAction(order: AdminOrderSummary, action: string) {
  return order.availableActions
    .map((availableAction) => availableAction.toUpperCase())
    .includes(action);
}

function hasPayoutAction(payout: AdminPayoutSummary, action: string) {
  return payout.availableActions
    .map((availableAction) => availableAction.toUpperCase())
    .includes(action);
}

function hasBankAccountAction(bankAccount: VendorBankAccount, action: string) {
  return bankAccount.availableActions
    .map((availableAction) => availableAction.toUpperCase())
    .includes(action);
}

function patchVendorDocumentSummary(
  current: VendorDocumentSummary | null,
  next?: VendorDocumentSummary | null,
) {
  return next === undefined ? current : next;
}

function buildBankAccountSummary(
  accounts: VendorBankAccount[],
  current: VendorBankAccountSummary,
): VendorBankAccountSummary {
  const primary =
    accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const summary = accounts.reduce(
    (acc, account) => {
      acc.total += 1;

      if (account.status === "VERIFIED") acc.verified += 1;
      if (account.status === "PENDING_VERIFICATION") acc.pending += 1;
      if (account.status === "REJECTED") acc.rejected += 1;
      if (account.status === "DISABLED") acc.disabled += 1;

      return acc;
    },
    { total: 0, verified: 0, pending: 0, rejected: 0, disabled: 0 },
  );
  const warnings: string[] = [];

  if (!primary) {
    warnings.push("PRIMARY_BANK_ACCOUNT_MISSING");
  } else if (primary.status === "PENDING_VERIFICATION") {
    warnings.push("PRIMARY_BANK_ACCOUNT_PENDING_VERIFICATION");
  } else if (primary.status === "REJECTED") {
    warnings.push("PRIMARY_BANK_ACCOUNT_REJECTED");
  } else if (primary.status === "DISABLED") {
    warnings.push("PRIMARY_BANK_ACCOUNT_DISABLED");
  }

  return {
    ...current,
    ...summary,
    hasPrimary: Boolean(primary),
    primaryStatus: primary?.status ?? null,
    primaryBankName: primary?.bankName ?? null,
    primaryAccountNumberMasked: primary?.accountNumberMasked ?? null,
    payoutReady: primary?.status === "VERIFIED",
    warnings,
    nextRecommendedAction: !primary
      ? "ADD_BANK_ACCOUNT"
      : primary.status === "PENDING_VERIFICATION"
        ? "WAIT_FOR_ADMIN_BANK_REVIEW"
        : primary.status === "REJECTED"
          ? "UPDATE_BANK_ACCOUNT"
          : null,
  };
}

function patchVendorOverviewWithActionResult(
  current: VendorOverviewResponse | undefined,
  result: VendorActionResult,
): VendorOverviewResponse | undefined {
  if (!current || current.data.vendor.vendorId !== result.vendorId) {
    return current;
  }

  const vendor = current.data.vendor;
  const changedDocument = result.verifiedDocument ?? result.rejectedDocument;
  const documents = changedDocument
    ? vendor.documents.map((document) =>
        document.documentId === changedDocument.documentId
          ? {
              ...document,
              ...changedDocument,
              rejectionReason:
                changedDocument.rejectionReason === undefined
                  ? document.rejectionReason
                  : changedDocument.rejectionReason,
            }
          : document,
      )
    : vendor.documents;
  const bankAccounts = result.bankAccount
    ? vendor.bankAccounts.map((account) =>
        account.bankAccountId === result.bankAccount?.bankAccountId
          ? result.bankAccount
          : account,
      )
    : vendor.bankAccounts;
  const nextVendor: VendorDetail = {
    ...vendor,
    shopName: result.shopName ?? vendor.shopName,
    onboardingStatus: result.onboardingStatus ?? vendor.onboardingStatus,
    vendorStatus: result.vendorStatus ?? vendor.vendorStatus,
    reviewNotes:
      result.reviewNotes === undefined ? vendor.reviewNotes : result.reviewNotes,
    rejectionReason:
      result.rejectionReason === undefined
        ? vendor.rejectionReason
        : result.rejectionReason,
    documentSummary: patchVendorDocumentSummary(
      vendor.documentSummary,
      result.documentSummary,
    ),
    warnings: result.warnings ?? vendor.warnings,
    availableActions: result.availableActions ?? vendor.availableActions,
    nextRecommendedAction:
      result.nextRecommendedAction === undefined
        ? vendor.nextRecommendedAction
        : result.nextRecommendedAction,
    verifiedAt:
      result.verifiedAt === undefined ? vendor.verifiedAt : result.verifiedAt,
    suspendedAt:
      result.suspendedAt === undefined ? vendor.suspendedAt : result.suspendedAt,
    suspensionReason:
      result.suspensionReason === undefined
        ? vendor.suspensionReason
        : result.suspensionReason,
    updatedAt: result.updatedAt ?? vendor.updatedAt,
    documents,
    bankAccounts,
    bankAccountSummary: result.bankAccount
      ? buildBankAccountSummary(bankAccounts, vendor.bankAccountSummary)
      : vendor.bankAccountSummary,
  };

  return {
    ...current,
    data: {
      ...current.data,
      vendor: nextVendor,
    },
  };
}

function statusFromRecommendedAction(action: string) {
  const normalized = action.toUpperCase();
  const markPrefix = "MARK_";

  if (normalized.startsWith(markPrefix)) {
    const targetStatus = normalized.slice(markPrefix.length);

    if (orderStatuses.includes(targetStatus as AdminOrderStatus)) {
      return targetStatus as AdminOrderStatus;
    }
  }

  return null;
}

function mapRecommendedOrderAction(
  order: AdminOrderSummary,
): OrderActionSelection | null {
  const action = order.nextRecommendedAction?.toUpperCase();

  if (!action) return null;

  if (action === "ADD_NOTE") return { kind: "ADD_NOTE" };
  if (action === "CANCEL" && hasOrderAction(order, "CANCEL")) {
    return { kind: "CANCEL" };
  }

  if (
    action === "INITIATE_REFUND" &&
    hasOrderAction(order, "INITIATE_REFUND")
  ) {
    return { kind: "INITIATE_REFUND" };
  }

  if (
    action === "GENERATE_DELIVERY_OTP" &&
    hasOrderAction(order, "GENERATE_DELIVERY_OTP")
  ) {
    return { kind: "GENERATE_DELIVERY_OTP" };
  }

  if (
    action === "CONFIRM_DELIVERY_OTP" &&
    hasOrderAction(order, "CONFIRM_DELIVERY_OTP")
  ) {
    return { kind: "CONFIRM_DELIVERY_OTP" };
  }

  const targetStatus = statusFromRecommendedAction(action);

  if (targetStatus && hasOrderAction(order, "UPDATE_STATUS")) {
    return { kind: "UPDATE_STATUS", targetStatus };
  }

  return null;
}

function orderActionLabel(action: OrderActionSelection) {
  if (action.kind === "UPDATE_STATUS") {
    return `Mark ${humanizeCode(action.targetStatus)}`;
  }

  return humanizeCode(action.kind);
}

function canRunOrderAction(
  action: OrderActionSelection,
  canUpdateOrders: boolean,
  canRefundPayments: boolean,
) {
  if (action.kind === "INITIATE_REFUND") return canRefundPayments;
  return canUpdateOrders;
}

function formatServicePriceType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatServiceWarning(value: string) {
  if (value === "CATALOG_USING_SUGGESTED_DEFAULT") {
    return "Using suggested catalog";
  }

  if (value === "FIXED_PRICE_WITH_ITEM_CATALOG") {
    return "Fixed price has item catalog";
  }

  if (value === "SERVICE_INACTIVE") {
    return "Inactive service";
  }

  return formatServicePriceType(value);
}

function getVisibleVendorDetailActions(
  actions: string[],
  visibility?: VendorActionVisibility,
) {
  return actions.filter(
    (action) => {
      const normalizedAction = action.toUpperCase();

      if (
        hiddenVendorDetailActions.includes(
          normalizedAction as (typeof hiddenVendorDetailActions)[number],
        )
      ) {
        return false;
      }

      if (
        vendorProfileActions.includes(
          normalizedAction as (typeof vendorProfileActions)[number],
        )
      ) {
        return visibility?.canUpdateProfile ?? true;
      }

      if (
        vendorReviewActions.includes(
          normalizedAction as (typeof vendorReviewActions)[number],
        )
      ) {
        return visibility?.canApproveVendors ?? true;
      }

      return true;
    },
  );
}

function toVendorHeaderActionKind(
  action: string | null | undefined,
): VendorHeaderActionKind | null {
  const normalizedAction = action?.toUpperCase();

  if (
    normalizedAction === "ADD_NOTE" ||
    normalizedAction === "APPROVE" ||
    normalizedAction === "REACTIVATE" ||
    normalizedAction === "REJECT" ||
    normalizedAction === "SUSPEND"
  ) {
    return normalizedAction;
  }

  return null;
}

function getRecommendedVendorHeaderAction(
  vendor: VendorDetail,
  visibleActions: string[],
) {
  const recommendedAction = toVendorHeaderActionKind(
    vendor.nextRecommendedAction,
  );

  if (
    recommendedAction &&
    (recommendedAction === "ADD_NOTE" ||
      visibleActions.includes(recommendedAction))
  ) {
    return recommendedAction;
  }

  if (isRejectedVendor(vendor) && visibleActions.includes("REACTIVATE")) {
    return "REACTIVATE";
  }

  return null;
}

const documentColumns: DynamicTableColumn<VendorDocument>[] = [
  {
    key: "documentType",
    label: "Document",
    minWidth: 220,
  },
  {
    key: "status",
    label: "Status",
    format: "status",
    statusTone: (value) =>
      value === "VERIFIED"
        ? "success"
        : value === "REJECTED"
          ? "danger"
          : "warning",
    minWidth: 140,
  },
  {
    key: "verifiedAt",
    label: "Verified",
    format: "date",
    minWidth: 180,
    placeholder: "Not verified",
  },
  {
    key: "updatedAt",
    label: "Updated",
    format: "date",
    minWidth: 180,
  },
];

const bankAccountColumns: DynamicTableColumn<VendorBankAccount>[] = [
  {
    key: "account",
    label: "Account",
    minWidth: 260,
    renderCell: (account) => (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{account.bankName}</p>
          {account.isPrimary ? <Badge tone="info">Primary</Badge> : null}
        </div>
        <p className="text-xs text-muted">{account.accountNumberMasked}</p>
      </div>
    ),
  },
  {
    key: "accountHolderName",
    label: "Holder",
    minWidth: 180,
  },
  {
    key: "ifscCode",
    label: "IFSC",
    minWidth: 140,
  },
  {
    key: "upiId",
    label: "UPI",
    minWidth: 180,
    placeholder: "Not linked",
  },
  {
    key: "status",
    label: "Status",
    format: "status",
    statusTone: (value) =>
      value === "VERIFIED"
        ? "success"
        : value === "REJECTED" || value === "DISABLED"
          ? "danger"
          : "warning",
    minWidth: 190,
  },
  {
    key: "verifiedAt",
    label: "Verified",
    format: "date",
    minWidth: 180,
    placeholder: "Not verified",
  },
  {
    key: "updatedAt",
    label: "Updated",
    format: "date",
    minWidth: 180,
  },
];

const serviceColumns: DynamicTableColumn<VendorServiceRecord>[] = [
  {
    key: "service",
    label: "Service",
    minWidth: 260,
    renderCell: (service) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{service.serviceName}</p>
          {service.nextRecommendedAction === "EDIT_CATALOG" ? (
            <Badge tone="warning">Catalog needed</Badge>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted">
          {service.description ?? "No description"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {service.category.name}
          {service.serviceType ? ` · ${service.serviceType.name}` : ""}
        </p>
      </div>
    ),
  },
  {
    key: "pricing",
    label: "Pricing",
    minWidth: 220,
    renderCell: (service) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatPaise(
            service.pricing.basePricePaise,
            service.pricing.currency,
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          {formatServicePriceType(service.pricing.priceType)}
        </p>
        {service.pricing.minPricePaise != null ||
        service.pricing.maxPricePaise != null ? (
          <p className="mt-1 text-xs text-muted">
            {formatPaise(
              service.pricing.minPricePaise,
              service.pricing.currency,
            )}{" "}
            to{" "}
            {formatPaise(
              service.pricing.maxPricePaise,
              service.pricing.currency,
            )}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: "catalog",
    label: "Catalog",
    minWidth: 210,
    renderCell: (service) => {
      const isConfigured = service.pricing.catalog.isConfigured;
      const itemCount = isConfigured
        ? service.pricing.catalog.configuredItemCount
        : service.pricing.catalog.items.length;
      const activeItemCount = isConfigured
        ? service.pricing.catalog.activeItemCount
        : service.pricing.catalog.items.filter(
            (item) => item.isActive !== false,
          ).length;

      return (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isConfigured ? "success" : "warning"}>
              {isConfigured ? "Configured" : "Suggested"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted">
            {activeItemCount} active / {itemCount} items
          </p>
          {service.warnings.length ? (
            <p className="mt-1 line-clamp-1 text-xs text-warning">
              {service.warnings.map(formatServiceWarning).join(", ")}
            </p>
          ) : null}
        </div>
      );
    },
  },
  {
    key: "isActive",
    label: "Status",
    minWidth: 130,
    renderCell: (service) => (
      <Badge tone={service.isActive ? "success" : "danger"}>
        {service.isActive ? "ACTIVE" : "INACTIVE"}
      </Badge>
    ),
  },
  {
    key: "updatedAt",
    label: "Updated",
    format: "date",
    minWidth: 180,
  },
];

const orderColumns: DynamicTableColumn<AdminOrderSummary>[] = [
  {
    key: "order",
    label: "Order",
    minWidth: 260,
    renderCell: (order) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{order.publicOrderId}</p>
          <Badge tone={getOrderStatusTone(order.orderStatus)}>
            {humanizeCode(order.orderStatus)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          Created {formatDateSafe(order.createdAt)}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {order.category?.name ?? "No category"}
        </p>
      </div>
    ),
  },
  {
    key: "customer",
    label: "Customer",
    minWidth: 220,
    renderCell: (order) => (
      <div>
        <p className="font-medium text-foreground">{order.customer.fullName}</p>
        <p className="mt-1 text-xs text-muted">
          {order.customer.mobileNumber ?? "No mobile"}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {order.customer.city ?? "No city"}
        </p>
      </div>
    ),
  },
  {
    key: "payment",
    label: "Payment",
    minWidth: 210,
    renderCell: (order) => {
      const value = orderDisplayValue(order);

      return (
        <div>
          <Badge tone={getPaymentStatusTone(order.paymentStatus)}>
            {humanizeCode(order.paymentStatus)}
          </Badge>
          <p className="mt-2 font-semibold text-foreground">{value.value}</p>
          <p className="mt-1 text-xs text-muted">
            {order.paymentMethod} · {value.meta}
          </p>
        </div>
      );
    },
  },
  {
    key: "pickup",
    label: "Pickup",
    minWidth: 210,
    renderCell: (order) => (
      <div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <CalendarClock className="size-4 text-muted" />
          <span>{formatDateSafe(order.schedule.pickupDate)}</span>
        </div>
        <p className="mt-1 pl-6 text-xs text-muted">
          {order.schedule.pickupSlotStart} - {order.schedule.pickupSlotEnd}
        </p>
        <p className="mt-1 pl-6 text-xs text-muted">
          Delivery {formatDateSafe(order.schedule.expectedDeliveryAt)}
        </p>
      </div>
    ),
  },
  {
    key: "activity",
    label: "Activity",
    minWidth: 210,
    renderCell: (order) => (
      <div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Package className="size-4 text-muted" />
          <span>{order.counts?.itemCount ?? 0} items</span>
        </div>
        <p className="mt-1 pl-6 text-xs text-muted">
          {order.counts?.noteCount ?? 0} notes /{" "}
          {order.counts?.refundCount ?? 0} refunds
        </p>
        {order.warnings.length ? (
          <p className="mt-1 line-clamp-1 pl-6 text-xs text-warning">
            {order.warnings.map(humanizeCode).join(", ")}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: "updatedAt",
    label: "Updated",
    minWidth: 180,
    renderCell: (order) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatDateSafe(order.updatedAt)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {order.nextRecommendedAction
            ? humanizeCode(order.nextRecommendedAction)
            : "No next action"}
        </p>
      </div>
    ),
  },
];

const payoutColumns: DynamicTableColumn<AdminPayoutSummary>[] = [
  {
    key: "payout",
    label: "Payout",
    minWidth: 260,
    renderCell: (payout) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">
            {payout.publicPayoutId}
          </p>
          <Badge tone={getPayoutStatusTone(payout.status)}>
            {humanizeCode(payout.status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          Created {formatDateSafe(payout.createdAt)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {humanizeCode(payout.payoutMethod)}
        </p>
      </div>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    minWidth: 210,
    renderCell: (payout) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatPaise(payout.totalAmountPaise, payout.currency)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Net payable{" "}
          {formatPaise(payout.itemSummary.netPayablePaise, payout.currency)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {payout.itemSummary.itemCount} earning items
        </p>
      </div>
    ),
  },
  {
    key: "deductions",
    label: "Deductions",
    minWidth: 220,
    renderCell: (payout) => (
      <div>
        <p className="text-sm text-foreground">
          Commission{" "}
          <span className="font-semibold">
            {formatPaise(
              payout.itemSummary.commissionAmountPaise,
              payout.currency,
            )}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Logistics{" "}
          {formatPaise(
            payout.itemSummary.logisticsDeductionPaise,
            payout.currency,
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          Adjustments{" "}
          {formatPaise(
            payout.itemSummary.adjustmentAmountPaise,
            payout.currency,
          )}
        </p>
      </div>
    ),
  },
  {
    key: "lifecycle",
    label: "Lifecycle",
    minWidth: 230,
    renderCell: (payout) => (
      <div>
        <p className="text-sm font-semibold text-foreground">
          {payout.paidAt
            ? `Paid ${formatDateSafe(payout.paidAt)}`
            : payout.approvedAt
              ? `Approved ${formatDateSafe(payout.approvedAt)}`
              : "Awaiting review"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {payout.utrReference
            ? `UTR ${payout.utrReference}`
            : payout.holdReason
              ? payout.holdReason
              : payout.failureReason
                ? payout.failureReason
                : "No transfer reference"}
        </p>
      </div>
    ),
  },
  {
    key: "warnings",
    label: "Signals",
    minWidth: 220,
    renderCell: (payout) => (
      <div>
        {payout.warnings.length ? (
          <p className="line-clamp-2 text-xs text-warning">
            {payout.warnings.map(humanizeCode).join(", ")}
          </p>
        ) : (
          <p className="text-xs text-muted">No warnings</p>
        )}
        <p className="mt-2 text-xs text-muted">
          Next{" "}
          {payout.nextRecommendedAction
            ? humanizeCode(payout.nextRecommendedAction)
            : "No action"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Updated {formatDateSafe(payout.updatedAt)}
        </p>
      </div>
    ),
  },
];

const reelColumns: DynamicTableColumn<AdminReel>[] = [
  {
    key: "reel",
    label: "Reel",
    minWidth: 320,
    renderCell: (reel) => (
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[0.65rem] border border-border bg-surface-muted">
          {reel.media.thumbnailUrl ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              src={reel.media.thumbnailUrl}
            />
          ) : (
            <Film className="size-5 text-muted" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{reel.publicReelId}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">
            {reel.caption ?? "No caption"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{humanizeCode(reel.contentType)}</Badge>
            {reel.priceIndicator ? (
              <span className="text-xs text-muted">{reel.priceIndicator}</span>
            ) : null}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "media",
    label: "Media",
    minWidth: 170,
    renderCell: (reel) => (
      <div>
        <Badge tone={getUploadStatusTone(reel.media.uploadStatus)}>
          {humanizeCode(reel.media.uploadStatus)}
        </Badge>
        <p className="mt-2 text-xs text-muted">
          {reel.media.durationSeconds
            ? `${reel.media.durationSeconds} seconds`
            : "Duration unavailable"}
        </p>
      </div>
    ),
  },
  {
    key: "moderation",
    label: "Moderation",
    minWidth: 210,
    renderCell: (reel) => (
      <div>
        <Badge tone={getModerationStatusTone(reel.moderation.status)}>
          {humanizeCode(reel.moderation.status)}
        </Badge>
        {reel.warnings.length ? (
          <p className="mt-2 line-clamp-1 text-xs text-warning">
            {reel.warnings.map(humanizeCode).join(", ")}
          </p>
        ) : (
          <p className="mt-2 line-clamp-1 text-xs text-muted">
            {reel.nextRecommendedAction
              ? humanizeCode(reel.nextRecommendedAction)
              : "No next action"}
          </p>
        )}
      </div>
    ),
  },
  {
    key: "visibility",
    label: "Visibility",
    minWidth: 170,
    renderCell: (reel) => (
      <div>
        <Badge
          tone={
            reel.publish.customerVisibility === "VISIBLE"
              ? "success"
              : "neutral"
          }
        >
          {humanizeCode(reel.publish.customerVisibility)}
        </Badge>
        <p className="mt-2 text-xs text-muted">
          Published {formatDateSafe(reel.publish.publishedAt)}
        </p>
      </div>
    ),
  },
  {
    key: "updatedAt",
    label: "Updated",
    minWidth: 180,
    renderCell: (reel) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatDateSafe(reel.updatedAt)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Created {formatDateSafe(reel.createdAt)}
        </p>
      </div>
    ),
  },
];

const timelineColumns: DynamicTableColumn<VendorReviewTimelineItem>[] = [
  {
    key: "actionCode",
    label: "Action",
    minWidth: 180,
  },
  {
    key: "reason",
    label: "Reason",
    minWidth: 260,
    placeholder: "No reason recorded",
  },
  {
    key: "createdAt",
    label: "Created",
    format: "date",
    minWidth: 180,
  },
];

interface VendorDocumentHistoryRow {
  reviewEventId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}

const documentHistoryColumns: DynamicTableColumn<VendorDocumentHistoryRow>[] = [
  {
    key: "action",
    label: "Action",
    minWidth: 220,
  },
  {
    key: "fromStatus",
    label: "From",
    minWidth: 120,
    placeholder: "—",
  },
  {
    key: "toStatus",
    label: "To",
    minWidth: 120,
    placeholder: "—",
  },
  {
    key: "reason",
    label: "Reason",
    minWidth: 280,
    placeholder: "No reason recorded",
  },
  {
    key: "createdAt",
    label: "When",
    format: "date",
    minWidth: 180,
  },
];

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">
        {value ?? "Not available"}
      </p>
    </div>
  );
}

function ContactPersonsField({
  contacts,
}: {
  contacts: VendorContactPerson[] | null | undefined;
}) {
  const visibleContacts = contacts?.slice(0, 3) ?? [];

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">
        Contact Persons
      </p>
      {visibleContacts.length > 0 ? (
        <div className="space-y-1 text-sm text-foreground">
          {visibleContacts.map((contact, index) => (
            <p
              className="break-words"
              key={`${contact.mobileNumber}-${contact.name}-${index}`}
            >
              <span className="font-medium">
                {contact.name || `Contact ${index + 1}`}
              </span>
              <span className="text-muted">
                {" "}
                · {contact.mobileNumber || "Mobile not available"}
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p className="break-words text-sm text-foreground">Not available</p>
      )}
    </div>
  );
}

function getVendorStatusTone(status: VendorStatus) {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "SUSPENDED") {
    return "danger";
  }

  if (status === "PENDING") {
    return "warning";
  }

  return "neutral";
}

function getOnboardingStatusTone(status: VendorOnboardingStatus) {
  if (status === "APPROVED") {
    return "success";
  }

  if (status === "REJECTED") {
    return "danger";
  }

  if (status === "DOCUMENTS_PENDING") {
    return "warning";
  }

  return "info";
}

function getVendorInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isVendorBrandLogoMimeType(
  value: string,
): value is VendorBrandLogoMimeType {
  return vendorBrandLogoMimeTypes.includes(value as VendorBrandLogoMimeType);
}

function formatFileSize(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function getVendorLogoToneClasses(vendor: VendorDetail) {
  if (vendor.vendorStatus === "SUSPENDED") {
    return "border-danger/25 text-danger";
  }

  if (vendor.onboardingStatus !== "APPROVED" || vendor.warnings.length > 0) {
    return "border-warning/25 text-warning";
  }

  return "border-success/25 text-success";
}

function buildVendorBrandLogoMediaItem(
  vendor: VendorDetail,
): MediaViewerItem | null {
  const logoUrl = vendor.brandLogo?.url ?? vendor.brandLogo?.downloadUrl ?? null;

  if (!isOpenableMediaUrl(logoUrl)) return null;

  return {
    description: "Brand logo shown across vendor records.",
    downloadUrl: vendor.brandLogo?.downloadUrl ?? logoUrl,
    expiresAt: vendor.brandLogo?.expiresAt,
    fileName: vendor.brandLogo?.fileName,
    id: `${vendor.vendorId}-brand-logo`,
    kind: inferMediaViewerKind({
      fileName: vendor.brandLogo?.fileName,
      mimeType: vendor.brandLogo?.mimeType,
      src: logoUrl,
    }),
    mimeType: vendor.brandLogo?.mimeType,
    ownerLabel: vendor.shopName,
    providerStatus: vendor.brandLogo?.providerStatus,
    sizeBytes: vendor.brandLogo?.sizeBytes,
    sourceLabel: "Vendor brand logo",
    src: logoUrl,
    title: `${vendor.shopName} brand logo`,
    warnings: vendor.brandLogo?.warnings ?? [],
  };
}

function buildVendorDocumentMediaItem(
  vendor: VendorDetail,
  document: VendorDocument,
): MediaViewerItem | null {
  const downloadUrl = document.download?.downloadUrl;

  if (!isOpenableMediaUrl(downloadUrl)) return null;

  const fileName = document.fileName ?? document.documentType;
  const mimeType = document.mimeType ?? null;

  return {
    description: `${humanizeCode(document.status)} vendor document for ${vendor.shopName}.`,
    downloadUrl,
    expiresAt: document.download?.expiresAt,
    fileName,
    id: document.documentId,
    kind: inferMediaViewerKind({
      fileName,
      mimeType,
      src: downloadUrl,
    }),
    mimeType,
    ownerLabel: vendor.shopName,
    providerStatus: document.download?.providerStatus,
    sizeBytes: document.sizeBytes ?? null,
    sourceLabel: "Vendor document",
    src: downloadUrl,
    title: humanizeCode(document.documentType),
    warnings: document.download?.warnings ?? [],
  };
}

function buildVendorReelMediaItems(reel: AdminReel): MediaViewerItem[] {
  const thumbnailUrl = isOpenableMediaUrl(reel.media.thumbnailUrl)
    ? reel.media.thumbnailUrl
    : null;
  const playbackUrl = isOpenableMediaUrl(reel.media.playbackUrl)
    ? reel.media.playbackUrl
    : null;
  const thumbnailItem: MediaViewerItem | null = thumbnailUrl
    ? {
        description: `${humanizeCode(reel.media.uploadStatus)} thumbnail.`,
        downloadUrl: thumbnailUrl,
        height: reel.media.height ?? null,
        id: `${reel.reelId}-thumbnail`,
        kind: "image",
        ownerLabel: reel.vendor.shopName,
        sourceLabel: "Vendor reel thumbnail",
        src: thumbnailUrl,
        title: `${reel.publicReelId} thumbnail`,
        width: reel.media.width ?? null,
      }
    : null;
  const videoItem: MediaViewerItem | null =
    reel.media.cloudflareVideoUid || playbackUrl
      ? {
          cloudflareVideoUid: reel.media.cloudflareVideoUid,
          description: reel.media.durationSeconds
            ? `${reel.media.durationSeconds} seconds`
            : humanizeCode(reel.media.uploadStatus),
          downloadUrl: playbackUrl,
          height: reel.media.height ?? null,
          id: `${reel.reelId}-video`,
          kind: reel.media.cloudflareVideoUid ? "cloudflare-video" : "video",
          ownerLabel: reel.vendor.shopName,
          posterUrl: thumbnailUrl,
          sourceLabel: "Vendor reel playback",
          src: playbackUrl,
          title: `${reel.publicReelId} video`,
          width: reel.media.width ?? null,
        }
      : null;
  const relatedItems = [thumbnailItem, videoItem].filter(
    (item): item is MediaViewerItem => Boolean(item),
  );

  if (!relatedItems.length) return [];

  return [
    {
      cloudflareVideoUid: videoItem?.cloudflareVideoUid ?? null,
      description: reel.media.durationSeconds
        ? `${reel.media.durationSeconds} seconds`
        : humanizeCode(reel.media.uploadStatus),
      downloadUrl: videoItem?.downloadUrl ?? thumbnailItem?.downloadUrl ?? null,
      height: reel.media.height ?? null,
      id: `${reel.reelId}-media`,
      kind: "reel",
      ownerLabel: reel.vendor.shopName,
      posterUrl: thumbnailUrl,
      relatedItems,
      sourceLabel: "Vendor reel media",
      src: videoItem?.src ?? thumbnailItem?.src ?? null,
      title: `${reel.publicReelId} media`,
      width: reel.media.width ?? null,
    },
  ];
}

function VendorBrandLogoMark({
  onOpen,
  vendor,
}: {
  onOpen?: () => void;
  vendor: VendorDetail;
}) {
  const logoUrl = vendor.brandLogo?.url ?? vendor.brandLogo?.downloadUrl ?? null;
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const visibleLogoUrl = logoUrl && failedLogoUrl !== logoUrl ? logoUrl : null;
  const markClassName = cn(
    "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border bg-surface text-base font-semibold",
    getVendorLogoToneClasses(vendor),
    onOpen && visibleLogoUrl
      ? "transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      : null,
  );
  const content = visibleLogoUrl ? (
    <img
      alt={`${vendor.shopName} logo`}
      className="size-full object-contain p-1.5"
      loading="lazy"
      src={visibleLogoUrl}
      onError={() => setFailedLogoUrl(visibleLogoUrl)}
    />
  ) : (
    <span>{getVendorInitials(vendor.shopName)}</span>
  );

  if (onOpen && visibleLogoUrl) {
    return (
      <button
        aria-label={`View ${vendor.shopName} logo`}
        className={markClassName}
        type="button"
        onClick={onOpen}
      >
        {content}
      </button>
    );
  }

  return <div className={markClassName}>{content}</div>;
}

interface VendorBrandLogoModalProps {
  action: VendorBrandLogoAction | null;
  error?: string | null;
  isSubmitting: boolean;
  vendor: VendorDetail;
  onClose: () => void;
  onSubmit: (values: VendorBrandLogoMutationInput) => void;
}

function VendorBrandLogoModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  vendor,
}: VendorBrandLogoModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (!action) {
    return null;
  }

  const isChange = action === "change";
  const title = isChange ? "Change vendor logo" : "Remove vendor logo";
  const description = isChange
    ? "Upload the logo shown across the admin vendor records."
    : "Remove the current vendor logo and return admin views to initials.";
  const visibleError = formError ?? error;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setFormError("Reason is required.");
      return;
    }

    if (isChange) {
      if (!file) {
        setFormError("Logo file is required.");
        return;
      }

      if (!isVendorBrandLogoMimeType(file.type)) {
        setFormError("Logo must be JPEG, PNG, or WebP.");
        return;
      }

      if (file.size > vendorBrandLogoMaxSizeBytes) {
        setFormError("Logo file must be 2 MB or smaller.");
        return;
      }

      onSubmit({ action, file, reason: trimmedReason });
      return;
    }

    onSubmit({ action, reason: trimmedReason });
  };

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {title}
            </h2>
            <p className="text-sm leading-6 text-muted">{description}</p>
          </div>
          <button
            aria-label="Close logo modal"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-border bg-surface-muted/50 p-3">
          <VendorBrandLogoMark vendor={vendor} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {vendor.shopName}
            </p>
            <p className="mt-1 truncate text-sm text-muted">
              {vendor.publicVendorId}
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {isChange ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Logo file <span className="text-danger">*</span>
              </span>
              <input
                accept={vendorBrandLogoAccept}
                className="form-input cursor-pointer file:mr-3 file:rounded-control file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-secondary-foreground"
                disabled={isSubmitting}
                type="file"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setFormError(null);
                }}
              />
              <span className="block text-xs text-muted">
                JPEG, PNG, or WebP up to 2 MB.
              </span>
              {file ? (
                <span className="block truncate text-xs text-foreground">
                  {file.name} · {formatFileSize(file.size)}
                </span>
              ) : null}
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Reason <span className="text-danger">*</span>
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              disabled={isSubmitting}
              onChange={(event) => {
                setReason(event.target.value);
                setFormError(null);
              }}
              placeholder="Enter reason"
              value={reason}
            />
          </label>

          {visibleError ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {visibleError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
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
              variant={isChange ? "primary" : "danger"}
            >
              {isChange ? "Change logo" : "Remove logo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VendorHeaderStatus({ vendor }: { vendor: VendorDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
        {vendor.vendorStatus}
      </Badge>
      <Badge tone={getOnboardingStatusTone(vendor.onboardingStatus)}>
        {vendor.onboardingStatus}
      </Badge>
    </div>
  );
}

function getApprovalBlockMessage(vendor: VendorDetail) {
  const summary = vendor.documentSummary;

  if (!summary || summary.total === 0) {
    return "Approval is blocked until the vendor uploads the required documents.";
  }

  const unverifiedBySummary = Math.max(summary.total - summary.verified, 0);
  const unverifiedDocuments = vendor.documents.filter(
    (document) => document.status !== "VERIFIED",
  );
  const unverifiedCount = Math.max(
    unverifiedBySummary,
    unverifiedDocuments.length,
  );

  if (unverifiedCount === 0) {
    return null;
  }

  const documentLabel = unverifiedCount === 1 ? "document is" : "documents are";

  return `Approval is blocked until ${unverifiedCount} ${documentLabel} verified. Verify the documents or request corrections before approving this vendor.`;
}

function scrollToVendorDetailSection(section: VendorDetailSectionKey) {
  const sectionElement = document.getElementById(vendorDetailSectionIds[section]);

  if (!sectionElement) return;

  sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });

  if (sectionElement instanceof HTMLElement) {
    sectionElement.focus({ preventScroll: true });
  }
}

function VendorReviewJumpPanel({
  message,
  targets,
  vendor,
}: {
  message: string | null;
  targets: VendorReviewJumpTarget[];
  vendor: VendorDetail;
}) {
  const hasReviewWork = Boolean(message) || targets.length > 0;
  const title = message
    ? "Approval blocked"
    : hasReviewWork
      ? "Review needed"
      : vendor.vendorStatus === "ACTIVE" && vendor.onboardingStatus === "APPROVED"
        ? "Vendor ready"
        : "Review vendor";
  const summaryTone: VendorTone = message
    ? "warning"
    : vendor.vendorStatus === "SUSPENDED"
      ? "danger"
      : hasReviewWork
        ? "warning"
        : "success";

  return (
    <section
      className={cn(
        "rounded-[0.875rem] border bg-surface p-3",
        summaryTone === "warning" && "border-warning/20 bg-warning/10",
        summaryTone === "danger" && "border-danger/20 bg-danger/10",
      )}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,auto)] xl:items-center">
        <div className="flex min-w-0 items-start gap-2">
          <FileWarning
            className={cn(
              "mt-0.5 size-4 shrink-0",
              summaryTone === "danger"
                ? "text-danger"
                : summaryTone === "success"
                  ? "text-success"
                  : "text-warning",
            )}
          />
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-semibold",
                summaryTone === "danger"
                  ? "text-danger"
                  : summaryTone === "success"
                    ? "text-success"
                    : "text-warning",
              )}
            >
              {title}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {message ??
                (hasReviewWork
                  ? "This vendor has items waiting for admin review."
                  : "Documents, payout account, and onboarding state are clear at list level.")}
            </p>
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <DetailField
            label="Documents"
            value={
              vendor.documentSummary
                ? `${vendor.documentSummary.verified}/${vendor.documentSummary.total}`
                : "0/0"
            }
          />
          <DetailField
            label="Payout"
            value={vendor.bankAccountSummary.payoutReady ? "Ready" : "Review"}
          />
          <DetailField label="Onboarding" value={vendor.onboardingStatus} />
          <DetailField label="Timeline" value={vendor.reviewTimeline.length} />
        </div>
      </div>

      {targets.length ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-warning/20 pt-3">
          {targets.map((target) => (
            <Button
              aria-controls={vendorDetailSectionIds[target.section]}
              className="border border-warning/25 bg-surface text-warning hover:bg-warning/10"
              key={target.section}
              size="sm"
              title={target.description}
              type="button"
              variant="secondary"
              onClick={() => scrollToVendorDetailSection(target.section)}
            >
              {target.icon}
              {target.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function VendorDetailSectionNav({
  bankAccountCount,
  canReadOrders,
  canReadPayouts,
  canReadReels,
  documentCount,
  orderCount,
  payoutCount,
  reelCount,
  serviceCount,
  timelineCount,
}: {
  bankAccountCount: number;
  canReadOrders: boolean;
  canReadPayouts: boolean;
  canReadReels: boolean;
  documentCount: number;
  orderCount: number;
  payoutCount: number;
  reelCount: number;
  serviceCount: number;
  timelineCount: number;
}) {
  const items = [
    { href: `#${vendorDetailSectionIds.overview}`, label: "Overview" },
    {
      count: documentCount,
      href: `#${vendorDetailSectionIds.documents}`,
      label: "Documents",
    },
    {
      count: bankAccountCount,
      href: `#${vendorDetailSectionIds.payoutAccount}`,
      label: "Payout Account",
    },
    {
      count: timelineCount,
      href: `#${vendorDetailSectionIds.activity}`,
      label: "Activity",
    },
    canReadPayouts
      ? {
          count: payoutCount,
          href: `#${vendorDetailSectionIds.payouts}`,
          label: "Payouts",
        }
      : null,
    canReadOrders
      ? {
          count: orderCount,
          href: `#${vendorDetailSectionIds.orders}`,
          label: "Orders",
        }
      : null,
    {
      count: serviceCount,
      href: `#${vendorDetailSectionIds.services}`,
      label: "Services",
    },
    canReadReels
      ? {
          count: reelCount,
          href: `#${vendorDetailSectionIds.reels}`,
          label: "Reels",
        }
      : null,
    { href: `#${vendorDetailSectionIds.profile}`, label: "Profile" },
  ].filter(Boolean) as {
    count?: number;
    href: string;
    label: string;
  }[];
  const [activeHref, setActiveHref] = useState(
    `#${vendorDetailSectionIds.overview}`,
  );

  return (
    <nav
      aria-label="Vendor detail sections"
      className="sticky top-[3.4rem] z-40 -mx-3 overflow-x-auto border-b border-border bg-surface/95 px-3 backdrop-blur sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
    >
      <div className="flex min-w-max items-center gap-5">
        {items.map((item) => (
          <a
            aria-current={activeHref === item.href ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-sm font-semibold transition",
              activeHref === item.href
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground",
            )}
            href={item.href}
            key={item.href}
            onClick={() => setActiveHref(item.href)}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  activeHref === item.href
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-muted text-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </a>
        ))}
      </div>
    </nav>
  );
}

function getBankSummaryMessage(vendor: VendorDetail) {
  const summary = vendor.bankAccountSummary;

  if (!summary.hasPrimary) {
    return "No primary payout bank account has been submitted by this vendor.";
  }

  if (summary.payoutReady) {
    return `Primary payout account is verified: ${summary.primaryBankName ?? "Bank"} ${summary.primaryAccountNumberMasked ?? ""}`.trim();
  }

  if (summary.primaryStatus === "REJECTED") {
    return "Primary payout account was rejected. The vendor needs to submit corrected details.";
  }

  return "Primary payout account is waiting for admin verification.";
}

function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];

  return typeof value === "string" ? value : null;
}

function getDocumentHistoryActionLabel(actionCode: string) {
  switch (actionCode) {
    case "reject_document":
      return "Admin requested resubmission";
    case "document_upload_confirm":
      return "Vendor resubmitted document";
    case "verify_document":
      return "Admin verified document";
    case "request_documents":
      return "Admin requested documents";
    default:
      return actionCode;
  }
}

function getDocumentHistoryRows(
  vendor: VendorDetail,
  document: VendorDocument | null,
): VendorDocumentHistoryRow[] {
  if (!document) {
    return [];
  }

  return vendor.reviewTimeline
    .filter((event) => {
      const documentId = getMetadataString(event.metadata, "documentId");
      const documentType = getMetadataString(event.metadata, "documentType");
      const requestedDocumentTypes = event.metadata?.requestedDocumentTypes;

      if (documentId) {
        return documentId === document.documentId;
      }

      if (documentType) {
        return documentType === document.documentType;
      }

      return Array.isArray(requestedDocumentTypes)
        ? requestedDocumentTypes.includes(document.documentType)
        : false;
    })
    .map((event) => ({
      reviewEventId: event.reviewEventId,
      action: getDocumentHistoryActionLabel(event.actionCode),
      fromStatus: getMetadataString(event.metadata, "fromDocumentStatus"),
      toStatus: getMetadataString(event.metadata, "toDocumentStatus"),
      reason: event.reason,
      createdAt: event.createdAt,
    }));
}

function VendorHeaderActions({
  canApproveVendors,
  canUpdateProfile,
  isSubmitting,
  onEditProfile,
  onSelectAction,
  vendor,
}: {
  canApproveVendors: boolean;
  canUpdateProfile: boolean;
  isSubmitting: boolean;
  onEditProfile: () => void;
  onSelectAction: (kind: VendorActionKind) => void;
  vendor: VendorDetail;
}) {
  const visibleActions = getVisibleVendorDetailActions(
    getVendorDetailActionSource(vendor),
    {
      canApproveVendors,
      canUpdateProfile,
    },
  );
  const hasAction = (action: string) => visibleActions.includes(action);
  const approvalBlockMessage = getApprovalBlockMessage(vendor);
  const rawRecommendedAction = getRecommendedVendorHeaderAction(
    vendor,
    visibleActions,
  );
  const recommendedAction =
    rawRecommendedAction === "APPROVE" && approvalBlockMessage
      ? null
      : rawRecommendedAction;
  const secondaryActionCandidates: {
    icon: ReactNode;
    isDisabled?: boolean;
    kind: VendorHeaderActionKind;
    label: string;
    title?: string;
    variant?: "primary" | "secondary" | "danger" | "ghost";
  }[] = [
    {
      icon: <CheckCircle2 className="mr-1.5 size-3.5" />,
      isDisabled: Boolean(approvalBlockMessage),
      kind: "APPROVE",
      label: "Approve",
      title: approvalBlockMessage ?? undefined,
    },
    {
      icon: <XCircle className="mr-1.5 size-3.5" />,
      kind: "REJECT",
      label: "Reject",
      variant: "danger",
    },
    {
      icon: <PauseCircle className="mr-1.5 size-3.5" />,
      kind: "SUSPEND",
      label: "Suspend",
      variant: "secondary",
    },
    {
      icon: <RotateCcw className="mr-1.5 size-3.5" />,
      kind: "REACTIVATE",
      label: "Reactivate",
      variant: "secondary",
    },
  ];
  const secondaryActions = secondaryActionCandidates.filter(
    (action) => hasAction(action.kind) && action.kind !== recommendedAction,
  );

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {recommendedAction ? (
        <Button
          className="h-8 min-h-8 whitespace-nowrap px-2.5"
          disabled={
            isSubmitting ||
            (recommendedAction === "APPROVE" && Boolean(approvalBlockMessage))
          }
          size="sm"
          title={
            recommendedAction === "APPROVE"
              ? approvalBlockMessage ?? undefined
              : undefined
          }
          variant={
            recommendedAction === "REJECT" || recommendedAction === "SUSPEND"
              ? "danger"
              : "primary"
          }
          onClick={() => onSelectAction(recommendedAction)}
        >
          {recommendedAction === "ADD_NOTE" ? (
            <MessageSquarePlus className="mr-1.5 size-3.5" />
          ) : (
            <ArrowUpRight className="mr-1.5 size-3.5" />
          )}
          {humanizeCode(recommendedAction)}
        </Button>
      ) : null}
      {canUpdateProfile && hasAction("EDIT_PROFILE") ? (
        <Button
          className="h-8 min-h-8 whitespace-nowrap px-2.5"
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={onEditProfile}
        >
          <Pencil className="mr-1.5 size-3.5" />
          Edit Profile
        </Button>
      ) : null}
      {secondaryActions.map((action) => (
        <Button
          className="h-8 min-h-8 whitespace-nowrap px-2.5"
          disabled={isSubmitting || action.isDisabled}
          key={action.kind}
          size="sm"
          title={action.title}
          variant={action.variant ?? "secondary"}
          onClick={() => onSelectAction(action.kind)}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
      {recommendedAction !== "ADD_NOTE" ? (
        <Button
          className="h-8 min-h-8 whitespace-nowrap px-2.5"
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction("ADD_NOTE")}
        >
          <MessageSquarePlus className="mr-1.5 size-3.5" />
          Add Note
        </Button>
      ) : null}
    </div>
  );
}

interface VendorDetailPageProps {
  listHref?: string;
  listLabel?: string;
}

export function VendorDetailPage({
  listHref = routePaths.vendors,
  listLabel = "Vendors",
}: VendorDetailPageProps = {}) {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openMediaViewer } = useMediaViewer();
  const canApproveVendors = useAuthStore((state) =>
    state.can("vendors:approve"),
  );
  const canUpdateVendors = useAuthStore((state) => state.can("vendors:update"));
  const canReadOrders = useAuthStore((state) => state.can("orders:read"));
  const canUpdateOrders = useAuthStore((state) =>
    state.can("orders:update_status"),
  );
  const canRefundPayments = useAuthStore((state) =>
    state.can("payments:refund"),
  );
  const canReadPayouts = useAuthStore((state) => state.can("payouts:read"));
  const canApprovePayouts = useAuthStore((state) =>
    state.can("payouts:approve"),
  );
  const canReadReels = useAuthStore((state) => state.can("reels:read"));
  const canModerateReels = useAuthStore((state) => state.can("reels:moderate"));
  const canDeleteReels = useAuthStore((state) => state.can("reels:delete"));
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProfileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedLogoAction, setSelectedLogoAction] =
    useState<VendorBrandLogoAction | null>(null);
  const [brandLogoError, setBrandLogoError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] =
    useState<VendorActionSelection | null>(null);
  const [selectedReelAction, setSelectedReelAction] =
    useState<ReelActionSelection | null>(null);
  const [reelError, setReelError] = useState<string | null>(null);
  const [selectedServiceAction, setSelectedServiceAction] =
    useState<VendorServiceActionSelection | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [selectedOrderAction, setSelectedOrderAction] =
    useState<VendorOrderActionTarget | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [selectedPayoutAction, setSelectedPayoutAction] =
    useState<PayoutActionSelection | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [selectedHistoryDocument, setSelectedHistoryDocument] =
    useState<VendorDocument | null>(null);
  const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(
    null,
  );

  const vendorOverviewQuery = useQuery({
    enabled: Boolean(vendorId),
    queryKey: ["vendor-overview", vendorId],
    queryFn: () => vendorService.getVendorOverview(vendorId as string),
    staleTime: 30_000,
  });

  const vendorQuery = vendorOverviewQuery;
  const vendorOverview = vendorOverviewQuery.data?.data;
  const vendor = vendorOverview?.vendor;
  const vendorServices = vendorOverview?.sections.services ?? undefined;
  const vendorOrders = vendorOverview?.sections.orders ?? undefined;
  const vendorPayouts = vendorOverview?.sections.payouts ?? undefined;
  const vendorReels = vendorOverview?.sections.reels ?? undefined;
  const overviewSectionQueryState = {
    isError: vendorOverviewQuery.isError,
    isLoading: vendorOverviewQuery.isLoading,
    isFetching: vendorOverviewQuery.isFetching,
    refetch: vendorOverviewQuery.refetch,
  };
  const servicesQuery = overviewSectionQueryState;
  const ordersQuery = overviewSectionQueryState;
  const payoutsQuery = overviewSectionQueryState;
  const reelsQuery = overviewSectionQueryState;

  const refreshVendor = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendor-overview", vendorId] }),
      queryClient.invalidateQueries({ queryKey: ["vendor-detail", vendorId] }),
      queryClient.invalidateQueries({
        queryKey: ["vendor-services", vendorId],
      }),
      queryClient.invalidateQueries({ queryKey: ["vendor-orders", vendorId] }),
      queryClient.invalidateQueries({ queryKey: ["vendor-payouts", vendorId] }),
      queryClient.invalidateQueries({ queryKey: ["vendor-reels", vendorId] }),
      queryClient.invalidateQueries({ queryKey: ["payouts"] }),
      queryClient.invalidateQueries({ queryKey: ["vendors"] }),
      queryClient.invalidateQueries({ queryKey: ["vendor-onboarding"] }),
    ]);
  };

  const profileMutation = useMutation({
    mutationFn: async (payload: VendorProfileUpdatePayload) => {
      if (!vendor) {
        throw new Error("Vendor details are unavailable.");
      }

      return vendorService.updateVendorProfile(vendor.vendorId, payload);
    },
    onMutate: () => setProfileError(null),
    onSuccess: () => {
      setProfileEditorOpen(false);
      void refreshVendor();
    },
    onError: (error) => {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Vendor profile update failed.",
      );
    },
  });

  const brandLogoMutation = useMutation({
    mutationFn: async (input: VendorBrandLogoMutationInput) => {
      if (!vendor) {
        throw new Error("Vendor details are unavailable.");
      }

      if (input.action === "remove") {
        return vendorService.removeVendorBrandLogo(vendor.vendorId, {
          reason: input.reason,
        });
      }

      if (!input.file) {
        throw new Error("Logo file is required.");
      }

      if (!isVendorBrandLogoMimeType(input.file.type)) {
        throw new Error("Logo must be JPEG, PNG, or WebP.");
      }

      const uploadIntentResponse =
        await vendorService.createVendorBrandLogoUploadIntent(vendor.vendorId, {
          fileName: input.file.name,
          mimeType: input.file.type,
          sizeBytes: input.file.size,
        });
      const uploadIntent = uploadIntentResponse.data;

      if (!uploadIntent.uploadUrl) {
        throw new Error("Logo upload URL is unavailable.");
      }

      const uploadHeaders = new Headers(uploadIntent.headers);

      if (!uploadHeaders.has("Content-Type")) {
        uploadHeaders.set("Content-Type", input.file.type);
      }

      const uploadResponse = await fetch(uploadIntent.uploadUrl, {
        method: "PUT",
        headers: uploadHeaders,
        body: input.file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Logo upload failed. Please try again.");
      }

      return vendorService.confirmVendorBrandLogoUpload(vendor.vendorId, {
        mediaAssetId: uploadIntent.mediaAssetId,
        uploadedAt: new Date().toISOString(),
        reason: input.reason,
      });
    },
    onMutate: () => setBrandLogoError(null),
    onSuccess: async () => {
      setSelectedLogoAction(null);
      await refreshVendor();
    },
    onError: (error) => {
      setBrandLogoError(
        error instanceof Error ? error.message : "Vendor logo update failed.",
      );
    },
  });

  const documentPreviewMutation = useMutation({
    mutationFn: async (document: VendorDocument) => {
      if (!vendor) {
        throw new Error("Vendor details are unavailable.");
      }

      if (!document.mediaAssetId) {
        throw new Error("Document media is not linked.");
      }

      const response = await vendorService.getVendorDocumentDownloadTarget(
        vendor.vendorId,
        document.documentId,
      );

      return {
        document: {
          ...document,
          download: response.data.download,
          fileName: response.data.fileName ?? document.fileName,
          mediaStatus: response.data.mediaStatus ?? document.mediaStatus,
          mimeType: response.data.mimeType ?? document.mimeType,
          sizeBytes: response.data.sizeBytes ?? document.sizeBytes,
        },
      };
    },
    onMutate: () => setDocumentPreviewError(null),
    onSuccess: ({ document }) => {
      if (!vendor) {
        return;
      }

      const documentMediaItem = buildVendorDocumentMediaItem(vendor, document);

      if (documentMediaItem) {
        openMediaViewer({ items: [documentMediaItem] });
        return;
      }

      setDocumentPreviewError("Signed document preview is unavailable for this file.");
    },
    onError: (error) => {
      setDocumentPreviewError(
        error instanceof Error
          ? error.message
          : "We could not load this document preview.",
      );
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: VendorActionSelection;
      values: VendorActionFormValues;
    }) => {
      if (!vendor) {
        throw new Error("Vendor details are unavailable.");
      }

      if (action.kind === "APPROVE") {
        const approvalBlockMessage = getApprovalBlockMessage(vendor);

        if (approvalBlockMessage) {
          throw new Error(approvalBlockMessage);
        }

        return vendorService.approveVendor(vendor.vendorId, {
          reason: values.reason,
        });
      }

      if (action.kind === "REJECT") {
        if (!values.reason) {
          throw new Error("Rejection reason is required.");
        }

        return vendorService.rejectVendor(vendor.vendorId, {
          reason: values.reason,
        });
      }

      if (action.kind === "REQUEST_DOCUMENTS") {
        if (!values.reason) {
          throw new Error("Document request reason is required.");
        }

        return vendorService.requestVendorDocuments(vendor.vendorId, {
          reason: values.reason,
          requestedDocumentTypes: values.requestedDocumentTypes,
        });
      }

      if (action.kind === "SUSPEND") {
        if (!values.reason) {
          throw new Error("Suspension reason is required.");
        }

        return vendorService.suspendVendor(vendor.vendorId, {
          reason: values.reason,
        });
      }

      if (action.kind === "REACTIVATE") {
        if (!values.reason) {
          throw new Error("Reactivation reason is required.");
        }

        return vendorService.reactivateVendor(vendor.vendorId, {
          reason: values.reason,
        });
      }

      if (action.kind === "ADD_NOTE") {
        if (!values.note) {
          throw new Error("Internal note is required.");
        }

        return vendorService.addVendorNote(vendor.vendorId, {
          note: values.note,
        });
      }

      if (action.kind === "REJECT_DOCUMENT") {
        if (!action.document) {
          throw new Error("Document details are unavailable.");
        }

        if (!values.reason) {
          throw new Error("Resubmission reason is required.");
        }

        return vendorService.rejectVendorDocument(
          vendor.vendorId,
          action.document.documentId,
          { reason: values.reason },
        );
      }

      if (action.kind === "VERIFY_BANK_ACCOUNT") {
        if (!action.bankAccount) {
          throw new Error("Bank account details are unavailable.");
        }

        return vendorService.verifyVendorBankAccount(
          vendor.vendorId,
          action.bankAccount.bankAccountId,
          { reason: values.reason },
        );
      }

      if (action.kind === "REJECT_BANK_ACCOUNT") {
        if (!action.bankAccount) {
          throw new Error("Bank account details are unavailable.");
        }

        if (!values.reason) {
          throw new Error("Bank account rejection reason is required.");
        }

        return vendorService.rejectVendorBankAccount(
          vendor.vendorId,
          action.bankAccount.bankAccountId,
          { reason: values.reason },
        );
      }

      if (!action.document) {
        throw new Error("Document details are unavailable.");
      }

      return vendorService.verifyVendorDocument(
        vendor.vendorId,
        action.document.documentId,
        { reason: values.reason },
      );
    },
    onMutate: () => setActionError(null),
    onSuccess: (response) => {
      setSelectedAction(null);
      queryClient.setQueryData<VendorOverviewResponse>(
        ["vendor-overview", vendorId],
        (current) =>
          patchVendorOverviewWithActionResult(current, response.data),
      );
      void queryClient.invalidateQueries({
        queryKey: ["vendors"],
        refetchType: "none",
      });
      void queryClient.invalidateQueries({
        queryKey: ["vendor-onboarding"],
        refetchType: "none",
      });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["vendor-overview", vendorId],
        });
      }, 1500);
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Vendor action failed.",
      );
    },
  });

  const serviceMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: VendorServiceActionSelection;
      values: VendorServiceActionFormValues;
    }) => {
      if (!vendor) {
        throw new Error("Vendor details are unavailable.");
      }

      if (action.kind === "CREATE") {
        if (!values.service) {
          throw new Error("Service details are required.");
        }

        return vendorService.createVendorService(
          vendor.vendorId,
          values.service,
        );
      }

      if (!action.service) {
        throw new Error("Service details are unavailable.");
      }

      if (action.kind === "EDIT") {
        if (!values.service) {
          throw new Error("Service details are required.");
        }

        return vendorService.updateVendorService(
          vendor.vendorId,
          action.service.vendorServiceId,
          values.service,
        );
      }

      if (action.kind === "DISABLE") {
        if (!values.reason) {
          throw new Error("Disable reason is required.");
        }

        return vendorService.disableVendorService(
          vendor.vendorId,
          action.service.vendorServiceId,
          values.reason,
        );
      }

      if (!values.catalog) {
        throw new Error("Catalog details are required.");
      }

      return vendorService.replaceVendorServiceCatalog(
        vendor.vendorId,
        action.service.vendorServiceId,
        values.catalog,
      );
    },
    onMutate: () => setServiceError(null),
    onSuccess: () => {
      setSelectedServiceAction(null);
      void refreshVendor();
    },
    onError: (error) => {
      setServiceError(
        error instanceof Error
          ? error.message
          : "Vendor service action failed.",
      );
    },
  });

  const orderMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: VendorOrderActionTarget;
      values: OrderActionFormValues;
    }) => {
      const { action, order } = target;

      if (action.kind === "UPDATE_STATUS") {
        if (!action.targetStatus) {
          throw new Error("Target status is required.");
        }

        return orderService.updateOrderStatus(order.orderId, {
          targetStatus: action.targetStatus,
          eventTime: values.eventTime,
          internalNote: values.internalNote,
          proofMediaAssetId: values.proofMediaAssetId,
          packageCondition: values.packageCondition,
          issueType: values.issueType,
          notifyCustomer: values.notifyCustomer,
          notifyVendor: values.notifyVendor,
        });
      }

      if (action.kind === "CANCEL") {
        if (!values.reason) {
          throw new Error("Cancellation reason is required.");
        }

        return orderService.cancelOrder(order.orderId, {
          reason: values.reason,
          notifyCustomer: values.notifyCustomer,
          notifyVendor: values.notifyVendor,
        });
      }

      if (action.kind === "INITIATE_REFUND") {
        if (!values.reason) {
          throw new Error("Refund reason is required.");
        }

        return orderService.initiateOrderRefund(order.orderId, {
          paymentId: values.paymentId,
          amountPaise: values.amountPaise,
          reason: values.reason,
        });
      }

      if (action.kind === "GENERATE_DELIVERY_OTP") {
        return orderService.generateDeliveryOtp(order.orderId, {
          expiresInMinutes: values.expiresInMinutes,
          notifyCustomer: values.notifyCustomer,
          reason: values.reason,
        });
      }

      if (action.kind === "CONFIRM_DELIVERY_OTP") {
        if (!values.otpCode) {
          throw new Error("Delivery OTP is required.");
        }

        return orderService.confirmDeliveryOtp(order.orderId, {
          otpCode: values.otpCode,
          eventTime: values.eventTime,
          internalNote: values.internalNote,
          proofMediaAssetId: values.proofMediaAssetId,
          packageCondition: values.packageCondition,
        });
      }

      if (action.kind === "ADD_NOTE") {
        if (!values.note) {
          throw new Error("Note is required.");
        }

        return orderService.addOrderNote(order.orderId, {
          note: values.note,
          isPinned: values.isPinned,
        });
      }

      throw new Error("Unsupported order action from vendor detail.");
    },
    onMutate: () => setOrderError(null),
    onSuccess: (_response, variables) => {
      setSelectedOrderAction(null);
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["vendor-overview", vendorId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["vendor-orders", vendorId],
        }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["order-detail", variables.target.order.orderId],
        }),
      ]);
    },
    onError: (error) => {
      setOrderError(
        error instanceof Error ? error.message : "Order action failed.",
      );
    },
  });

  const payoutMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PayoutActionSelection;
      values: PayoutActionFormValues;
    }) => {
      if (!action.payout) {
        throw new Error("Payout details are unavailable.");
      }

      if (!values.reason) {
        throw new Error("Reason is required for payout actions.");
      }

      if (action.kind === "APPROVE") {
        return payoutService.approvePayout(action.payout.payoutId, {
          reason: values.reason,
          processImmediately: values.processImmediately,
        });
      }

      if (action.kind === "HOLD") {
        return payoutService.holdPayout(action.payout.payoutId, {
          reason: values.reason,
        });
      }

      if (action.kind === "RELEASE_HOLD") {
        return payoutService.releasePayoutHold(action.payout.payoutId, {
          reason: values.reason,
        });
      }

      if (action.kind === "MARK_PAID") {
        if (!values.utrReference) {
          throw new Error("UTR reference is required.");
        }

        return payoutService.markPayoutPaid(action.payout.payoutId, {
          utrReference: values.utrReference,
          paidAt: values.paidAt,
          reason: values.reason,
        });
      }

      if (action.kind === "MARK_FAILED") {
        return payoutService.markPayoutFailed(action.payout.payoutId, {
          reason: values.reason,
        });
      }

      throw new Error("Unsupported payout action from vendor detail.");
    },
    onMutate: () => setPayoutError(null),
    onSuccess: (_response, variables) => {
      setSelectedPayoutAction(null);
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["vendor-overview", vendorId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["vendor-payouts", vendorId],
        }),
        queryClient.invalidateQueries({ queryKey: ["payouts"] }),
        queryClient.invalidateQueries({
          queryKey: [
            "payout-detail",
            variables.action.payout?.payoutId,
          ],
        }),
      ]);
    },
    onError: (error) => {
      setPayoutError(
        error instanceof Error ? error.message : "Payout action failed.",
      );
    },
  });

  const reelMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: ReelActionSelection;
      values: ReelActionFormValues;
    }) => {
      if (action.kind === "APPROVE") {
        return reelService.approveReel(action.reel.reelId, {
          reason: values.reason,
        });
      }

      if (!values.reason) {
        throw new Error("Reason is required for this reel action.");
      }

      if (action.kind === "REJECT") {
        return reelService.rejectReel(action.reel.reelId, {
          reason: values.reason,
        });
      }

      if (action.kind === "REQUEST_EDIT") {
        return reelService.requestReelEdit(action.reel.reelId, {
          reason: values.reason,
        });
      }

      if (action.kind === "PAUSE") {
        return reelService.pauseReel(action.reel.reelId, {
          reason: values.reason,
        });
      }

      if (action.kind === "SOFT_DELETE" || action.kind === "HARD_DELETE") {
        return reelService.deleteReel(action.reel.reelId, {
          hardDelete: action.kind === "HARD_DELETE",
          reason: values.reason,
        });
      }

      return reelService.removeReel(action.reel.reelId, {
        reason: values.reason,
      });
    },
    onMutate: () => setReelError(null),
    onSuccess: (_response, variables) => {
      setSelectedReelAction(null);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vendor-overview", vendorId] }),
        queryClient.invalidateQueries({ queryKey: ["vendor-reels", vendorId] }),
        queryClient.invalidateQueries({ queryKey: ["reels"] }),
        queryClient.invalidateQueries({
          queryKey: ["reel-detail", variables.action.reel.reelId],
        }),
      ]);
    },
    onError: (error) => {
      setReelError(
        error instanceof Error ? error.message : "Reel action failed.",
      );
    },
  });

  const openAction = (
    kind: VendorActionKind,
    document?: VendorDocument,
    bankAccount?: VendorBankAccount,
  ) => {
    setActionError(null);
    setSelectedAction({ kind, document, bankAccount });
  };

  const openServiceAction = (
    kind: VendorServiceActionKind,
    service?: VendorServiceRecord,
  ) => {
    setServiceError(null);
    setSelectedServiceAction({ kind, service });
  };

  const openOrderAction = (
    order: AdminOrderSummary,
    action: OrderActionSelection,
  ) => {
    setOrderError(null);
    setSelectedOrderAction({ order, action });
  };

  const openPayoutAction = (
    kind: PayoutActionKind,
    payout: AdminPayoutSummary,
  ) => {
    setPayoutError(null);
    setSelectedPayoutAction({ kind, payout });
  };

  const openReelAction = (kind: ReelActionKind, reel: AdminReel) => {
    setReelError(null);
    setSelectedReelAction({ kind, reel });
  };

  const submitAction = (values: VendorActionFormValues) => {
    if (!selectedAction) {
      return;
    }

    void actionMutation.mutateAsync({
      action: selectedAction,
      values,
    });
  };

  const submitServiceAction = (values: VendorServiceActionFormValues) => {
    if (!selectedServiceAction) {
      return;
    }

    void serviceMutation.mutateAsync({
      action: selectedServiceAction,
      values,
    });
  };

  const submitOrderAction = (values: OrderActionFormValues) => {
    if (!selectedOrderAction) {
      return;
    }

    void orderMutation.mutateAsync({
      target: selectedOrderAction,
      values,
    });
  };

  const submitPayoutAction = (values: PayoutActionFormValues) => {
    if (!selectedPayoutAction) {
      return;
    }

    void payoutMutation.mutateAsync({
      action: selectedPayoutAction,
      values,
    });
  };

  const submitReelAction = (values: ReelActionFormValues) => {
    if (!selectedReelAction) {
      return;
    }

    void reelMutation.mutateAsync({
      action: selectedReelAction,
      values,
    });
  };

  if (!vendorId) {
    return (
      <PageContainer>
        <ErrorState
          description="The vendor route is missing a vendor id."
          title="Vendor not found"
        />
      </PageContainer>
    );
  }

  if (vendorQuery.isLoading) {
    return (
      <PageContainer>
        <DetailPageHeaderSkeleton />
        <Skeleton className="h-[28rem] w-full" />
      </PageContainer>
    );
  }

  if (vendorQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this vendor. Please retry."
          title="Vendor unavailable"
          onRetry={() => void vendorQuery.refetch()}
        />
      </PageContainer>
    );
  }

  if (!vendor) {
    return (
      <PageContainer>
        <EmptyState
          description="The vendor detail API returned no vendor data."
          title="Vendor not found"
        />
      </PageContainer>
    );
  }

  const vendorActionSource = getVendorDetailActionSource(vendor);
  const approvalBlockMessage =
    canApproveVendors && vendorActionSource.includes("APPROVE")
      ? getApprovalBlockMessage(vendor)
      : null;
  const activeHistoryDocument = selectedHistoryDocument
    ? (vendor.documents.find(
        (document) =>
          document.documentId === selectedHistoryDocument.documentId,
      ) ?? selectedHistoryDocument)
    : null;
  const selectedDocumentHistory = getDocumentHistoryRows(
    vendor,
    activeHistoryDocument,
  );
  const serviceRows = vendorServices?.services ?? [];
  const orderRows = canReadOrders ? (vendorOrders?.data ?? []) : [];
  const vendorLogisticsQuery = buildQueryParams({ vendorId });
  const vendorLogisticsPath = vendorLogisticsQuery
    ? `${routePaths.manualLogistics}?${vendorLogisticsQuery}`
    : routePaths.manualLogistics;
  const payoutRows = canReadPayouts ? (vendorPayouts?.data ?? []) : [];
  const reelRows = vendorReels?.data ?? [];
  const visibleVendorActions = getVisibleVendorDetailActions(
    vendorActionSource,
    {
      canApproveVendors,
      canUpdateProfile: canUpdateVendors,
    },
  );
  const documentsPendingReview = vendor.documents.filter(
    (document) =>
      vendor.onboardingStatus !== "APPROVED" && document.status !== "VERIFIED",
  );
  const bankAccountsPendingReview = vendor.bankAccounts.filter(
    (bankAccount) =>
      hasBankAccountAction(bankAccount, "VERIFY") ||
      hasBankAccountAction(bankAccount, "REJECT"),
  );
  const payoutRowsPendingReview = payoutRows.filter(
    (payout) =>
      hasPayoutAction(payout, "APPROVE") ||
      hasPayoutAction(payout, "HOLD") ||
      hasPayoutAction(payout, "RELEASE_HOLD") ||
      hasPayoutAction(payout, "MARK_PAID") ||
      hasPayoutAction(payout, "MARK_FAILED"),
  );
  const reelsPendingReview = reelRows.filter(
    (reel) => {
      const reelActions = reel.availableActions.map((action) =>
        action.toUpperCase(),
      );

      return (
        reelActions.includes("APPROVE") ||
        reelActions.includes("REJECT") ||
        reelActions.includes("REQUEST_EDIT")
      );
    },
  );
  const reviewJumpTargets: VendorReviewJumpTarget[] = [
    ...(canApproveVendors &&
    (approvalBlockMessage || documentsPendingReview.length)
      ? [
          {
            description: approvalBlockMessage
              ? "Vendor approval is blocked by pending or rejected documents."
              : `${documentsPendingReview.length} document ${documentsPendingReview.length === 1 ? "needs" : "need"} admin review.`,
            icon: <FileCheck2 className="mr-2 size-4" />,
            label: "Review documents",
            section: "documents" as const,
          },
        ]
      : []),
    ...(canApproveVendors && bankAccountsPendingReview.length
      ? [
          {
            description: `${bankAccountsPendingReview.length} payout account ${bankAccountsPendingReview.length === 1 ? "needs" : "need"} verification.`,
            icon: <Landmark className="mr-2 size-4" />,
            label: "Review payout account",
            section: "payoutAccount" as const,
          },
        ]
      : []),
    ...(canReadPayouts && canApprovePayouts && payoutRowsPendingReview.length
      ? [
          {
            description: `${payoutRowsPendingReview.length} payout ${payoutRowsPendingReview.length === 1 ? "needs" : "need"} admin action.`,
            icon: <CreditCard className="mr-2 size-4" />,
            label: "Review payouts",
            section: "payouts" as const,
          },
        ]
      : []),
    ...(canReadReels && canModerateReels && reelsPendingReview.length
      ? [
          {
            description: `${reelsPendingReview.length} reel ${reelsPendingReview.length === 1 ? "needs" : "need"} moderation.`,
            icon: <Film className="mr-2 size-4" />,
            label: "Review reels",
            section: "reels" as const,
          },
        ]
      : []),
  ];
  const hasVendorBrandLogo = Boolean(vendor.brandLogo);
  const vendorBrandLogoMediaItem = buildVendorBrandLogoMediaItem(vendor);
  const openVendorBrandLogo = () => {
    if (vendorBrandLogoMediaItem) {
      openMediaViewer({ items: [vendorBrandLogoMediaItem] });
    }
  };
  const openVendorDocument = (vendorDocument: VendorDocument) => {
    documentPreviewMutation.mutate(vendorDocument);
  };
  const openVendorReelMedia = (reel: AdminReel) => {
    const mediaItems = buildVendorReelMediaItems(reel);

    if (mediaItems.length) {
      openMediaViewer({ items: mediaItems });
    }
  };

  return (
    <PageContainer className="!px-3 !py-3 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <VendorHeaderActions
            canApproveVendors={canApproveVendors}
            canUpdateProfile={canUpdateVendors}
            isSubmitting={actionMutation.isPending || profileMutation.isPending}
            vendor={vendor}
            onEditProfile={() => {
              setProfileError(null);
              setProfileEditorOpen(true);
            }}
            onSelectAction={openAction}
          />
        }
        description={vendor.publicVendorId}
        listHref={listHref}
        listLabel={listLabel}
        recordName={vendor.shopName}
        titleMetaNode={<VendorHeaderStatus vendor={vendor} />}
      />

      <VendorDetailSectionNav
        bankAccountCount={vendor.bankAccounts.length}
        canReadOrders={canReadOrders}
        canReadPayouts={canReadPayouts}
        canReadReels={canReadReels}
        documentCount={vendor.documentSummary?.total ?? vendor.documents.length}
        orderCount={
          canReadOrders ? (vendorOrders?.summary?.total ?? orderRows.length) : 0
        }
        payoutCount={
          canReadPayouts
            ? (vendorPayouts?.summary?.total ?? payoutRows.length)
            : 0
        }
        reelCount={
          canReadReels ? (vendorReels?.summary?.total ?? reelRows.length) : 0
        }
        serviceCount={vendorServices?.summary.total ?? serviceRows.length}
        timelineCount={vendor.reviewTimeline.length}
      />

      <section
        className="scroll-mt-24 space-y-3 focus:outline-none"
        id={vendorDetailSectionIds.overview}
        tabIndex={-1}
      >
        <VendorReviewJumpPanel
          message={approvalBlockMessage}
          targets={reviewJumpTargets}
          vendor={vendor}
        />
      </section>

      <section
        className="scroll-mt-24 space-y-4 focus:outline-none"
        id={vendorDetailSectionIds.documents}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FileCheck2 className="size-4 text-muted" />
            <h2 className="text-base font-semibold text-foreground">
              Documents
            </h2>
          </div>
          <Badge
            tone={
              vendor.documents.some((document) =>
                ["PENDING", "REJECTED", "EXPIRED"].includes(document.status),
              )
                ? "warning"
                : "success"
            }
          >
            {vendor.documentSummary
              ? `${vendor.documentSummary.verified}/${vendor.documentSummary.total} verified`
              : "No uploads"}
          </Badge>
        </div>

        {documentPreviewError ? (
          <div className="rounded-surface border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
            {documentPreviewError}
          </div>
        ) : null}

        <DynamicTable
          actionColumnLabel="Document Actions"
          actionColumnMinWidth={410}
          bodyMaxHeight={360}
          columns={documentColumns}
          data={vendor.documents}
          description={
            vendor.onboardingStatus === "APPROVED"
              ? "Approved vendor documents are locked from onboarding resubmission."
              : "Verified documents can still be requested for resubmission before vendor approval."
          }
          emptyDescription="This vendor has no uploaded documents."
          emptyTitle="No documents"
          getRowId={(row) => row.documentId}
          inlineActionLimit={3}
          rowActions={(document) => [
            {
              icon: <Eye className="size-4" />,
              isDisabled:
                documentPreviewMutation.isPending || !document.mediaAssetId,
              key: "view",
              label: document.mediaAssetId ? "Preview" : "No preview",
              onClick: openVendorDocument,
              variant: "ghost",
            },
            {
              icon: <FileCheck2 className="size-4" />,
              isVisible:
                canApproveVendors &&
                vendor.onboardingStatus !== "APPROVED" &&
                document.status !== "VERIFIED",
              key: "verify",
              label: "Verify",
              onClick: () => openAction("VERIFY_DOCUMENT", document),
              variant: "secondary",
            },
            {
              icon: <FileWarning className="size-4" />,
              isVisible:
                canApproveVendors &&
                vendor.onboardingStatus !== "APPROVED" &&
                ["PENDING", "VERIFIED"].includes(document.status),
              key: "reject",
              label:
                document.status === "VERIFIED"
                  ? "Request resubmit again"
                  : "Request resubmit",
              onClick: () => openAction("REJECT_DOCUMENT", document),
              variant: "secondary",
            },
            {
              icon: <History className="size-4" />,
              key: "history",
              label: "History",
              onClick: () => setSelectedHistoryDocument(document),
              placement: "menu",
              variant: "ghost",
            },
          ]}
          title="Documents"
        />

        {activeHistoryDocument ? (
          <section className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    Document History
                  </h2>
                  <Badge
                    tone={
                      activeHistoryDocument.status === "VERIFIED"
                        ? "success"
                        : activeHistoryDocument.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {activeHistoryDocument.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted">
                  {activeHistoryDocument.documentType}
                </p>
              </div>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setSelectedHistoryDocument(null)}
              >
                Close
              </Button>
            </div>

            {activeHistoryDocument.rejectionReason ? (
              <div className="rounded-surface border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
                Current admin reason: {activeHistoryDocument.rejectionReason}
              </div>
            ) : null}

            <DynamicTable
              bodyMaxHeight={300}
              columns={documentHistoryColumns}
              data={selectedDocumentHistory}
              emptyDescription="No review or resubmission events have been recorded for this document yet."
              emptyTitle="No document history"
              getRowId={(row) => row.reviewEventId}
              title={`${activeHistoryDocument.documentType} history`}
            />
          </section>
        ) : null}
      </section>

      <section
        className="scroll-mt-24 space-y-4 rounded-[1rem] border border-border bg-surface p-4 focus:outline-none"
        id={vendorDetailSectionIds.payoutAccount}
        tabIndex={-1}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Landmark className="size-4 text-muted" />
              <h2 className="text-base font-semibold text-foreground">
                Payout Bank Account
              </h2>
              <Badge
                tone={
                  vendor.bankAccountSummary.payoutReady ? "success" : "warning"
                }
              >
                {vendor.bankAccountSummary.payoutReady
                  ? "Payout Ready"
                  : "Review Needed"}
              </Badge>
            </div>
            <p className="text-sm text-muted">
              {getBankSummaryMessage(vendor)}
            </p>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <DetailField
              label="Total"
              value={vendor.bankAccountSummary.total}
            />
            <DetailField
              label="Verified"
              value={vendor.bankAccountSummary.verified}
            />
            <DetailField
              label="Pending"
              value={vendor.bankAccountSummary.pending}
            />
          </div>
        </div>

        {vendor.bankAccountSummary.warnings.length ? (
          <div className="rounded-surface border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
            {vendor.bankAccountSummary.warnings.join(", ")}
          </div>
        ) : null}

        <DynamicTable
          actionColumnLabel="Bank Actions"
          actionColumnMinWidth={260}
          bodyMaxHeight={320}
          columns={bankAccountColumns}
          data={vendor.bankAccounts}
          emptyDescription="This vendor has not submitted payout bank details yet."
          emptyTitle="No bank account"
          getRowId={(row) => row.bankAccountId}
          rowActions={(bankAccount) => [
            {
              icon: <CheckCircle2 className="size-4" />,
              isVisible:
                canApproveVendors &&
                bankAccount.availableActions.includes("VERIFY"),
              key: "verify-bank",
              label: "Verify",
              onClick: () =>
                openAction("VERIFY_BANK_ACCOUNT", undefined, bankAccount),
              variant: "secondary",
            },
            {
              icon: <XCircle className="size-4" />,
              isVisible:
                canApproveVendors &&
                bankAccount.availableActions.includes("REJECT"),
              key: "reject-bank",
              label: "Reject",
              onClick: () =>
                openAction("REJECT_BANK_ACCOUNT", undefined, bankAccount),
              variant: "danger",
            },
          ]}
          title="Bank Accounts"
        />
      </section>

      <section
        className="scroll-mt-24 space-y-4 focus:outline-none"
        id={vendorDetailSectionIds.activity}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-center gap-2">
          <History className="size-4 text-muted" />
          <h2 className="text-base font-semibold text-foreground">
            Review Timeline
          </h2>
        </div>
        <DynamicTable
          bodyMaxHeight={320}
          columns={timelineColumns}
          data={vendor.reviewTimeline}
          emptyDescription="No review events have been recorded."
          emptyTitle="No review timeline"
          getRowId={(row) => row.reviewEventId}
          title="Review Timeline"
        />
      </section>

      <section
        className="scroll-mt-24 space-y-4 focus:outline-none"
        id={vendorDetailSectionIds.payouts}
        tabIndex={-1}
      >
        <DynamicTable
          actionColumnLabel="Payout Actions"
          actionColumnMinWidth={360}
          bodyMaxHeight={380}
          columns={payoutColumns}
          data={payoutRows}
          description="Vendor payout batches with earning totals, bank-transfer state, warnings, and finance actions."
          emptyDescription={
            canReadPayouts
              ? "This vendor does not have payout batches yet."
              : "Your role does not include payouts:read."
          }
          emptyTitle={canReadPayouts ? "No payouts" : "Payouts unavailable"}
          error={
            payoutsQuery.isError
              ? "We could not load this vendor payout history."
              : false
          }
          getRowId={(row) => row.payoutId}
          inlineActionLimit={2}
          loading={canReadPayouts && payoutsQuery.isLoading}
          rowActions={(payout) => [
            {
              icon: <CheckCircle2 className="size-4" />,
              isDisabled: payoutMutation.isPending,
              isVisible:
                canApprovePayouts && hasPayoutAction(payout, "APPROVE"),
              key: "approve-payout",
              label: "Approve",
              onClick: () => openPayoutAction("APPROVE", payout),
              variant: "secondary",
            },
            {
              icon: <PauseCircle className="size-4" />,
              isDisabled: payoutMutation.isPending,
              isVisible: canApprovePayouts && hasPayoutAction(payout, "HOLD"),
              key: "hold-payout",
              label: "Hold",
              onClick: () => openPayoutAction("HOLD", payout),
              variant: "secondary",
            },
            {
              icon: <RotateCcw className="size-4" />,
              isDisabled: payoutMutation.isPending,
              isVisible:
                canApprovePayouts && hasPayoutAction(payout, "RELEASE_HOLD"),
              key: "release-payout-hold",
              label: "Release Hold",
              onClick: () => openPayoutAction("RELEASE_HOLD", payout),
              variant: "secondary",
            },
            {
              icon: <CreditCard className="size-4" />,
              isDisabled: payoutMutation.isPending,
              isVisible:
                canApprovePayouts && hasPayoutAction(payout, "MARK_PAID"),
              key: "mark-payout-paid",
              label: "Mark Paid",
              onClick: () => openPayoutAction("MARK_PAID", payout),
              placement: "menu",
              variant: "secondary",
            },
            {
              icon: <XCircle className="size-4" />,
              isDisabled: payoutMutation.isPending,
              isVisible:
                canApprovePayouts && hasPayoutAction(payout, "MARK_FAILED"),
              key: "mark-payout-failed",
              label: "Mark Failed",
              onClick: () => openPayoutAction("MARK_FAILED", payout),
              placement: "menu",
              variant: "danger",
            },
            {
              icon: <ArrowUpRight className="size-4" />,
              isDisabled: payoutMutation.isPending,
              key: "open-payout",
              label: "Open",
              onClick: () =>
                navigate(`${routePaths.payouts}/${payout.payoutId}`),
              placement: "menu",
              variant: "ghost",
            },
          ]}
          title="Vendor Payouts"
          toolbar={
            canReadPayouts ? (
              <Button
                disabled={payoutsQuery.isFetching}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void payoutsQuery.refetch()}
              >
                <RotateCcw className="mr-2 size-4" />
                Refresh
              </Button>
            ) : undefined
          }
          onRetry={() => void payoutsQuery.refetch()}
          onRowClick={(payout) =>
            navigate(`${routePaths.payouts}/${payout.payoutId}`)
          }
        />
      </section>

      <section
        className="scroll-mt-24 space-y-4 focus:outline-none"
        id={vendorDetailSectionIds.orders}
        tabIndex={-1}
      >
        <DynamicTable
          actionColumnLabel="Order Actions"
          actionColumnMinWidth={360}
          bodyMaxHeight={390}
          columns={orderColumns}
          data={orderRows}
          description="Vendor orders with customer, payment, logistics, warnings, and allowed admin actions."
          emptyDescription={
            canReadOrders
              ? "This vendor does not have orders yet."
              : "Your role does not include orders:read."
          }
          emptyTitle={canReadOrders ? "No orders" : "Orders unavailable"}
          error={
            ordersQuery.isError
              ? "We could not load this vendor order history."
              : false
          }
          getRowId={(row) => row.orderId}
          inlineActionLimit={2}
          loading={canReadOrders && ordersQuery.isLoading}
          rowActions={(order) => {
            const recommendedAction = mapRecommendedOrderAction(order);

            return [
              {
                icon: <ArrowUpRight className="size-4" />,
                isDisabled: orderMutation.isPending,
                isVisible:
                  Boolean(recommendedAction) &&
                  Boolean(
                    recommendedAction &&
                    canRunOrderAction(
                      recommendedAction,
                      canUpdateOrders,
                      canRefundPayments,
                    ),
                  ),
                key: "recommended-order-action",
                label: recommendedAction
                  ? orderActionLabel(recommendedAction)
                  : "Next Action",
                onClick: () => {
                  if (recommendedAction) {
                    openOrderAction(order, recommendedAction);
                  }
                },
                variant:
                  recommendedAction?.kind === "CANCEL" ? "danger" : "primary",
              },
              {
                icon: <MessageSquarePlus className="size-4" />,
                isDisabled: orderMutation.isPending,
                isVisible: canUpdateOrders && hasOrderAction(order, "ADD_NOTE"),
                key: "add-order-note",
                label: "Add Note",
                onClick: () => openOrderAction(order, { kind: "ADD_NOTE" }),
                variant: "secondary",
              },
              {
                icon: <XCircle className="size-4" />,
                isDisabled: orderMutation.isPending,
                isVisible:
                  canUpdateOrders &&
                  hasOrderAction(order, "CANCEL") &&
                  recommendedAction?.kind !== "CANCEL",
                key: "cancel-order",
                label: "Cancel",
                onClick: () => openOrderAction(order, { kind: "CANCEL" }),
                placement: "menu",
                variant: "danger",
              },
              {
                icon: <CreditCard className="size-4" />,
                isDisabled: orderMutation.isPending,
                isVisible:
                  canRefundPayments &&
                  hasOrderAction(order, "INITIATE_REFUND") &&
                  recommendedAction?.kind !== "INITIATE_REFUND",
                key: "refund-order",
                label: "Refund",
                onClick: () =>
                  openOrderAction(order, { kind: "INITIATE_REFUND" }),
                placement: "menu",
                variant: "secondary",
              },
              {
                icon: <RotateCcw className="size-4" />,
                isDisabled: orderMutation.isPending,
                isVisible:
                  canUpdateOrders &&
                  hasOrderAction(order, "GENERATE_DELIVERY_OTP") &&
                  recommendedAction?.kind !== "GENERATE_DELIVERY_OTP",
                key: "generate-delivery-otp",
                label: "Generate OTP",
                onClick: () =>
                  openOrderAction(order, { kind: "GENERATE_DELIVERY_OTP" }),
                placement: "menu",
                variant: "secondary",
              },
              {
                icon: <CheckCircle2 className="size-4" />,
                isDisabled: orderMutation.isPending,
                isVisible:
                  canUpdateOrders &&
                  hasOrderAction(order, "CONFIRM_DELIVERY_OTP") &&
                  recommendedAction?.kind !== "CONFIRM_DELIVERY_OTP",
                key: "confirm-delivery-otp",
                label: "Confirm OTP",
                onClick: () =>
                  openOrderAction(order, { kind: "CONFIRM_DELIVERY_OTP" }),
                placement: "menu",
                variant: "secondary",
              },
              {
                icon: <Truck className="size-4" />,
                isDisabled: orderMutation.isPending,
                key: "open-logistics",
                label: "Logistics",
                onClick: () =>
                  navigate(`${routePaths.orders}/${order.orderId}/logistics`),
                placement: "menu",
                variant: "secondary",
              },
              {
                icon: <ArrowUpRight className="size-4" />,
                isDisabled: orderMutation.isPending,
                key: "open-order",
                label: "Open",
                onClick: () =>
                  navigate(`${routePaths.orders}/${order.orderId}`),
                placement: "menu",
                variant: "ghost",
              },
            ];
          }}
          title="Vendor Orders"
          toolbar={
            canReadOrders ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(vendorLogisticsPath)}
                >
                  <Truck className="mr-2 size-4" />
                  Logistics
                </Button>
                <Button
                  disabled={ordersQuery.isFetching}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void ordersQuery.refetch()}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Refresh
                </Button>
              </div>
            ) : undefined
          }
          onRetry={() => void ordersQuery.refetch()}
          onRowClick={(order) =>
            navigate(`${routePaths.orders}/${order.orderId}`)
          }
        />
      </section>

      <section
        className="scroll-mt-24 space-y-4 focus:outline-none"
        id={vendorDetailSectionIds.services}
        tabIndex={-1}
      >
        <DynamicTable
          actionColumnLabel="Service Actions"
          actionColumnMinWidth={300}
          bodyMaxHeight={360}
          columns={serviceColumns}
          data={serviceRows}
          description="Vendor services, pricing, and itemized catalog configuration."
          emptyDescription="This vendor does not have services configured yet."
          emptyTitle="No services"
          error={
            servicesQuery.isError
              ? "We could not load this vendor service catalog."
              : false
          }
          getRowId={(row) => row.vendorServiceId}
          inlineActionLimit={2}
          loading={servicesQuery.isLoading}
          rowActions={(service) => [
            {
              icon: <Pencil className="size-4" />,
              isDisabled: serviceMutation.isPending,
              isVisible:
                canUpdateVendors &&
                service.availableActions.includes("EDIT_SERVICE"),
              key: "edit-service",
              label: "Edit",
              onClick: () => openServiceAction("EDIT", service),
              variant: "secondary",
            },
            {
              icon: <Tags className="size-4" />,
              isDisabled: serviceMutation.isPending,
              isVisible:
                canUpdateVendors &&
                service.availableActions.includes("EDIT_CATALOG"),
              key: "edit-catalog",
              label: "Catalog",
              onClick: () => openServiceAction("CATALOG", service),
              variant: "secondary",
            },
            {
              icon: <Ban className="size-4" />,
              isDisabled: serviceMutation.isPending,
              isVisible:
                canUpdateVendors &&
                service.availableActions.includes("DISABLE_SERVICE"),
              key: "disable-service",
              label: "Disable",
              onClick: () => openServiceAction("DISABLE", service),
              placement: "menu",
              variant: "danger",
            },
          ]}
          title="Services & Pricing"
          toolbar={
            canUpdateVendors ? (
              <Button
                disabled={
                  serviceMutation.isPending ||
                  servicesQuery.isLoading ||
                  !vendor.category
                }
                size="sm"
                title={
                  vendor.category
                    ? undefined
                    : "Assign a category before adding services."
                }
                type="button"
                onClick={() => openServiceAction("CREATE")}
              >
                <Plus className="mr-2 size-4" />
                Add Service
              </Button>
            ) : undefined
          }
          onRetry={() => void servicesQuery.refetch()}
        />
      </section>

      <section
        className="scroll-mt-24 space-y-4 focus:outline-none"
        id={vendorDetailSectionIds.reels}
        tabIndex={-1}
      >
        <DynamicTable
          actionColumnLabel="Reel Actions"
          actionColumnMinWidth={360}
          bodyMaxHeight={380}
          columns={reelColumns}
          data={canReadReels ? reelRows : []}
          description="Vendor reels with moderation, media readiness, and customer visibility state."
          emptyDescription={
            canReadReels
              ? "This vendor has not uploaded reels yet."
              : "Your role does not include reels:read."
          }
          emptyTitle={canReadReels ? "No reels" : "Reels unavailable"}
          error={
            reelsQuery.isError
              ? "We could not load this vendor reel history."
              : false
          }
          getRowId={(row) => row.reelId}
          inlineActionLimit={2}
          loading={canReadReels && reelsQuery.isLoading}
          rowActions={(reel) => [
            {
              icon: <Eye className="size-4" />,
              isDisabled: buildVendorReelMediaItems(reel).length === 0,
              key: "view-reel-media",
              label: buildVendorReelMediaItems(reel).length
                ? "View Media"
                : "No media",
              onClick: () => openVendorReelMedia(reel),
              variant: "ghost",
            },
            {
              icon: <CheckCircle2 className="size-4" />,
              isDisabled: reelMutation.isPending,
              isVisible:
                canModerateReels && reel.availableActions.includes("APPROVE"),
              key: "approve-reel",
              label: "Approve",
              onClick: () => openReelAction("APPROVE", reel),
              variant: "secondary",
            },
            {
              icon: <XCircle className="size-4" />,
              isDisabled: reelMutation.isPending,
              isVisible:
                canModerateReels && reel.availableActions.includes("REJECT"),
              key: "reject-reel",
              label: "Reject",
              onClick: () => openReelAction("REJECT", reel),
              variant: "danger",
            },
            {
              icon: <PencilLine className="size-4" />,
              isDisabled: reelMutation.isPending,
              isVisible:
                canModerateReels &&
                reel.availableActions.includes("REQUEST_EDIT"),
              key: "request-edit-reel",
              label: "Request Edit",
              onClick: () => openReelAction("REQUEST_EDIT", reel),
              variant: "secondary",
            },
            {
              icon: <PauseCircle className="size-4" />,
              isDisabled: reelMutation.isPending,
              isVisible:
                canModerateReels && reel.availableActions.includes("PAUSE"),
              key: "pause-reel",
              label: "Pause",
              onClick: () => openReelAction("PAUSE", reel),
              placement: "menu",
              variant: "secondary",
            },
            {
              icon: <Trash2 className="size-4" />,
              isDisabled: reelMutation.isPending,
              isVisible:
                canModerateReels && reel.availableActions.includes("REMOVE"),
              key: "remove-reel",
              label: "Remove",
              onClick: () => openReelAction("REMOVE", reel),
              placement: "menu",
              variant: "danger",
            },
            {
              icon: <Trash2 className="size-4" />,
              isDisabled: reelMutation.isPending,
              isVisible:
                canDeleteReels && reel.availableActions.includes("SOFT_DELETE"),
              key: "soft-delete-reel",
              label: "Soft Delete",
              onClick: () => openReelAction("SOFT_DELETE", reel),
              placement: "menu",
              variant: "danger",
            },
            {
              icon: <Trash2 className="size-4" />,
              isDisabled: reelMutation.isPending,
              isVisible:
                canDeleteReels && reel.availableActions.includes("HARD_DELETE"),
              key: "hard-delete-reel",
              label: "Hard Delete",
              onClick: () => openReelAction("HARD_DELETE", reel),
              placement: "menu",
              variant: "danger",
            },
            {
              icon: <ArrowUpRight className="size-4" />,
              isDisabled: reelMutation.isPending,
              key: "open-reel",
              label: "Open",
              onClick: () => navigate(`${routePaths.reels}/${reel.reelId}`),
              placement: "menu",
              variant: "ghost",
            },
          ]}
          title="Vendor Reels"
          toolbar={
            canReadReels ? (
              <Button
                disabled={reelsQuery.isFetching}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void reelsQuery.refetch()}
              >
                <RotateCcw className="mr-2 size-4" />
                Refresh
              </Button>
            ) : undefined
          }
          onRetry={() => void reelsQuery.refetch()}
        />
      </section>

      <section
        className="scroll-mt-24 grid gap-4 focus:outline-none lg:grid-cols-3"
        id={vendorDetailSectionIds.profile}
        tabIndex={-1}
      >
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <VendorBrandLogoMark
                vendor={vendor}
                onOpen={vendorBrandLogoMediaItem ? openVendorBrandLogo : undefined}
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  Vendor Information
                </h2>
                <p className="mt-1 truncate text-sm text-muted">
                  {vendor.shopName} · {vendor.publicVendorId}
                </p>
              </div>
            </div>
            {canUpdateVendors ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  disabled={brandLogoMutation.isPending}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setBrandLogoError(null);
                    setSelectedLogoAction("change");
                  }}
                >
                  <Upload className="mr-2 size-4" />
                  Change logo
                </Button>
                {hasVendorBrandLogo ? (
                  <Button
                    disabled={brandLogoMutation.isPending}
                    size="sm"
                    type="button"
                    variant="danger"
                    onClick={() => {
                      setBrandLogoError(null);
                      setSelectedLogoAction("remove");
                    }}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Remove logo
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Brand Logo"
              value={vendor.brandLogo?.fileName ?? null}
            />
            <DetailField label="Owner" value={vendor.ownerName} />
            <DetailField label="Mobile" value={vendor.mobileNumber} />
            <DetailField
              label="Alternative Mobile"
              value={vendor.alternativeMobileNumber}
            />
            <ContactPersonsField contacts={vendor.contactPersons} />
            <DetailField label="Vendor ID" value={vendor.vendorId} />
            <DetailField
              label="Public Vendor ID"
              value={vendor.publicVendorId}
            />
            <DetailField label="Category" value={vendor.category?.name} />
            <DetailField
              label="Category ID"
              value={vendor.category?.categoryId}
            />
            <DetailField
              label="Category Code"
              value={vendor.category?.categoryCode}
            />
            <DetailField label="Referral ID" value={vendor.referralId} />
            <DetailField label="Review Notes" value={vendor.reviewNotes} />
            <DetailField
              label="Rejection Reason"
              value={vendor.rejectionReason}
            />
            <DetailField
              label="Document Summary"
              value={
                vendor.documentSummary
                  ? `${vendor.documentSummary.verified}/${vendor.documentSummary.total} verified`
                  : null
              }
            />
            <DetailField
              label="Warnings"
              value={vendor.warnings.length ? vendor.warnings.join(", ") : null}
            />
            <DetailField
              label="Available Actions"
              value={
                visibleVendorActions.length
                  ? visibleVendorActions.join(", ")
                  : null
              }
            />
            <DetailField label="Verified At" value={vendor.verifiedAt} />
            <DetailField label="Suspended At" value={vendor.suspendedAt} />
            <DetailField
              label="Suspension Reason"
              value={vendor.suspensionReason}
            />
            <DetailField label="Created" value={formatDateSafe(vendor.createdAt)} />
            <DetailField label="Updated" value={formatDateSafe(vendor.updatedAt)} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Address</h2>
          <DetailField
            label="Address Line 1"
            value={vendor.address.addressLine1}
          />
          <DetailField
            label="Address Line 2"
            value={vendor.address.addressLine2}
          />
          <DetailField label="City" value={vendor.address.city} />
          <DetailField label="Zone" value={vendor.address.zone?.zoneName} />
          <DetailField label="Pincode" value={vendor.address.pincode} />
          <DetailField label="Latitude" value={vendor.address.latitude} />
          <DetailField label="Longitude" value={vendor.address.longitude} />
        </div>
      </section>

      <VendorActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={
          selectedAction
            ? `${selectedAction.kind}-${selectedAction.document?.documentId ?? selectedAction.bankAccount?.bankAccountId ?? "vendor"}`
            : "vendor-action-closed"
        }
        vendor={vendor}
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null);
            setActionError(null);
          }
        }}
        onSubmit={submitAction}
      />

      <VendorServiceActionModal
        action={selectedServiceAction}
        error={serviceError}
        isSubmitting={serviceMutation.isPending}
        key={
          selectedServiceAction
            ? `${selectedServiceAction.kind}-${selectedServiceAction.service?.vendorServiceId ?? "new"}`
            : "vendor-service-action-closed"
        }
        vendor={vendor}
        onClose={() => {
          if (!serviceMutation.isPending) {
            setSelectedServiceAction(null);
            setServiceError(null);
          }
        }}
        onSubmit={submitServiceAction}
      />

      {selectedOrderAction ? (
        <OrderActionModal
          action={selectedOrderAction.action}
          error={orderError}
          isSubmitting={orderMutation.isPending}
          key={`${selectedOrderAction.order.orderId}-${selectedOrderAction.action.kind}-${selectedOrderAction.action.targetStatus ?? "order"}`}
          order={selectedOrderAction.order}
          onClose={() => {
            if (!orderMutation.isPending) {
              setSelectedOrderAction(null);
              setOrderError(null);
            }
          }}
          onSubmit={submitOrderAction}
        />
      ) : null}

      <PayoutActionModal
        action={selectedPayoutAction}
        error={payoutError}
        isSubmitting={payoutMutation.isPending}
        key={
          selectedPayoutAction
            ? `${selectedPayoutAction.kind}-${selectedPayoutAction.payout?.payoutId ?? "payout"}`
            : "payout-action-closed"
        }
        onClose={() => {
          if (!payoutMutation.isPending) {
            setSelectedPayoutAction(null);
            setPayoutError(null);
          }
        }}
        onSubmit={submitPayoutAction}
      />

      <ReelActionModal
        action={selectedReelAction}
        error={reelError}
        isSubmitting={reelMutation.isPending}
        key={
          selectedReelAction
            ? `${selectedReelAction.kind}-${selectedReelAction.reel.reelId}`
            : "reel-action-closed"
        }
        onClose={() => {
          if (!reelMutation.isPending) {
            setSelectedReelAction(null);
            setReelError(null);
          }
        }}
        onSubmit={submitReelAction}
      />

      <VendorBrandLogoModal
        action={selectedLogoAction}
        error={brandLogoError}
        isSubmitting={brandLogoMutation.isPending}
        key={
          selectedLogoAction
            ? `brand-logo-${selectedLogoAction}-${vendor.vendorId}-${vendor.brandLogo?.mediaAssetId ?? "none"}`
            : "brand-logo-closed"
        }
        vendor={vendor}
        onClose={() => {
          if (!brandLogoMutation.isPending) {
            setSelectedLogoAction(null);
            setBrandLogoError(null);
          }
        }}
        onSubmit={(values) => void brandLogoMutation.mutateAsync(values)}
      />

      {isProfileEditorOpen ? (
        <VendorProfileEditModal
          error={profileError}
          isSubmitting={profileMutation.isPending}
          key={`profile-${vendor.vendorId}-${vendor.updatedAt}`}
          vendor={vendor}
          onClose={() => {
            if (!profileMutation.isPending) {
              setProfileEditorOpen(false);
              setProfileError(null);
            }
          }}
          onSubmit={(values) => void profileMutation.mutateAsync(values)}
        />
      ) : null}
    </PageContainer>
  );
}
