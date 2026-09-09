export type GeoLevel = "countries" | "states" | "districts" | "cities";

export interface GeoTranslations {
  ta?: {
    name?: string;
  };
}

interface GeoRecordBase {
  name: string;
  translations?: GeoTranslations;
  isActive: boolean;
  displayOrder: number;
  availableActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Country extends GeoRecordBase {
  countryId: string;
  isoCode: string;
}

export interface State extends GeoRecordBase {
  stateId: string;
  countryId: string;
  stateCode: string;
}

export interface District extends GeoRecordBase {
  districtId: string;
  stateId: string;
  districtCode: string;
}

export interface City extends GeoRecordBase {
  cityId: string;
  districtId: string;
  cityCode: string;
}

export type GeoRecord = Country | State | District | City;

export interface GeoListQueryParams {
  page?: number;
  limit?: number;
  parentId?: string;
  search?: string;
  isActive?: boolean;
}

export interface GeoPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface GeoListResponse<T> {
  code: string;
  message: string;
  data: T[];
  pagination: GeoPagination;
}

export interface GeoRecordResponse<T> {
  code: string;
  message: string;
  data: T;
}

export interface CreateCountryPayload {
  isoCode: string;
  name: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason: string;
}

export interface UpdateCountryPayload {
  isoCode?: string;
  name?: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason?: string;
}

export interface CreateStatePayload {
  countryId: string;
  stateCode: string;
  name: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason: string;
}

export interface UpdateStatePayload {
  stateCode?: string;
  name?: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason?: string;
}

export interface CreateDistrictPayload {
  stateId: string;
  districtCode: string;
  name: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason: string;
}

export interface UpdateDistrictPayload {
  districtCode?: string;
  name?: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason?: string;
}

export interface CreateCityPayload {
  districtId: string;
  cityCode: string;
  name: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason: string;
}

export interface UpdateCityPayload {
  cityCode?: string;
  name?: string;
  translations?: GeoTranslations;
  isActive?: boolean;
  displayOrder?: number;
  reason?: string;
}
