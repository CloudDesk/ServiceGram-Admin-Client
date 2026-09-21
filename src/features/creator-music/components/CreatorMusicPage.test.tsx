import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { creatorMusicService } from "../services/creatorMusic.service";
import { CreatorMusicPage } from "./CreatorMusicPage";

const list = vi.spyOn(creatorMusicService, "list");
const create = vi.spyOn(creatorMusicService, "create");
const detail = vi.spyOn(creatorMusicService, "detail");
const upload = vi.spyOn(creatorMusicService, "upload");

const savedTrack = {
  trackId: "11111111-1111-4111-8111-111111111111",
  publicTrackId: "MUSIC-TEST",
  title: "Calm service",
  artistName: "ServiceGram",
  sourceType: "LICENSED" as const,
  status: "DRAFT" as const,
  licenseStatus: "CLEARED" as const,
  durationMs: 60_000,
  previewStartMs: 0,
  previewDurationMs: 30_000,
  moodTags: [],
  isInstrumental: false,
  isExplicit: false,
  version: 1,
  publishedAt: null,
  updatedAt: "2026-09-17T00:00:00.000Z",
};

beforeEach(() => {
  list.mockReset();
  create.mockReset();
  detail.mockReset();
  upload.mockReset();
  list.mockResolvedValue({
    data: [],
    pagination: { page: 1, limit: 20, totalItems: 42, totalPages: 3 },
    summary: { totalTracks: 42 },
  });
  create.mockResolvedValue({ data: savedTrack });
  detail.mockResolvedValue({ data: savedTrack });
  upload.mockResolvedValue({ data: savedTrack });
});

describe("CreatorMusicPage", () => {
  it("shows the catalogue first and opens creation with media upload controls", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatorMusicPage />, {
      initialEntry: "/app/creator-music",
      path: "/app/creator-music",
      permissions: ["creator_music:read", "creator_music:update"],
    });

    expect(
      await screen.findByRole("button", { name: /all.*42/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /draft.*42/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /active.*42/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /columns/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /density/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /new creator music track/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^track$/i }));

    expect(screen.getByRole("heading", { name: /new creator music track/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/choose audio/i)).toHaveAttribute(
      "accept",
      "audio/mpeg,audio/mp4,audio/aac,audio/wav",
    );
    expect(screen.getByLabelText(/choose artwork/i)).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
  });

  it("requests the selected server-side page size", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatorMusicPage />, {
      initialEntry: "/app/creator-music",
      path: "/app/creator-music",
      permissions: ["creator_music:read"],
    });

    await screen.findByRole("button", { name: /all.*42/i });
    await user.selectOptions(screen.getByLabelText(/^rows$/i), "25");

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 25 }),
      ),
    );
  });

  it("requires activation-ready rights and audio before saving", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatorMusicPage />, {
      initialEntry: "/app/creator-music",
      path: "/app/creator-music",
      permissions: ["creator_music:read", "creator_music:update"],
    });

    await user.click(await screen.findByRole("button", { name: /^track$/i }));
    await user.type(screen.getByLabelText(/^Title/), "Calm service");
    await user.type(screen.getByLabelText(/^Artist/), "ServiceGram");
    await user.click(screen.getByRole("button", { name: /create track/i }));

    expect(create).not.toHaveBeenCalled();
    expect(
      screen.getByText("Rights must be cleared before this track can be saved."),
    ).toBeInTheDocument();
    expect(screen.getByText("Licence provider is required.")).toBeInTheDocument();
    expect(screen.getByText("Licence reference is required.")).toBeInTheDocument();
    expect(screen.getByText("Upload an audio file before saving.")).toBeInTheDocument();
  });

  it("opens incomplete legacy drafts for correction instead of calling activation", async () => {
    const user = userEvent.setup();
    const incompleteTrack = {
      ...savedTrack,
      licenseStatus: "PENDING" as const,
      license: {
        status: "PENDING" as const,
        provider: null,
        reference: null,
        validFrom: null,
        validUntil: null,
        territories: [],
        attributionText: null,
      },
      media: {
        audioStatus: null,
        artworkStatus: null,
      },
    };
    list.mockResolvedValue({
      data: [incompleteTrack],
      pagination: { page: 1, limit: 50, totalItems: 1, totalPages: 1 },
      summary: { totalTracks: 1 },
    });
    detail.mockResolvedValue({ data: incompleteTrack });

    renderWithProviders(<CreatorMusicPage />, {
      initialEntry: "/app/creator-music",
      path: "/app/creator-music",
      permissions: [
        "creator_music:read",
        "creator_music:update",
        "creator_music:publish",
      ],
    });

    await user.click(
      await screen.findByRole("button", {
        name: "More actions for Calm service",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Activate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /cleared licence status.*licence provider.*licence reference.*licensed territory.*available audio/i,
    );
    expect(
      screen.getByRole("heading", { name: "Edit MUSIC-TEST" }),
    ).toBeInTheDocument();
  });

  it("creates metadata before uploading selected audio and artwork", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatorMusicPage />, {
      initialEntry: "/app/creator-music",
      path: "/app/creator-music",
      permissions: ["creator_music:read", "creator_music:update"],
    });

    await user.click(await screen.findByRole("button", { name: /^track$/i }));
    await user.type(screen.getByLabelText(/^Title/), "Calm service");
    await user.type(screen.getByLabelText(/^Artist/), "ServiceGram");
    await user.selectOptions(screen.getByLabelText(/^Licence status/), "CLEARED");
    await user.type(screen.getByLabelText(/^Licence provider/), "Example Music");
    await user.type(screen.getByLabelText(/^Licence reference/), "LIC-2026-001");
    await user.upload(
      screen.getByLabelText(/choose audio/i),
      new File(["audio"], "calm.mp3", { type: "audio/mpeg" }),
    );
    await user.upload(
      screen.getByLabelText(/choose artwork/i),
      new File(["image"], "cover.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /create track/i }));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        licenseStatus: "CLEARED",
        licenseProvider: "Example Music",
        licenseReference: "LIC-2026-001",
        licensedTerritories: ["IN"],
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      1,
      savedTrack.trackId,
      "AUDIO",
      expect.objectContaining({ name: "calm.mp3" }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      2,
      savedTrack.trackId,
      "ARTWORK",
      expect.objectContaining({ name: "cover.png" }),
    );
  });
});
