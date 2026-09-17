import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../services/apiClient";
import { creatorMusicService } from "./creatorMusic.service";

const requestSpy = vi.spyOn(apiClient, "request");

beforeEach(() => {
  requestSpy.mockReset();
});

describe("creatorMusicService", () => {
  it("passes server-side pagination and filters to the list endpoint", async () => {
    requestSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [],
          pagination: { page: 2, limit: 10, totalItems: 24, totalPages: 3 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await creatorMusicService.list({
      page: 2,
      limit: 10,
      search: "calm",
      status: "ACTIVE",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/creator-music/tracks?page=2&limit=10&search=calm&status=ACTIVE",
    );
  });
});
