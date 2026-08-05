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
  Truck,
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
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from "../../../components/layout/DetailPageHeader";
import { PageContainer } from "../../../components/layout/PageContainer";
import { featureFlags } from "../../../config/featureFlags";
import { routePaths } from "../../../config/routes";
import { usePermission } from "../../../hooks/usePermission";
import { buildQueryParams } from "../../../utils/buildQueryParams";
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

const customerUpdateActions = new Set([
  "ADD_NOTE",
  "BLOCK",
  "EDIT_PROFILE",
  "MANAGE_ADDRESSES",
  "UNBLOCK",
]);

function canRunCustomerAction({
  action,
  canCreditWallet,
  canUpdateCustomer,
}: {
  action: string;
  canCreditWallet: boolean;
  canUpdateCustomer: boolean;
}) {
  const normalizedAction = action.toUpperCase();

  if (customerUpdateActions.has(normalizedAction)) {
    return canUpdateCustomer;
  }

  if (normalizedAction === "WALLET_CREDIT") {
    return featureFlags.customerWallet && canCreditWallet;
  }

  return false;
}

function permittedAvailableActions(
  actions: string[],
  access: {
    canCreditWallet: boolean;
    canUpdateCustomer: boolean;
  },
) {
  return visibleAvailableActions(actions).filter((action) =>
    canRunCustomerAction({ action, ...access }),
  );
}

function permittedRecommendedAction(
  customer: AdminCustomerDetail,
  access: {
    canCreditWallet: boolean;
    canUpdateCustomer: boolean;
  },
) {
  const nextRecommendedAction = visibleRecommendedAction(customer);

  if (!nextRecommendedAction) return null;

  return canRunCustomerAction({ action: nextRecommendedAction, ...access })
    ? nextRecommendedAction
    : null;
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

function customerAvatarClass(customer: AdminCustomerDetail) {
  if (customer.status === "BLOCKED") {
    return "bg-danger/10 text-danger ring-1 ring-danger/20";
  }

  if (customer.status === "INCOMPLETE") {
    return "bg-warning/10 text-warning ring-1 ring-warning/20";
  }

  return "bg-primary/10 text-primary ring-1 ring-primary/15";
}

function formatOrderCount(value: number) {
  return `${value} ${value === 1 ? "order" : "orders"}`;
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
      <div className="mb-2 flex items-start justify-between gap-3">
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
    <div className="rounded-[0.65rem] border border-border bg-surface-muted/45 p-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
        {icon ? <span className="text-muted">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <p className="mt-1 break-words text-sm font-medium text-foreground">
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
      <Badge tone={statusTone(customer.status)}>{customerStatus}</Badge>
      {showUserStatus ? (
        <Badge tone="neutral">{userStatus}</Badge>
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
  const availableActions = permittedAvailableActions(customer.availableActions, {
    canCreditWallet,
    canUpdateCustomer,
  });
  const hasAction = (action: string) => availableActions.includes(action);

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
      {canUpdateCustomer && hasAction("EDIT_PROFILE") ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="primary"
          onClick={onEditProfile}
        >
          <Edit3 className="mr-2 size-4" />
          Edit
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
          Credit
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
          Note
        </Button>
      ) : null}
    </div>
  );
}

function CustomerHeroCard({
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
  return (
    <section className="rounded-[1rem] border border-border bg-surface p-3 shadow-surface sm:p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div
            className={cn(
              "relative flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold sm:size-20",
              customerAvatarClass(customer),
            )}
          >
            {getInitials(customer.fullName)}
            {customer.status === "ACTIVE" ? (
              <span className="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full border-2 border-surface bg-success text-primary-foreground">
                <CheckCircle2 className="size-3" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                {customer.fullName}
              </h1>
              <CustomerHeaderStatus customer={customer} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">{customer.customerId}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">
                  {customer.email ?? "No email"}
                </span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" />
                <span className="truncate">
                  {customer.mobileNumber ?? "No mobile"}
                </span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">
                  {customer.zone?.zoneName ||
                    customer.city ||
                    customer.zone?.city ||
                    "No location"}
                </span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted">
              <span>Customer since: {formatDateSafe(customer.createdAt)}</span>
              <span>
                Last active:{" "}
                {formatDateSafe(customer.lastLoginAt ?? customer.updatedAt)}
              </span>
            </div>
          </div>
        </div>
        <CustomerHeaderActions
          canCreditWallet={canCreditWallet}
          canUpdateCustomer={canUpdateCustomer}
          customer={customer}
          isSubmitting={isSubmitting}
          onEditProfile={onEditProfile}
          onSelectAction={onSelectAction}
        />
      </div>
    </section>
  );
}

function CustomerSummaryTile({
  hint,
  icon,
  label,
  tone = "neutral",
  value,
}: {
  hint?: string;
  icon: ReactNode;
  label: string;
  tone?: CustomerTone;
  value: string;
}) {
  const toneClassName: Record<CustomerTone, string> = {
    danger: "bg-danger/10 text-danger ring-danger/20",
    info: "bg-primary/10 text-primary ring-primary/15",
    neutral: "bg-surface-muted text-muted ring-border",
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
  };

  return (
    <div className="flex min-h-[4.6rem] min-w-0 items-center gap-3 rounded-[0.75rem] border border-border bg-surface p-3 shadow-surface">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
          toneClassName[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[0.7rem] font-semibold uppercase tracking-normal text-muted">
          {label}
        </p>
        <p className="mt-1 truncate text-base font-semibold text-foreground">
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function CustomerSummaryStrip({
  customer,
}: {
  customer: AdminCustomerDetail;
}) {
  const warningsCount = visibleWarnings(customer.warnings).length;

  return (
    <section
      aria-label="Customer summary"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
    >
      <CustomerSummaryTile
        hint="All orders"
        icon={<ReceiptText className="size-4" />}
        label="Total orders"
        value={String(customer.orderSummary.totalOrders)}
      />
      <CustomerSummaryTile
        hint={formatOrderCount(customer.orderSummary.activeOrders)}
        icon={<Package className="size-4" />}
        label="Active orders"
        tone={customer.orderSummary.activeOrders > 0 ? "warning" : "success"}
        value={String(customer.orderSummary.activeOrders)}
      />
      <CustomerSummaryTile
        icon={<CreditCard className="size-4" />}
        label="Lifetime spend"
        tone="info"
        value={formatPaise(customer.orderSummary.lifetimeSpendPaise)}
      />
      <CustomerSummaryTile
        hint={formatDateSafe(customer.noteSummary.lastNoteAt)}
        icon={<MessageSquarePlus className="size-4" />}
        label="Notes"
        value={String(customer.noteSummary.totalNotes)}
      />
      <CustomerSummaryTile
        icon={<Home className="size-4" />}
        label={featureFlags.customerWallet ? "Wallet credit" : "Addresses"}
        tone={
          featureFlags.customerWallet &&
          customer.walletSummary.creditBalancePaise > 0
            ? "warning"
            : "neutral"
        }
        value={
          featureFlags.customerWallet
            ? formatPaise(customer.walletSummary.creditBalancePaise)
            : String(customer.addresses.length)
        }
      />
      <CustomerSummaryTile
        hint={customerNeedsAttention(customer) ? "Review needed" : "Clear"}
        icon={
          warningsCount > 0 ? (
            <AlertTriangle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )
        }
        label="Signals"
        tone={warningsCount > 0 ? "warning" : "success"}
        value={String(warningsCount)}
      />
    </section>
  );
}

function CustomerContactPanel({
  customer,
}: {
  customer: AdminCustomerDetail;
}) {
  return (
    <DetailPanel icon={<Phone className="size-4" />} title="Contact">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
    </DetailPanel>
  );
}

function CustomerAccountPanel({
  customer,
}: {
  customer: AdminCustomerDetail;
}) {
  return (
    <DetailPanel icon={<CalendarClock className="size-4" />} title="Account">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <DetailField label="Customer ID" value={customer.customerId} />
        <DetailField label="User ID" value={customer.userId} />
        <DetailField
          label="Last login"
          value={formatDateSafe(customer.lastLoginAt)}
        />
        <DetailField label="Created" value={formatDateSafe(customer.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(customer.updatedAt)} />
        {featureFlags.customerWallet ? (
          <DetailField
            label="Wallet provider"
            value={humanizeCode(customer.walletSummary.providerStatus)}
          />
        ) : null}
      </div>
    </DetailPanel>
  );
}

function CustomerRecentActivityPanel({
  customer,
}: {
  customer: AdminCustomerDetail;
}) {
  const latestOrder = [...customer.recentOrders].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )[0];
  const latestNote = [...customer.notes].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )[0];
  const items = [
    latestOrder
      ? {
          description: `${humanizeCode(latestOrder.orderStatus)} with ${latestOrder.vendor.shopName}`,
          icon: <ReceiptText className="size-3.5" />,
          meta: formatDateSafe(latestOrder.updatedAt),
          title: `Latest order ${latestOrder.publicOrderId}`,
        }
      : null,
    latestNote
      ? {
          description: latestNote.note,
          icon: <MessageSquarePlus className="size-3.5" />,
          meta: formatDateSafe(latestNote.createdAt),
          title: "Latest note",
        }
      : null,
    customer.lastLoginAt
      ? {
          description:
            customer.email ?? customer.mobileNumber ?? customer.customerId,
          icon: <Clock3 className="size-3.5" />,
          meta: formatDateSafe(customer.lastLoginAt),
          title: "Last login",
        }
      : null,
    {
      description: "Profile record updated",
      icon: <Edit3 className="size-3.5" />,
      meta: formatDateSafe(customer.updatedAt),
      title: "Profile updated",
    },
    {
      description: customer.customerId,
      icon: <UserRound className="size-3.5" />,
      meta: formatDateSafe(customer.createdAt),
      title: "Customer created",
    },
  ].filter(Boolean) as {
    description: string;
    icon: ReactNode;
    meta: string;
    title: string;
  }[];

  return (
    <DetailPanel icon={<Activity className="size-4" />} title="Recent activity">
      <div className="relative space-y-3 pl-6 before:absolute before:bottom-2 before:left-[0.55rem] before:top-2 before:w-px before:bg-border">
        {items.slice(0, 5).map((item) => (
          <div className="relative" key={`${item.title}-${item.meta}`}>
            <span className="absolute -left-6 flex size-5 items-center justify-center rounded-full border border-border bg-surface text-primary">
              {item.icon}
            </span>
            <div className="min-w-0 rounded-[0.65rem] border border-border bg-surface-muted/35 p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-foreground">{item.title}</p>
                <span className="text-xs text-muted">{item.meta}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </DetailPanel>
  );
}

function CustomerSignalsPanel({
  canCreditWallet,
  canUpdateCustomer,
  customer,
}: {
  canCreditWallet: boolean;
  canUpdateCustomer: boolean;
  customer: AdminCustomerDetail;
}) {
  const warnings = visibleWarnings(customer.warnings);
  const health = customerHealth(customer);
  const nextRecommendedAction = permittedRecommendedAction(customer, {
    canCreditWallet,
    canUpdateCustomer,
  });

  return (
    <DetailPanel
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
        <Badge tone="success">Clear</Badge>
      )}
      <div className="mt-3 rounded-[0.65rem] border border-border bg-surface-muted/45 p-2.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold uppercase tracking-normal text-muted">
            Health
          </span>
          <span className="font-semibold text-foreground">{health}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-surface">
          <div
            className={cn("h-2 rounded-full", healthColor(health))}
            style={{ width: `${health}%` }}
          />
        </div>
      </div>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <DetailField
          label="Next action"
          value={
            nextRecommendedAction ? humanizeCode(nextRecommendedAction) : null
          }
        />
        <DetailField
          label="User status"
          value={humanizeCode(customer.userStatus)}
        />
        {featureFlags.customerWallet ? (
          <DetailField
            label="Wallet provider"
            value={humanizeCode(customer.walletSummary.providerStatus)}
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
  description?: string;
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
        {description ? (
          <p className="mt-1 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
    </div>
  );
}

function CustomerDetailSectionNav({
  canReadOrders,
  canReadPayments,
  customer,
  orderCount,
  relatedVendorCount,
  paymentCount,
  refundCount,
}: {
  canReadOrders: boolean;
  canReadPayments: boolean;
  customer: AdminCustomerDetail;
  orderCount: number;
  relatedVendorCount: number;
  paymentCount: number;
  refundCount: number;
}) {
  const items = [
    { href: "#overview", label: "Overview" },
    canReadOrders
      ? { href: "#orders", label: "Orders", count: orderCount }
      : null,
    { href: "#related-vendors", label: "Vendors", count: relatedVendorCount },
    canReadPayments
      ? {
          href: "#finance",
          label: "Finance",
          count: paymentCount + refundCount,
        }
      : null,
    { href: "#addresses", label: "Addresses", count: customer.addresses.length },
    { href: "#notes", label: "Notes", count: customer.notes.length },
  ].filter(Boolean) as {
    href: string;
    label: string;
  count?: number;
  }[];
  const [activeHref, setActiveHref] = useState("#overview");

  return (
    <nav
      aria-label="Customer detail sections"
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

  const customerOverviewQuery = useQuery({
    enabled: Boolean(customerId),
    queryKey: ["customer-overview", customerId],
    queryFn: () => customerService.getCustomerOverview(customerId as string),
    staleTime: 30_000,
  });

  const customerOverview = customerOverviewQuery.data?.data;
  const customer = customerOverview?.customer;
  const customerOrders = customerOverview?.sections.orders;
  const customerRelatedVendors = customerOverview?.sections.relatedVendors;
  const customerPayments = customerOverview?.sections.payments;
  const customerRefunds = customerOverview?.sections.refunds;
  const customerQuery = customerOverviewQuery;
  const overviewSectionQueryState = {
    isError: customerOverviewQuery.isError,
    isLoading: customerOverviewQuery.isLoading,
    isFetching: customerOverviewQuery.isFetching,
    refetch: customerOverviewQuery.refetch,
  };
  const ordersQuery = overviewSectionQueryState;
  const relatedVendorsQuery = overviewSectionQueryState;
  const paymentsQuery = overviewSectionQueryState;
  const refundsQuery = overviewSectionQueryState;

  const refreshCustomer = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["customer-overview", customerId],
      }),
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
          queryKey: ["customer-overview", customerId],
        }),
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
          queryKey: ["customer-overview", customerId],
        }),
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
        <DetailPageHeaderSkeleton />
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

  const canManageAddresses =
    canUpdateCustomer &&
    visibleAvailableActions(customer.availableActions).includes(
      "MANAGE_ADDRESSES",
    );
  const orderRows = canReadOrders ? (customerOrders?.data ?? []) : [];
  const orderSummary = customerOrders?.summary;
  const customerLogisticsQuery = buildQueryParams({ customerId });
  const customerLogisticsPath = customerLogisticsQuery
    ? `${routePaths.manualLogistics}?${customerLogisticsQuery}`
    : routePaths.manualLogistics;
  const relatedVendorRows = customerRelatedVendors?.data ?? [];
  const relatedVendorSummary = customerRelatedVendors?.summary;
  const paymentRows = canReadPayments ? (customerPayments?.data ?? []) : [];
  const refundRows = canReadPayments ? (customerRefunds?.data ?? []) : [];
  const paymentSummary = customerPayments?.summary;
  const refundSummary = customerRefunds?.summary;

  return (
    <PageContainer className="!px-3 !py-3 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        listHref={routePaths.customers}
        listLabel="Customers"
        recordName={customer.fullName}
      />

      <CustomerHeroCard
        canCreditWallet={canCreditWallet}
        canUpdateCustomer={canUpdateCustomer}
        customer={customer}
        isSubmitting={isSubmitting}
        onEditProfile={openProfileEditor}
        onSelectAction={openAction}
      />

      <CustomerDetailSectionNav
        canReadOrders={canReadOrders}
        canReadPayments={canReadPayments}
        customer={customer}
        orderCount={canReadOrders ? (orderSummary?.total ?? 0) : 0}
        paymentCount={canReadPayments ? (paymentSummary?.total ?? 0) : 0}
        refundCount={canReadPayments ? (refundSummary?.total ?? 0) : 0}
        relatedVendorCount={relatedVendorSummary?.total ?? 0}
      />

      <section className="space-y-3" id="overview">
        <CustomerSummaryStrip customer={customer} />

        <div className="min-w-0 space-y-3">
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(17rem,0.85fr)_minmax(0,1.15fr)]">
            <div className="space-y-3">
              <CustomerContactPanel customer={customer} />
              <CustomerAccountPanel customer={customer} />
            </div>

            <div className="space-y-3">
              <CustomerSignalsPanel
                canCreditWallet={canCreditWallet}
                canUpdateCustomer={canUpdateCustomer}
                customer={customer}
              />
              <CustomerRecentActivityPanel customer={customer} />
            </div>
          </div>

          {canReadOrders ? (
            <div id="orders" className="scroll-mt-24 space-y-3">
              <DynamicTable
                actionColumnLabel="Order Actions"
                actionColumnMinWidth={360}
                bodyMaxHeight={390}
                columns={orderColumns}
                data={orderRows}
                emptyDescription="No orders yet."
                emptyTitle="No orders"
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(customerLogisticsPath)}
                          >
                            <Truck className="mr-2 size-4" />
                            Logistics
                          </Button>
                          <Button
                            disabled={ordersQuery.isFetching}
                            size="sm"
                            variant="secondary"
                            onClick={() => void ordersQuery.refetch()}
                          >
                            <RotateCcw className="mr-2 size-4" />
                            Refresh
                          </Button>
                        </div>
                      ) : null
                    }
                    count={canReadOrders ? (orderSummary?.total ?? 0) : 0}
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
                      onClick: () =>
                        openOrderAction(order, { kind: "ADD_NOTE" }),
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
                      icon: <Truck className="size-4" />,
                      isDisabled: orderMutation.isPending,
                      key: "open-logistics",
                      label: "Logistics",
                      onClick: () =>
                        navigate(
                          `${routePaths.orders}/${order.orderId}/logistics`,
                        ),
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
          ) : null}

          <div id="related-vendors" className="scroll-mt-24 space-y-3">
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

          {canReadPayments ? (
            <div id="finance" className="scroll-mt-24 space-y-3">
              <div className="grid gap-3 2xl:grid-cols-2">
                <DynamicTable
                actionColumnLabel="Payment Actions"
                actionColumnMinWidth={280}
                bodyMaxHeight={340}
                columns={paymentColumns}
                data={paymentRows}
                emptyDescription="No payment records."
                emptyTitle="No payments"
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
                emptyDescription="No refund records."
                emptyTitle="No refunds"
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
          ) : null}

          <div id="addresses" className="scroll-mt-24">
            <DynamicTable
              actionColumnMinWidth={260}
              bodyMaxHeight={280}
              columns={addressColumns}
              data={customer.addresses}
              emptyDescription="No addresses."
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
                  emptyDescription="No wallet credits."
                  emptyTitle="No wallet credits"
                  getRowId={(row) => row.walletCreditId}
                  stickyHeader
                  title="Wallet credits"
                  toolbar={
                    <TableToolbar
                      count={customer.walletCredits.length}
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
                emptyDescription="No notes."
                emptyTitle="No notes"
                getRowId={(row) => row.noteId}
                stickyHeader
                title="Internal notes"
                toolbar={
                  <TableToolbar
                    count={customer.notes.length}
                    icon={<MessageSquarePlus className="size-4" />}
                    title="Internal notes"
                  />
                }
              />
            </div>
          </div>
        </div>
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
            : "customer-address-action-closed"
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
            : "customer-payment-action-closed"
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
            : "customer-action-closed"
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
