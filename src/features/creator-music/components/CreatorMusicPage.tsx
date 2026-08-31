import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Music2, RefreshCcw, Upload } from "lucide-react";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PageContextHeader } from "../../../components/ui/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { usePermission } from "../../../hooks/usePermission";
import { creatorMusicService } from "../services/creatorMusic.service";
import type {
  AdminMusicTrack,
  MusicLicenseStatus,
  MusicSourceType,
  MusicTrackMutation,
} from "../types/creatorMusic.types";

const emptyForm: MusicTrackMutation = {
  title: "",
  artistName: "",
  albumName: null,
  sourceType: "LICENSED",
  durationMs: 60_000,
  previewStartMs: 0,
  previewDurationMs: 30_000,
  moodTags: [],
  categoryIds: [],
  isInstrumental: false,
  isExplicit: false,
  licenseStatus: "PENDING",
  licenseProvider: null,
  licenseReference: null,
  licenseValidFrom: null,
  licenseValidUntil: null,
  licensedTerritories: ["IN"],
  attributionText: null,
  metadata: {},
};

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

function csv(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export function CreatorMusicPage() {
  const queryClient = useQueryClient();
  const canUpdate = usePermission("creator_music:update");
  const canPublish = usePermission("creator_music:publish");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [territoryFilter, setTerritoryFilter] = useState("");
  const [explicitFilter, setExplicitFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expiringFilter, setExpiringFilter] = useState("");
  const [editing, setEditing] = useState<AdminMusicTrack | null>(null);
  const [form, setForm] = useState<MusicTrackMutation>(emptyForm);
  const [moods, setMoods] = useState("");
  const [categories, setCategories] = useState("");
  const [territories, setTerritories] = useState("IN");
  const [error, setError] = useState<string | null>(null);

  const tracksQuery = useQuery({
    queryKey: [
      "creator-music",
      search,
      statusFilter,
      licenseFilter,
      sourceFilter,
      moodFilter,
      territoryFilter,
      explicitFilter,
      categoryFilter,
      expiringFilter,
    ],
    queryFn: () =>
      creatorMusicService.list({
        search,
        status: statusFilter,
        licenseStatus: licenseFilter,
        sourceType: sourceFilter,
        mood: moodFilter,
        territory: territoryFilter.toUpperCase(),
        explicit: explicitFilter,
        categoryId: categoryFilter,
        expiringBefore: expiringFilter
          ? new Date(`${expiringFilter}T23:59:59`).toISOString()
          : "",
      }),
  });
  const tracks = useMemo(
    () => tracksQuery.data?.data ?? [],
    [tracksQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        moodTags: csv(moods),
        categoryIds: csv(categories),
        licensedTerritories: csv(territories).map((item) => item.toUpperCase()),
      };
      return editing
        ? creatorMusicService.update(editing.trackId, body, editing.version)
        : creatorMusicService.create(body);
    },
    onSuccess: async () => {
      setEditing(null);
      setForm(emptyForm);
      setMoods("");
      setCategories("");
      setTerritories("IN");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["creator-music"] });
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Save failed."),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({
      action,
      reason,
      track,
    }: {
      action: "ACTIVATE" | "PAUSE" | "RETIRE" | "REVOKE_LICENSE";
      reason: string;
      track: AdminMusicTrack;
    }) => creatorMusicService.lifecycle(track, action, reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["creator-music"] }),
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Action failed."),
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      kind,
      trackId,
    }: {
      file: File;
      kind: "AUDIO" | "ARTWORK";
      trackId: string;
    }) => creatorMusicService.upload(trackId, kind, file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["creator-music"] }),
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Upload failed."),
  });

  const activeCount = useMemo(
    () => tracks.filter((track) => track.status === "ACTIVE").length,
    [tracks],
  );

  const editTrack = async (track: AdminMusicTrack) => {
    setError(null);
    const detail = (await creatorMusicService.detail(track.trackId)).data;
    setEditing(detail);
    setForm({
      title: detail.title,
      artistName: detail.artistName,
      albumName: detail.albumName,
      sourceType: detail.sourceType,
      durationMs: detail.durationMs,
      previewStartMs: detail.previewStartMs,
      previewDurationMs: detail.previewDurationMs,
      moodTags: detail.moodTags,
      categoryIds:
        detail.categories?.map((category) => category.categoryId) ?? [],
      isInstrumental: detail.isInstrumental,
      isExplicit: detail.isExplicit,
      licenseStatus: detail.license?.status ?? detail.licenseStatus,
      licenseProvider: detail.license?.provider,
      licenseReference: detail.license?.reference,
      licenseValidFrom: detail.license?.validFrom,
      licenseValidUntil: detail.license?.validUntil,
      licensedTerritories: detail.license?.territories ?? [],
      attributionText: detail.license?.attributionText,
      metadata: {},
    });
    setMoods(detail.moodTags.join(", "));
    setCategories(
      detail.categories?.map((category) => category.categoryId).join(", ") ??
        "",
    );
    setTerritories(detail.license?.territories.join(", ") ?? "");
  };

  const runLifecycle = (
    track: AdminMusicTrack,
    action: "ACTIVATE" | "PAUSE" | "RETIRE" | "REVOKE_LICENSE",
  ) => {
    const reason = window
      .prompt(`Reason for ${action.toLowerCase().replaceAll("_", " ")}:`)
      ?.trim();
    if (reason) lifecycleMutation.mutate({ track, action, reason });
  };

  return (
    <PageContainer className="space-y-5">
      <PageContextHeader
        title="Creator Music"
        description={`${tracks.length} loaded · ${activeCount} active. All creator access remains feature-gated.`}
        actionNode={
          <Button
            variant="secondary"
            onClick={() => void tracksQuery.refetch()}
          >
            <RefreshCcw className="mr-2 size-4" /> Refresh
          </Button>
        }
      />

      {canUpdate ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                {editing ? `Edit ${editing.publicTrackId}` : "New track"}
              </h2>
              <p className="text-sm text-muted">
                A track cannot activate until rights and audio are verified.
              </p>
            </div>
            {editing ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Title">
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </Field>
            <Field label="Artist">
              <input
                className={inputClass}
                value={form.artistName}
                onChange={(event) =>
                  setForm({ ...form, artistName: event.target.value })
                }
              />
            </Field>
            <Field label="Album">
              <input
                className={inputClass}
                value={form.albumName ?? ""}
                onChange={(event) =>
                  setForm({ ...form, albumName: event.target.value || null })
                }
              />
            </Field>
            <Field label="Source">
              <select
                className={inputClass}
                value={form.sourceType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    sourceType: event.target.value as MusicSourceType,
                  })
                }
              >
                <option value="LICENSED">Licensed</option>
                <option value="ROYALTY_FREE">Royalty free</option>
                <option value="PLATFORM_OWNED">Platform owned</option>
              </select>
            </Field>
            <Field label="Duration (ms)">
              <input
                className={inputClass}
                type="number"
                value={form.durationMs}
                onChange={(event) =>
                  setForm({ ...form, durationMs: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Preview start / duration (ms)">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  type="number"
                  value={form.previewStartMs}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      previewStartMs: Number(event.target.value),
                    })
                  }
                />
                <input
                  className={inputClass}
                  type="number"
                  value={form.previewDurationMs}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      previewDurationMs: Number(event.target.value),
                    })
                  }
                />
              </div>
            </Field>
            <Field label="Mood tags">
              <input
                className={inputClass}
                placeholder="calm, upbeat"
                value={moods}
                onChange={(event) => setMoods(event.target.value)}
              />
            </Field>
            <Field label="Service category UUIDs">
              <input
                className={inputClass}
                placeholder="comma separated"
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
              />
            </Field>
            <Field label="Territories">
              <input
                className={inputClass}
                placeholder="IN, SG"
                value={territories}
                onChange={(event) => setTerritories(event.target.value)}
              />
            </Field>
            <Field label="Licence status">
              <select
                className={inputClass}
                value={form.licenseStatus}
                onChange={(event) =>
                  setForm({
                    ...form,
                    licenseStatus: event.target.value as MusicLicenseStatus,
                  })
                }
              >
                <option value="PENDING">Pending</option>
                <option value="CLEARED">Cleared</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </Field>
            <Field label="Licence provider">
              <input
                className={inputClass}
                value={form.licenseProvider ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    licenseProvider: event.target.value || null,
                  })
                }
              />
            </Field>
            <Field label="Licence reference">
              <input
                className={inputClass}
                value={form.licenseReference ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    licenseReference: event.target.value || null,
                  })
                }
              />
            </Field>
            <Field label="Valid from">
              <input
                className={inputClass}
                type="datetime-local"
                value={dateInput(form.licenseValidFrom)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    licenseValidFrom: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  })
                }
              />
            </Field>
            <Field label="Valid until">
              <input
                className={inputClass}
                type="datetime-local"
                value={dateInput(form.licenseValidUntil)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    licenseValidUntil: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  })
                }
              />
            </Field>
            <Field label="Attribution">
              <input
                className={inputClass}
                value={form.attributionText ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    attributionText: event.target.value || null,
                  })
                }
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label>
              <input
                type="checkbox"
                checked={form.isInstrumental}
                onChange={(event) =>
                  setForm({ ...form, isInstrumental: event.target.checked })
                }
              />{" "}
              <span className="ml-1">Instrumental</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.isExplicit}
                onChange={(event) =>
                  setForm({ ...form, isExplicit: event.target.checked })
                }
              />{" "}
              <span className="ml-1">Explicit content</span>
            </label>
          </div>
          {editing?.media?.previewUrl ? (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface-muted p-3">
              {editing.media.artworkUrl ? (
                <img
                  alt={`${editing.title} artwork`}
                  className="size-12 rounded-lg object-cover"
                  src={editing.media.artworkUrl}
                />
              ) : (
                <Music2 className="size-6 text-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Audio preview</p>
                <audio
                  className="mt-1 h-8 w-full"
                  controls
                  src={editing.media.previewUrl}
                />
              </div>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button
            className="mt-4"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create draft track"}
          </Button>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5">
          <input
            className={inputClass}
            placeholder="Search title, artist or track ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="RETIRED">Retired</option>
          </select>
          <select
            className={inputClass}
            value={licenseFilter}
            onChange={(event) => setLicenseFilter(event.target.value)}
          >
            <option value="">All licences</option>
            <option value="PENDING">Pending</option>
            <option value="CLEARED">Cleared</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
          </select>
          <select
            className={inputClass}
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="">All sources</option>
            <option value="LICENSED">Licensed</option>
            <option value="ROYALTY_FREE">Royalty free</option>
            <option value="PLATFORM_OWNED">Platform owned</option>
          </select>
          <input
            className={inputClass}
            placeholder="Mood"
            value={moodFilter}
            onChange={(event) => setMoodFilter(event.target.value)}
          />
          <input
            className={inputClass}
            maxLength={2}
            placeholder="Territory"
            value={territoryFilter}
            onChange={(event) => setTerritoryFilter(event.target.value)}
          />
          <select
            className={inputClass}
            value={explicitFilter}
            onChange={(event) => setExplicitFilter(event.target.value)}
          >
            <option value="">All content</option>
            <option value="false">Clean only</option>
            <option value="true">Explicit only</option>
          </select>
          <input
            className={inputClass}
            placeholder="Service category UUID"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          />
          <input
            aria-label="Licence expiring before"
            className={inputClass}
            type="date"
            value={expiringFilter}
            onChange={(event) => setExpiringFilter(event.target.value)}
          />
        </div>
        {tracksQuery.isLoading ? (
          <p className="text-sm text-muted">Loading Creator Music…</p>
        ) : null}
        {tracksQuery.isError ? (
          <p className="text-sm text-danger">Could not load Creator Music.</p>
        ) : null}
        {!tracksQuery.isLoading && tracks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No music tracks yet.
          </p>
        ) : null}
        {tracks.map((track) => (
          <article
            className="rounded-xl border border-border bg-surface p-4"
            key={track.trackId}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-surface-muted">
                  <Music2 className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{track.title}</h3>
                  <p className="text-sm text-muted">
                    {track.artistName} · {track.publicTrackId} ·{" "}
                    {(track.durationMs / 1000).toFixed(1)}s
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge
                      tone={
                        track.status === "ACTIVE"
                          ? "success"
                          : track.status === "PAUSED"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {track.status}
                    </Badge>
                    <Badge
                      tone={
                        track.licenseStatus === "CLEARED"
                          ? "success"
                          : track.licenseStatus === "REVOKED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {track.licenseStatus}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canUpdate ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void editTrack(track)}
                  >
                    Edit
                  </Button>
                ) : null}
                {canUpdate ? (
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 text-sm">
                    <Upload className="mr-2 size-4" />
                    Audio
                    <input
                      className="sr-only"
                      type="file"
                      accept="audio/mpeg,audio/mp4,audio/aac,audio/wav"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          uploadMutation.mutate({
                            trackId: track.trackId,
                            kind: "AUDIO",
                            file,
                          });
                      }}
                    />
                  </label>
                ) : null}
                {canUpdate ? (
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 text-sm">
                    <Upload className="mr-2 size-4" />
                    Artwork
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          uploadMutation.mutate({
                            trackId: track.trackId,
                            kind: "ARTWORK",
                            file,
                          });
                      }}
                    />
                  </label>
                ) : null}
                {canPublish && track.status !== "ACTIVE" ? (
                  <Button
                    size="sm"
                    onClick={() => runLifecycle(track, "ACTIVATE")}
                  >
                    Activate
                  </Button>
                ) : null}
                {canPublish && track.status === "ACTIVE" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => runLifecycle(track, "PAUSE")}
                  >
                    Pause
                  </Button>
                ) : null}
                {canPublish ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runLifecycle(track, "RETIRE")}
                  >
                    Retire
                  </Button>
                ) : null}
                {canPublish && track.licenseStatus !== "REVOKED" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => runLifecycle(track, "REVOKE_LICENSE")}
                  >
                    Revoke licence
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </PageContainer>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
