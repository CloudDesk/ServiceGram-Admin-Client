import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Info, Loader2, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { cn } from '../../../../utils/cn'
import { settingsService } from '../../services/settings.service'
import type { MediaPolicyPreviewPayload } from '../../types/settings.types'
import { mediaReelPolicyFormSchema } from '../schemas/mediaReelPolicy.schema'
import type { MediaReelPolicyFormValues } from '../types/mediaReelPolicy.types'

const ASPECT_RATIO_CSS: Record<MediaReelPolicyFormValues['reelAspectRatio'], string> = {
  '9:16': '9 / 16',
  '1:1': '1 / 1',
  '16:9': '16 / 9',
}

interface CheckItem {
  label: string
  isValid: boolean
  message?: string
}

export function MediaReelSummaryPanel({
  currentRuleId = null,
}: {
  currentRuleId?: string | null
}) {
  const { watch } = useFormContext<MediaReelPolicyFormValues>()
  const values = watch()

  const parseResult = mediaReelPolicyFormSchema.safeParse(values)
  const issuesByPath = new Map<string, string>()
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const key = String(issue.path[0] ?? '')
      if (!issuesByPath.has(key)) issuesByPath.set(key, issue.message)
    }
  }

  const checks: CheckItem[] = [
    {
      label: 'Reel length',
      isValid: !issuesByPath.has('reelDurationSeconds'),
      message: issuesByPath.get('reelDurationSeconds'),
    },
    {
      label: 'Resolution range',
      isValid: !issuesByPath.has('maxReelWidth') && !issuesByPath.has('maxReelHeight'),
      message: issuesByPath.get('maxReelWidth') ?? issuesByPath.get('maxReelHeight'),
    },
    {
      label: 'Music preview vs. track length',
      isValid: !issuesByPath.has('maxMusicPreviewSeconds'),
      message: issuesByPath.get('maxMusicPreviewSeconds'),
    },
    {
      label: 'Applies-to details',
      isValid:
        !issuesByPath.has('categoryId') &&
        !issuesByPath.has('city') &&
        !issuesByPath.has('zoneId') &&
        !issuesByPath.has('vendorId'),
      message:
        issuesByPath.get('categoryId') ??
        issuesByPath.get('city') ??
        issuesByPath.get('zoneId') ??
        issuesByPath.get('vendorId'),
    },
    {
      label: 'File formats selected',
      isValid:
        !issuesByPath.has('allowedVideoFormats') &&
        !issuesByPath.has('allowedImageFormats') &&
        !issuesByPath.has('allowedStoryImageFormats') &&
        !issuesByPath.has('allowedAudioFormats'),
      message:
        issuesByPath.get('allowedVideoFormats') ??
        issuesByPath.get('allowedImageFormats') ??
        issuesByPath.get('allowedStoryImageFormats') ??
        issuesByPath.get('allowedAudioFormats'),
    },
  ]

  const appliesToLabel =
    values.scopeType === 'GLOBAL'
      ? 'Every vendor, platform-wide'
      : values.scopeType === 'CATEGORY'
        ? values.categoryLabel || 'A category (not yet chosen)'
        : values.scopeType === 'CITY'
          ? values.city || 'A city (not yet entered)'
          : values.scopeType === 'ZONE'
            ? values.zoneLabel || 'A zone (not yet chosen)'
            : values.vendorLabel || 'A vendor (not yet chosen)'

  const scopePreviewPayload: MediaPolicyPreviewPayload = useMemo(() => {
    if (values.scopeType === 'CATEGORY' && values.categoryId) return { categoryId: values.categoryId }
    if (values.scopeType === 'CITY' && values.city.trim()) return { city: values.city.trim() }
    if (values.scopeType === 'ZONE' && values.zoneId) return { zoneId: values.zoneId }
    if (values.scopeType === 'VENDOR' && values.vendorId) return { vendorId: values.vendorId }
    return {}
  }, [values.categoryId, values.city, values.scopeType, values.vendorId, values.zoneId])

  const [debouncedPayload, setDebouncedPayload] = useState(scopePreviewPayload)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPayload(scopePreviewPayload), 400)
    return () => window.clearTimeout(timer)
  }, [scopePreviewPayload])

  const appliesPreviewQuery = useQuery({
    queryKey: ['content-rule-applies-preview', debouncedPayload],
    queryFn: () => settingsService.previewMediaPolicy(debouncedPayload),
    staleTime: 15_000,
  })
  const preview = appliesPreviewQuery.data?.data
  const selectedCandidate = preview?.candidates.find((candidate) => candidate.selected)

  return (
    <aside className="space-y-3">
      <div className="rounded-[0.875rem] border border-border bg-surface-muted/40 p-4">
        <div className="mx-auto w-28">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted">
            <Smartphone className="size-3.5" />
            Reel preview
          </div>
          <div
            className="mx-auto mt-2 flex items-center justify-center rounded-[0.9rem] border-4 border-foreground/80 bg-surface p-1 shadow-sm"
            style={{ aspectRatio: ASPECT_RATIO_CSS[values.reelAspectRatio], width: '100%' }}
          >
            <span className="px-1 text-center text-[0.65rem] font-semibold leading-tight text-muted">
              {values.reelAspectRatio}
            </span>
          </div>
        </div>
        <dl className="mt-3 space-y-1.5 text-xs">
          <SummaryRow
            label="Length"
            value={`${values.reelDurationSeconds[0]}–${values.reelDurationSeconds[1]} sec`}
          />
          <SummaryRow label="Max size" value={`Up to ${values.maxReelSizeMB} MB`} />
          <SummaryRow
            label="Resolution"
            value={`${values.minReelWidth}×${values.minReelHeight} to ${values.maxReelWidth}×${values.maxReelHeight}`}
          />
        </dl>
      </div>

      <div className="rounded-[0.875rem] border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Applies to</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{appliesToLabel}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Active</p>
        <p className="mt-1 text-sm text-foreground">
          {values.status === 'ACTIVE' ? 'Live now' : values.status === 'DRAFT' ? 'Not live yet (draft)' : 'Archived'}
          {values.effectiveTo ? ` · until ${new Date(values.effectiveTo).toLocaleDateString()}` : ''}
        </p>

        <p className="mt-3 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Who does this apply to?
        </p>
        {appliesPreviewQuery.isLoading ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Checking live rules…
          </p>
        ) : appliesPreviewQuery.isError ? (
          <p className="mt-1 text-xs text-muted">Live check unavailable right now.</p>
        ) : preview ? (
          <div className="mt-1 space-y-1.5 text-xs">
            {preview.effectivePolicy.source === 'SYSTEM_DEFAULT' ? (
              <p className="flex items-start gap-1.5 text-info">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                No active rule matches yet, so platform defaults apply here.
              </p>
            ) : currentRuleId && preview.effectivePolicy.ruleId === currentRuleId ? (
              <p className="flex items-start gap-1.5 text-success">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                This rule currently applies here.
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {currentRuleId ? 'Another rule applies here first: ' : 'Applies via: '}
                <span className="font-semibold">{preview.effectivePolicy.displayName}</span>
                {selectedCandidate ? ` (priority ${selectedCandidate.priority})` : ''}
              </p>
            )}
            <p className="text-muted">
              {preview.candidates.length} active rule{preview.candidates.length === 1 ? '' : 's'} match this
              scope.
            </p>
            {preview.warnings.length > 0 ? (
              <p className="flex items-start gap-1.5 text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {preview.warnings.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-[0.875rem] border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Checks</p>
        <ul className="mt-2 space-y-1.5">
          {checks.map((check) => (
            <li className="flex items-start gap-2 text-xs" key={check.label}>
              {check.isValid ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              )}
              <span className={cn(check.isValid ? 'text-foreground' : 'text-warning')}>
                {check.isValid ? check.label : check.message ?? check.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  )
}
