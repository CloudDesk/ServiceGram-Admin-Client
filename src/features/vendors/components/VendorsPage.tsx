import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from "../../../components/ui/Table";
import { PageContainer } from "../../../components/layout/PageContainer";
import { routePaths } from "../../../config/routes";
import { vendorService } from "../services/vendor.service";
import type {
  VendorListItem,
  VendorListQueryParams,
  VendorOnboardingStatus,
  VendorStatus,
} from "../types/vendor.types";

type VendorViewMode = "active" | "onboarding";
const DEFAULT_PAGE_SIZE = 20;

const vendorColumns: DynamicTableColumn<VendorListItem>[] = [
  {
    key: "shopName",
    label: "Vendor",
    minWidth: 280,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.shopName}</p>
        <p className="text-xs text-muted">{row.publicVendorId}</p>
      </div>
    ),
  },
  {
    key: "category",
    label: "Category",
    minWidth: 180,
    getValue: (row) => row.category?.name ?? "Unassigned",
    renderCell: (row) => <span>{row.category?.name ?? "Unassigned"}</span>,
  },
  {
    key: "address",
    label: "City",
    minWidth: 180,
    getValue: (row) => row.address.city,
  },
  {
    key: "vendorStatus",
    label: "Vendor Status",
    format: "status",
    statusTone: (value) => {
      if (value === "ACTIVE") {
        return "success";
      }

      if (value === "SUSPENDED") {
        return "warning";
      }

      return "neutral";
    },
    minWidth: 160,
    getValue: (row) => row.vendorStatus,
  },
  {
    key: "onboardingStatus",
    label: "Onboarding",
    format: "status",
    statusTone: (value) => {
      if (value === "APPROVED") {
        return "success";
      }

      if (value === "REJECTED") {
        return "danger";
      }

      if (value === "DOCUMENTS_PENDING" || value === "UNDER_REVIEW") {
        return "warning";
      }

      return "info";
    },
    minWidth: 160,
    getValue: (row) => row.onboardingStatus,
  },
  {
    key: "updatedAt",
    label: "Updated",
    format: "date",
    minWidth: 180,
  },
];

function getVendorQuery(viewMode: VendorViewMode): VendorListQueryParams {
  if (viewMode === "onboarding") {
    return {
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
    };
  }

  return {
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    vendorStatus: "ACTIVE",
  };
}

export function VendorsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<VendorViewMode>("active");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState<
    "" | VendorOnboardingStatus
  >("");
  const [vendorStatus, setVendorStatus] = useState<"" | VendorStatus>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const query = useMemo(
    () => ({
      ...getVendorQuery(viewMode),
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      zoneId: zoneId.trim() || undefined,
      onboardingStatus: onboardingStatus || undefined,
      vendorStatus: vendorStatus || undefined,
    }),
    [
      categoryId,
      city,
      limit,
      onboardingStatus,
      page,
      search,
      vendorStatus,
      viewMode,
      zoneId,
    ],
  );

  const vendorQuery = useQuery({
    queryKey: ["vendors", viewMode, query],
    queryFn: () =>
      viewMode === "onboarding"
        ? vendorService.getVendorOnboardingQueue(query)
        : vendorService.getVendorList(query),
  });

  const vendors = vendorQuery.data?.data ?? [];
  const pagination = vendorQuery.data?.pagination;
  const isLoading = vendorQuery.isLoading || vendorQuery.isFetching;
  const hasNextPage = pagination?.hasNextPage ?? false;
  const hasPreviousPage = pagination?.hasPreviousPage ?? false;

  const resetToFirstPage = () => setPage(1);

  return (
    <PageContainer>
      <PageContextHeader
        title="Vendors"
        utilityNode={
          <div className="inline-flex rounded-full border border-border bg-surface p-1">
            <button
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "active"
                  ? "bg-foreground text-primary-foreground"
                  : "text-muted hover:text-foreground"
              }`}
              type="button"
              onClick={() => {
                setViewMode("active");
                resetToFirstPage();
              }}
            >
              Active Vendors
            </button>
            <button
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "onboarding"
                  ? "bg-foreground text-primary-foreground"
                  : "text-muted hover:text-foreground"
              }`}
              type="button"
              onClick={() => {
                setViewMode("onboarding");
                resetToFirstPage();
              }}
            >
              Onboarding Queue
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 grid gap-3 lg:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Search
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  className="min-h-11 pl-9"
                  placeholder="Search vendors"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetToFirstPage();
                  }}
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">City</span>
              <Input
                className="min-h-11"
                placeholder="Bengaluru"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  resetToFirstPage();
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Category ID
              </span>
              <Input
                className="min-h-11"
                placeholder="UUID"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  resetToFirstPage();
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Zone ID
              </span>
              <Input
                className="min-h-11"
                placeholder="UUID"
                value={zoneId}
                onChange={(event) => {
                  setZoneId(event.target.value);
                  resetToFirstPage();
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Onboarding Status
              </span>
              <select
                className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                value={onboardingStatus}
                onChange={(event) => {
                  setOnboardingStatus(
                    event.target.value as "" | VendorOnboardingStatus,
                  );
                  resetToFirstPage();
                }}
              >
                <option value="">All</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="DOCUMENTS_PENDING">DOCUMENTS_PENDING</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Vendor Status
              </span>
              <select
                className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                value={vendorStatus}
                onChange={(event) => {
                  setVendorStatus(event.target.value as "" | VendorStatus);
                  resetToFirstPage();
                }}
              >
                <option value="">All</option>
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>

          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {viewMode === "active" ? "Active Vendors" : "Onboarding Queue"}
            </h2>
            <p className="text-sm text-muted">
              {viewMode === "active"
                ? "Live vendors currently active in the platform."
                : "Vendors waiting for onboarding review and approval."}
            </p>
          </div>

          {vendorQuery.isError ? (
            <ErrorState
              description="We could not load vendor data. Please retry."
              title="Vendor data unavailable"
              onRetry={() => void vendorQuery.refetch()}
            />
          ) : isLoading ? (
            <TableSkeleton
              columns={vendorColumns}
              hasFooter={Boolean(pagination)}
              rowCount={8}
            />
          ) : vendors.length === 0 ? (
            <EmptyState
              description={
                viewMode === "active"
                  ? "No active vendors were found."
                  : "No vendors are currently in the onboarding queue."
              }
              title={
                viewMode === "active" ? "No active vendors" : "Queue is empty"
              }
            />
          ) : (
            <DynamicTable
              bodyMaxHeight={560}
              columns={vendorColumns}
              data={vendors}
              description="No vendor records are available."
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize: pagination.limit,
                      total: pagination.totalItems,
                      onPageChange: (nextPage) => {
                        setPage(nextPage);
                      },
                      onPageSizeChange: (nextLimit) => {
                        setLimit(nextLimit);
                        setPage(1);
                      },
                      rowsPerPageOptions: [10, 20, 50, 100],
                    }
                  : {
                      page: 1,
                      pageSize: vendors.length || 1,
                      total: vendors.length,
                    }
              }
              title={
                viewMode === "active" ? "Active vendors" : "Onboarding queue"
              }
              getRowId={(row) => row.vendorId}
              onRowClick={(row) =>
                navigate(`${routePaths.vendors}/${row.vendorId}`)
              }
            />
          )}

          {pagination ? (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!hasPreviousPage || isLoading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!hasNextPage || isLoading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
