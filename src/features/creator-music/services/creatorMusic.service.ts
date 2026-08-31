import { buildApiUrl } from "../../../config/api";
import { apiClient } from "../../../services/apiClient";
import type {
  AdminMusicTrack,
  MusicTrackMutation,
  MusicTrackResponse,
  MusicTracksResponse,
  MusicUploadIntent,
} from "../types/creatorMusic.types";

const ROOT = "/admin/creator-music/tracks";

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok)
    throw new Error(body.message ?? "Creator Music request failed.");
  return body;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function list(
  filters: {
    search?: string;
    status?: string;
    licenseStatus?: string;
    sourceType?: string;
    mood?: string;
    territory?: string;
    explicit?: string;
    categoryId?: string;
    expiringBefore?: string;
  } = {},
) {
  const params = new URLSearchParams({ page: "1", limit: "100" });
  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) params.set(key, value.trim());
  }
  return parse<MusicTracksResponse>(
    await apiClient.request(buildApiUrl(`${ROOT}?${params.toString()}`)),
  );
}

async function detail(trackId: string) {
  return parse<MusicTrackResponse>(
    await apiClient.request(buildApiUrl(`${ROOT}/${trackId}`)),
  );
}

async function create(body: MusicTrackMutation) {
  return parse<MusicTrackResponse>(
    await apiClient.request(buildApiUrl(ROOT), json("POST", body)),
  );
}

async function update(
  trackId: string,
  body: MusicTrackMutation,
  expectedVersion: number,
) {
  return parse<MusicTrackResponse>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${trackId}`),
      json("PUT", { ...body, expectedVersion }),
    ),
  );
}

async function lifecycle(
  track: AdminMusicTrack,
  action: "ACTIVATE" | "PAUSE" | "RETIRE" | "REVOKE_LICENSE",
  reason: string,
) {
  return parse<MusicTrackResponse>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${track.trackId}/lifecycle`),
      json("POST", { action, expectedVersion: track.version, reason }),
    ),
  );
}

async function upload(trackId: string, kind: "AUDIO" | "ARTWORK", file: File) {
  const intentEnvelope = await parse<{ data: MusicUploadIntent }>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${trackId}/upload-intent`),
      json("POST", {
        kind,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    ),
  );
  const intent = intentEnvelope.data;
  if (!intent.uploadUrl)
    throw new Error("The signed upload URL is unavailable.");
  const headers = new Headers(intent.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", file.type);
  const uploaded = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!uploaded.ok) throw new Error("The media provider rejected the upload.");
  return parse<MusicTrackResponse>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${trackId}/confirm-upload`),
      json("POST", { kind, mediaAssetId: intent.mediaAssetId }),
    ),
  );
}

export const creatorMusicService = {
  list,
  detail,
  create,
  update,
  lifecycle,
  upload,
};
