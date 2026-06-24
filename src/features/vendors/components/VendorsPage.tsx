import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Input } from "../../../components/ui/Input";
import {
  ListFilterBar,
  type ActiveFilterChip,
} from "../../../components/layout/ListFilterBar";
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
const DEFAULT_PAGE_SIZE = 10;

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

  const resetToFirstPage = () => setPage(1);
  const clearVendorFilters = () => {
    setSearch("");
    setCity("");
    setCategoryId("");
    setZoneId("");
    setOnboardingStatus("");
    setVendorStatus("");
    resetToFirstPage();
  };
  const activeFilters: ActiveFilterChip[] = [
    search
      ? {
          key: "search",
          label: `Search: ${search}`,
          onRemove: () => {
            setSearch("");
            resetToFirstPage();
          },
        }
      : null,
    city
      ? {
          key: "city",
          label: `City: ${city}`,
          onRemove: () => {
            setCity("");
            resetToFirstPage();
          },
        }
      : null,
    categoryId
      ? {
          key: "categoryId",
          label: `Category: ${categoryId}`,
          onRemove: () => {
            setCategoryId("");
            resetToFirstPage();
          },
        }
      : null,
    zoneId
      ? {
          key: "zoneId",
          label: `Zone: ${zoneId}`,
          onRemove: () => {
            setZoneId("");
            resetToFirstPage();
          },
        }
      : null,
    onboardingStatus
      ? {
          key: "onboardingStatus",
          label: `Onboarding: ${onboardingStatus}`,
          onRemove: () => {
            setOnboardingStatus("");
            resetToFirstPage();
          },
        }
      : null,
    vendorStatus
      ? {
          key: "vendorStatus",
          label: `Vendor: ${vendorStatus}`,
          onRemove: () => {
            setVendorStatus("");
            resetToFirstPage();
          },
        }
      : null,
  ].filter((filter): filter is ActiveFilterChip => Boolean(filter));

  return (
    <PageContainer>
      <PageContextHeader
        description={
          viewMode === "active"
            ? "Live vendors currently active in the platform."
            : "Vendors waiting for onboarding review and approval."
        }
        placement="topbar"
        title="Vendors"
      />

      <div className="list-workspace">
        <ListFilterBar
          activeFilters={activeFilters}
          onClearAll={clearVendorFilters}
          primaryFilters={
            <>
              <div className="inline-flex min-h-11 rounded-[0.9rem] border border-border bg-surface p-1">
                <button
                  className={`rounded-[0.7rem] px-3 text-sm font-medium transition ${
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
                  Active
                </button>
                <button
                  className={`rounded-[0.7rem] px-3 text-sm font-medium transition ${
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
                  Onboarding
                </button>
              </div>
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
            </>
          }
          secondaryFilters={
            <>
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
            </>
          }
        />

        <section className="list-results-panel">
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
              bodyMaxHeight="calc(100vh - 18rem)"
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
                viewMode === "active" ? "Active Vendors" : "Onboarding Queue"
              }
              getRowId={(row) => row.vendorId}
              onRowClick={(row) =>
                navigate(`${routePaths.vendors}/${row.vendorId}`)
              }
            />
          )}

        </section>
      </div>
    </PageContainer>
  );
}
