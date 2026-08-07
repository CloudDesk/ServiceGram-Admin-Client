import { type FormEvent, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
  | { type: "categories"; action: "CREATE"; record?: undefined }
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
  categoryCode?: string;
  categoryImageFile?: File | null;
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

function actionLabel(action: SettingsActionSelection["action"]) {
  if (action === "UPDATE") return "Update";
  if (action === "EDIT") return "Edit";
  if (action === "ACTIVATE") return "Activate";
  if (action === "DEACTIVATE") return "Deactivate";
  return "Create";
}

function title(action: SettingsActionSelection) {
  const typeLabel: Record<SettingsActionSelection["type"], string> = {
    settings: "setting",
    categories: "category",
    serviceTypes: "service type",
    zones: "zone",
  };
  return `${actionLabel(action.action)} ${typeLabel[action.type]}`;
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

function parseJsonObject(raw: string) {
  if (!raw.trim()) return {};
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function formatJsonObject(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

const pricingStyleOptions = [
  {
    label: "Fixed",
    modes: ["FIXED"],
    units: ["PIECE"],
    value: "FIXED",
  },
  {
    label: "Per item",
    modes: ["ITEMIZED"],
    units: ["PIECE"],
    value: "ITEMIZED",
  },
  {
    label: "By weight",
    modes: ["WEIGHT"],
    units: ["KG", "BAG"],
    value: "WEIGHT",
  },
  {
    label: "Mixed",
    modes: ["WEIGHT", "ITEMIZED", "MIXED"],
    units: ["KG", "PIECE", "BAG"],
    value: "MIXED",
  },
  {
    label: "Timed",
    modes: ["DURATION"],
    units: ["HOUR", "VISIT"],
    value: "DURATION",
  },
  {
    label: "Inspect first",
    modes: ["INSPECTION_REQUIRED"],
    units: ["VISIT"],
    value: "INSPECTION_REQUIRED",
  },
] as const;

const pricingUnitOptions = [
  "KG",
  "PIECE",
  "BAG",
  "LOT",
  "SQFT",
  "PAIR",
  "HOUR",
  "VISIT",
  "DEVICE",
] as const;

const pricingModeOptions = [
  "FIXED",
  "WEIGHT",
  "ITEMIZED",
  "MIXED",
  "DURATION",
  "INSPECTION_REQUIRED",
] as const;

const quoteModeOptions = [
  { label: "Instant", value: "INSTANT" },
  { label: "Range", value: "PRICE_RANGE" },
  { label: "Inspect first", value: "INSPECTION_REQUIRED" },
] as const;

const bookingFieldTypeOptions = [
  { label: "Short text", value: "TEXT" },
  { label: "Number", value: "NUMBER" },
  { label: "Single choice", value: "SELECT" },
  { label: "Multiple choices", value: "MULTI_SELECT" },
  { label: "Yes or no", value: "TOGGLE" },
  { label: "Date", value: "DATE" },
  { label: "Image upload", value: "IMAGE" },
] as const;

type BookingFieldType = (typeof bookingFieldTypeOptions)[number]["value"];
type PricingUnit = (typeof pricingUnitOptions)[number];
type PricingMode = (typeof pricingModeOptions)[number];
type QuoteMode = (typeof quoteModeOptions)[number]["value"];

interface BookingFieldDraft {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: BookingFieldType;
  isRequired: boolean;
  displayOrder: string;
  placeholder: string;
  optionsText: string;
  validation: Record<string, unknown>;
}

interface CatalogueItemDraft {
  id: string;
  itemCode: string;
  itemName: string;
  pricingUnit: PricingUnit;
  isPopular: boolean;
  displayOrder: string;
  defaultMinQuantity: string;
  defaultMaxQuantity: string;
  metadata: Record<string, unknown>;
}

interface CategoryTemplatePreset {
  label: string;
  categoryCode: string;
  name: string;
  description: string;
  customerHelpText: string;
  vendorHelpText: string;
  multiServiceEnabled: boolean;
  instantEstimateEnabled: boolean;
  priceRevisionEnabled: boolean;
  allowedPricingUnits: PricingUnit[];
  allowedPricingModes: PricingMode[];
  defaultPricingMode: PricingMode;
  quoteMode: QuoteMode;
  fields: Record<string, unknown>[];
  itemTemplates: Record<string, unknown>[];
  addOnTemplates: Record<string, unknown>[];
  workflow: Record<string, unknown>;
}

let draftIdCounter = 0;

function createDraftId(prefix: string) {
  draftIdCounter += 1;
  return `${prefix}-${draftIdCounter}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringFrom(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanFrom(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberInputFrom(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : String(fallback);
}

function toCode(raw: string, fallback: string) {
  const normalized = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length >= 2 ? normalized : fallback;
}

function isPricingUnit(value: string): value is PricingUnit {
  return (pricingUnitOptions as readonly string[]).includes(value);
}

function isPricingMode(value: string): value is PricingMode {
  return (pricingModeOptions as readonly string[]).includes(value);
}

function isQuoteMode(value: string): value is QuoteMode {
  return quoteModeOptions.some((option) => option.value === value);
}

function isBookingFieldType(value: string): value is BookingFieldType {
  return bookingFieldTypeOptions.some((option) => option.value === value);
}

function coercePricingUnit(value: unknown, fallback: PricingUnit = "PIECE") {
  const normalized = stringFrom(value).trim().toUpperCase();
  return isPricingUnit(normalized) ? normalized : fallback;
}

function coercePricingMode(value: unknown, fallback: PricingMode = "ITEMIZED") {
  const normalized = stringFrom(value).trim().toUpperCase();
  return isPricingMode(normalized) ? normalized : fallback;
}

function coerceQuoteMode(value: unknown, fallback: QuoteMode = "INSTANT") {
  const normalized = stringFrom(value).trim().toUpperCase();
  return isQuoteMode(normalized) ? normalized : fallback;
}

function coerceBookingFieldType(
  value: unknown,
  fallback: BookingFieldType = "TEXT",
) {
  const normalized = stringFrom(value).trim().toUpperCase();
  return isBookingFieldType(normalized) ? normalized : fallback;
}

function choiceLabelsFromOptions(options: unknown) {
  if (!Array.isArray(options)) return "";

  return options
    .map((option) => {
      if (!isRecord(option)) return "";
      return stringFrom(option.label) || stringFrom(option.value);
    })
    .filter(Boolean)
    .join(", ");
}

function createBookingFieldDraft(index: number): BookingFieldDraft {
  return {
    id: createDraftId("question"),
    fieldKey: "",
    label: "",
    fieldType: "TEXT",
    isRequired: false,
    displayOrder: String(index + 1),
    placeholder: "",
    optionsText: "",
    validation: {},
  };
}

function bookingFieldToDraft(
  value: Record<string, unknown>,
  index: number,
): BookingFieldDraft {
  const validation = isRecord(value.validation) ? value.validation : {};

  return {
    id: createDraftId("question"),
    fieldKey: stringFrom(value.fieldKey),
    label: stringFrom(value.label),
    fieldType: coerceBookingFieldType(value.fieldType),
    isRequired: booleanFrom(value.isRequired),
    displayOrder: numberInputFrom(value.displayOrder, index + 1),
    placeholder: stringFrom(value.placeholder),
    optionsText: choiceLabelsFromOptions(value.options),
    validation,
  };
}

function createCatalogueItemDraft(index: number): CatalogueItemDraft {
  return {
    id: createDraftId("item"),
    itemCode: "",
    itemName: "",
    pricingUnit: "PIECE",
    isPopular: false,
    displayOrder: String(index + 1),
    defaultMinQuantity: "1",
    defaultMaxQuantity: "99",
    metadata: {},
  };
}

function catalogueItemToDraft(
  value: Record<string, unknown>,
  index: number,
): CatalogueItemDraft {
  const metadata = isRecord(value.metadata) ? value.metadata : {};

  return {
    id: createDraftId("item"),
    itemCode: stringFrom(value.itemCode),
    itemName: stringFrom(value.itemName),
    pricingUnit: coercePricingUnit(value.pricingUnit),
    isPopular: booleanFrom(value.isPopular),
    displayOrder: numberInputFrom(value.displayOrder, index + 1),
    defaultMinQuantity: numberInputFrom(value.defaultMinQuantity, 1),
    defaultMaxQuantity: numberInputFrom(value.defaultMaxQuantity, 99),
    metadata,
  };
}

function recordsToBookingFieldDrafts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((record, index) => bookingFieldToDraft(record, index));
}

function recordsToCatalogueItemDrafts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((record, index) => catalogueItemToDraft(record, index));
}

function parseIntegerInput(
  raw: string,
  label: string,
  fallback: number,
  min: number,
  max: number,
) {
  const trimmed = raw.trim();
  const value = trimmed ? Number(trimmed) : fallback;

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }

  return value;
}

function choiceFieldNeedsOptions(fieldType: BookingFieldType) {
  return fieldType === "SELECT" || fieldType === "MULTI_SELECT";
}

function splitChoiceLabels(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildBookingFields(fields: BookingFieldDraft[]) {
  const seenKeys = new Set<string>();

  return fields.map((field, index) => {
    const label = field.label.trim();
    const position = index + 1;

    if (!label) {
      throw new Error(`Customer question ${position} needs a label.`);
    }

    const fieldKey = toCode(field.fieldKey || label, `QUESTION_${position}`);

    if (seenKeys.has(fieldKey)) {
      throw new Error(`Customer question "${label}" is too similar to another question.`);
    }

    seenKeys.add(fieldKey);

    const displayOrder = parseIntegerInput(
      field.displayOrder,
      `Customer question "${label}" order`,
      position,
      0,
      10000,
    );
    const payload: Record<string, unknown> = {
      fieldKey,
      label,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      displayOrder,
      validation: field.validation,
    };

    const placeholder = field.placeholder.trim();
    if (placeholder) {
      payload.placeholder = placeholder;
    }

    if (choiceFieldNeedsOptions(field.fieldType)) {
      const options = splitChoiceLabels(field.optionsText).map(
        (optionLabel, optionIndex) => ({
          value: toCode(optionLabel, `OPTION_${optionIndex + 1}`),
          label: optionLabel,
        }),
      );

      if (!options.length) {
        throw new Error(`Customer question "${label}" needs at least one choice.`);
      }

      payload.options = options;
    }

    return payload;
  });
}

function buildCatalogueItemTemplates(
  items: CatalogueItemDraft[],
  itemLabel: string,
  codePrefix: string,
) {
  const seenCodes = new Set<string>();

  return items.map((item, index) => {
    const itemName = item.itemName.trim();
    const position = index + 1;

    if (!itemName) {
      throw new Error(`${itemLabel} ${position} needs a name.`);
    }

    const itemCode = toCode(item.itemCode || itemName, `${codePrefix}_${position}`);

    if (seenCodes.has(itemCode)) {
      throw new Error(`${itemLabel} "${itemName}" is too similar to another item.`);
    }

    seenCodes.add(itemCode);

    const defaultMinQuantity = parseIntegerInput(
      item.defaultMinQuantity,
      `${itemLabel} "${itemName}" minimum quantity`,
      1,
      1,
      100000,
    );
    const defaultMaxQuantity = parseIntegerInput(
      item.defaultMaxQuantity,
      `${itemLabel} "${itemName}" maximum quantity`,
      99,
      1,
      100000,
    );

    if (defaultMinQuantity > defaultMaxQuantity) {
      throw new Error(
        `${itemLabel} "${itemName}" maximum quantity must be greater than or equal to the minimum quantity.`,
      );
    }

    return {
      itemCode,
      itemName,
      pricingUnit: item.pricingUnit,
      isPopular: item.isPopular,
      displayOrder: parseIntegerInput(
        item.displayOrder,
        `${itemLabel} "${itemName}" order`,
        position,
        0,
        10000,
      ),
      defaultMinQuantity,
      defaultMaxQuantity,
      metadata: item.metadata,
    };
  });
}

function mergeAllowedUnits(
  selectedUnits: string[],
  ...draftGroups: CatalogueItemDraft[][]
) {
  const units = new Set(selectedUnits.filter(isPricingUnit));

  draftGroups.forEach((group) => {
    group.forEach((item) => units.add(item.pricingUnit));
  });

  if (!units.size) {
    units.add("PIECE");
  }

  return Array.from(units);
}

function presetItemsToDrafts(items: Record<string, unknown>[]) {
  return items.map((item, index) => catalogueItemToDraft(item, index));
}

function presetFieldsToDrafts(fields: Record<string, unknown>[]) {
  return fields.map((field, index) => bookingFieldToDraft(field, index));
}

const categoryTemplatePresets: CategoryTemplatePreset[] = [
  {
    label: "Laundry",
    categoryCode: "LAUNDRY",
    name: "Laundry",
    description: "Laundry, dry cleaning, and fabric care.",
    customerHelpText:
      "Add everyday laundry by kg and special garments as pieces in one pickup.",
    vendorHelpText:
      "Activate the laundry items you support and set per kg or per item rates.",
    multiServiceEnabled: true,
    instantEstimateEnabled: true,
    priceRevisionEnabled: true,
    allowedPricingUnits: ["KG", "PIECE", "BAG"],
    allowedPricingModes: ["WEIGHT", "ITEMIZED", "MIXED", "INSPECTION_REQUIRED"],
    defaultPricingMode: "MIXED",
    quoteMode: "INSTANT",
    fields: [
      {
        fieldKey: "STAIN_DETAILS",
        label: "Stain details",
        fieldType: "TEXT",
        displayOrder: 1,
      },
      {
        fieldKey: "SPECIAL_INSTRUCTIONS",
        label: "Special instructions",
        fieldType: "TEXT",
        displayOrder: 2,
      },
    ],
    itemTemplates: [
      {
        itemCode: "LAUNDRY_KG",
        itemName: "Regular laundry",
        pricingUnit: "KG",
        isPopular: true,
        displayOrder: 1,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 30,
      },
      {
        itemCode: "SHIRT",
        itemName: "Shirt",
        pricingUnit: "PIECE",
        isPopular: true,
        displayOrder: 2,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 99,
      },
      {
        itemCode: "TROUSER",
        itemName: "Trouser",
        pricingUnit: "PIECE",
        isPopular: true,
        displayOrder: 3,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 99,
      },
    ],
    addOnTemplates: [],
    workflow: { requiresPickupInspection: false },
  },
  {
    label: "Tailoring",
    categoryCode: "TAILORING",
    name: "Tailoring",
    description: "Stitching, alterations, and fitting services.",
    customerHelpText:
      "Add garments and alteration details. Vendor may confirm final price after review.",
    vendorHelpText:
      "Configure garment-wise stitching or alteration prices and required measurement fields.",
    multiServiceEnabled: true,
    instantEstimateEnabled: false,
    priceRevisionEnabled: true,
    allowedPricingUnits: ["PIECE"],
    allowedPricingModes: ["ITEMIZED", "INSPECTION_REQUIRED"],
    defaultPricingMode: "ITEMIZED",
    quoteMode: "PRICE_RANGE",
    fields: [
      {
        fieldKey: "ALTERATION_TYPE",
        label: "Stitching or alteration type",
        fieldType: "SELECT",
        isRequired: true,
        displayOrder: 1,
        options: [
          { value: "STITCHING", label: "Stitching" },
          { value: "ALTERATION", label: "Alteration" },
          { value: "FALL_PICO", label: "Fall and pico" },
        ],
      },
      {
        fieldKey: "MEASUREMENT_NOTES",
        label: "Measurements or fitting notes",
        fieldType: "TEXT",
        displayOrder: 2,
      },
    ],
    itemTemplates: [
      {
        itemCode: "BLOUSE",
        itemName: "Blouse",
        pricingUnit: "PIECE",
        isPopular: true,
        displayOrder: 1,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 20,
      },
      {
        itemCode: "PANT_ALTERATION",
        itemName: "Pant alteration",
        pricingUnit: "PIECE",
        isPopular: true,
        displayOrder: 2,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 20,
      },
    ],
    addOnTemplates: [],
    workflow: { requiresPickupInspection: true },
  },
  {
    label: "Gadget repair",
    categoryCode: "GADGET_REPAIR",
    name: "Gadget repair",
    description: "Mobile, laptop, tablet, and device repair services.",
    customerHelpText:
      "Share device details and issue. Vendor confirms price after diagnosis.",
    vendorHelpText:
      "Configure diagnostic fees and common repair item ranges.",
    multiServiceEnabled: false,
    instantEstimateEnabled: false,
    priceRevisionEnabled: true,
    allowedPricingUnits: ["DEVICE", "PIECE"],
    allowedPricingModes: ["INSPECTION_REQUIRED", "ITEMIZED"],
    defaultPricingMode: "INSPECTION_REQUIRED",
    quoteMode: "INSPECTION_REQUIRED",
    fields: [
      {
        fieldKey: "DEVICE_TYPE",
        label: "Device type",
        fieldType: "SELECT",
        isRequired: true,
        displayOrder: 1,
        options: [
          { value: "MOBILE", label: "Mobile" },
          { value: "LAPTOP", label: "Laptop" },
          { value: "TABLET", label: "Tablet" },
        ],
      },
      {
        fieldKey: "BRAND",
        label: "Brand",
        fieldType: "TEXT",
        isRequired: true,
        displayOrder: 2,
      },
      {
        fieldKey: "ISSUE_DESCRIPTION",
        label: "Issue description",
        fieldType: "TEXT",
        isRequired: true,
        displayOrder: 3,
      },
    ],
    itemTemplates: [
      {
        itemCode: "DIAGNOSIS",
        itemName: "Diagnosis",
        pricingUnit: "DEVICE",
        isPopular: true,
        displayOrder: 1,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 5,
      },
      {
        itemCode: "SCREEN_REPLACEMENT",
        itemName: "Screen replacement",
        pricingUnit: "PIECE",
        isPopular: true,
        displayOrder: 2,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 5,
      },
    ],
    addOnTemplates: [],
    workflow: { requiresPickupInspection: true, requiresDiagnosis: true },
  },
  {
    label: "Shoe cleaning",
    categoryCode: "SHOE_CLEANING",
    name: "Shoe cleaning",
    description: "Shoe cleaning, restoration, and care add-ons.",
    customerHelpText: "Add shoe pairs and optional care add-ons.",
    vendorHelpText: "Configure pair-wise cleaning and repair add-ons.",
    multiServiceEnabled: true,
    instantEstimateEnabled: true,
    priceRevisionEnabled: true,
    allowedPricingUnits: ["PAIR", "PIECE"],
    allowedPricingModes: ["ITEMIZED", "INSPECTION_REQUIRED"],
    defaultPricingMode: "ITEMIZED",
    quoteMode: "INSTANT",
    fields: [
      {
        fieldKey: "SHOE_MATERIAL",
        label: "Shoe material",
        fieldType: "SELECT",
        displayOrder: 1,
        options: [
          { value: "LEATHER", label: "Leather" },
          { value: "SUEDE", label: "Suede" },
          { value: "CANVAS", label: "Canvas" },
          { value: "SPORTS", label: "Sports shoes" },
        ],
      },
      {
        fieldKey: "SPECIAL_NOTES",
        label: "Special notes",
        fieldType: "TEXT",
        displayOrder: 2,
      },
    ],
    itemTemplates: [
      {
        itemCode: "SNEAKER_CLEANING",
        itemName: "Sneaker cleaning",
        pricingUnit: "PAIR",
        isPopular: true,
        displayOrder: 1,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 20,
      },
      {
        itemCode: "LEATHER_CLEANING",
        itemName: "Leather shoe cleaning",
        pricingUnit: "PAIR",
        isPopular: true,
        displayOrder: 2,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 20,
      },
    ],
    addOnTemplates: [
      {
        itemCode: "POLISH",
        itemName: "Polish",
        pricingUnit: "PAIR",
        isPopular: true,
        displayOrder: 1,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 20,
      },
      {
        itemCode: "WATERPROOFING",
        itemName: "Waterproofing",
        pricingUnit: "PAIR",
        displayOrder: 2,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 20,
      },
    ],
    workflow: { requiresPickupInspection: false },
  },
  {
    label: "Home cleaning",
    categoryCode: "HOME_CLEANING",
    name: "Home cleaning",
    description: "Home, kitchen, bathroom, and deep cleaning services.",
    customerHelpText: "Choose the area and add any instructions for the visit.",
    vendorHelpText: "Configure visit-wise and room-wise cleaning services.",
    multiServiceEnabled: true,
    instantEstimateEnabled: true,
    priceRevisionEnabled: true,
    allowedPricingUnits: ["VISIT", "SQFT", "HOUR"],
    allowedPricingModes: ["FIXED", "DURATION", "INSPECTION_REQUIRED"],
    defaultPricingMode: "FIXED",
    quoteMode: "PRICE_RANGE",
    fields: [
      {
        fieldKey: "PROPERTY_TYPE",
        label: "Property type",
        fieldType: "SELECT",
        isRequired: true,
        displayOrder: 1,
        options: [
          { value: "APARTMENT", label: "Apartment" },
          { value: "VILLA", label: "Villa" },
          { value: "OFFICE", label: "Office" },
        ],
      },
      {
        fieldKey: "AREA_SIZE",
        label: "Area size",
        fieldType: "NUMBER",
        displayOrder: 2,
        placeholder: "1200 sqft",
      },
      {
        fieldKey: "SPECIAL_INSTRUCTIONS",
        label: "Special instructions",
        fieldType: "TEXT",
        displayOrder: 3,
      },
    ],
    itemTemplates: [
      {
        itemCode: "BASIC_CLEANING",
        itemName: "Basic cleaning",
        pricingUnit: "VISIT",
        isPopular: true,
        displayOrder: 1,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 10,
      },
      {
        itemCode: "DEEP_CLEANING",
        itemName: "Deep cleaning",
        pricingUnit: "VISIT",
        isPopular: true,
        displayOrder: 2,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 10,
      },
    ],
    addOnTemplates: [
      {
        itemCode: "BALCONY_CLEANING",
        itemName: "Balcony cleaning",
        pricingUnit: "VISIT",
        displayOrder: 1,
        defaultMinQuantity: 1,
        defaultMaxQuantity: 10,
      },
    ],
    workflow: { requiresPickupInspection: false },
  },
];

function splitList(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function joinList(values: readonly string[]) {
  return values.join(", ");
}

function humanizeToken(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function PreviewList({
  emptyText,
  items,
  title: listTitle,
}: {
  emptyText: string;
  items: string[];
  title: string;
}) {
  const visibleItems = items.slice(0, 3);
  const remainingCount = items.length - visibleItems.length;

  return (
    <div className="border-t border-border pt-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {listTitle}
      </p>
      {visibleItems.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {visibleItems.map((item) => (
            <span
              className="max-w-full truncate rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground"
              key={item}
            >
              {item}
            </span>
          ))}
          {remainingCount > 0 ? (
            <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-muted">
              +{remainingCount} more
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-muted">{emptyText}</p>
      )}
    </div>
  );
}

function CustomerQuestionsBuilder({
  fields,
  onAdd,
  onRemove,
  onUpdate,
}: {
  fields: BookingFieldDraft[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, changes: Partial<BookingFieldDraft>) => void;
}) {
  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          Customer questions
        </span>
        <button
          className="inline-flex min-h-9 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-semibold text-foreground transition hover:border-primary/35"
          type="button"
          onClick={onAdd}
        >
          <Plus className="size-4" />
          Add question
        </button>
      </div>

      {fields.length ? (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              className="space-y-3 rounded-[0.65rem] border border-border bg-surface p-3"
              key={field.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Question {index + 1}
                </span>
                <button
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-[0.65rem] border border-border bg-surface px-2 text-xs font-semibold text-muted transition hover:text-danger"
                  type="button"
                  onClick={() => onRemove(field.id)}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">
                    Question label
                  </span>
                  <input
                    className="form-input"
                    placeholder="Special instructions"
                    value={field.label}
                    onChange={(event) =>
                      onUpdate(field.id, { label: event.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">
                    Answer type
                  </span>
                  <select
                    className="form-input"
                    value={field.fieldType}
                    onChange={(event) =>
                      onUpdate(field.id, {
                        fieldType: event.target.value as BookingFieldType,
                      })
                    }
                  >
                    {bookingFieldTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">
                    Placeholder
                  </span>
                  <input
                    className="form-input"
                    placeholder="Optional"
                    value={field.placeholder}
                    onChange={(event) =>
                      onUpdate(field.id, { placeholder: event.target.value })
                    }
                  />
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">
                      Order
                    </span>
                    <input
                      className="form-input"
                      min={0}
                      type="number"
                      value={field.displayOrder}
                      onChange={(event) =>
                        onUpdate(field.id, { displayOrder: event.target.value })
                      }
                    />
                  </label>
                  <label className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                    <input
                      checked={field.isRequired}
                      type="checkbox"
                      onChange={(event) =>
                        onUpdate(field.id, { isRequired: event.target.checked })
                      }
                    />
                    Required
                  </label>
                </div>
                {choiceFieldNeedsOptions(field.fieldType) ? (
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-semibold text-muted">
                      Choices
                    </span>
                    <textarea
                      className="form-input min-h-16 resize-y"
                      placeholder="Mobile, Laptop, Tablet"
                      value={field.optionsText}
                      onChange={(event) =>
                        onUpdate(field.id, { optionsText: event.target.value })
                      }
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-[0.65rem] border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted">
          No customer questions added.
        </p>
      )}
    </div>
  );
}

function CatalogueItemsBuilder({
  addLabel,
  emptyText,
  items,
  onAdd,
  onRemove,
  onUpdate,
  title: builderTitle,
}: {
  addLabel: string;
  emptyText: string;
  items: CatalogueItemDraft[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, changes: Partial<CatalogueItemDraft>) => void;
  title: string;
}) {
  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {builderTitle}
        </span>
        <button
          className="inline-flex min-h-9 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-semibold text-foreground transition hover:border-primary/35"
          type="button"
          onClick={onAdd}
        >
          <Plus className="size-4" />
          {addLabel}
        </button>
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              className="space-y-3 rounded-[0.65rem] border border-border bg-surface p-3"
              key={item.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Item {index + 1}
                </span>
                <button
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-[0.65rem] border border-border bg-surface px-2 text-xs font-semibold text-muted transition hover:text-danger"
                  type="button"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">
                    Name
                  </span>
                  <input
                    className="form-input"
                    placeholder="Regular laundry"
                    value={item.itemName}
                    onChange={(event) =>
                      onUpdate(item.id, { itemName: event.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted">
                    Unit
                  </span>
                  <select
                    className="form-input"
                    value={item.pricingUnit}
                    onChange={(event) =>
                      onUpdate(item.id, {
                        pricingUnit: event.target.value as PricingUnit,
                      })
                    }
                  >
                    {pricingUnitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {humanizeToken(unit)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">
                      Min qty
                    </span>
                    <input
                      className="form-input"
                      min={1}
                      type="number"
                      value={item.defaultMinQuantity}
                      onChange={(event) =>
                        onUpdate(item.id, {
                          defaultMinQuantity: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">
                      Max qty
                    </span>
                    <input
                      className="form-input"
                      min={1}
                      type="number"
                      value={item.defaultMaxQuantity}
                      onChange={(event) =>
                        onUpdate(item.id, {
                          defaultMaxQuantity: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted">
                      Order
                    </span>
                    <input
                      className="form-input"
                      min={0}
                      type="number"
                      value={item.displayOrder}
                      onChange={(event) =>
                        onUpdate(item.id, { displayOrder: event.target.value })
                      }
                    />
                  </label>
                  <label className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                    <input
                      checked={item.isPopular}
                      type="checkbox"
                      onChange={(event) =>
                        onUpdate(item.id, { isPopular: event.target.checked })
                      }
                    />
                    Popular
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-[0.65rem] border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted">
          {emptyText}
        </p>
      )}
    </div>
  );
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
        ? `${action.type}:${action.record?.categoryId ?? "new"}:${action.action}`
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
  const categoryRecord =
    action.type === "categories" && action.action !== "CREATE"
      ? action.record
      : null;
  const template: CategoryBookingTemplate =
    categoryRecord?.bookingTemplate ?? {};
  const [city, setCity] = useState(
    action.type === "zones" ? (action.record?.city ?? "") : "",
  );
  const [description, setDescription] = useState(
    categoryRecord ? (categoryRecord.description ?? "") : "",
  );
  const [displayOrder, setDisplayOrder] = useState(
    categoryRecord ? String(categoryRecord.displayOrder) : "0",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryImagePreviewUrl, setCategoryImagePreviewUrl] = useState(
    categoryRecord?.iconUrl ?? categoryRecord?.icon?.url ?? "",
  );
  const [categoryIsActive, setCategoryIsActive] = useState(
    categoryRecord?.isActive ?? true,
  );
  const [name, setName] = useState(
    categoryRecord
      ? categoryRecord.name
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
    (template.allowedPricingUnits ?? ["PIECE"]).join(", "),
  );
  const [allowedPricingModes, setAllowedPricingModes] = useState(
    (template.allowedPricingModes ?? ["ITEMIZED"]).join(", "),
  );
  const [defaultPricingMode, setDefaultPricingMode] = useState<PricingMode>(
    coercePricingMode(template.defaultPricingMode),
  );
  const [quoteMode, setQuoteMode] = useState<QuoteMode>(
    coerceQuoteMode(template.quoteMode),
  );
  const [customerHelpText, setCustomerHelpText] = useState(
    template.customerHelpText ?? "",
  );
  const [vendorHelpText, setVendorHelpText] = useState(
    template.vendorHelpText ?? "",
  );
  const [customerFields, setCustomerFields] = useState(() =>
    recordsToBookingFieldDrafts(template.fields),
  );
  const [serviceItemTemplates, setServiceItemTemplates] = useState(() =>
    recordsToCatalogueItemDrafts(template.itemTemplates),
  );
  const [addOnTemplates, setAddOnTemplates] = useState(() =>
    recordsToCatalogueItemDrafts(template.addOnTemplates),
  );
  const [categoryWorkflow, setCategoryWorkflow] = useState<Record<string, unknown>>(
    isRecord(template.workflow) ? template.workflow : {},
  );
  const [showAdvancedCategory, setShowAdvancedCategory] = useState(false);
  const isCategoryAction = action.type === "categories";
  const isServiceTypeForm =
    action.type === "serviceTypes" &&
    (action.action === "CREATE" || action.action === "EDIT");
  const modalWidthClass =
    isCategoryAction
      ? "max-w-[96rem]"
      : isServiceTypeForm
        ? "max-w-6xl"
        : "max-w-xl";

  useEffect(() => {
    return () => {
      if (categoryImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(categoryImagePreviewUrl);
      }
    };
  }, [categoryImagePreviewUrl]);

  const applyPricingStyle = (style: (typeof pricingStyleOptions)[number]) => {
    setDefaultPricingMode(style.value);
    setAllowedPricingModes(joinList(style.modes));
    setAllowedPricingUnits(joinList(style.units));
  };

  const togglePricingUnit = (unit: string) => {
    const currentUnits = splitList(allowedPricingUnits);
    const exists = currentUnits.includes(unit);

    if (exists && currentUnits.length === 1) {
      return;
    }

    const nextUnits = exists
      ? currentUnits.filter((item) => item !== unit)
      : [...currentUnits, unit];

    setAllowedPricingUnits(joinList(nextUnits));
  };

  const togglePricingMode = (mode: string) => {
    const currentModes = splitList(allowedPricingModes);
    const exists = currentModes.includes(mode);

    if (exists && currentModes.length === 1) {
      return;
    }

    const nextModes = exists
      ? currentModes.filter((item) => item !== mode)
      : [...currentModes, mode];

    setAllowedPricingModes(joinList(nextModes));
  };

  const addCustomerQuestion = () => {
    setCustomerFields((current) => [
      ...current,
      createBookingFieldDraft(current.length),
    ]);
  };

  const updateCustomerQuestion = (
    id: string,
    changes: Partial<BookingFieldDraft>,
  ) => {
    setCustomerFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...changes } : field,
      ),
    );
  };

  const removeCustomerQuestion = (id: string) => {
    setCustomerFields((current) => current.filter((field) => field.id !== id));
  };

  const addServiceItem = () => {
    setServiceItemTemplates((current) => [
      ...current,
      createCatalogueItemDraft(current.length),
    ]);
  };

  const updateServiceItem = (
    id: string,
    changes: Partial<CatalogueItemDraft>,
  ) => {
    setServiceItemTemplates((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  };

  const removeServiceItem = (id: string) => {
    setServiceItemTemplates((current) =>
      current.filter((item) => item.id !== id),
    );
  };

  const addAddOn = () => {
    setAddOnTemplates((current) => [
      ...current,
      createCatalogueItemDraft(current.length),
    ]);
  };

  const updateAddOn = (id: string, changes: Partial<CatalogueItemDraft>) => {
    setAddOnTemplates((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  };

  const removeAddOn = (id: string) => {
    setAddOnTemplates((current) => current.filter((item) => item.id !== id));
  };

  const applyCategoryPreset = (preset: CategoryTemplatePreset) => {
    setCategoryCode(preset.categoryCode);
    setName(preset.name);
    setDescription(preset.description);
    setCustomerHelpText(preset.customerHelpText);
    setVendorHelpText(preset.vendorHelpText);
    setMultiServiceEnabled(preset.multiServiceEnabled);
    setInstantEstimateEnabled(preset.instantEstimateEnabled);
    setPriceRevisionEnabled(preset.priceRevisionEnabled);
    setAllowedPricingUnits(joinList(preset.allowedPricingUnits));
    setAllowedPricingModes(joinList(preset.allowedPricingModes));
    setDefaultPricingMode(preset.defaultPricingMode);
    setQuoteMode(preset.quoteMode);
    setCustomerFields(presetFieldsToDrafts(preset.fields));
    setServiceItemTemplates(presetItemsToDrafts(preset.itemTemplates));
    setAddOnTemplates(presetItemsToDrafts(preset.addOnTemplates));
    setCategoryWorkflow(preset.workflow);
  };

  const previewQuestions = customerFields
    .map((field) => field.label.trim())
    .filter(Boolean);
  const previewItems = serviceItemTemplates
    .map((item) => item.itemName.trim())
    .filter(Boolean);
  const previewAddOns = addOnTemplates
    .map((item) => item.itemName.trim())
    .filter(Boolean);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      setFormError(
        isCategoryAction
          ? "Add a short change note."
          : "Reason must be at least 3 characters.",
      );
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
        const itemTemplates = buildCatalogueItemTemplates(
          serviceItemTemplates,
          "Service item",
          "SERVICE_ITEM",
        );
        const addOnTemplatePayloads = buildCatalogueItemTemplates(
          addOnTemplates,
          "Add-on",
          "ADD_ON",
        );
        const selectedPricingModes =
          csvToList(allowedPricingModes).filter(isPricingMode);
        const bookingTemplate: CategoryBookingTemplate = {
          schemaVersion: categoryRecord?.bookingTemplate?.schemaVersion ?? 1,
          isEnabled: templateEnabled,
          multiServiceEnabled,
          instantEstimateEnabled,
          priceRevisionEnabled,
          allowedPricingUnits: mergeAllowedUnits(
            csvToList(allowedPricingUnits),
            serviceItemTemplates,
            addOnTemplates,
          ),
          allowedPricingModes: selectedPricingModes.length
            ? selectedPricingModes
            : [defaultPricingMode],
          defaultPricingMode,
          quoteMode,
          customerHelpText: customerHelpText.trim() || undefined,
          vendorHelpText: vendorHelpText.trim() || undefined,
          fields: buildBookingFields(customerFields),
          itemTemplates,
          addOnTemplates: addOnTemplatePayloads,
          workflow: categoryWorkflow,
        };

        onSubmit({
          categoryCode:
            action.action === "CREATE"
              ? categoryCode.trim().toUpperCase() || undefined
              : undefined,
          name: name.trim() || undefined,
          description: description.trim() || null,
          categoryImageFile,
          bookingTemplate,
          displayOrder: displayOrder ? Number(displayOrder) : undefined,
          isActive:
            action.action === "CREATE"
              ? categoryIsActive
              : action.action === "EDIT"
                ? categoryIsActive
              : action.action === "ACTIVATE"
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
    } catch (submitError) {
      const friendlyMessage =
        submitError instanceof Error ? submitError.message : null;
      setFormError(
        isCategoryAction
          ? (friendlyMessage ?? "Category details need a quick check.")
          : "Value must match the expected type.",
      );
    }
  };

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6 lg:items-center">
      <div
        className={`flex max-h-[calc(100vh-1.5rem)] w-full ${modalWidthClass} flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold tracking-normal text-foreground">
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
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="space-y-4">
                    <div className="grid gap-3 rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-semibold text-foreground">
                          Category name
                        </span>
                        <input
                          className="form-input"
                          placeholder="Laundry"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-sm font-semibold text-foreground">
                          Home screen order
                        </span>
                        <input
                          className="form-input"
                          min={0}
                          type="number"
                          value={displayOrder}
                          onChange={(event) => setDisplayOrder(event.target.value)}
                        />
                      </label>
                      <label className="block space-y-1.5 sm:col-span-2">
                        <span className="text-sm font-semibold text-foreground">
                          Short description
                        </span>
                        <textarea
                          className="form-input min-h-20 resize-y"
                          placeholder="Laundry, ironing, and dry cleaning"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          Booking setup
                        </p>
                        <label className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-foreground">
                          <input
                            checked={templateEnabled}
                            type="checkbox"
                            onChange={(event) =>
                              setTemplateEnabled(event.target.checked)
                            }
                          />
                          Bookable
                        </label>
                      </div>

                      <div className="mt-4 space-y-4">
                        {action.action === "CREATE" ? (
                          <div className="space-y-2">
                            <span className="text-sm font-semibold text-foreground">
                              Start from
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {categoryTemplatePresets.map((preset) => (
                                <button
                                  className="min-h-9 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-muted transition hover:border-primary/35 hover:text-foreground"
                                  key={preset.categoryCode}
                                  type="button"
                                  onClick={() => applyCategoryPreset(preset)}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-foreground">
                            Pricing style
                          </span>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {pricingStyleOptions.map((style) => {
                              const selected = defaultPricingMode === style.value;

                              return (
                                <button
                                  className={`flex min-h-10 items-center justify-center rounded-[0.65rem] border px-3 text-sm font-semibold transition ${
                                    selected
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border bg-surface text-foreground hover:border-primary/35"
                                  }`}
                                  key={style.value}
                                  type="button"
                                  onClick={() => applyPricingStyle(style)}
                                >
                                  {selected ? <Check className="mr-1.5 size-4" /> : null}
                                  {style.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block space-y-1.5">
                            <span className="text-sm font-semibold text-foreground">
                              Price shown as
                            </span>
                            <select
                              className="form-input"
                              value={quoteMode}
                              onChange={(event) =>
                                setQuoteMode(event.target.value as QuoteMode)
                              }
                            >
                              {quoteModeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-2 pt-6">
                            <label className="flex min-h-10 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                              <input
                                checked={multiServiceEnabled}
                                type="checkbox"
                                onChange={(event) =>
                                  setMultiServiceEnabled(event.target.checked)
                                }
                              />
                              Multiple services
                            </label>
                            <label className="flex min-h-10 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-medium text-foreground">
                              <input
                                checked={instantEstimateEnabled}
                                type="checkbox"
                                onChange={(event) =>
                                  setInstantEstimateEnabled(event.target.checked)
                                }
                              />
                              Instant price
                            </label>
                          </div>
                        </div>

                        <label className="flex min-h-10 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-medium text-foreground sm:w-max">
                          <input
                            checked={priceRevisionEnabled}
                            type="checkbox"
                            onChange={(event) =>
                              setPriceRevisionEnabled(event.target.checked)
                            }
                          />
                          Adjust price later
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block space-y-1.5">
                            <span className="text-sm font-semibold text-foreground">
                              Customer note
                            </span>
                            <textarea
                              className="form-input min-h-16 resize-y"
                              value={customerHelpText}
                              onChange={(event) =>
                                setCustomerHelpText(event.target.value)
                              }
                            />
                          </label>
                          <label className="block space-y-1.5">
                            <span className="text-sm font-semibold text-foreground">
                              Vendor note
                            </span>
                            <textarea
                              className="form-input min-h-16 resize-y"
                              value={vendorHelpText}
                              onChange={(event) =>
                                setVendorHelpText(event.target.value)
                              }
                            />
                          </label>
                        </div>

                        <button
                          aria-expanded={showAdvancedCategory}
                          className="inline-flex min-h-9 items-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-semibold text-muted transition hover:text-foreground"
                          type="button"
                          onClick={() =>
                            setShowAdvancedCategory((current) => !current)
                          }
                        >
                          More options
                          <ChevronDown
                            className={`size-4 transition ${
                              showAdvancedCategory ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {showAdvancedCategory ? (
                          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                            {action.action === "CREATE" ? (
                              <label className="block space-y-1.5">
                                <span className="text-sm font-semibold text-foreground">
                                  Category code
                                </span>
                                <input
                                  className="form-input"
                                  placeholder="HOME_CLEANING"
                                  value={categoryCode}
                                  onChange={(event) =>
                                    setCategoryCode(event.target.value)
                                  }
                                />
                              </label>
                            ) : null}
                            <div className="space-y-2 sm:col-span-2">
                              <span className="text-sm font-semibold text-foreground">
                                Units
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {pricingUnitOptions.map((unit) => {
                                  const selected = splitList(
                                    allowedPricingUnits,
                                  ).includes(unit);

                                  return (
                                    <button
                                      className={`min-h-9 rounded-full border px-3 text-sm font-semibold transition ${
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-surface text-muted hover:text-foreground"
                                      }`}
                                      key={unit}
                                      type="button"
                                      onClick={() => togglePricingUnit(unit)}
                                    >
                                      {humanizeToken(unit)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <span className="text-sm font-semibold text-foreground">
                                Price types
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {pricingModeOptions.map((mode) => {
                                  const selected = splitList(
                                    allowedPricingModes,
                                  ).includes(mode);

                                  return (
                                    <button
                                      className={`min-h-9 rounded-full border px-3 text-sm font-semibold transition ${
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-surface text-muted hover:text-foreground"
                                      }`}
                                      key={mode}
                                      type="button"
                                      onClick={() => togglePricingMode(mode)}
                                    >
                                      {humanizeToken(mode)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <CustomerQuestionsBuilder
                              fields={customerFields}
                              onAdd={addCustomerQuestion}
                              onRemove={removeCustomerQuestion}
                              onUpdate={updateCustomerQuestion}
                            />
                            <CatalogueItemsBuilder
                              addLabel="Add item"
                              emptyText="No service items added."
                              items={serviceItemTemplates}
                              title="Service items"
                              onAdd={addServiceItem}
                              onRemove={removeServiceItem}
                              onUpdate={updateServiceItem}
                            />
                            <CatalogueItemsBuilder
                              addLabel="Add add-on"
                              emptyText="No add-ons added."
                              items={addOnTemplates}
                              title="Optional add-ons"
                              onAdd={addAddOn}
                              onRemove={removeAddOn}
                              onUpdate={updateAddOn}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-3 rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        Customer app
                      </span>
                      <label className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-foreground">
                        <input
                          checked={categoryIsActive}
                          type="checkbox"
                          onChange={(event) =>
                            setCategoryIsActive(event.target.checked)
                          }
                        />
                        Visible
                      </label>
                    </div>
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[0.75rem] border border-border bg-surface">
                      {categoryImagePreviewUrl ? (
                        <img
                          alt=""
                          className="h-full w-full object-contain p-3"
                          src={categoryImagePreviewUrl}
                        />
                      ) : (
                        <ImageIcon className="size-10 text-muted" />
                      )}
                    </div>
                    <label className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[0.65rem] border border-border bg-surface px-3 text-sm font-semibold text-foreground transition hover:bg-surface-muted">
                      <Upload className="size-4" />
                      <span>Upload image</span>
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setCategoryImageFile(file);

                          if (file) {
                            const objectUrl = URL.createObjectURL(file);
                            setCategoryImagePreviewUrl(objectUrl);
                          }
                        }}
                      />
                    </label>
                    <div className="space-y-3 border-t border-border pt-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {name.trim() || "New category"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                          {description.trim() || "No description added."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground">
                          {humanizeToken(defaultPricingMode)}
                        </span>
                        <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-semibold text-muted">
                          {quoteModeOptions.find(
                            (option) => option.value === quoteMode,
                          )?.label ?? "Instant"}
                        </span>
                      </div>
                      <PreviewList
                        emptyText="No questions."
                        items={previewQuestions}
                        title="Questions"
                      />
                      <PreviewList
                        emptyText="No service items."
                        items={previewItems}
                        title="Items"
                      />
                      <PreviewList
                        emptyText="No add-ons."
                        items={previewAddOns}
                        title="Add-ons"
                      />
                    </div>
                  </aside>
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
                  {isCategoryAction ? "Change note" : "Reason"}{" "}
                  <span className="text-danger">*</span>
                </span>
                <textarea
                  className="form-input min-h-20 resize-y"
                  placeholder={
                    isCategoryAction
                      ? "Example: Updated laundry image"
                      : "Required for audit history"
                  }
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
              {actionLabel(action.action)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
