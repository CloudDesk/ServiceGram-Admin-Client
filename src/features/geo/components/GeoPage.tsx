import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCcw } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataList } from "../../../components/ui/DataList";
import type { DataListColumn } from "../../../components/ui/DataList";
import { EmptyState } from "../../../components/ui/EmptyState";
import { filterInputClass } from "../../../components/ui/Input";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { usePermission } from "../../../hooks/usePermission";
import { cn } from "../../../utils/cn";
import { geoService } from "../services/geo.service";
import { GeoActionModal, type GeoActionSelection } from "./GeoActionModal";
import type {
  City,
  Country,
  District,
  GeoLevel,
  GeoListResponse,
  GeoRecord,
  State,
} from "../types/geo.types";

const GEO_LIST_STORAGE_KEY = "servicegram.geo.list.v1";
const DEFAULT_PAGE_SIZE = 50;

const LEVEL_TABS: { level: GeoLevel; label: string; singular: string }[] = [
  { level: "countries", label: "Countries", singular: "Country" },
  { level: "states", label: "States", singular: "State" },
  { level: "districts", label: "Districts", singular: "District" },
  { level: "cities", label: "Cities", singular: "City" },
];

function recordCode(level: GeoLevel, record: GeoRecord): string {
  if (level === "countries") return (record as Country).isoCode;
  if (level === "states") return (record as State).stateCode;
  if (level === "districts") return (record as District).districtCode;
  return (record as City).cityCode;
}

function recordId(level: GeoLevel, record: GeoRecord): string {
  if (level === "countries") return (record as Country).countryId;
  if (level === "states") return (record as State).stateId;
  if (level === "districts") return (record as District).districtId;
  return (record as City).cityId;
}

function toActionSelection(
  level: GeoLevel,
  record: GeoRecord,
): GeoActionSelection {
  if (level === "countries")
    return { level, mode: "EDIT", record: record as Country };
  if (level === "states")
    return { level, mode: "EDIT", record: record as State };
  if (level === "districts")
    return { level, mode: "EDIT", record: record as District };
  return { level, mode: "EDIT", record: record as City };
}

export function GeoPage() {
  const queryClient = useQueryClient();
  const canUpdateGeo = usePermission("geo:update");
  const [level, setLevel] = useState<GeoLevel>("countries");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [action, setAction] = useState<GeoActionSelection | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const parentSelected =
    level === "countries" ||
    (level === "states" && Boolean(countryId)) ||
    (level === "districts" && Boolean(stateId)) ||
    (level === "cities" && Boolean(districtId));

  // Dropdown option sources — always the full parent set (a country/state
  // realistically never exceeds a couple hundred children), independent of
  // the active level's own paginated/searched table below.
  const countryOptionsQuery = useQuery({
    queryKey: ["geo", "countries", "options"],
    queryFn: () => geoService.getCountries({ limit: 200 }),
    enabled: level !== "countries",
  });

  const stateOptionsQuery = useQuery({
    queryKey: ["geo", "states", "options", countryId],
    queryFn: () => geoService.getStates({ parentId: countryId, limit: 200 }),
    enabled: (level === "districts" || level === "cities") && Boolean(countryId),
  });

  const districtOptionsQuery = useQuery({
    queryKey: ["geo", "districts", "options", stateId],
    queryFn: () => geoService.getDistricts({ parentId: stateId, limit: 200 }),
    enabled: level === "cities" && Boolean(stateId),
  });

  const countryOptions = countryOptionsQuery.data?.data ?? [];
  const stateOptions = stateOptionsQuery.data?.data ?? [];
  const districtOptions = districtOptionsQuery.data?.data ?? [];

  // The active level's own table — paginated and searched, unlike the
  // dropdown queries above.
  const activeQuery = useQuery({
    queryKey: ["geo", "table", level, countryId, stateId, districtId, page, limit, search],
    queryFn: (): Promise<GeoListResponse<GeoRecord>> => {
      const params = { page, limit, search: search.trim() || undefined };
      if (level === "countries") return geoService.getCountries(params);
      if (level === "states") return geoService.getStates({ ...params, parentId: countryId });
      if (level === "districts") return geoService.getDistricts({ ...params, parentId: stateId });
      return geoService.getCities({ ...params, parentId: districtId });
    },
    enabled: parentSelected,
  });

  const records: GeoRecord[] = activeQuery.data?.data ?? [];
  const pagination = activeQuery.data?.pagination;

  const columns: DataListColumn<GeoRecord>[] = useMemo(
    () => [
      {
        id: "code",
        label: "Code",
        defaultWidth: 100,
        minWidth: 88,
        priority: 1,
        render: (record) => (
          <span className="font-mono text-xs text-muted">
            {recordCode(level, record)}
          </span>
        ),
      },
      {
        id: "name",
        label: "Name",
        defaultWidth: 220,
        minWidth: 160,
        priority: 1,
        grow: true,
        locked: true,
        render: (record) => (
          <span className="truncate font-medium text-foreground">{record.name}</span>
        ),
      },
      {
        id: "nameTa",
        label: "Tamil name",
        defaultWidth: 160,
        minWidth: 120,
        priority: 2,
        render: (record) => (
          <span className="truncate text-muted">
            {record.translations?.ta?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 96,
        minWidth: 88,
        priority: 1,
        render: (record) => (
          <Badge tone={record.isActive ? "success" : "neutral"}>
            {record.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "order",
        label: "Order",
        defaultWidth: 80,
        minWidth: 72,
        priority: 3,
        align: "right",
        render: (record) => <span className="text-muted">{record.displayOrder}</span>,
      },
    ],
    [level],
  );

  const mutation = useMutation({
    mutationFn: async (values: {
      selection: GeoActionSelection;
      code: string;
      name: string;
      nameTa: string;
      isActive: boolean;
      displayOrder: number;
      reason: string;
    }) => {
      const { selection, code, name, nameTa, isActive, displayOrder, reason } =
        values;
      const translations = nameTa ? { ta: { name: nameTa } } : undefined;

      if (selection.level === "countries") {
        if (selection.mode === "CREATE") {
          return geoService.createCountry({
            isoCode: code,
            name,
            translations,
            isActive,
            displayOrder,
            reason,
          });
        }
        return geoService.updateCountry(selection.record.countryId, {
          isoCode: code,
          name,
          translations,
          isActive,
          displayOrder,
          reason,
        });
      }

      if (selection.level === "states") {
        if (selection.mode === "CREATE") {
          return geoService.createState({
            countryId: selection.parentId,
            stateCode: code,
            name,
            translations,
            isActive,
            displayOrder,
            reason,
          });
        }
        return geoService.updateState(selection.record.stateId, {
          stateCode: code,
          name,
          translations,
          isActive,
          displayOrder,
          reason,
        });
      }

      if (selection.level === "districts") {
        if (selection.mode === "CREATE") {
          return geoService.createDistrict({
            stateId: selection.parentId,
            districtCode: code,
            name,
            translations,
            isActive,
            displayOrder,
            reason,
          });
        }
        return geoService.updateDistrict(selection.record.districtId, {
          districtCode: code,
          name,
          translations,
          isActive,
          displayOrder,
          reason,
        });
      }

      if (selection.mode === "CREATE") {
        return geoService.createCity({
          districtId: selection.parentId,
          cityCode: code,
          name,
          translations,
          isActive,
          displayOrder,
          reason,
        });
      }
      return geoService.updateCity(selection.record.cityId, {
        cityCode: code,
        name,
        translations,
        isActive,
        displayOrder,
        reason,
      });
    },
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["geo"] });
      setAction(null);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Save failed.");
    },
  });

  const activeLevelTab =
    LEVEL_TABS.find((tab) => tab.level === level) ?? LEVEL_TABS[0] ?? {
      level: "countries" as const,
      label: "Countries",
      singular: "Country",
    };

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh geo records"
            className="h-9"
            disabled={activeQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void activeQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                "size-4 sm:mr-2",
                activeQuery.isFetching && "animate-spin motion-reduce:animate-none",
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Geo"
      />

      {/*
        Level switching has to stay visible even before a parent is picked —
        States/Districts/Cities all start with no parent selected, so this
        can't live inside DataList's own queueTabs (which only render once
        DataList itself mounts, i.e. once a parent is already selected).
      */}
      <div className="inline-flex w-fit flex-wrap rounded-full border border-border bg-surface p-0.5">
        {LEVEL_TABS.map((tab) => (
          <button
            key={tab.level}
            className={`min-h-9 rounded-full px-3 text-sm font-semibold transition ${
              level === tab.level
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:text-foreground"
            }`}
            type="button"
            onClick={() => {
              setLevel(tab.level);
              setPage(1);
              setSearch("");
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {level !== "countries" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            Country
            <select
              className={filterInputClass}
              value={countryId}
              onChange={(event) => {
                setCountryId(event.target.value);
                setStateId("");
                setDistrictId("");
                setPage(1);
              }}
            >
              <option value="">Select a country</option>
              {countryOptions.map((country) => (
                <option key={country.countryId} value={country.countryId}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          {level === "districts" || level === "cities" ? (
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              State
              <select
                className={filterInputClass}
                disabled={!countryId}
                value={stateId}
                onChange={(event) => {
                  setStateId(event.target.value);
                  setDistrictId("");
                  setPage(1);
                }}
              >
                <option value="">Select a state</option>
                {stateOptions.map((state) => (
                  <option key={state.stateId} value={state.stateId}>
                    {state.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {level === "cities" ? (
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              District
              <select
                className={filterInputClass}
                disabled={!stateId}
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Select a district</option>
                {districtOptions.map((district) => (
                  <option key={district.districtId} value={district.districtId}>
                    {district.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {!parentSelected ? (
        <div className="overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface">
          <EmptyState
            description="Pick a parent above to see and manage its records."
            title="Select a parent"
          />
        </div>
      ) : (
        <DataList
          columns={columns}
          emptyHint="Try a different search term."
          emptyMessage="No records yet. Use Add to create the first one."
          errorMessage="Could not load geo records."
          getRowId={(record) => recordId(level, record)}
          isError={activeQuery.isError}
          isLoading={activeQuery.isLoading}
          pagination={{
            page,
            pageSize: limit,
            totalItems: pagination?.totalItems ?? 0,
            totalPages: pagination?.totalPages ?? 1,
            onPageChange: setPage,
            onPageSizeChange: (nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            },
          }}
          rows={records}
          search={search}
          searchPlaceholder={`Search ${activeLevelTab.label.toLowerCase()}…`}
          storageKey={GEO_LIST_STORAGE_KEY}
          toolbarActions={
            canUpdateGeo ? (
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  if (level === "countries") setAction({ level, mode: "CREATE" });
                  else if (level === "states")
                    setAction({ level, mode: "CREATE", parentId: countryId });
                  else if (level === "districts")
                    setAction({ level, mode: "CREATE", parentId: stateId });
                  else setAction({ level, mode: "CREATE", parentId: districtId });
                }}
              >
                <Plus className="mr-1.5 size-4" />
                Add {activeLevelTab.singular}
              </Button>
            ) : undefined
          }
          onRetry={() => void activeQuery.refetch()}
          onRowClick={
            canUpdateGeo
              ? (record) => setAction(toActionSelection(level, record))
              : undefined
          }
          onSearchChange={(nextSearch) => {
            setSearch(nextSearch);
            setPage(1);
          }}
        />
      )}

      {action ? (
        <GeoActionModal
          action={action}
          error={actionError}
          isSubmitting={mutation.isPending}
          onClose={() => {
            setAction(null);
            setActionError(null);
          }}
          onSubmit={(values) => mutation.mutate({ selection: action, ...values })}
        />
      ) : null}
    </PageContainer>
  );
}
