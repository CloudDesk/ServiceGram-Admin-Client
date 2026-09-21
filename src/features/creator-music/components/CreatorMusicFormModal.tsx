import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Music2, Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
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
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";

type CreatorMusicField =
  | "title"
  | "artistName"
  | "durationMs"
  | "previewDurationMs"
  | "licenseStatus"
  | "licenseProvider"
  | "licenseReference"
  | "licensedTerritories"
  | "licenseValidFrom"
  | "licenseValidUntil"
  | "audio";

type CreatorMusicFieldErrors = Partial<Record<CreatorMusicField, string>>;

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

function validateTrackForActivation(input: {
  audioFile: File | null;
  detail: AdminMusicTrack | null;
  form: MusicTrackMutation;
  territories: string;
}): CreatorMusicFieldErrors {
  const { audioFile, detail, form, territories } = input;
  const errors: CreatorMusicFieldErrors = {};
  const territoryCodes = csv(territories).map((item) => item.toUpperCase());
  const now = Date.now();

  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.artistName.trim()) errors.artistName = "Artist is required.";
  if (!Number.isInteger(form.durationMs) || form.durationMs < 1000) {
    errors.durationMs = "Duration must be at least 1 second.";
  }
  if (
    !Number.isInteger(form.previewStartMs) ||
    form.previewStartMs < 0 ||
    !Number.isInteger(form.previewDurationMs) ||
    form.previewDurationMs < 1000 ||
    form.previewStartMs + form.previewDurationMs > form.durationMs
  ) {
    errors.previewDurationMs = "Preview must be at least 1 second and fit within the track.";
  }
  if (form.licenseStatus !== "CLEARED") {
    errors.licenseStatus = "Rights must be cleared before this track can be saved.";
  }
  if (!form.licenseProvider?.trim()) {
    errors.licenseProvider = "Licence provider is required.";
  }
  if (!form.licenseReference?.trim()) {
    errors.licenseReference = "Licence reference is required.";
  }
  if (territoryCodes.length === 0) {
    errors.licensedTerritories = "At least one territory is required.";
  } else if (territoryCodes.some((territory) => !/^[A-Z]{2}$/.test(territory))) {
    errors.licensedTerritories = "Use two-letter territory codes such as IN or SG.";
  }

  const validFrom = form.licenseValidFrom
    ? Date.parse(form.licenseValidFrom)
    : null;
  const validUntil = form.licenseValidUntil
    ? Date.parse(form.licenseValidUntil)
    : null;

  if (validFrom !== null && validFrom > now) {
    errors.licenseValidFrom = "Licence validity cannot start in the future.";
  }
  if (validUntil !== null && validUntil <= now) {
    errors.licenseValidUntil = "Licence validity must end in the future.";
  } else if (
    validFrom !== null &&
    validUntil !== null &&
    validUntil <= validFrom
  ) {
    errors.licenseValidUntil = "Licence end must be after its start.";
  }

  if (!audioFile && detail?.media?.audioStatus !== "AVAILABLE") {
    errors.audio = "Upload an audio file before saving.";
  }

  return errors;
}

function formFromTrack(detail: AdminMusicTrack): MusicTrackMutation {
  return {
    title: detail.title,
    artistName: detail.artistName,
    albumName: detail.albumName,
    sourceType: detail.sourceType,
    durationMs: detail.durationMs,
    previewStartMs: detail.previewStartMs,
    previewDurationMs: detail.previewDurationMs,
    moodTags: detail.moodTags,
    categoryIds: detail.categories?.map((category) => category.categoryId) ?? [],
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
  };
}

export function CreatorMusicFormModal({
  initialMessage,
  track,
  onClose,
  onSaved,
}: {
  initialMessage?: string | null;
  track: AdminMusicTrack | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const trackId = track?.trackId;
  const detailQuery = useQuery({
    queryKey: ["creator-music-detail", trackId],
    queryFn: () => {
      if (!trackId) throw new Error("A track ID is required.");
      return creatorMusicService.detail(trackId);
    },
    enabled: Boolean(trackId),
  });

  if (track && detailQuery.isLoading) {
    return (
      <Modal onClose={onClose} title={`Edit ${track.publicTrackId}`}>
        <p className="text-sm text-muted">Loading track…</p>
      </Modal>
    );
  }

  if (track && (detailQuery.isError || !detailQuery.data?.data)) {
    return (
      <Modal onClose={onClose} title={`Edit ${track.publicTrackId}`}>
        <p className="text-sm text-danger">Could not load the track.</p>
      </Modal>
    );
  }

  return (
    <CreatorMusicForm
      detail={detailQuery.data?.data ?? null}
      initialMessage={initialMessage}
      track={track}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function CreatorMusicForm({
  detail,
  initialMessage,
  track,
  onClose,
  onSaved,
}: {
  detail: AdminMusicTrack | null;
  initialMessage?: string | null;
  track: AdminMusicTrack | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MusicTrackMutation>(() =>
    detail ? formFromTrack(detail) : { ...emptyForm },
  );
  const [moods, setMoods] = useState(() => detail?.moodTags.join(", ") ?? "");
  const [categories, setCategories] = useState(
    () => detail?.categories?.map((category) => category.categoryId).join(", ") ?? "",
  );
  const [territories, setTerritories] = useState(
    () => detail?.license?.territories.join(", ") ?? "IN",
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CreatorMusicFieldErrors>({});
  const [metadataSaved, setMetadataSaved] = useState(false);
  const persistedTrack = useRef<AdminMusicTrack | null>(null);
  const [completedUploads, setCompletedUploads] = useState(
    () => new Set<"AUDIO" | "ARTWORK">(),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      let saved = persistedTrack.current;
      if (!metadataSaved) {
        const body = {
          ...form,
          moodTags: csv(moods),
          categoryIds: csv(categories),
          licensedTerritories: csv(territories).map((item) => item.toUpperCase()),
        };
        const response = track
          ? await creatorMusicService.update(
              track.trackId,
              body,
              detail?.version ?? track.version,
            )
          : await creatorMusicService.create(body);
        saved = response.data;
        persistedTrack.current = saved;
        setMetadataSaved(true);
      }

      if (!saved) throw new Error("The track could not be saved.");

      if (audioFile && !completedUploads.has("AUDIO")) {
        const response = await creatorMusicService.upload(
          saved.trackId,
          "AUDIO",
          audioFile,
        );
        saved = response.data;
        persistedTrack.current = saved;
        setCompletedUploads((current) => new Set(current).add("AUDIO"));
      }
      if (artworkFile && !completedUploads.has("ARTWORK")) {
        const response = await creatorMusicService.upload(
          saved.trackId,
          "ARTWORK",
          artworkFile,
        );
        persistedTrack.current = response.data;
        setCompletedUploads((current) => new Set(current).add("ARTWORK"));
      }
    },
    onSuccess: onSaved,
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Save failed."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const nextFieldErrors = validateTrackForActivation({
      audioFile,
      detail,
      form,
      territories,
    });
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Complete the required activation fields before saving.");
      return;
    }

    saveMutation.mutate();
  };

  const clearFieldError = (field: CreatorMusicField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;

      return { ...current, [field]: undefined };
    });
    setError(null);
  };

  const busy = saveMutation.isPending;
  const locked = busy || metadataSaved;
  const close = () => {
    if (metadataSaved) onSaved();
    else onClose();
  };

  return (
    <Modal
      className="max-h-[92vh] overflow-y-auto"
      closeDisabled={busy}
      description={
        track
          ? "Update metadata or replace the track media."
          : "Create the draft and upload its audio and artwork in one workflow."
      }
      onClose={close}
      size="xl"
      title={track ? `Edit ${track.publicTrackId}` : "New Creator Music track"}
    >
      <form className="space-y-4" noValidate onSubmit={submit}>
          {initialMessage ? (
            <p
              className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning"
              role="alert"
            >
              {initialMessage}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field error={fieldErrors.title} label="Title" required>
              <input
                aria-invalid={Boolean(fieldErrors.title)}
                className={inputClass}
                disabled={locked}
                required
                value={form.title}
                onChange={(event) => {
                  clearFieldError("title");
                  setForm({ ...form, title: event.target.value });
                }}
              />
            </Field>
            <Field error={fieldErrors.artistName} label="Artist" required>
              <input
                aria-invalid={Boolean(fieldErrors.artistName)}
                className={inputClass}
                disabled={locked}
                required
                value={form.artistName}
                onChange={(event) => {
                  clearFieldError("artistName");
                  setForm({ ...form, artistName: event.target.value });
                }}
              />
            </Field>
            <Field label="Album">
              <input
                className={inputClass}
                disabled={locked}
                value={form.albumName ?? ""}
                onChange={(event) =>
                  setForm({ ...form, albumName: event.target.value || null })
                }
              />
            </Field>
            <Field label="Source">
              <select
                className={inputClass}
                disabled={locked}
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
            <Field error={fieldErrors.durationMs} label="Duration (ms)" required>
              <input
                aria-invalid={Boolean(fieldErrors.durationMs)}
                className={inputClass}
                disabled={locked}
                min={1000}
                required
                type="number"
                value={form.durationMs}
                onChange={(event) => {
                  clearFieldError("durationMs");
                  setForm({ ...form, durationMs: Number(event.target.value) });
                }}
              />
            </Field>
            <Field
              error={fieldErrors.previewDurationMs}
              label="Preview start / duration (ms)"
              required
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Preview start in milliseconds"
                  aria-invalid={Boolean(fieldErrors.previewDurationMs)}
                  className={inputClass}
                  disabled={locked}
                  min={0}
                  type="number"
                  value={form.previewStartMs}
                  onChange={(event) => {
                    clearFieldError("previewDurationMs");
                    setForm({ ...form, previewStartMs: Number(event.target.value) });
                  }}
                />
                <input
                  aria-label="Preview duration in milliseconds"
                  aria-invalid={Boolean(fieldErrors.previewDurationMs)}
                  className={inputClass}
                  disabled={locked}
                  min={1000}
                  type="number"
                  value={form.previewDurationMs}
                  onChange={(event) => {
                    clearFieldError("previewDurationMs");
                    setForm({
                      ...form,
                      previewDurationMs: Number(event.target.value),
                    });
                  }}
                />
              </div>
            </Field>
            <Field label="Mood tags">
              <input
                className={inputClass}
                disabled={locked}
                placeholder="calm, upbeat"
                value={moods}
                onChange={(event) => setMoods(event.target.value)}
              />
            </Field>
            <Field label="Service category UUIDs">
              <input
                className={inputClass}
                disabled={locked}
                placeholder="comma separated"
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
              />
            </Field>
            <Field
              error={fieldErrors.licensedTerritories}
              label="Territories"
              required
            >
              <input
                aria-invalid={Boolean(fieldErrors.licensedTerritories)}
                className={inputClass}
                disabled={locked}
                placeholder="IN, SG"
                required
                value={territories}
                onChange={(event) => {
                  clearFieldError("licensedTerritories");
                  setTerritories(event.target.value);
                }}
              />
            </Field>
            <Field error={fieldErrors.licenseStatus} label="Licence status" required>
              <select
                aria-invalid={Boolean(fieldErrors.licenseStatus)}
                className={inputClass}
                disabled={locked}
                required
                value={form.licenseStatus}
                onChange={(event) => {
                  clearFieldError("licenseStatus");
                  setForm({
                    ...form,
                    licenseStatus: event.target.value as MusicLicenseStatus,
                  });
                }}
              >
                <option value="PENDING">Pending</option>
                <option value="CLEARED">Cleared</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </Field>
            <Field
              error={fieldErrors.licenseProvider}
              label="Licence provider"
              required
            >
              <input
                aria-invalid={Boolean(fieldErrors.licenseProvider)}
                className={inputClass}
                disabled={locked}
                required
                value={form.licenseProvider ?? ""}
                onChange={(event) => {
                  clearFieldError("licenseProvider");
                  setForm({ ...form, licenseProvider: event.target.value || null });
                }}
              />
            </Field>
            <Field
              error={fieldErrors.licenseReference}
              label="Licence reference"
              required
            >
              <input
                aria-invalid={Boolean(fieldErrors.licenseReference)}
                className={inputClass}
                disabled={locked}
                required
                value={form.licenseReference ?? ""}
                onChange={(event) => {
                  clearFieldError("licenseReference");
                  setForm({ ...form, licenseReference: event.target.value || null });
                }}
              />
            </Field>
            <Field error={fieldErrors.licenseValidFrom} label="Valid from">
              <input
                aria-invalid={Boolean(fieldErrors.licenseValidFrom)}
                className={inputClass}
                disabled={locked}
                type="datetime-local"
                value={dateInput(form.licenseValidFrom)}
                onChange={(event) => {
                  clearFieldError("licenseValidFrom");
                  setForm({
                    ...form,
                    licenseValidFrom: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  });
                }}
              />
            </Field>
            <Field error={fieldErrors.licenseValidUntil} label="Valid until">
              <input
                aria-invalid={Boolean(fieldErrors.licenseValidUntil)}
                className={inputClass}
                disabled={locked}
                type="datetime-local"
                value={dateInput(form.licenseValidUntil)}
                onChange={(event) => {
                  clearFieldError("licenseValidUntil");
                  setForm({
                    ...form,
                    licenseValidUntil: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  });
                }}
              />
            </Field>
            <Field label="Attribution">
              <input
                className={inputClass}
                disabled={locked}
                value={form.attributionText ?? ""}
                onChange={(event) =>
                  setForm({ ...form, attributionText: event.target.value || null })
                }
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label>
              <input
                checked={form.isInstrumental}
                disabled={locked}
                type="checkbox"
                onChange={(event) =>
                  setForm({ ...form, isInstrumental: event.target.checked })
                }
              />
              <span className="ml-1">Instrumental</span>
            </label>
            <label>
              <input
                checked={form.isExplicit}
                disabled={locked}
                type="checkbox"
                onChange={(event) =>
                  setForm({ ...form, isExplicit: event.target.checked })
                }
              />
              <span className="ml-1">Explicit content</span>
            </label>
          </div>

          <section
            className={`rounded-xl border bg-surface-muted p-4 ${
              fieldErrors.audio ? "border-danger" : "border-border"
            }`}
          >
            <h3 className="font-semibold">
              Media files<span aria-hidden="true" className="text-danger"> *</span>
            </h3>
            <p className="mt-1 text-sm text-muted">
              Audio is required before activation. Artwork is optional. Files upload
              after the track metadata is saved.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <FilePicker
                accept="audio/mpeg,audio/mp4,audio/aac,audio/wav"
                disabled={busy || completedUploads.has("AUDIO")}
                file={audioFile}
                label="Choose audio"
                onChange={(file) => {
                  clearFieldError("audio");
                  setAudioFile(file);
                }}
              />
              <FilePicker
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || completedUploads.has("ARTWORK")}
                file={artworkFile}
                label="Choose artwork"
                onChange={setArtworkFile}
              />
            </div>
            {fieldErrors.audio ? (
              <p className="mt-2 text-xs text-danger">{fieldErrors.audio}</p>
            ) : null}
          </section>

          {detail?.media?.previewUrl ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted p-3">
              {detail.media.artworkUrl ? (
                <img
                  alt={`${detail.title} artwork`}
                  className="size-12 rounded-lg object-cover"
                  src={detail.media.artworkUrl}
                />
              ) : (
                <Music2 className="size-6 text-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Current audio</p>
                <audio className="mt-1 h-8 w-full" controls src={detail.media.previewUrl} />
              </div>
            </div>
          ) : null}

          {metadataSaved && error ? (
            <p className="text-sm text-warning">
              The track metadata is saved. Retry to finish the remaining upload.
            </p>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button disabled={busy} type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy} type="submit">
              {busy
                ? "Saving and uploading…"
                : metadataSaved
                  ? "Retry remaining upload"
                  : track
                    ? "Save changes"
                    : "Create track"}
            </Button>
          </div>
      </form>
    </Modal>
  );
}

function FilePicker({
  accept,
  disabled,
  file,
  label,
  onChange,
}: {
  accept: string;
  disabled: boolean;
  file: File | null;
  label: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label
      className={`inline-flex min-h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <Upload className="mr-2 size-4" />
      <span className="max-w-52 truncate">{file?.name ?? label}</span>
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Field({
  children,
  error,
  label,
  required = false,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required ? <span aria-hidden="true" className="text-danger"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}
