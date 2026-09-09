import { buildApiUrl } from "../../../config/api";
import {
  GEO_CITIES_PATH,
  GEO_CITY_DETAIL_PATH,
  GEO_COUNTRIES_PATH,
  GEO_COUNTRY_DETAIL_PATH,
  GEO_DISTRICTS_PATH,
  GEO_DISTRICT_DETAIL_PATH,
  GEO_STATES_PATH,
  GEO_STATE_DETAIL_PATH,
} from "../../../config/geoApiPaths";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  City,
  Country,
  CreateCityPayload,
  CreateCountryPayload,
  CreateDistrictPayload,
  CreateStatePayload,
  District,
  GeoListQueryParams,
  GeoListResponse,
  GeoRecordResponse,
  State,
  UpdateCityPayload,
  UpdateCountryPayload,
  UpdateDistrictPayload,
  UpdateStatePayload,
} from "../types/geo.types";

interface ErrorEnvelope {
  message?: string;
  error?: string;
  code?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" ? (payload as ErrorEnvelope) : null;

    throw new Error(
      errorPayload?.message ?? errorPayload?.error ?? "Request failed.",
    );
  }

  return payload as T;
}

function jsonRequest<TPayload>(method: "POST" | "PUT", payload: TPayload) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function getCountries(
  query: GeoListQueryParams = {},
): Promise<GeoListResponse<Country>> {
  const queryString = buildQueryParams(query);
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${GEO_COUNTRIES_PATH}?${queryString}` : GEO_COUNTRIES_PATH),
  );
  return parseJsonResponse<GeoListResponse<Country>>(response);
}

async function createCountry(
  payload: CreateCountryPayload,
): Promise<GeoRecordResponse<Country>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_COUNTRIES_PATH),
    jsonRequest("POST", payload),
  );
  return parseJsonResponse<GeoRecordResponse<Country>>(response);
}

async function updateCountry(
  countryId: string,
  payload: UpdateCountryPayload,
): Promise<GeoRecordResponse<Country>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_COUNTRY_DETAIL_PATH(countryId)),
    jsonRequest("PUT", payload),
  );
  return parseJsonResponse<GeoRecordResponse<Country>>(response);
}

async function getStates(
  query: GeoListQueryParams = {},
): Promise<GeoListResponse<State>> {
  const queryString = buildQueryParams(query);
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${GEO_STATES_PATH}?${queryString}` : GEO_STATES_PATH),
  );
  return parseJsonResponse<GeoListResponse<State>>(response);
}

async function createState(
  payload: CreateStatePayload,
): Promise<GeoRecordResponse<State>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_STATES_PATH),
    jsonRequest("POST", payload),
  );
  return parseJsonResponse<GeoRecordResponse<State>>(response);
}

async function updateState(
  stateId: string,
  payload: UpdateStatePayload,
): Promise<GeoRecordResponse<State>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_STATE_DETAIL_PATH(stateId)),
    jsonRequest("PUT", payload),
  );
  return parseJsonResponse<GeoRecordResponse<State>>(response);
}

async function getDistricts(
  query: GeoListQueryParams = {},
): Promise<GeoListResponse<District>> {
  const queryString = buildQueryParams(query);
  const response = await apiClient.request(
    buildApiUrl(
      queryString ? `${GEO_DISTRICTS_PATH}?${queryString}` : GEO_DISTRICTS_PATH,
    ),
  );
  return parseJsonResponse<GeoListResponse<District>>(response);
}

async function createDistrict(
  payload: CreateDistrictPayload,
): Promise<GeoRecordResponse<District>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_DISTRICTS_PATH),
    jsonRequest("POST", payload),
  );
  return parseJsonResponse<GeoRecordResponse<District>>(response);
}

async function updateDistrict(
  districtId: string,
  payload: UpdateDistrictPayload,
): Promise<GeoRecordResponse<District>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_DISTRICT_DETAIL_PATH(districtId)),
    jsonRequest("PUT", payload),
  );
  return parseJsonResponse<GeoRecordResponse<District>>(response);
}

async function getCities(
  query: GeoListQueryParams = {},
): Promise<GeoListResponse<City>> {
  const queryString = buildQueryParams(query);
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${GEO_CITIES_PATH}?${queryString}` : GEO_CITIES_PATH),
  );
  return parseJsonResponse<GeoListResponse<City>>(response);
}

async function createCity(
  payload: CreateCityPayload,
): Promise<GeoRecordResponse<City>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_CITIES_PATH),
    jsonRequest("POST", payload),
  );
  return parseJsonResponse<GeoRecordResponse<City>>(response);
}

async function updateCity(
  cityId: string,
  payload: UpdateCityPayload,
): Promise<GeoRecordResponse<City>> {
  const response = await apiClient.request(
    buildApiUrl(GEO_CITY_DETAIL_PATH(cityId)),
    jsonRequest("PUT", payload),
  );
  return parseJsonResponse<GeoRecordResponse<City>>(response);
}

export const geoService = {
  getCountries,
  createCountry,
  updateCountry,
  getStates,
  createState,
  updateState,
  getDistricts,
  createDistrict,
  updateDistrict,
  getCities,
  createCity,
  updateCity,
};
