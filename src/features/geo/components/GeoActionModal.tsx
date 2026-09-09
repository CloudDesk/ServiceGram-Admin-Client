import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import type { City, Country, District, GeoLevel, State } from "../types/geo.types";

export type GeoActionSelection =
  | { level: "countries"; mode: "CREATE" }
  | { level: "countries"; mode: "EDIT"; record: Country }
  | { level: "states"; mode: "CREATE"; parentId: string }
  | { level: "states"; mode: "EDIT"; record: State }
  | { level: "districts"; mode: "CREATE"; parentId: string }
  | { level: "districts"; mode: "EDIT"; record: District }
  | { level: "cities"; mode: "CREATE"; parentId: string }
  | { level: "cities"; mode: "EDIT"; record: City };

export interface GeoActionFormValues {
  code: string;
  name: string;
  nameTa: string;
  isActive: boolean;
  displayOrder: number;
  reason: string;
}

interface GeoActionModalProps {
  action: GeoActionSelection;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: GeoActionFormValues) => void;
}

const LEVEL_LABEL: Record<GeoLevel, string> = {
  countries: "Country",
  states: "State",
  districts: "District",
  cities: "City",
};

const CODE_LABEL: Record<GeoLevel, string> = {
  countries: "ISO code (e.g. IN)",
  states: "State code (e.g. TN)",
  districts: "District code",
  cities: "City code",
};

function existingCode(action: GeoActionSelection): string {
  if (action.mode !== "EDIT") return "";
  if (action.level === "countries") return action.record.isoCode;
  if (action.level === "states") return action.record.stateCode;
  if (action.level === "districts") return action.record.districtCode;
  return action.record.cityCode;
}

export function GeoActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: GeoActionModalProps) {
  const record = action.mode === "EDIT" ? action.record : null;
  const [code, setCode] = useState(existingCode(action));
  const [name, setName] = useState(record?.name ?? "");
  const [nameTa, setNameTa] = useState(record?.translations?.ta?.name ?? "");
  const [activeLocaleTab, setActiveLocaleTab] = useState<"en" | "ta">("en");
  const [isActive, setIsActive] = useState(record?.isActive ?? true);
  const [displayOrder, setDisplayOrder] = useState(
    String(record?.displayOrder ?? 0),
  );
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedReason = reason.trim();

    if (!trimmedCode || !trimmedName) {
      setFormError("Code and English name are required.");
      return;
    }

    if (trimmedReason.length < 3) {
      setFormError("Reason must be at least 3 characters.");
      return;
    }

    onSubmit({
      code: trimmedCode,
      name: trimmedName,
      nameTa: nameTa.trim(),
      isActive,
      displayOrder: Number(displayOrder) || 0,
      reason: trimmedReason,
    });
  };

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {action.mode === "CREATE" ? "Add" : "Edit"} {LEVEL_LABEL[action.level]}
          </h2>
          <button
            aria-label="Close"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={submit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {CODE_LABEL[action.level]}
            </span>
            <Input
              className="min-h-11 uppercase"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>

          <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
            <div className="mb-3 inline-flex rounded-full border border-border bg-surface p-0.5">
              <button
                className={`min-h-8 rounded-full px-3 text-sm font-semibold transition ${
                  activeLocaleTab === "en"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:text-foreground"
                }`}
                type="button"
                onClick={() => setActiveLocaleTab("en")}
              >
                English
              </button>
              <button
                className={`min-h-8 rounded-full px-3 text-sm font-semibold transition ${
                  activeLocaleTab === "ta"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:text-foreground"
                }`}
                type="button"
                onClick={() => setActiveLocaleTab("ta")}
              >
                தமிழ்
              </button>
            </div>

            {activeLocaleTab === "en" ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">Name</span>
                <Input
                  className="min-h-11"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">
                  Name (Tamil)
                </span>
                <Input
                  className="min-h-11"
                  value={nameTa}
                  onChange={(event) => setNameTa(event.target.value)}
                />
                <span className="text-xs text-muted">
                  Leave blank to keep showing the English name for Tamil-language
                  app users.
                </span>
              </label>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-foreground">
                Display order
              </span>
              <Input
                className="min-h-11"
                min={0}
                type="number"
                value={displayOrder}
                onChange={(event) => setDisplayOrder(event.target.value)}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 self-end rounded-[0.75rem] border border-border bg-surface-muted/45 px-3 text-sm font-medium text-foreground">
              <input
                checked={isActive}
                type="checkbox"
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              Change note
            </span>
            <textarea
              className="form-input min-h-20 resize-y"
              placeholder="Added for launch coverage."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
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
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
