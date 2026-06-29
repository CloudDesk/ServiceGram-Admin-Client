import { type FormEvent, useState } from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type {
  CategoryBookingTemplate,
  PlatformSetting,
  ServiceCategory,
  ServiceType,
  ServiceZone,
} from "../types/settings.types";

export type SettingsActionSelection =
  | { type: "settings"; action: "UPDATE"; record: PlatformSetting }
  | {
      type: "categories";
      action: "EDIT" | "ACTIVATE" | "DEACTIVATE";
      record: ServiceCategory;
    }
  | { type: "serviceTypes"; action: "CREATE"; category: ServiceCategory }
  | {
      type: "serviceTypes";
      action: "EDIT" | "ACTIVATE" | "DEACTIVATE";
      record: ServiceType;
    }
  | { type: "zones"; action: "CREATE"; record?: undefined }
  | {
      type: "zones";
      action: "EDIT" | "ACTIVATE" | "DEACTIVATE";
      record: ServiceZone;
    };

export interface SettingsActionFormValues {
  value?: unknown;
  serviceTypeCode?: string;
  name?: string;
  description?: string | null;
  iconAssetId?: string | null;
  bookingTemplate?: CategoryBookingTemplate;
  displayOrder?: number;
  city?: string;
  zoneName?: string;
  pincodeList?: string[] | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  reason?: string;
}

interface SettingsActionModalProps {
  action: SettingsActionSelection | null;
  error?: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: SettingsActionFormValues) => void;
}

function title(action: SettingsActionSelection) {
  const typeLabel: Record<SettingsActionSelection["type"], string> = {
    settings: "setting",
    categories: "category",
    serviceTypes: "service type",
    zones: "zone",
  };
  return `${action.action.replace("_", " ").toLowerCase()} ${typeLabel[action.type]}`;
}

function parseValue(raw: string, valueType?: string): unknown {
  if (valueType === "boolean") return raw === "true";
  if (valueType === "number" || valueType === "integer") return Number(raw);
  if (valueType === "json") return JSON.parse(raw);
  return raw;
}

function csvToList(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function parseJsonArray(raw: string) {
  if (!raw.trim()) return [];
  const value = JSON.parse(raw) as unknown;
  if (!Array.isArray(value)) {
    throw new Error("Expected an array.");
  }
  return value as Record<string, unknown>[];
}

function parseJsonObject(raw: string) {
  if (!raw.trim()) return {};
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? [], null, 2);
}

function formatJsonObject(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function SettingsActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: SettingsActionModalProps) {
  if (!action) return null;

  const actionKey =
    action.type === "settings"
      ? `${action.type}:${action.record.settingKey}:${action.action}`
      : action.type === "categories"
        ? `${action.type}:${action.record.categoryId}:${action.action}`
        : action.type === "serviceTypes"
          ? `${action.type}:${
              action.action === "CREATE"
                ? action.category.categoryId
                : action.record.serviceTypeId
            }:${action.action}`
          : `${action.type}:${action.record?.zoneId ?? "new"}:${action.action}`;

  return (
    <SettingsActionModalContent
      key={actionKey}
      action={action}
      error={error}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function SettingsActionModalContent({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: Omit<SettingsActionModalProps, "action"> & {
  action: SettingsActionSelection;
}) {
  const template: CategoryBookingTemplate =
    action.type === "categories" ? (action.record.bookingTemplate ?? {}) : {};
  const [city, setCity] = useState(
    action.type === "zones" ? (action.record?.city ?? "") : "",
  );
  const [description, setDescription] = useState(
    action.type === "categories" ? (action.record.description ?? "") : "",
  );
  const [displayOrder, setDisplayOrder] = useState(
    action.type === "categories" ? String(action.record.displayOrder) : "",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [iconAssetId, setIconAssetId] = useState(
    action.type === "categories" ? (action.record.iconAssetId ?? "") : "",
  );
  const [name, setName] = useState(
    action.type === "categories"
      ? action.record.name
      : action.type === "serviceTypes" && action.action !== "CREATE"
        ? action.record.name
        : "",
  );
  const [serviceTypeCode, setServiceTypeCode] = useState("");
  const [serviceTypeDescription, setServiceTypeDescription] = useState(
    action.type === "serviceTypes" && action.action !== "CREATE"
      ? (action.record.description ?? "")
      : "",
  );
  const [serviceTypeDisplayOrder, setServiceTypeDisplayOrder] = useState(
    action.type === "serviceTypes" && action.action !== "CREATE"
      ? String(action.record.displayOrder)
      : "0",
  );
  const [serviceTypeMetadataJson, setServiceTypeMetadataJson] = useState(
    action.type === "serviceTypes" && action.action !== "CREATE"
      ? formatJsonObject(action.record.metadata)
      : "{}",
  );
  const [pincodeList, setPincodeList] = useState(
    action.type === "zones"
      ? (action.record?.pincodeList.join(", ") ?? "")
      : "",
  );
  const [reason, setReason] = useState("");
  const [settingValue, setSettingValue] = useState(
    action.type === "settings" ? JSON.stringify(action.record.value ?? "") : "",
  );
  const [zoneName, setZoneName] = useState(
    action.type === "zones" ? (action.record?.zoneName ?? "") : "",
  );
  const [templateEnabled, setTemplateEnabled] = useState(
    template.isEnabled ?? true,
  );
  const [multiServiceEnabled, setMultiServiceEnabled] = useState(
    template.multiServiceEnabled ?? false,
  );
  const [instantEstimateEnabled, setInstantEstimateEnabled] = useState(
    template.instantEstimateEnabled ?? true,
  );
  const [priceRevisionEnabled, setPriceRevisionEnabled] = useState(
    template.priceRevisionEnabled ?? false,
  );
  const [allowedPricingUnits, setAllowedPricingUnits] = useState(
    (template.allowedPricingUnits ?? []).join(", "),
  );
  const [allowedPricingModes, setAllowedPricingModes] = useState(
    (template.allowedPricingModes ?? []).join(", "),
  );
  const [defaultPricingMode, setDefaultPricingMode] = useState(
    template.defaultPricingMode ?? "ITEMIZED",
  );
  const [quoteMode, setQuoteMode] = useState(template.quoteMode ?? "INSTANT");
  const [customerHelpText, setCustomerHelpText] = useState(
    template.customerHelpText ?? "",
  );
  const [vendorHelpText, setVendorHelpText] = useState(
    template.vendorHelpText ?? "",
  );
  const [fieldsJson, setFieldsJson] = useState(formatJson(template.fields));
  const [itemTemplatesJson, setItemTemplatesJson] = useState(
    formatJson(template.itemTemplates),
  );
  const [addOnTemplatesJson, setAddOnTemplatesJson] = useState(
    formatJson(template.addOnTemplates),
  );
  const isCategoryAction = action.type === "categories";
  const isServiceTypeForm =
    action.type === "serviceTypes" &&
    (action.action === "CREATE" || action.action === "EDIT");
  const modalWidthClass =
    isCategoryAction || isServiceTypeForm ? "max-w-6xl" : "max-w-xl";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      setFormError("Reason must be at least 3 characters.");
      return;
    }

    try {
      if (action.type === "settings") {
        onSubmit({
          value: parseValue(
            settingValue,
            action.record.valueType.toLowerCase(),
          ),
          reason: trimmedReason,
        });
        return;
      }
      if (action.type === "categories") {
        const bookingTemplate: CategoryBookingTemplate = {
          schemaVersion: action.record.bookingTemplate?.schemaVersion ?? 1,
          isEnabled: templateEnabled,
          multiServiceEnabled,
          instantEstimateEnabled,
          priceRevisionEnabled,
          allowedPricingUnits: csvToList(allowedPricingUnits),
          allowedPricingModes: csvToList(allowedPricingModes),
          defaultPricingMode,
          quoteMode,
          customerHelpText: customerHelpText.trim() || undefined,
          vendorHelpText: vendorHelpText.trim() || undefined,
          fields: parseJsonArray(fieldsJson),
          itemTemplates: parseJsonArray(itemTemplatesJson),
          addOnTemplates: parseJsonArray(addOnTemplatesJson),
          workflow: action.record.bookingTemplate?.workflow ?? {},
        };

        onSubmit({
          name: name || undefined,
          description: description || null,
          iconAssetId: iconAssetId || null,
          bookingTemplate,
          displayOrder: displayOrder ? Number(displayOrder) : undefined,
          isActive:
            action.action === "ACTIVATE"
              ? true
              : action.action === "DEACTIVATE"
                ? false
                : undefined,
          reason: trimmedReason,
        });
        return;
      }
      if (action.type === "serviceTypes") {
        if (action.action === "CREATE" || action.action === "EDIT") {
          onSubmit({
            serviceTypeCode:
              action.action === "CREATE"
                ? serviceTypeCode.trim().toUpperCase()
                : undefined,
            name: name.trim() || undefined,
            description: serviceTypeDescription.trim() || null,
            displayOrder: serviceTypeDisplayOrder
              ? Number(serviceTypeDisplayOrder)
              : undefined,
            metadata: parseJsonObject(serviceTypeMetadataJson),
            isActive:
              action.action === "CREATE"
                ? true
                : action.record.isActive,
            reason: trimmedReason,
          });
          return;
        }

        onSubmit({
          isActive: action.action === "ACTIVATE",
          reason: trimmedReason,
        });
        return;
      }
      onSubmit({
        city: city || undefined,
        zoneName: zoneName || undefined,
        pincodeList: pincodeList
          ? pincodeList
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        isActive:
          action.action === "ACTIVATE" || action.action === "CREATE"
            ? true
            : action.action === "DEACTIVATE"
              ? false
              : undefined,
        reason: trimmedReason,
      });
    } catch {
      setFormError("Value must match the expected type.");
    }
  };

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6 lg:items-center">
      <div
        className={`flex max-h-[calc(100vh-1.5rem)] w-full ${modalWidthClass} flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold capitalize tracking-[-0.03em] text-foreground">
            {title(action)}
          </h2>
          <button
            aria-label="Close action modal"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-4">
              {action.type === "settings" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-foreground">
                    Value ({action.record.valueType})
                  </span>
                  <textarea
                    className="form-input min-h-24 resize-y"
                    value={settingValue}
                    onChange={(event) => setSettingValue(event.target.value)}
                  />
                </label>
              ) : null}
              {action.type === "categories" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground">
                      Name
                    </span>
                    <input
                      className="form-input"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground">
                      Display order
                    </span>
                    <input
                      className="form-input"
                      type="number"
                      value={displayOrder}
                      onChange={(event) => setDisplayOrder(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-foreground">
                      Icon asset ID
                    </span>
                    <input
                      className="form-input"
                      value={iconAssetId}
                      onChange={(event) => setIconAssetId(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2 md:col-span-2 xl:col-span-4">
                    <span className="text-sm font-semibold text-foreground">
                      Description
                    </span>
                    <textarea
                      className="form-input min-h-20 resize-y"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                  <div className="rounded-[0.75rem] border border-border bg-surface-muted p-4 md:col-span-2 xl:col-span-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Booking template
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          Configure how this category is priced and collected in
                          vendor and customer apps.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <label className="flex min-h-11 items-center gap-2 rounded-[0.75rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={templateEnabled}
                          onChange={(event) =>
                            setTemplateEnabled(event.target.checked)
                          }
                        />
                        Enabled
                      </label>
                      <label className="flex min-h-11 items-center gap-2 rounded-[0.75rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={multiServiceEnabled}
                          onChange={(event) =>
                            setMultiServiceEnabled(event.target.checked)
                          }
                        />
                        Multi-service booking
                      </label>
                      <label className="flex min-h-11 items-center gap-2 rounded-[0.75rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={instantEstimateEnabled}
                          onChange={(event) =>
                            setInstantEstimateEnabled(event.target.checked)
                          }
                        />
                        Instant estimate
                      </label>
                      <label className="flex min-h-11 items-center gap-2 rounded-[0.75rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={priceRevisionEnabled}
                          onChange={(event) =>
                            setPriceRevisionEnabled(event.target.checked)
                          }
                        />
                        Price revision
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-foreground">
                          Allowed units
                        </span>
                        <input
                          className="form-input"
                          placeholder="KG, PIECE, PAIR"
                          value={allowedPricingUnits}
                          onChange={(event) =>
                            setAllowedPricingUnits(event.target.value)
                          }
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-foreground">
                          Allowed modes
                        </span>
                        <input
                          className="form-input"
                          placeholder="ITEMIZED, MIXED"
                          value={allowedPricingModes}
                          onChange={(event) =>
                            setAllowedPricingModes(event.target.value)
                          }
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-foreground">
                          Default pricing mode
                        </span>
                        <select
                          className="form-input"
                          value={defaultPricingMode}
                          onChange={(event) =>
                            setDefaultPricingMode(event.target.value)
                          }
                        >
                          <option value="FIXED">Fixed</option>
                          <option value="WEIGHT">Weight</option>
                          <option value="ITEMIZED">Itemized</option>
                          <option value="MIXED">Mixed</option>
                          <option value="DURATION">Duration</option>
                          <option value="INSPECTION_REQUIRED">
                            Inspection required
                          </option>
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-foreground">
                          Quote mode
                        </span>
                        <select
                          className="form-input"
                          value={quoteMode}
                          onChange={(event) => setQuoteMode(event.target.value)}
                        >
                          <option value="INSTANT">Instant</option>
                          <option value="PRICE_RANGE">Price range</option>
                          <option value="INSPECTION_REQUIRED">
                            Inspection required
                          </option>
                        </select>
                      </label>
                      <label className="block space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-foreground">
                          Customer help text
                        </span>
                        <textarea
                          className="form-input min-h-16 resize-y"
                          value={customerHelpText}
                          onChange={(event) =>
                            setCustomerHelpText(event.target.value)
                          }
                        />
                      </label>
                      <label className="block space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-foreground">
                          Vendor help text
                        </span>
                        <textarea
                          className="form-input min-h-16 resize-y"
                          value={vendorHelpText}
                          onChange={(event) =>
                            setVendorHelpText(event.target.value)
                          }
                        />
                      </label>
                      <label className="block space-y-2 md:col-span-2 xl:col-span-2">
                        <span className="text-sm font-semibold text-foreground">
                          Customer fields JSON
                        </span>
                        <textarea
                          className="form-input min-h-36 resize-y font-mono text-xs"
                          value={fieldsJson}
                          onChange={(event) =>
                            setFieldsJson(event.target.value)
                          }
                        />
                      </label>
                      <label className="block space-y-2 md:col-span-2 xl:col-span-2">
                        <span className="text-sm font-semibold text-foreground">
                          Item templates JSON
                        </span>
                        <textarea
                          className="form-input min-h-36 resize-y font-mono text-xs"
                          value={itemTemplatesJson}
                          onChange={(event) =>
                            setItemTemplatesJson(event.target.value)
                          }
                        />
                      </label>
                      <label className="block space-y-2 md:col-span-2 xl:col-span-4">
                        <span className="text-sm font-semibold text-foreground">
                          Add-on templates JSON
                        </span>
                        <textarea
                          className="form-input min-h-32 resize-y font-mono text-xs"
                          value={addOnTemplatesJson}
                          onChange={(event) =>
                            setAddOnTemplatesJson(event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
              {isServiceTypeForm ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {action.action === "CREATE" ? (
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-foreground">
                        Service type code
                      </span>
                      <input
                        className="form-input"
                        placeholder="WASH_AND_FOLD"
                        value={serviceTypeCode}
                        onChange={(event) =>
                          setServiceTypeCode(event.target.value)
                        }
                      />
                    </label>
                  ) : null}
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground">
                      Name
                    </span>
                    <input
                      className="form-input"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground">
                      Display order
                    </span>
                    <input
                      className="form-input"
                      type="number"
                      value={serviceTypeDisplayOrder}
                      onChange={(event) =>
                        setServiceTypeDisplayOrder(event.target.value)
                      }
                    />
                  </label>
                  <label className="block space-y-2 md:col-span-2 xl:col-span-4">
                    <span className="text-sm font-semibold text-foreground">
                      Description
                    </span>
                    <textarea
                      className="form-input min-h-20 resize-y"
                      value={serviceTypeDescription}
                      onChange={(event) =>
                        setServiceTypeDescription(event.target.value)
                      }
                    />
                  </label>
                  <label className="block space-y-2 md:col-span-2 xl:col-span-4">
                    <span className="text-sm font-semibold text-foreground">
                      Metadata JSON
                    </span>
                    <textarea
                      className="form-input min-h-32 resize-y font-mono text-xs"
                      value={serviceTypeMetadataJson}
                      onChange={(event) =>
                        setServiceTypeMetadataJson(event.target.value)
                      }
                    />
                  </label>
                </div>
              ) : null}
              {action.type === "zones" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground">
                      City
                    </span>
                    <input
                      className="form-input"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground">
                      Zone name
                    </span>
                    <input
                      className="form-input"
                      value={zoneName}
                      onChange={(event) => setZoneName(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2 sm:col-span-2">
                    <span className="text-sm font-semibold text-foreground">
                      Pincodes
                    </span>
                    <input
                      className="form-input"
                      placeholder="Comma separated"
                      value={pincodeList}
                      onChange={(event) => setPincodeList(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Reason <span className="text-danger">*</span>
                </span>
                <textarea
                  className="form-input min-h-20 resize-y"
                  placeholder="Required for audit history"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              {formError || error ? (
                <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                  {formError ?? error}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button isLoading={isSubmitting} size="sm" type="submit">
              Submit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
