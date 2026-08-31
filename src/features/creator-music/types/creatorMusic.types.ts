export type MusicTrackStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "RETIRED";
export type MusicLicenseStatus = "PENDING" | "CLEARED" | "EXPIRED" | "REVOKED";
export type MusicSourceType = "LICENSED" | "ROYALTY_FREE" | "PLATFORM_OWNED";

export interface AdminMusicTrack {
  trackId: string;
  publicTrackId: string;
  title: string;
  artistName: string;
  albumName?: string | null;
  sourceType: MusicSourceType;
  status: MusicTrackStatus;
  licenseStatus: MusicLicenseStatus;
  durationMs: number;
  previewStartMs: number;
  previewDurationMs: number;
  moodTags: string[];
  isInstrumental: boolean;
  isExplicit: boolean;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
  categories?: {
    categoryId: string;
    categoryCode: string;
    name: string;
  }[];
  license?: {
    status: MusicLicenseStatus;
    provider: string | null;
    reference: string | null;
    validFrom: string | null;
    validUntil: string | null;
    territories: string[];
    attributionText: string | null;
  };
  media?: {
    audioMediaAssetId?: string | null;
    artworkMediaAssetId?: string | null;
    audioStatus: string | null;
    artworkStatus: string | null;
    previewUrl?: string | null;
    previewUrlExpiresAt?: string | null;
    artworkUrl?: string | null;
    artworkUrlExpiresAt?: string | null;
  };
}

export interface MusicTrackMutation {
  title: string;
  artistName: string;
  albumName?: string | null;
  sourceType: MusicSourceType;
  durationMs: number;
  previewStartMs: number;
  previewDurationMs: number;
  moodTags: string[];
  categoryIds: string[];
  isInstrumental: boolean;
  isExplicit: boolean;
  licenseStatus: MusicLicenseStatus;
  licenseProvider?: string | null;
  licenseReference?: string | null;
  licenseValidFrom?: string | null;
  licenseValidUntil?: string | null;
  licensedTerritories: string[];
  attributionText?: string | null;
  metadata: Record<string, unknown>;
}

export interface MusicTracksResponse {
  data: AdminMusicTrack[];
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  summary?: { totalTracks: number };
}

export interface MusicTrackResponse {
  data: AdminMusicTrack;
}

export interface MusicUploadIntent {
  mediaAssetId: string;
  uploadUrl: string | null;
  headers: Record<string, string>;
}
