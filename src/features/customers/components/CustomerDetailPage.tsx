import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  Home,
  Mail,
  MapPin,
  MessageSquarePlus,
  Package,
  Phone,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
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
import { DetailPageHeader } from "../../../components/layout/DetailPageHeader";
import { PageContainer } from "../../../components/layout/PageContainer";
import { featureFlags } from "../../../config/featureFlags";
import { routePaths } from "../../../config/routes";
import { usePermission } from "../../../hooks/usePermission";
import { cn } from "../../../utils/cn";
import { formatDate } from "../../../utils/formatDate";
import { formatMoney } from "../../../utils/formatMoney";
import { orderService } from "../../orders/services/order.service";
import {
  OrderActionModal,
  type OrderActionFormValues,
  type OrderActionSelection,
} from "../../orders/components/OrderActionModal";
import type {
  AdminOrderPaymentStatus,
  AdminOrdersSummary,
  AdminOrderStatus,
  AdminOrderSummary,
} from "../../orders/types/order.types";
import { paymentService } from "../../payments/services/payment.service";
import {
  PaymentActionModal,
  type PaymentActionFormValues,
  type PaymentActionSelection,
} from "../../payments/components/PaymentActionModal";
import type {
  AdminPaymentStatus,
  AdminPaymentSummary,
  AdminRefundStatus,
  AdminRefundSummary,
} from "../../payments/types/payment.types";
import { customerService } from "../services/customer.service";
import {
  CustomerActionModal,
  type CustomerActionFormValues,
  type CustomerActionKind,
  type CustomerActionSelection,
} from "./CustomerActionModal";
import {
  CustomerAddressActionModal,
  type CustomerAddressActionSelection,
} from "./CustomerAddressActionModal";
import { CustomerProfileEditModal } from "./CustomerProfileEditModal";
import type {
  AdminCustomerAddress,
  AdminCustomerDetail,
  AdminCustomerNote,
  AdminCustomerRelatedVendor,
  AdminCustomerRelatedVendorRelationshipType,
  AdminCustomerRelatedVendorStatus,
  AdminCustomerWalletCredit,
  CustomerAddressPayload,
  CustomerAddressReasonPayload,
  CustomerProfileUpdatePayload,
} from "../types/customer.types";

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

interface CustomerOrderActionTarget {
  action: OrderActionSelection;
  order: AdminOrderSummary;
}

const addressColumns: DynamicTableColumn<AdminCustomerAddress>[] = [
  {
    key: "label",
    label: "Address",
    minWidth: 260,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.label ?? "Address"}</p>
        <p className="text-xs text-muted">
          {row.addressLine1}
          {row.addressLine2 ? `, ${row.addressLine2}` : ""}
        </p>
      </div>
    ),
  },
  {
    key: "contactName",
    label: "Contact",
    minWidth: 180,
    renderCell: (row) => (
      <div>
        <p>{row.contactName}</p>
        <p className="text-xs text-muted">{row.contactMobile}</p>
      </div>
    ),
  },
  {
    key: "city",
    label: "City",
    minWidth: 180,
    renderCell: (row) => (
      <div>
        <p>{row.city}</p>
        <p className="text-xs text-muted">{row.zone?.zoneName ?? "No zone"}</p>
      </div>
    ),
  },
  {
    key: "isDefault",
    label: "Default",
    format: "status",
    minWidth: 120,
    getValue: (row) => (row.isDefault ? "YES" : "NO"),
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
    key: "vendor",
    label: "Vendor",
    minWidth: 220,
    renderCell: (order) => (
      <div>
        <p className="font-medium text-foreground">{order.vendor.shopName}</p>
        <p className="mt-1 text-xs text-muted">{order.vendor.publicVendorId}</p>
        <p className="mt-1 truncate text-xs text-muted">
          {order.vendor.zone?.zoneName ?? order.vendor.city}
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

const relatedVendorColumns: DynamicTableColumn<AdminCustomerRelatedVendor>[] = [
  {
    key: "vendor",
    label: "Vendor",
    minWidth: 260,
    renderCell: (row) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">
            {row.vendor.shopName}
          </p>
          <Badge tone={getRelatedVendorStatusTone(row.vendor.vendorStatus)}>
            {humanizeCode(row.vendor.vendorStatus)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {row.vendor.publicVendorId}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {row.vendor.ownerName} · {row.vendor.mobileNumber}
        </p>
      </div>
    ),
  },
  {
    key: "relationship",
    label: "Relationship",
    minWidth: 230,
    renderCell: (row) => (
      <div>
        <Badge tone={getRelatedVendorRelationshipTone(row.relationship.type)}>
          {relatedVendorRelationshipLabel(row.relationship.type)}
        </Badge>
        <p className="mt-2 text-xs text-muted">
          Saved {formatDateSafe(row.relationship.savedAt)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Last activity {formatDateSafe(row.relationship.lastInteractionAt)}
        </p>
      </div>
    ),
  },
  {
    key: "orders",
    label: "Orders",
    minWidth: 230,
    renderCell: (row) => (
      <div>
        <p className="font-semibold text-foreground">
          {row.orderSummary.totalOrders} total ·{" "}
          {row.orderSummary.activeOrders} active
        </p>
        <p className="mt-1 text-xs text-muted">
          {formatPaise(
            row.orderSummary.totalOrderValuePaise,
            row.orderSummary.currency,
          )}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {row.orderSummary.latestOrder
            ? `Latest ${row.orderSummary.latestOrder.publicOrderId}`
            : "No orders yet"}
        </p>
      </div>
    ),
  },
  {
    key: "coverage",
    label: "Coverage",
    minWidth: 230,
    renderCell: (row) => (
      <div>
        <p className="font-medium text-foreground">
          {row.vendor.category?.name ?? "No category"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {row.vendor.zone?.zoneName ?? row.vendor.city}
        </p>
        <p className="mt-1 text-xs text-muted">
          {humanizeCode(row.vendor.onboardingStatus)}
        </p>
      </div>
    ),
  },
  {
    key: "signals",
    label: "Signals",
    minWidth: 250,
    renderCell: (row) => (
      <div className="space-y-2">
        {row.warnings.length ? (
          <div className="flex flex-wrap gap-1.5">
            {row.warnings.slice(0, 2).map((warning) => (
              <Badge key={warning} tone="warning">
                {relatedVendorWarningLabel(warning)}
              </Badge>
            ))}
            {row.warnings.length > 2 ? (
              <Badge tone="neutral">+{row.warnings.length - 2}</Badge>
            ) : null}
          </div>
        ) : (
          <Badge tone="success">No warnings</Badge>
        )}
        <p className="text-xs text-muted">
          {row.nextRecommendedAction
            ? humanizeCode(row.nextRecommendedAction)
            : "View vendor"}
        </p>
      </div>
    ),
  },
];

const paymentColumns: DynamicTableColumn<AdminPaymentSummary>[] = [
  {
    key: "payment",
    label: "Payment",
    minWidth: 240,
    renderCell: (payment) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">
            {payment.publicPaymentId}
          </p>
          <Badge tone={getFinancePaymentStatusTone(payment.status)}>
            {humanizeCode(payment.status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          Created {formatDateSafe(payment.createdAt)}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {payment.gateway} · {payment.method}
        </p>
      </div>
    ),
  },
  {
    key: "order",
    label: "Order / Vendor",
    minWidth: 240,
    renderCell: (payment) => (
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {payment.order.publicOrderId}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {payment.vendor.shopName}
        </p>
        <p className="mt-1 text-xs text-muted">
          {humanizeCode(payment.order.paymentStatus)}
        </p>
      </div>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    minWidth: 190,
    renderCell: (payment) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatPaise(payment.amountPaise, payment.currency)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Refundable{" "}
          {formatPaise(
            payment.refundSummary.remainingRefundableAmountPaise,
            payment.currency,
          )}
        </p>
      </div>
    ),
  },
  {
    key: "refunds",
    label: "Refunds",
    minWidth: 180,
    renderCell: (payment) => (
      <div>
        <p className="font-semibold text-foreground">
          {payment.refundSummary.refundCount} total
        </p>
        <p
          className={cn(
            "mt-1 text-xs",
            payment.refundSummary.requestedCount > 0
              ? "text-warning"
              : "text-muted",
          )}
        >
          {payment.refundSummary.requestedCount} requested
        </p>
      </div>
    ),
  },
  {
    key: "updatedAt",
    label: "Updated",
    minWidth: 170,
    renderCell: (payment) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatDateSafe(payment.updatedAt)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {payment.nextRecommendedAction
            ? humanizeCode(payment.nextRecommendedAction)
            : "No next action"}
        </p>
      </div>
    ),
  },
];

const refundColumns: DynamicTableColumn<AdminRefundSummary>[] = [
  {
    key: "refund",
    label: "Refund",
    minWidth: 240,
    renderCell: (refund) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{refund.refundId}</p>
          <Badge tone={getRefundStatusTone(refund.status)}>
            {humanizeCode(refund.status)}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted">
          {refund.publicPaymentId}
        </p>
        <p className="mt-1 text-xs text-muted">
          Created {formatDateSafe(refund.createdAt)}
        </p>
      </div>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    minWidth: 180,
    renderCell: (refund) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatPaise(refund.amountPaise, refund.currency)}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-muted">
          {refund.reason}
        </p>
      </div>
    ),
  },
  {
    key: "order",
    label: "Order / Vendor",
    minWidth: 230,
    renderCell: (refund) => (
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {refund.order.publicOrderId}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {refund.vendor.shopName}
        </p>
        <p className="mt-1 text-xs text-muted">
          {humanizeCode(refund.order.paymentStatus)}
        </p>
      </div>
    ),
  },
  {
    key: "review",
    label: "Review",
    minWidth: 190,
    renderCell: (refund) => (
      <div>
        <p className="font-semibold text-foreground">
          {refund.nextRecommendedAction
            ? humanizeCode(refund.nextRecommendedAction)
            : "No next action"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {refund.reviewedAt
            ? `Reviewed ${formatDateSafe(refund.reviewedAt)}`
            : "Awaiting review"}
        </p>
      </div>
    ),
  },
  {
    key: "updatedAt",
    label: "Updated",
    minWidth: 170,
    renderCell: (refund) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatDateSafe(refund.updatedAt)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {refund.processedAt
            ? `Processed ${formatDateSafe(refund.processedAt)}`
            : refund.razorpayRefundId ?? "Provider pending"}
        </p>
      </div>
    ),
  },
];

const noteColumns: DynamicTableColumn<AdminCustomerNote>[] = [
  {
    key: "note",
    label: "Note",
    minWidth: 320,
  },
  {
    key: "adminId",
    label: "Admin ID",
    minWidth: 220,
    placeholder: "System",
  },
  {
    key: "createdAt",
    label: "Created",
    format: "date",
    minWidth: 180,
  },
];

const walletCreditColumns: DynamicTableColumn<AdminCustomerWalletCredit>[] = [
  {
    key: "amountPaise",
    label: "Amount",
    minWidth: 160,
    renderCell: (row) => (
      <span>{formatMoney(row.amountPaise / 100, row.currency)}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    format: "status",
    minWidth: 150,
  },
  {
    key: "reason",
    label: "Reason",
    minWidth: 260,
  },
  {
    key: "createdAt",
    label: "Created",
    format: "date",
    minWidth: 180,
  },
];

type CustomerTone = "success" | "warning" | "danger" | "info" | "neutral";

function toneClasses(tone: CustomerTone) {
  if (tone === "success") return "border-border bg-surface text-success";
  if (tone === "warning") return "border-border bg-surface text-warning";
  if (tone === "danger") return "border-border bg-surface text-danger";
  if (tone === "info") return "border-border bg-surface text-primary";
  return "border-border bg-surface text-muted";
}

function statusTone(status: AdminCustomerDetail["status"]) {
  if (status === "ACTIVE") return "success";
  if (status === "BLOCKED") return "danger";
  return "warning";
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return "Review customer";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function signalLabel(warning: string) {
  const labels: Record<string, string> = {
    CUSTOMER_BLOCKED: "Customer blocked",
    HAS_ACTIVE_ORDERS: "Active orders",
    HAS_WALLET_CREDIT: "Wallet credit",
    PROFILE_INCOMPLETE: "Profile incomplete",
    ZONE_MISSING: "Zone missing",
  };

  return labels[warning] ?? humanizeCode(warning);
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return "Not available";
  return formatDate(value, true);
}

function formatPaise(value: number | null | undefined, currency = "INR") {
  if (value == null) return "Not available";

  return formatMoney(value / 100, currency);
}

function getOrderStatusTone(status: AdminOrderStatus): CustomerTone {
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

function getPaymentStatusTone(status: AdminOrderPaymentStatus): CustomerTone {
  if (status === "PAID" || status === "REFUNDED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PARTIALLY_REFUNDED") return "info";
  return "warning";
}

function getFinancePaymentStatusTone(status: AdminPaymentStatus): CustomerTone {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "CREATED" || status === "PENDING") return "warning";
  return "neutral";
}

function getRefundStatusTone(status: AdminRefundStatus): CustomerTone {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED" || status === "REJECTED") return "danger";
  if (
    status === "REQUESTED" ||
    status === "APPROVED" ||
    status === "PROCESSING"
  ) {
    return "warning";
  }

  return "neutral";
}

function getRelatedVendorStatusTone(
  status: AdminCustomerRelatedVendorStatus,
): CustomerTone {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED" || status === "INACTIVE") return "danger";
  return "warning";
}

function getRelatedVendorRelationshipTone(
  relationship: AdminCustomerRelatedVendorRelationshipType,
): CustomerTone {
  if (relationship === "SAVED_AND_ORDERED") return "success";
  if (relationship === "SAVED") return "info";
  return "neutral";
}

function relatedVendorRelationshipLabel(
  relationship: AdminCustomerRelatedVendorRelationshipType,
) {
  if (relationship === "SAVED_AND_ORDERED") return "Saved + Ordered";
  if (relationship === "SAVED") return "Saved";
  return "Ordered";
}

function relatedVendorWarningLabel(warning: string) {
  const labels: Record<string, string> = {
    HAS_ACTIVE_ORDERS: "Active orders",
    SAVED_VENDOR_NOT_VISIBLE: "Saved vendor hidden",
    SAVED_WITH_NO_ORDERS: "Saved, no orders",
    VENDOR_NOT_CUSTOMER_VISIBLE: "Not customer visible",
  };

  return labels[warning] ?? humanizeCode(warning);
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

function hasPaymentAction(payment: AdminPaymentSummary, action: string) {
  return payment.availableActions
    .map((availableAction) => availableAction.toUpperCase())
    .includes(action);
}

function hasRefundAction(refund: AdminRefundSummary, action: string) {
  return refund.availableActions
    .map((availableAction) => availableAction.toUpperCase())
    .includes(action);
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

function getOrderSummaryTone(summary: AdminOrdersSummary | undefined) {
  if (!summary?.total) return "neutral";
  if (summary.needsAttention > 0 || summary.paymentReview > 0) return "warning";
  if (summary.active > 0) return "info";
  return "success";
}

function isWalletAction(action: string | null | undefined) {
  return action?.toUpperCase() === "WALLET_CREDIT";
}

function visibleWarnings(warnings: string[]) {
  return featureFlags.customerWallet
    ? warnings
    : warnings.filter((warning) => warning !== "HAS_WALLET_CREDIT");
}

function visibleRecommendedAction(customer: AdminCustomerDetail) {
  if (
    !featureFlags.customerWallet &&
    isWalletAction(customer.nextRecommendedAction)
  ) {
    return null;
  }

  return customer.nextRecommendedAction;
}

function visibleAvailableActions(actions: string[]) {
  return featureFlags.customerWallet
    ? actions
    : actions.filter((action) => action !== "WALLET_CREDIT");
}

function customerNeedsAttention(customer: AdminCustomerDetail) {
  return (
    customer.status !== "ACTIVE" ||
    visibleWarnings(customer.warnings).length > 0 ||
    Boolean(visibleRecommendedAction(customer))
  );
}

function customerHealth(customer: AdminCustomerDetail) {
  let score = 100;

  if (customer.status === "BLOCKED") score -= 55;
  if (customer.status === "INCOMPLETE") score -= 25;
  if (!customer.zone) score -= 12;
  if (customer.orderSummary.activeOrders > 0) score -= 8;
  if (
    featureFlags.customerWallet &&
    customer.walletSummary.creditBalancePaise > 0
  )
    score -= 5;
  score -= Math.min(visibleWarnings(customer.warnings).length * 10, 30);

  return Math.max(18, Math.min(98, score));
}

function healthColor(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 55) return "bg-warning";
  return "bg-danger";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function DetailMetricCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  tone: CustomerTone;
  value: string;
}) {
  return (
    <div
      className={cn(
        "min-h-[4.35rem] rounded-[0.75rem] border p-2.5",
        toneClasses(tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal opacity-80">
            {label}
          </p>
          <p className="mt-1 truncate text-lg font-semibold tracking-normal">
            {value}
          </p>
        </div>
        <span className="mt-0.5 shrink-0 opacity-80">{icon}</span>
      </div>
      <p className="mt-0.5 truncate text-xs leading-4 opacity-80">{meta}</p>
    </div>
  );
}

function DetailPanel({
  children,
  className,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[0.875rem] border border-border bg-surface p-3 shadow-surface",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function DetailField({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
        {icon ? <span className="text-muted">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 break-words text-sm font-medium text-foreground">
        {value ?? "Not available"}
      </p>
    </div>
  );
}

function CustomerHeaderStatus({ customer }: { customer: AdminCustomerDetail }) {
  const customerStatus = humanizeCode(customer.status);
  const userStatus = humanizeCode(customer.userStatus);
  const showUserStatus =
    customer.userStatus.toUpperCase() !== customer.status.toUpperCase();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={statusTone(customer.status)}>Customer: {customerStatus}</Badge>
      {showUserStatus ? (
        <Badge tone="neutral">User: {userStatus}</Badge>
      ) : null}
      {customerNeedsAttention(customer) ? (
        <Badge tone="warning">Action needed</Badge>
      ) : (
        <Badge tone="success">Healthy</Badge>
      )}
    </div>
  );
}

function CustomerHeaderActions({
  canCreditWallet,
  canUpdateCustomer,
  customer,
  isSubmitting,
  onEditProfile,
  onSelectAction,
}: {
  canCreditWallet: boolean;
  canUpdateCustomer: boolean;
  customer: AdminCustomerDetail;
  isSubmitting: boolean;
  onEditProfile: () => void;
  onSelectAction: (kind: CustomerActionKind) => void;
}) {
  const availableActions = visibleAvailableActions(customer.availableActions);
  const hasAction = (action: string) => availableActions.includes(action);

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canUpdateCustomer && hasAction("EDIT_PROFILE") ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={onEditProfile}
        >
          <Edit3 className="mr-2 size-4" />
          Edit Profile
        </Button>
      ) : null}
      {canUpdateCustomer && hasAction("BLOCK") ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction("BLOCK")}
        >
          <Ban className="mr-2 size-4" />
          Block
        </Button>
      ) : null}
      {canUpdateCustomer && hasAction("UNBLOCK") ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction("UNBLOCK")}
        >
          <ShieldCheck className="mr-2 size-4" />
          Unblock
        </Button>
      ) : null}
      {featureFlags.customerWallet &&
      canCreditWallet &&
      hasAction("WALLET_CREDIT") ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction("WALLET_CREDIT")}
        >
          <Wallet className="mr-2 size-4" />
          Wallet Credit
        </Button>
      ) : null}
      {canUpdateCustomer && hasAction("ADD_NOTE") ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction("ADD_NOTE")}
        >
          <MessageSquarePlus className="mr-2 size-4" />
          Add Note
        </Button>
      ) : null}
    </div>
  );
}

function CustomerIdentityPanel({
  customer,
}: {
  customer: AdminCustomerDetail;
}) {
  const health = customerHealth(customer);

  return (
    <DetailPanel
      className="lg:col-span-2"
      description="Primary profile, contact, and service coverage from backend data."
      icon={<UserRound className="size-4" />}
      title="Customer profile"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 items-start gap-3 rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full border bg-surface text-base font-semibold",
              customer.status === "BLOCKED"
                ? "border-danger/25 text-danger"
                : customerNeedsAttention(customer)
                  ? "border-warning/25 text-warning"
                  : "border-success/25 text-success",
            )}
          >
            {getInitials(customer.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">
                {customer.fullName}
              </h2>
              <Badge tone={statusTone(customer.status)}>
                {customer.status}
              </Badge>
            </div>
            <p className="mt-1 break-words text-xs text-muted">
              {customer.customerId}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField
                icon={<Phone className="size-3.5" />}
                label="Mobile"
                value={customer.mobileNumber}
              />
              <DetailField
                icon={<Mail className="size-3.5" />}
                label="Email"
                value={customer.email}
              />
              <DetailField
                icon={<MapPin className="size-3.5" />}
                label="City"
                value={customer.city || customer.zone?.city}
              />
              <DetailField
                icon={<Home className="size-3.5" />}
                label="Zone"
                value={customer.zone?.zoneName}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold uppercase tracking-normal text-muted">
              Health
            </span>
            <span className="font-semibold text-foreground">{health}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-surface">
            <div
              className={cn("h-2 rounded-full", healthColor(health))}
              style={{ width: `${health}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 text-xs text-muted">
            <div className="flex items-center justify-between">
              <span>Active orders</span>
              <span className="font-semibold text-foreground">
                {customer.orderSummary.activeOrders}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Warning signals</span>
              <span className="font-semibold text-foreground">
                {visibleWarnings(customer.warnings).length}
              </span>
            </div>
            {featureFlags.customerWallet ? (
              <div className="flex items-center justify-between">
                <span>Wallet credit</span>
                <span className="font-semibold text-foreground">
                  {formatPaise(customer.walletSummary.creditBalancePaise)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DetailPanel>
  );
}

function CustomerActionRail({
  canCreditWallet,
  canUpdateCustomer,
  customer,
  isSubmitting,
  onEditProfile,
  onSelectAction,
}: {
  canCreditWallet: boolean;
  canUpdateCustomer: boolean;
  customer: AdminCustomerDetail;
  isSubmitting: boolean;
  onEditProfile: () => void;
  onSelectAction: (kind: CustomerActionKind) => void;
}) {
  const availableActions = visibleAvailableActions(customer.availableActions);
  const hasAction = (action: string) => availableActions.includes(action);
  const firstWarning = visibleWarnings(customer.warnings)[0];
  const nextRecommendedAction = visibleRecommendedAction(customer);
  const recommendedAction = nextRecommendedAction?.toUpperCase();
  const healthy = !firstWarning && customer.status === "ACTIVE";
  const recommendedActionButton =
    recommendedAction === "EDIT_PROFILE" &&
    canUpdateCustomer &&
    hasAction("EDIT_PROFILE") ? (
      <Button
        className="mt-3 w-full justify-start"
        disabled={isSubmitting}
        size="sm"
        variant="secondary"
        onClick={onEditProfile}
      >
        <Edit3 className="mr-2 size-4" />
        Review profile
      </Button>
    ) : recommendedAction === "ADD_NOTE" &&
      canUpdateCustomer &&
      hasAction("ADD_NOTE") ? (
      <Button
        className="mt-3 w-full justify-start"
        disabled={isSubmitting}
        size="sm"
        variant="secondary"
        onClick={() => onSelectAction("ADD_NOTE")}
      >
        <MessageSquarePlus className="mr-2 size-4" />
        Add note
      </Button>
    ) : recommendedAction === "BLOCK" &&
      canUpdateCustomer &&
      hasAction("BLOCK") ? (
      <Button
        className="mt-3 w-full justify-start"
        disabled={isSubmitting}
        size="sm"
        variant="danger"
        onClick={() => onSelectAction("BLOCK")}
      >
        <Ban className="mr-2 size-4" />
        Block customer
      </Button>
    ) : recommendedAction === "UNBLOCK" &&
      canUpdateCustomer &&
      hasAction("UNBLOCK") ? (
      <Button
        className="mt-3 w-full justify-start"
        disabled={isSubmitting}
        size="sm"
        variant="secondary"
        onClick={() => onSelectAction("UNBLOCK")}
      >
        <ShieldCheck className="mr-2 size-4" />
        Unblock customer
      </Button>
    ) : recommendedAction === "WALLET_CREDIT" &&
      featureFlags.customerWallet &&
      canCreditWallet &&
      hasAction("WALLET_CREDIT") ? (
      <Button
        className="mt-3 w-full justify-start"
        disabled={isSubmitting}
        size="sm"
        variant="secondary"
        onClick={() => onSelectAction("WALLET_CREDIT")}
      >
        <Wallet className="mr-2 size-4" />
        Apply credit
      </Button>
    ) : null;

  return (
    <aside className="space-y-3 xl:sticky xl:top-[4.75rem] xl:max-h-[calc(100vh-var(--spacing-topbar)-5.5rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
      <DetailPanel
        description="Backend recommendation and recent operational context."
        icon={<ShieldAlert className="size-4" />}
        title="Recommendation"
      >
        <div
          className={cn(
            "rounded-[0.75rem] border p-3",
            healthy
              ? "border-success/25 bg-success/10 text-success"
              : "border-warning/25 bg-warning/10 text-warning",
          )}
        >
          <div className="flex items-start gap-2">
            {healthy ? (
              <CheckCircle2 className="mt-0.5 size-4" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {nextRecommendedAction
                  ? humanizeCode(nextRecommendedAction)
                  : healthy
                    ? "No active warning"
                    : signalLabel(firstWarning ?? "")}
              </p>
              <p className="mt-1 text-xs leading-5 opacity-80">
                {nextRecommendedAction
                  ? "Recommended by the backend workflow state."
                  : healthy
                    ? "This customer has no warnings in the current response."
                    : "Review the customer record before taking support action."}
              </p>
            </div>
          </div>
        </div>
        {recommendedActionButton}
      </DetailPanel>

      <DetailPanel
        icon={<Activity className="size-4" />}
        title="Activity trail"
      >
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <ReceiptText className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium text-foreground">Last order</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.orderSummary.lastOrderAt)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <MessageSquarePlus className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium text-foreground">Last note</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.noteSummary.lastNoteAt)}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Clock3 className="mt-0.5 size-4 text-muted" />
            <p>
              <span className="font-medium text-foreground">Last login</span>
              <br />
              <span className="text-xs text-muted">
                {formatDateSafe(customer.lastLoginAt)}
              </span>
            </p>
          </div>
        </div>
      </DetailPanel>
    </aside>
  );
}

function CustomerSignalsPanel({ customer }: { customer: AdminCustomerDetail }) {
  const warnings = visibleWarnings(customer.warnings);
  const availableActions = visibleAvailableActions(customer.availableActions);
  const nextRecommendedAction = visibleRecommendedAction(customer);

  return (
    <DetailPanel
      description="Backend warnings and operational metadata."
      icon={<ShieldAlert className="size-4" />}
      title="Signals"
    >
      {warnings.length ? (
        <div className="flex flex-wrap gap-2">
          {warnings.map((warning) => (
            <Badge key={warning} tone="warning">
              {signalLabel(warning)}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="rounded-[0.75rem] border border-success/20 bg-success/10 p-3 text-sm text-success">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4" />
            <p className="font-medium">
              No warning signals in the current response.
            </p>
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DetailField
          label="Available actions"
          value={
            availableActions.length
              ? availableActions.map(humanizeCode).join(", ")
              : null
          }
        />
        <DetailField
          label="Next action"
          value={
            nextRecommendedAction ? humanizeCode(nextRecommendedAction) : null
          }
        />
        <DetailField label="User status" value={customer.userStatus} />
        {featureFlags.customerWallet ? (
          <DetailField
            label="Wallet provider"
            value={customer.walletSummary.providerStatus}
          />
        ) : null}
      </div>
    </DetailPanel>
  );
}

function TableToolbar({
  actionNode,
  count,
  description,
  icon,
  title,
}: {
  actionNode?: ReactNode;
  count: number;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <Badge tone="neutral">{count}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
      {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
    </div>
  );
}

export function CustomerDetailPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreditWallet = usePermission("customers:wallet_credit");
  const canUpdateCustomer = usePermission("customers:update");
  const canReadOrders = usePermission("orders:read");
  const canReadVendors = usePermission("vendors:read");
  const canUpdateOrders = usePermission("orders:update_status");
  const canReadPayments = usePermission("payments:read");
  const canReconcilePayments = usePermission("payments:reconcile");
  const canRefundPayments = usePermission("payments:refund");
  const [actionError, setActionError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedAddressAction, setSelectedAddressAction] =
    useState<CustomerAddressActionSelection | null>(null);
  const [selectedOrderAction, setSelectedOrderAction] =
    useState<CustomerOrderActionTarget | null>(null);
  const [selectedPaymentAction, setSelectedPaymentAction] =
    useState<PaymentActionSelection | null>(null);
  const [selectedAction, setSelectedAction] =
    useState<CustomerActionSelection | null>(null);

  const customerQuery = useQuery({
    enabled: Boolean(customerId),
    queryKey: ["customer-detail", customerId],
    queryFn: () => customerService.getCustomerById(customerId as string),
  });

  const customer = customerQuery.data?.data;

  const ordersQuery = useQuery({
    enabled: Boolean(customerId) && canReadOrders,
    queryKey: ["customer-orders", customerId],
    queryFn: () =>
      orderService.getCustomerOrders(customerId as string, {
        page: 1,
        limit: 20,
      }),
  });

  const customerOrders = ordersQuery.data;

  const relatedVendorsQuery = useQuery({
    enabled: Boolean(customerId),
    queryKey: ["customer-related-vendors", customerId],
    queryFn: () =>
      customerService.getCustomerRelatedVendors(customerId as string, {
        page: 1,
        limit: 20,
      }),
  });

  const customerRelatedVendors = relatedVendorsQuery.data;

  const paymentsQuery = useQuery({
    enabled: Boolean(customerId) && canReadPayments,
    queryKey: ["customer-payments", customerId],
    queryFn: () =>
      paymentService.getCustomerPayments(customerId as string, {
        page: 1,
        limit: 20,
      }),
  });

  const refundsQuery = useQuery({
    enabled: Boolean(customerId) && canReadPayments,
    queryKey: ["customer-refunds", customerId],
    queryFn: () =>
      paymentService.getCustomerRefunds(customerId as string, {
        page: 1,
        limit: 20,
      }),
  });

  const refreshCustomer = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["customer-detail", customerId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-orders", customerId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-related-vendors", customerId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-payments", customerId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-refunds", customerId],
      }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: CustomerActionSelection;
      values: CustomerActionFormValues;
    }) => {
      if (!customer) {
        throw new Error("Customer details are unavailable.");
      }

      if (action.kind === "ADD_NOTE") {
        if (!values.note) {
          throw new Error("Internal note is required.");
        }

        return customerService.addCustomerNote(customer.customerId, {
          note: values.note,
        });
      }

      if (action.kind === "BLOCK") {
        if (!values.reason) {
          throw new Error("Block reason is required.");
        }

        return customerService.blockCustomer(customer.customerId, {
          reason: values.reason,
        });
      }

      if (action.kind === "UNBLOCK") {
        if (!values.reason) {
          throw new Error("Unblock reason is required.");
        }

        return customerService.unblockCustomer(customer.customerId, {
          reason: values.reason,
        });
      }

      if (action.kind === "WALLET_CREDIT") {
        if (!featureFlags.customerWallet) {
          throw new Error("Wallet credit is currently disabled.");
        }

        if (!values.reason) {
          throw new Error("Wallet credit reason is required.");
        }

        if (!values.amountPaise) {
          throw new Error("Wallet credit amount is required.");
        }

        return customerService.creditCustomerWallet(customer.customerId, {
          amountPaise: values.amountPaise,
          currency: values.currency,
          reason: values.reason,
          referenceId: values.referenceId,
        });
      }

      throw new Error("Unsupported customer action.");
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null);
      void refreshCustomer();
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "Customer action failed.",
      );
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (values: CustomerProfileUpdatePayload) => {
      if (!customer) {
        throw new Error("Customer details are unavailable.");
      }

      return customerService.updateCustomerProfile(customer.customerId, values);
    },
    onMutate: () => setProfileError(null),
    onSuccess: () => {
      setIsProfileEditorOpen(false);
      void refreshCustomer();
    },
    onError: (error) => {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Customer profile update failed.",
      );
    },
  });

  const addressMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: CustomerAddressActionSelection;
      values: CustomerAddressPayload | CustomerAddressReasonPayload;
    }) => {
      if (!customer) {
        throw new Error("Customer details are unavailable.");
      }

      if (action.kind === "CREATE") {
        return customerService.createCustomerAddress(
          customer.customerId,
          values as CustomerAddressPayload,
        );
      }

      if (!action.address) {
        throw new Error("Customer address is unavailable.");
      }

      if (action.kind === "EDIT") {
        return customerService.updateCustomerAddress(
          customer.customerId,
          action.address.addressId,
          values as CustomerAddressPayload,
        );
      }

      if (action.kind === "SET_DEFAULT") {
        return customerService.setDefaultCustomerAddress(
          customer.customerId,
          action.address.addressId,
          values as CustomerAddressReasonPayload,
        );
      }

      if (action.kind === "DELETE") {
        return customerService.deleteCustomerAddress(
          customer.customerId,
          action.address.addressId,
          values as CustomerAddressReasonPayload,
        );
      }

      throw new Error("Unsupported customer address action.");
    },
    onMutate: () => setAddressError(null),
    onSuccess: () => {
      setSelectedAddressAction(null);
      void refreshCustomer();
    },
    onError: (error) => {
      setAddressError(
        error instanceof Error
          ? error.message
          : "Customer address action failed.",
      );
    },
  });

  const orderMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: CustomerOrderActionTarget;
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

      throw new Error("Unsupported order action from customer detail.");
    },
    onMutate: () => setOrderError(null),
    onSuccess: (_response, variables) => {
      setSelectedOrderAction(null);
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customer-orders", customerId],
        }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["order-detail", variables.target.order.orderId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer-detail", customerId],
        }),
      ]);
    },
    onError: (error) => {
      setOrderError(
        error instanceof Error ? error.message : "Order action failed.",
      );
    },
  });

  const financeMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PaymentActionSelection;
      values: PaymentActionFormValues;
    }) => {
      if (action.kind === "RECONCILE_PAYMENT") {
        return paymentService.reconcilePayment(action.payment.paymentId, {
          reason: values.reason,
        });
      }

      if (action.kind === "APPROVE_REFUND") {
        if (!values.reason) {
          throw new Error("Approval reason is required.");
        }

        return paymentService.approveRefund(action.refund.refundId, {
          processImmediately: values.processImmediately,
          reason: values.reason,
        });
      }

      if (action.kind === "REJECT_REFUND") {
        if (!values.reason) {
          throw new Error("Rejection reason is required.");
        }

        return paymentService.rejectRefund(action.refund.refundId, {
          reason: values.reason,
        });
      }

      throw new Error("Unsupported finance action from customer detail.");
    },
    onMutate: () => setFinanceError(null),
    onSuccess: (_response, variables) => {
      setSelectedPaymentAction(null);
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customer-payments", customerId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer-refunds", customerId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer-orders", customerId],
        }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["refunds"] }),
      ]);

      if (variables.action.kind === "RECONCILE_PAYMENT") {
        void queryClient.invalidateQueries({
          queryKey: ["payment-detail", variables.action.payment.paymentId],
        });
      }

      if (
        variables.action.kind === "APPROVE_REFUND" ||
        variables.action.kind === "REJECT_REFUND"
      ) {
        void queryClient.invalidateQueries({
          queryKey: ["refund-detail", variables.action.refund.refundId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["payment-detail", variables.action.refund.paymentId],
        });
      }
    },
    onError: (error) => {
      setFinanceError(
        error instanceof Error ? error.message : "Finance action failed.",
      );
    },
  });

  const isSubmitting =
    actionMutation.isPending ||
    profileMutation.isPending ||
    addressMutation.isPending ||
    orderMutation.isPending ||
    financeMutation.isPending;

  const openProfileEditor = () => {
    setActionError(null);
    setAddressError(null);
    setFinanceError(null);
    setProfileError(null);
    setIsProfileEditorOpen(true);
  };

  const openAction = (kind: CustomerActionKind) => {
    setActionError(null);
    setAddressError(null);
    setFinanceError(null);
    setProfileError(null);
    setSelectedAction({ kind });
  };

  const openAddressAction = (
    kind: CustomerAddressActionSelection["kind"],
    address?: AdminCustomerAddress,
  ) => {
    setActionError(null);
    setAddressError(null);
    setFinanceError(null);
    setProfileError(null);
    setSelectedAddressAction({ kind, address });
  };

  const openOrderAction = (
    order: AdminOrderSummary,
    action: OrderActionSelection,
  ) => {
    setActionError(null);
    setAddressError(null);
    setFinanceError(null);
    setOrderError(null);
    setProfileError(null);
    setSelectedOrderAction({ order, action });
  };

  const openFinanceAction = (action: PaymentActionSelection) => {
    setActionError(null);
    setAddressError(null);
    setFinanceError(null);
    setOrderError(null);
    setProfileError(null);
    setSelectedPaymentAction(action);
  };

  const submitAction = (values: CustomerActionFormValues) => {
    if (!selectedAction) {
      return;
    }

    void actionMutation.mutateAsync({
      action: selectedAction,
      values,
    });
  };

  const submitProfileUpdate = (values: CustomerProfileUpdatePayload) => {
    void profileMutation.mutateAsync(values);
  };

  const submitAddressAction = (
    values: CustomerAddressPayload | CustomerAddressReasonPayload,
  ) => {
    if (!selectedAddressAction) {
      return;
    }

    void addressMutation.mutateAsync({
      action: selectedAddressAction,
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

  const submitFinanceAction = (values: PaymentActionFormValues) => {
    if (!selectedPaymentAction) {
      return;
    }

    void financeMutation.mutateAsync({
      action: selectedPaymentAction,
      values,
    });
  };

  if (!customerId) {
    return (
      <PageContainer>
        <ErrorState
          description="The customer route is missing a customer id."
          title="Customer not found"
        />
      </PageContainer>
    );
  }

  if (customerQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[28rem] w-full" />
      </PageContainer>
    );
  }

  if (customerQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this customer. Please retry."
          title="Customer unavailable"
          onRetry={() => void customerQuery.refetch()}
        />
      </PageContainer>
    );
  }

  if (!customer) {
    return (
      <PageContainer>
        <EmptyState
          description="The customer detail API returned no customer data."
          title="Customer not found"
        />
      </PageContainer>
    );
  }

  const health = customerHealth(customer);
  const canManageAddresses =
    canUpdateCustomer &&
    visibleAvailableActions(customer.availableActions).includes(
      "MANAGE_ADDRESSES",
    );
  const orderRows = canReadOrders ? (customerOrders?.data ?? []) : [];
  const orderSummary = customerOrders?.summary;
  const orderSummaryTone: CustomerTone = canReadOrders
    ? getOrderSummaryTone(orderSummary)
    : "neutral";
  const relatedVendorRows = customerRelatedVendors?.data ?? [];
  const relatedVendorSummary = customerRelatedVendors?.summary;
  const paymentRows = canReadPayments ? (paymentsQuery.data?.data ?? []) : [];
  const refundRows = canReadPayments ? (refundsQuery.data?.data ?? []) : [];
  const paymentSummary = paymentsQuery.data?.summary;
  const refundSummary = refundsQuery.data?.summary;
  const financeReviewCount =
    (paymentSummary?.pending ?? 0) +
    (paymentSummary?.failed ?? 0) +
    (refundSummary?.pendingReview ?? 0);

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <CustomerHeaderActions
            canCreditWallet={canCreditWallet}
            canUpdateCustomer={canUpdateCustomer}
            customer={customer}
            isSubmitting={isSubmitting}
            onEditProfile={openProfileEditor}
            onSelectAction={openAction}
          />
        }
        description={customer.email ?? customer.mobileNumber ?? customer.userId}
        listHref={routePaths.customers}
        listLabel="Customers"
        recordName={customer.fullName}
        titleMetaNode={<CustomerHeaderStatus customer={customer} />}
      />

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <DetailMetricCard
          icon={<Activity className="size-4" />}
          label="Health"
          meta={
            customerNeedsAttention(customer)
              ? "Review warning signals"
              : "No active warnings"
          }
          tone={health >= 80 ? "success" : health >= 55 ? "warning" : "danger"}
          value={String(health)}
        />
        <DetailMetricCard
          icon={<ReceiptText className="size-4" />}
          label="Orders"
          meta={`${customer.orderSummary.activeOrders} active orders`}
          tone={customer.orderSummary.activeOrders ? "warning" : "neutral"}
          value={String(customer.orderSummary.totalOrders)}
        />
        {featureFlags.customerWallet ? (
          <DetailMetricCard
            icon={<CreditCard className="size-4" />}
            label="Wallet credit"
            meta={customer.walletSummary.providerStatus}
            tone={
              customer.walletSummary.creditBalancePaise > 0 ? "info" : "neutral"
            }
            value={formatPaise(customer.walletSummary.creditBalancePaise)}
          />
        ) : null}
        <DetailMetricCard
          icon={<MessageSquarePlus className="size-4" />}
          label="Notes"
          meta={`Last note: ${formatDateSafe(customer.noteSummary.lastNoteAt)}`}
          tone={customer.noteSummary.totalNotes ? "info" : "neutral"}
          value={String(customer.noteSummary.totalNotes)}
        />
      </section>

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <CustomerIdentityPanel customer={customer} />

          <div className="grid gap-3 lg:grid-cols-2">
            <DetailPanel
              icon={<CalendarClock className="size-4" />}
              title="Lifecycle"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Customer ID" value={customer.customerId} />
                <DetailField label="User ID" value={customer.userId} />
                <DetailField
                  label="Last login"
                  value={formatDateSafe(customer.lastLoginAt)}
                />
                <DetailField
                  label="Created"
                  value={formatDateSafe(customer.createdAt)}
                />
                <DetailField
                  label="Updated"
                  value={formatDateSafe(customer.updatedAt)}
                />
                <DetailField
                  label="Lifetime spend"
                  value={formatPaise(customer.orderSummary.lifetimeSpendPaise)}
                />
              </div>
            </DetailPanel>

            <CustomerSignalsPanel customer={customer} />
          </div>

          <div id="orders" className="scroll-mt-24 space-y-3">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <DetailMetricCard
                icon={<ReceiptText className="size-4" />}
                label="Orders"
                meta={
                  canReadOrders
                    ? `${orderSummary?.delivered ?? 0} delivered · ${orderSummary?.cancelled ?? 0} cancelled`
                    : "Orders permission required"
                }
                tone={orderSummaryTone}
                value={
                  canReadOrders ? String(orderSummary?.total ?? 0) : "Locked"
                }
              />
              <DetailMetricCard
                icon={<Package className="size-4" />}
                label="Active Orders"
                meta="Current customer workload"
                tone={(orderSummary?.active ?? 0) > 0 ? "info" : "neutral"}
                value={
                  canReadOrders ? String(orderSummary?.active ?? 0) : "Locked"
                }
              />
              <DetailMetricCard
                icon={<CreditCard className="size-4" />}
                label="Payment Review"
                meta="Pending, failed, or COD work"
                tone={
                  !canReadOrders
                    ? "neutral"
                    : (orderSummary?.paymentReview ?? 0) > 0
                      ? "warning"
                      : "success"
                }
                value={
                  canReadOrders
                    ? String(orderSummary?.paymentReview ?? 0)
                    : "Locked"
                }
              />
              <DetailMetricCard
                icon={<AlertTriangle className="size-4" />}
                label="Order Value"
                meta={
                  canReadOrders
                    ? `${orderSummary?.needsAttention ?? 0} need attention`
                    : "Orders permission required"
                }
                tone={
                  !canReadOrders
                    ? "neutral"
                    : (orderSummary?.needsAttention ?? 0) > 0
                      ? "warning"
                      : "info"
                }
                value={
                  canReadOrders
                    ? formatPaise(
                        orderSummary?.totalValuePaise,
                        orderSummary?.currency,
                      )
                    : "Locked"
                }
              />
            </div>

            <DynamicTable
              actionColumnLabel="Order Actions"
              actionColumnMinWidth={360}
              bodyMaxHeight={390}
              columns={orderColumns}
              data={orderRows}
              emptyDescription={
                canReadOrders
                  ? "This customer does not have orders yet."
                  : "Your role does not include orders:read."
              }
              emptyTitle={canReadOrders ? "No orders" : "Orders unavailable"}
              error={
                ordersQuery.isError
                  ? "We could not load this customer order history."
                  : false
              }
              getRowId={(row) => row.orderId}
              inlineActionLimit={2}
              loading={canReadOrders && ordersQuery.isLoading}
              stickyHeader
              title="Customer orders"
              toolbar={
                <TableToolbar
                  actionNode={
                    canReadOrders ? (
                      <Button
                        disabled={ordersQuery.isFetching}
                        size="sm"
                        variant="secondary"
                        onClick={() => void ordersQuery.refetch()}
                      >
                        <RotateCcw className="mr-2 size-4" />
                        Refresh
                      </Button>
                    ) : null
                  }
                  count={canReadOrders ? (orderSummary?.total ?? 0) : 0}
                  description="Customer order history with payment, logistics, warnings, and allowed admin actions."
                  icon={<ReceiptText className="size-4" />}
                  title="Customer orders"
                />
              }
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
                      recommendedAction?.kind === "CANCEL"
                        ? "danger"
                        : "primary",
                  },
                  {
                    icon: <MessageSquarePlus className="size-4" />,
                    isDisabled: orderMutation.isPending,
                    isVisible:
                      canUpdateOrders && hasOrderAction(order, "ADD_NOTE"),
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
                      openOrderAction(order, {
                        kind: "GENERATE_DELIVERY_OTP",
                      }),
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
                      openOrderAction(order, {
                        kind: "CONFIRM_DELIVERY_OTP",
                      }),
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
              onRetry={() => void ordersQuery.refetch()}
              onRowClick={(row) =>
                navigate(`${routePaths.orders}/${row.orderId}`)
              }
            />
          </div>

          <div id="related-vendors" className="scroll-mt-24 space-y-3">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <DetailMetricCard
                icon={<Store className="size-4" />}
                label="Related Vendors"
                meta={`${relatedVendorSummary?.saved ?? 0} saved · ${
                  relatedVendorSummary?.ordered ?? 0
                } ordered`}
                tone={(relatedVendorSummary?.total ?? 0) > 0 ? "info" : "neutral"}
                value={String(relatedVendorSummary?.total ?? 0)}
              />
              <DetailMetricCard
                icon={<CheckCircle2 className="size-4" />}
                label="Saved + Ordered"
                meta="Preference and order relationship"
                tone={
                  (relatedVendorSummary?.savedAndOrdered ?? 0) > 0
                    ? "success"
                    : "neutral"
                }
                value={String(relatedVendorSummary?.savedAndOrdered ?? 0)}
              />
              <DetailMetricCard
                icon={<Package className="size-4" />}
                label="Vendor Active Orders"
                meta="Open work across related vendors"
                tone={
                  (relatedVendorSummary?.activeOrders ?? 0) > 0
                    ? "warning"
                    : "neutral"
                }
                value={String(relatedVendorSummary?.activeOrders ?? 0)}
              />
              <DetailMetricCard
                icon={<AlertTriangle className="size-4" />}
                label="Vendor Visibility"
                meta={`${relatedVendorSummary?.inactiveOrBlockedVendors ?? 0} inactive or blocked`}
                tone={
                  (relatedVendorSummary?.inactiveOrBlockedVendors ?? 0) > 0
                    ? "warning"
                    : "success"
                }
                value={formatPaise(
                  relatedVendorSummary?.totalOrderValuePaise,
                  relatedVendorSummary?.currency,
                )}
              />
            </div>

            <DynamicTable
              actionColumnLabel="Vendor Actions"
              actionColumnMinWidth={260}
              bodyMaxHeight={360}
              columns={relatedVendorColumns}
              data={relatedVendorRows}
              emptyDescription="This customer has not saved vendors or ordered from vendors yet."
              emptyTitle="No related vendors"
              error={
                relatedVendorsQuery.isError
                  ? "We could not load this customer's related vendors."
                  : false
              }
              getRowId={(row) => row.vendor.vendorId}
              inlineActionLimit={2}
              loading={relatedVendorsQuery.isLoading}
              stickyHeader
              title="Related vendors"
              toolbar={
                <TableToolbar
                  actionNode={
                    <Button
                      disabled={relatedVendorsQuery.isFetching}
                      size="sm"
                      variant="secondary"
                      onClick={() => void relatedVendorsQuery.refetch()}
                    >
                      <RotateCcw className="mr-2 size-4" />
                      Refresh
                    </Button>
                  }
                  count={relatedVendorSummary?.total ?? 0}
                  description="Saved vendors and vendors this customer has ordered from, with order context and visibility signals."
                  icon={<Store className="size-4" />}
                  title="Related vendors"
                />
              }
              rowActions={
                canReadVendors || canReadOrders
                  ? (row) => [
                      {
                        icon: <ArrowUpRight className="size-4" />,
                        isVisible: canReadVendors,
                        key: "open-vendor",
                        label: "Open Vendor",
                        onClick: () =>
                          navigate(
                            `${routePaths.vendors}/${row.vendor.vendorId}`,
                          ),
                        variant: "ghost",
                      },
                      {
                        icon: <ReceiptText className="size-4" />,
                        isVisible:
                          canReadOrders &&
                          Boolean(row.orderSummary.latestOrder),
                        key: "open-latest-order",
                        label: "Latest Order",
                        onClick: () => {
                          if (row.orderSummary.latestOrder) {
                            navigate(
                              `${routePaths.orders}/${row.orderSummary.latestOrder.orderId}`,
                            );
                          }
                        },
                        placement: "menu",
                        variant: "ghost",
                      },
                    ]
                  : undefined
              }
              onRetry={() => void relatedVendorsQuery.refetch()}
              onRowClick={
                canReadVendors
                  ? (row) => navigate(`${routePaths.vendors}/${row.vendor.vendorId}`)
                  : undefined
              }
            />
          </div>

          <div id="finance" className="scroll-mt-24 space-y-3">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <DetailMetricCard
                icon={<CreditCard className="size-4" />}
                label="Payments"
                meta={
                  canReadPayments
                    ? `${paymentSummary?.successful ?? 0} successful · ${paymentSummary?.failed ?? 0} failed`
                    : "Payments permission required"
                }
                tone={
                  !canReadPayments
                    ? "neutral"
                    : (paymentSummary?.failed ?? 0) > 0
                      ? "warning"
                      : "success"
                }
                value={
                  canReadPayments ? String(paymentSummary?.total ?? 0) : "Locked"
                }
              />
              <DetailMetricCard
                icon={<ShieldCheck className="size-4" />}
                label="Successful Value"
                meta="Settled payment value"
                tone="success"
                value={
                  canReadPayments
                    ? formatPaise(
                        paymentSummary?.successfulAmountPaise,
                        paymentSummary?.currency,
                      )
                    : "Locked"
                }
              />
              <DetailMetricCard
                icon={<RotateCcw className="size-4" />}
                label="Refunds"
                meta={
                  canReadPayments
                    ? `${refundSummary?.requested ?? 0} requested · ${refundSummary?.successful ?? 0} successful`
                    : "Payments permission required"
                }
                tone={
                  !canReadPayments
                    ? "neutral"
                    : (refundSummary?.pendingReview ?? 0) > 0
                      ? "warning"
                      : "info"
                }
                value={
                  canReadPayments ? String(refundSummary?.total ?? 0) : "Locked"
                }
              />
              <DetailMetricCard
                icon={<AlertTriangle className="size-4" />}
                label="Finance Review"
                meta="Pending payments, failed payments, refund review"
                tone={
                  !canReadPayments
                    ? "neutral"
                    : financeReviewCount > 0
                      ? "warning"
                      : "success"
                }
                value={canReadPayments ? String(financeReviewCount) : "Locked"}
              />
            </div>

            <div className="grid gap-3 2xl:grid-cols-2">
              <DynamicTable
                actionColumnLabel="Payment Actions"
                actionColumnMinWidth={280}
                bodyMaxHeight={340}
                columns={paymentColumns}
                data={paymentRows}
                emptyDescription={
                  canReadPayments
                    ? "This customer does not have payment records yet."
                    : "Your role does not include payments:read."
                }
                emptyTitle={
                  canReadPayments ? "No payments" : "Payments unavailable"
                }
                error={
                  paymentsQuery.isError
                    ? "We could not load this customer payment history."
                    : false
                }
                getRowId={(row) => row.paymentId}
                inlineActionLimit={2}
                loading={canReadPayments && paymentsQuery.isLoading}
                stickyHeader
                title="Customer payments"
                toolbar={
                  <TableToolbar
                    actionNode={
                      canReadPayments ? (
                        <Button
                          disabled={paymentsQuery.isFetching}
                          size="sm"
                          variant="secondary"
                          onClick={() => void paymentsQuery.refetch()}
                        >
                          <RotateCcw className="mr-2 size-4" />
                          Refresh
                        </Button>
                      ) : null
                    }
                    count={canReadPayments ? (paymentSummary?.total ?? 0) : 0}
                    description="Customer payment history with refund state and allowed finance actions."
                    icon={<CreditCard className="size-4" />}
                    title="Customer payments"
                  />
                }
                rowActions={(payment) => [
                  {
                    icon: <RotateCcw className="size-4" />,
                    isDisabled: financeMutation.isPending,
                    isVisible:
                      canReconcilePayments &&
                      hasPaymentAction(payment, "RECONCILE"),
                    key: "reconcile-payment",
                    label: "Reconcile",
                    onClick: () =>
                      openFinanceAction({
                        kind: "RECONCILE_PAYMENT",
                        payment,
                      }),
                    variant: "secondary",
                  },
                  {
                    icon: <ArrowUpRight className="size-4" />,
                    isDisabled: financeMutation.isPending,
                    key: "open-payment",
                    label: "Open",
                    onClick: () =>
                      navigate(`${routePaths.payments}/${payment.paymentId}`),
                    placement: "menu",
                    variant: "ghost",
                  },
                ]}
                onRetry={() => void paymentsQuery.refetch()}
                onRowClick={(row) =>
                  navigate(`${routePaths.payments}/${row.paymentId}`)
                }
              />

              <DynamicTable
                actionColumnLabel="Refund Actions"
                actionColumnMinWidth={300}
                bodyMaxHeight={340}
                columns={refundColumns}
                data={refundRows}
                emptyDescription={
                  canReadPayments
                    ? "This customer does not have refund records yet."
                    : "Your role does not include payments:read."
                }
                emptyTitle={
                  canReadPayments ? "No refunds" : "Refunds unavailable"
                }
                error={
                  refundsQuery.isError
                    ? "We could not load this customer refund history."
                    : false
                }
                getRowId={(row) => row.refundId}
                inlineActionLimit={2}
                loading={canReadPayments && refundsQuery.isLoading}
                stickyHeader
                title="Customer refunds"
                toolbar={
                  <TableToolbar
                    actionNode={
                      canReadPayments ? (
                        <Button
                          disabled={refundsQuery.isFetching}
                          size="sm"
                          variant="secondary"
                          onClick={() => void refundsQuery.refetch()}
                        >
                          <RotateCcw className="mr-2 size-4" />
                          Refresh
                        </Button>
                      ) : null
                    }
                    count={canReadPayments ? (refundSummary?.total ?? 0) : 0}
                    description="Refund queue and history for this customer."
                    icon={<RotateCcw className="size-4" />}
                    title="Customer refunds"
                  />
                }
                rowActions={(refund) => [
                  {
                    icon: <CheckCircle2 className="size-4" />,
                    isDisabled: financeMutation.isPending,
                    isVisible:
                      canRefundPayments && hasRefundAction(refund, "APPROVE"),
                    key: "approve-refund",
                    label: "Approve",
                    onClick: () =>
                      openFinanceAction({
                        kind: "APPROVE_REFUND",
                        refund,
                      }),
                    variant: "primary",
                  },
                  {
                    icon: <XCircle className="size-4" />,
                    isDisabled: financeMutation.isPending,
                    isVisible:
                      canRefundPayments && hasRefundAction(refund, "REJECT"),
                    key: "reject-refund",
                    label: "Reject",
                    onClick: () =>
                      openFinanceAction({
                        kind: "REJECT_REFUND",
                        refund,
                      }),
                    variant: "danger",
                  },
                  {
                    icon: <ArrowUpRight className="size-4" />,
                    isDisabled: financeMutation.isPending,
                    key: "open-refund",
                    label: "Open",
                    onClick: () =>
                      navigate(`${routePaths.refunds}/${refund.refundId}`),
                    placement: "menu",
                    variant: "ghost",
                  },
                ]}
                onRetry={() => void refundsQuery.refetch()}
                onRowClick={(row) =>
                  navigate(`${routePaths.refunds}/${row.refundId}`)
                }
              />
            </div>
          </div>

          <div id="addresses" className="scroll-mt-24">
            <DynamicTable
              actionColumnMinWidth={260}
              bodyMaxHeight={280}
              columns={addressColumns}
              data={customer.addresses}
              emptyDescription="No addresses were returned for this customer."
              emptyTitle="No addresses"
              getRowId={(row) => row.addressId}
              stickyHeader
              title="Addresses"
              rowActions={
                canManageAddresses
                  ? (row) => [
                      {
                        key: "edit",
                        label: "Edit",
                        icon: <Edit3 className="size-4" />,
                        onClick: () => openAddressAction("EDIT", row),
                      },
                      {
                        key: "default",
                        label: "Default",
                        icon: <Star className="size-4" />,
                        isVisible: !row.isDefault,
                        onClick: () => openAddressAction("SET_DEFAULT", row),
                      },
                      {
                        key: "delete",
                        label: "Delete",
                        icon: <Trash2 className="size-4" />,
                        placement: "menu",
                        variant: "danger",
                        onClick: () => openAddressAction("DELETE", row),
                      },
                    ]
                  : undefined
              }
              toolbar={
                <TableToolbar
                  actionNode={
                    canManageAddresses ? (
                      <Button
                        disabled={isSubmitting}
                        size="sm"
                        variant="secondary"
                        onClick={() => openAddressAction("CREATE")}
                      >
                        <Plus className="mr-2 size-4" />
                        Add Address
                      </Button>
                    ) : null
                  }
                  count={customer.addresses.length}
                  description="Saved service addresses and zone mapping."
                  icon={<MapPin className="size-4" />}
                  title="Addresses"
                />
              }
            />
          </div>

          <div
            className={cn(
              "grid gap-3",
              featureFlags.customerWallet && "2xl:grid-cols-2",
            )}
          >
            {featureFlags.customerWallet ? (
              <div id="wallet-credits" className="scroll-mt-24">
                <DynamicTable
                  bodyMaxHeight={260}
                  columns={walletCreditColumns}
                  data={customer.walletCredits}
                  emptyDescription="No wallet credits were returned for this customer."
                  emptyTitle="No wallet credits"
                  getRowId={(row) => row.walletCreditId}
                  stickyHeader
                  title="Wallet credits"
                  toolbar={
                    <TableToolbar
                      count={customer.walletCredits.length}
                      description="Credit adjustments and wallet state."
                      icon={<CreditCard className="size-4" />}
                      title="Wallet credits"
                    />
                  }
                />
              </div>
            ) : null}

            <div id="notes" className="scroll-mt-24">
              <DynamicTable
                bodyMaxHeight={260}
                columns={noteColumns}
                data={customer.notes}
                emptyDescription="No internal notes were returned for this customer."
                emptyTitle="No notes"
                getRowId={(row) => row.noteId}
                stickyHeader
                title="Internal notes"
                toolbar={
                  <TableToolbar
                    count={customer.notes.length}
                    description="Internal support notes for admin follow-up."
                    icon={<MessageSquarePlus className="size-4" />}
                    title="Internal notes"
                  />
                }
              />
            </div>
          </div>
        </div>

        <CustomerActionRail
          canCreditWallet={canCreditWallet}
          canUpdateCustomer={canUpdateCustomer}
          customer={customer}
          isSubmitting={isSubmitting}
          onEditProfile={openProfileEditor}
          onSelectAction={openAction}
        />
      </section>

      {isProfileEditorOpen ? (
        <CustomerProfileEditModal
          customer={customer}
          error={profileError}
          isSubmitting={profileMutation.isPending}
          onClose={() => {
            if (!profileMutation.isPending) {
              setIsProfileEditorOpen(false);
              setProfileError(null);
            }
          }}
          onSubmit={submitProfileUpdate}
        />
      ) : null}

      <CustomerAddressActionModal
        action={selectedAddressAction}
        customer={customer}
        error={addressError}
        isSubmitting={addressMutation.isPending}
        key={
          selectedAddressAction
            ? `${selectedAddressAction.kind}-${selectedAddressAction.address?.addressId ?? "new"}`
            : "closed"
        }
        onClose={() => {
          if (!addressMutation.isPending) {
            setSelectedAddressAction(null);
            setAddressError(null);
          }
        }}
        onSubmit={submitAddressAction}
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

      <PaymentActionModal
        action={selectedPaymentAction}
        error={financeError}
        isSubmitting={financeMutation.isPending}
        key={
          selectedPaymentAction
            ? `${selectedPaymentAction.kind}-${
                selectedPaymentAction.kind === "RECONCILE_PAYMENT"
                  ? selectedPaymentAction.payment.paymentId
                  : selectedPaymentAction.refund.refundId
              }`
            : "closed"
        }
        onClose={() => {
          if (!financeMutation.isPending) {
            setSelectedPaymentAction(null);
            setFinanceError(null);
          }
        }}
        onSubmit={submitFinanceAction}
      />

      <CustomerActionModal
        action={selectedAction}
        customer={customer}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={
          selectedAction
            ? `${selectedAction.kind}-${customer.customerId}`
            : "closed"
        }
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null);
            setActionError(null);
          }
        }}
        onSubmit={submitAction}
      />
    </PageContainer>
  );
}
