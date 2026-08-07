import type { ApiErrorDetails } from "../../../types/api.types";

export type SettingsRecordType = "settings" | "categories" | "zones";

export interface CategoryBookingTemplate {
  schemaVersion?: number;
  isEnabled?: boolean;
  multiServiceEnabled?: boolean;
  instantEstimateEnabled?: boolean;
  priceRevisionEnabled?: boolean;
  allowedPricingUnits?: string[];
  allowedPricingModes?: string[];
  defaultPricingMode?: string;
  quoteMode?: string;
  customerHelpText?: string;
  vendorHelpText?: string;
  fields?: Record<string, unknown>[];
  itemTemplates?: Record<string, unknown>[];
  addOnTemplates?: Record<string, unknown>[];
  workflow?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SettingsListQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  isEditable?: boolean;
  search?: string;
}

export interface SettingsCategoriesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface SettingsZonesQueryParams extends SettingsCategoriesQueryParams {
  city?: string;
}

export type PolicyFamily =
  | "CUSTOMER_CATEGORY_PLACEMENT"
  | "NOTIFICATION_WORKFLOW"
  | "MEDIA_REEL_RULE"
  | "PRICING_RULE"
  | "COMMISSION_RULE";

export type PolicyStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type PolicyScopeType = "GLOBAL" | "CATEGORY" | "CITY" | "ZONE" | "VENDOR";

export interface PolicyRulesQueryParams {
  family?: PolicyFamily;
  status?: PolicyStatus;
  scopeType?: PolicyScopeType;
}

export interface UpdateSettingPayload {
  value: unknown;
  reason?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string | null;
  iconAssetId?: string | null;
  bookingTemplate?: CategoryBookingTemplate;
  isActive?: boolean;
  displayOrder?: number;
  reason?: string;
}

export interface CreateCategoryPayload {
  categoryCode?: string;
  name: string;
  description?: string | null;
  iconAssetId?: string | null;
  bookingTemplate?: CategoryBookingTemplate;
  isActive?: boolean;
  displayOrder?: number;
  reason: string;
}

export interface CategoryImageUploadIntentPayload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
}

export interface ConfirmCategoryImageUploadPayload {
  mediaAssetId: string;
  checksum?: string;
  uploadedAt?: string;
  width?: number;
  height?: number;
  reason: string;
}

export interface CategoryImageUploadIntent {
  mediaAssetId: string;
  uploadUrl: string | null;
  headers: Record<string, string>;
  providerStatus: string;
  warnings: string[];
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  recommendedDimensions: {
    aspectRatio: string;
    minWidth: number;
    minHeight: number;
  };
}

export interface ServiceCategoryIcon {
  mediaAssetId: string;
  url: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  status: string;
  accessLevel: string;
  providerStatus: string;
  warnings: string[];
  updatedAt: string;
}

export interface CategoryImageUploadResult {
  category: ServiceCategory;
  image: ServiceCategoryIcon | null;
  providerStatus: string;
  warnings: string[];
}

export type SettingsServiceTypesQueryParams = SettingsCategoriesQueryParams;

export interface ServiceTypeUsage {
  vendorServiceCount: number;
  activeVendorServiceCount: number;
}

export interface ServiceTypeSummary extends ServiceTypeUsage {
  total: number;
  active: number;
  inactive: number;
}

export interface CreateServiceTypePayload {
  serviceTypeCode: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  displayOrder?: number;
  metadata?: Record<string, unknown>;
  reason: string;
}

export interface UpdateServiceTypePayload {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  displayOrder?: number;
  metadata?: Record<string, unknown>;
  reason: string;
}

export interface CreateZonePayload {
  city: string;
  zoneName: string;
  pincodeList?: string[] | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  reason?: string;
}

export type UpdateZonePayload = Partial<CreateZonePayload>;

export interface UpsertPolicyRulePayload {
  family: PolicyFamily;
  ruleKey: string;
  displayName: string;
  description?: string | null;
  status?: PolicyStatus;
  priority?: number;
  scopeType?: PolicyScopeType;
  categoryId?: string | null;
  city?: string | null;
  zoneId?: string | null;
  vendorId?: string | null;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  reason: string;
}

export interface PricingPolicyPreviewPayload {
  categoryId?: string;
  city?: string;
  zoneId?: string;
  vendorId?: string;
  subtotalPaise: number;
}

export interface SettingsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PlatformSetting {
  settingId: string;
  settingKey: string;
  category: string;
  displayName: string;
  description: string | null;
  valueType: string;
  value: unknown;
  defaultValue: unknown;
  isValueMasked: boolean;
  isEditable: boolean;
  isSensitive: boolean;
  updatedByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  categoryId: string;
  categoryCode: string;
  name: string;
  description: string | null;
  iconAssetId: string | null;
  iconUrl: string | null;
  icon: ServiceCategoryIcon | null;
  bookingTemplate: CategoryBookingTemplate;
  isActive: boolean;
  displayOrder: number;
  warnings: string[];
  availableActions: string[];
  nextRecommendedAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceZone {
  zoneId: string;
  city: string;
  zoneName: string;
  pincodeList: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  warnings: string[];
  availableActions: string[];
  nextRecommendedAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceType {
  serviceTypeId: string;
  categoryId: string;
  serviceTypeCode: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  metadata: Record<string, unknown>;
  usage: ServiceTypeUsage;
  warnings: string[];
  availableActions: string[];
  nextRecommendedAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyRule {
  policyRuleId: string;
  family: PolicyFamily;
  ruleKey: string;
  displayName: string;
  description: string | null;
  status: PolicyStatus;
  priority: number;
  scope: {
    scopeType: PolicyScopeType;
    categoryId: string | null;
    city: string | null;
    zoneId: string | null;
    vendorId: string | null;
  };
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  updatedAt: string;
  availableActions: string[];
}

export interface PricingPolicyPreview {
  context: {
    categoryId?: string;
    city?: string;
    zoneId?: string;
    vendorId?: string;
  };
  subtotalPaise: number;
  customerPayablePaise: number;
  vendorNetPayablePaise: number;
  commissionAmountPaise: number;
  fees: {
    platformFeePaise: number;
    pickupFeePaise: number;
    deliveryFeePaise: number;
    taxPaise: number;
    discountPaise: number;
  };
  appliedRules: {
    pricing: {
      ruleId: string | null;
      ruleKey: string;
      version: number;
      providerStatus: string;
    };
    commission: {
      ruleId: string | null;
      ruleKey: string;
      version: number;
      providerStatus: string;
    };
  };
  warnings: string[];
}

export type SettingsRecord = PlatformSetting | ServiceCategory | ServiceZone;

export interface SettingsApiResponse<TData> {
  success?: boolean;
  code?: string;
  message?: string;
  data: TData;
  meta?: {
    requestId?: string;
    timestamp?: string;
    path?: string;
    method?: string;
    durationMs?: number;
    apiVersion?: string;
  };
}

export interface PlatformSettingsListResponse extends SettingsApiResponse<
  PlatformSetting[]
> {
  data: PlatformSetting[];
  pagination: SettingsPagination;
}

export interface ServiceCategoriesListResponse extends SettingsApiResponse<
  ServiceCategory[]
> {
  data: ServiceCategory[];
  pagination: SettingsPagination;
}

export interface ServiceZonesListResponse extends SettingsApiResponse<
  ServiceZone[]
> {
  data: ServiceZone[];
  pagination: SettingsPagination;
}

export interface ServiceTypesListResponse extends SettingsApiResponse<ServiceType[]> {
  data: ServiceType[];
  category: ServiceCategory;
  pagination: SettingsPagination;
  summary: ServiceTypeSummary;
}

export interface PolicyRulesListResponse extends SettingsApiResponse<PolicyRule[]> {
  data: PolicyRule[];
}

export type PlatformSettingResponse = SettingsApiResponse<PlatformSetting>;
export type ServiceCategoryResponse = SettingsApiResponse<ServiceCategory>;
export type ServiceZoneResponse = SettingsApiResponse<ServiceZone>;
export type ServiceTypeResponse = SettingsApiResponse<ServiceType>;
export type PolicyRuleResponse = SettingsApiResponse<PolicyRule>;
export type PricingPolicyPreviewResponse =
  SettingsApiResponse<PricingPolicyPreview>;
export type UpdateSettingResponse = SettingsApiResponse<PlatformSetting>;
export type UpdateCategoryResponse = SettingsApiResponse<ServiceCategory>;
export type CreateCategoryResponse = SettingsApiResponse<ServiceCategory>;
export type CategoryImageUploadIntentResponse =
  SettingsApiResponse<CategoryImageUploadIntent>;
export type CategoryImageUploadResponse =
  SettingsApiResponse<CategoryImageUploadResult>;
export type CreateZoneResponse = SettingsApiResponse<ServiceZone>;
export type UpdateZoneResponse = SettingsApiResponse<ServiceZone>;

export interface SettingsApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string;
    code: string;
    message: string;
  }[];
}
