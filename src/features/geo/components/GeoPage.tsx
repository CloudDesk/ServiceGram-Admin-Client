import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageContainer } from "../../../components/layout/PageContainer";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { Skeleton } from "../../../components/ui/Skeleton";
import { usePermission } from "../../../hooks/usePermission";
import { geoService } from "../services/geo.service";
import { GeoActionModal, type GeoActionSelection } from "./GeoActionModal";
import type {
  City,
  Country,
  District,
  GeoLevel,
  GeoRecord,
  State,
} from "../types/geo.types";

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

export function GeoPage() {
  const queryClient = useQueryClient();
  const canUpdateGeo = usePermission("geo:update");
  const [level, setLevel] = useState<GeoLevel>("countries");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [action, setAction] = useState<GeoActionSelection | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const countriesQuery = useQuery({
    queryKey: ["geo", "countries"],
    queryFn: () => geoService.getCountries({ limit: 200 }),
  });

  const statesQuery = useQuery({
    queryKey: ["geo", "states", countryId],
    queryFn: () => geoService.getStates({ parentId: countryId, limit: 200 }),
    enabled: Boolean(countryId),
  });

  const districtsQuery = useQuery({
    queryKey: ["geo", "districts", stateId],
    queryFn: () => geoService.getDistricts({ parentId: stateId, limit: 200 }),
    enabled: Boolean(stateId),
  });

  const citiesQuery = useQuery({
    queryKey: ["geo", "cities", districtId],
    queryFn: () => geoService.getCities({ parentId: districtId, limit: 200 }),
    enabled: level === "cities" && Boolean(districtId),
  });

  const countries = countriesQuery.data?.data ?? [];
  const states = statesQuery.data?.data ?? [];
  const districts = districtsQuery.data?.data ?? [];
  const cities = citiesQuery.data?.data ?? [];

  const activeQuery =
    level === "countries"
      ? countriesQuery
      : level === "states"
        ? statesQuery
        : level === "districts"
          ? districtsQuery
          : citiesQuery;

  const activeRecords: GeoRecord[] =
    level === "countries"
      ? countries
      : level === "states"
        ? countryId
          ? states
          : []
        : level === "districts"
          ? stateId
            ? districts
            : []
          : districtId
            ? cities
            : [];

  const parentSelected =
    level === "countries" ||
    (level === "states" && Boolean(countryId)) ||
    (level === "districts" && Boolean(stateId)) ||
    (level === "cities" && Boolean(districtId));

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

  return (
    <PageContainer className="flex min-h-full flex-col space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6">
      <PageContextHeader layout="workspace" placement="topbar" title="Geo" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-full border border-border bg-surface p-0.5">
          {LEVEL_TABS.map((tab) => (
            <button
              key={tab.level}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold transition ${
                level === tab.level
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:text-foreground"
              }`}
              type="button"
              onClick={() => setLevel(tab.level)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canUpdateGeo && parentSelected ? (
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
            <Plus className="mr-2 size-4" />
            Add {LEVEL_TABS.find((tab) => tab.level === level)?.singular}
          </Button>
        ) : null}
      </div>

      {level !== "countries" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            Country
            <select
              className="form-input min-h-9"
              value={countryId}
              onChange={(event) => {
                setCountryId(event.target.value);
                setStateId("");
                setDistrictId("");
              }}
            >
              <option value="">Select a country</option>
              {countries.map((country) => (
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
                className="form-input min-h-9"
                disabled={!countryId}
                value={stateId}
                onChange={(event) => {
                  setStateId(event.target.value);
                  setDistrictId("");
                }}
              >
                <option value="">Select a state</option>
                {states.map((state) => (
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
                className="form-input min-h-9"
                disabled={!stateId}
                value={districtId}
                onChange={(event) => setDistrictId(event.target.value)}
              >
                <option value="">Select a district</option>
                {districts.map((district) => (
                  <option key={district.districtId} value={district.districtId}>
                    {district.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface">
        {activeQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : activeQuery.isError ? (
          <ErrorState
            description="Could not load geo records."
            title="Something went wrong"
            onRetry={() => activeQuery.refetch()}
          />
        ) : !parentSelected ? (
          <EmptyState
            description="Pick a parent above to see and manage its records."
            title="Select a parent"
          />
        ) : activeRecords.length === 0 ? (
          <EmptyState
            description="No records yet. Use Add to create the first one."
            title="Nothing here yet"
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/40 text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Tamil name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeRecords.map((record) => (
                <tr key={recordId(level, record)}>
                  <td className="px-4 py-3 font-mono text-xs">
                    {recordCode(level, record)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {record.name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {record.translations?.ta?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={record.isActive ? "success" : "neutral"}>
                      {record.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{record.displayOrder}</td>
                  <td className="px-4 py-3 text-right">
                    {canUpdateGeo ? (
                      <Button
                        size="xs"
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          if (level === "countries")
                            setAction({
                              level,
                              mode: "EDIT",
                              record: record as Country,
                            });
                          else if (level === "states")
                            setAction({ level, mode: "EDIT", record: record as State });
                          else if (level === "districts")
                            setAction({
                              level,
                              mode: "EDIT",
                              record: record as District,
                            });
                          else
                            setAction({ level, mode: "EDIT", record: record as City });
                        }}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
