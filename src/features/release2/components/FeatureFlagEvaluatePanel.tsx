import { useMutation } from '@tanstack/react-query'
import { CircleCheck, CircleSlash, FlaskConical } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import {
  searchAdminUserIdLookupOptions,
  searchCustomerUserIdLookupOptions,
  searchInfluencerLookupOptions,
  searchInfluencerUserIdLookupOptions,
  searchVendorLookupOptions,
  searchZoneLookupOptions,
} from '../../lookups/adminLookups'
import { humanizeCode } from '../release2Presenters'
import { release2Service } from '../services/release2.service'
import {
  FEATURE_FLAG_APP_TYPES,
  FEATURE_FLAG_USER_SEGMENTS,
  type FeatureFlagAppType,
  type FeatureFlagUserSegment,
} from '../types/release2.types'
import { Release2ErrorNotice } from './Release2Feedback'

/** Only these app types expose a searchable auth user id; others need the raw uuid. */
function userIdFetcherFor(appType: FeatureFlagAppType) {
  switch (appType) {
    case 'CUSTOMER':
      return searchCustomerUserIdLookupOptions
    case 'ADMIN':
      return searchAdminUserIdLookupOptions
    case 'INFLUENCER':
      return searchInfluencerUserIdLookupOptions
    default:
      return null
  }
}

const selectClass = 'form-select h-9 text-sm'

interface FeatureFlagEvaluatePanelProps {
  featureKey: string
}

/**
 * Asks the backend how the flag resolves for one context. The verdict, reason,
 * matched target and rollout bucket all come from the evaluation service — the
 * panel never recomputes them locally.
 */
export function FeatureFlagEvaluatePanel({
  featureKey,
}: FeatureFlagEvaluatePanelProps) {
  const [appType, setAppType] = useState<FeatureFlagAppType>('CUSTOMER')
  const [userId, setUserId] = useState('')
  const [userLabel, setUserLabel] = useState('')
  const [city, setCity] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [zoneLabel, setZoneLabel] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [vendorLabel, setVendorLabel] = useState('')
  const [influencerId, setInfluencerId] = useState('')
  const [influencerLabel, setInfluencerLabel] = useState('')
  const [roleCodes, setRoleCodes] = useState('')
  const [userSegment, setUserSegment] = useState<FeatureFlagUserSegment | ''>('')
  const userIdFetcher = userIdFetcherFor(appType)

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const response = await release2Service.evaluateFeatureFlag(featureKey, {
        appType,
        userId: userId.trim() || undefined,
        city: city.trim() || undefined,
        zoneId: zoneId.trim() || undefined,
        vendorId: vendorId.trim() || undefined,
        influencerId: influencerId.trim() || undefined,
        roleCodes: roleCodes
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean),
        userSegments: userSegment ? [userSegment] : undefined,
      })

      return response.data
    },
  })

  const result = evaluateMutation.data

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    evaluateMutation.mutate()
  }

  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Evaluate</h3>
      </div>
      <p className="mt-1 text-xs text-muted">
        Test one context. Nothing is saved.
      </p>

      <form className="mt-3 space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[0.7rem] font-medium text-muted">App *</span>
            <select
              className={selectClass}
              value={appType}
              onChange={(event) =>
                setAppType(event.target.value as FeatureFlagAppType)
              }
            >
              {FEATURE_FLAG_APP_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[0.7rem] font-medium text-muted">Segment</span>
            <select
              className={selectClass}
              value={userSegment}
              onChange={(event) =>
                setUserSegment(event.target.value as FeatureFlagUserSegment | '')
              }
            >
              <option value="">None</option>
              {FEATURE_FLAG_USER_SEGMENTS.map((option) => (
                <option key={option} value={option}>
                  {humanizeCode(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[0.7rem] font-medium text-muted">City</span>
            <Input
              className="h-9 text-sm"
              placeholder="Bengaluru"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </label>

          <LookupSelect
            fetchOptions={searchZoneLookupOptions}
            label="Zone id"
            placeholder="Search zone"
            queryKey={['lookup', 'zones', 'evaluate-panel']}
            selectedLabel={zoneLabel}
            value={zoneId}
            onChange={(value, option) => {
              setZoneId(value)
              setZoneLabel(option?.label ?? '')
            }}
          />

          {userIdFetcher ? (
            <LookupSelect
              fetchOptions={userIdFetcher}
              label="User id"
              placeholder={`Search ${appType.toLowerCase()}`}
              queryKey={['lookup', 'user-id', appType, 'evaluate-panel']}
              selectedLabel={userLabel}
              value={userId}
              onChange={(value, option) => {
                setUserId(value)
                setUserLabel(option?.label ?? '')
              }}
            />
          ) : (
            <label className="block space-y-1">
              <span className="text-[0.7rem] font-medium text-muted">User id</span>
              <Input
                className="h-9 text-sm"
                placeholder="uuid"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
              />
              <span className="block text-[0.7rem] text-muted">
                No lookup for {appType.toLowerCase()} accounts — paste the auth user
                id directly.
              </span>
            </label>
          )}

          <LookupSelect
            fetchOptions={searchVendorLookupOptions}
            label="Vendor id"
            placeholder="Search vendor"
            queryKey={['lookup', 'vendors', 'evaluate-panel']}
            selectedLabel={vendorLabel}
            value={vendorId}
            onChange={(value, option) => {
              setVendorId(value)
              setVendorLabel(option?.label ?? '')
            }}
          />

          <LookupSelect
            fetchOptions={searchInfluencerLookupOptions}
            label="Influencer id"
            placeholder="Search influencer"
            queryKey={['lookup', 'influencers', 'evaluate-panel']}
            selectedLabel={influencerLabel}
            value={influencerId}
            onChange={(value, option) => {
              setInfluencerId(value)
              setInfluencerLabel(option?.label ?? '')
            }}
          />

          <label className="block space-y-1">
            <span className="text-[0.7rem] font-medium text-muted">Role codes</span>
            <Input
              className="h-9 text-sm"
              placeholder="SUPER_ADMIN, OPS"
              value={roleCodes}
              onChange={(event) => setRoleCodes(event.target.value)}
            />
          </label>
        </div>

        <Button
          className="w-full"
          isLoading={evaluateMutation.isPending}
          size="sm"
          type="submit"
          variant="secondary"
        >
          Run evaluation
        </Button>
      </form>

      <Release2ErrorNotice className="mt-3" error={evaluateMutation.error} />

      {result ? (
        <div className="mt-3 space-y-2 rounded-[0.75rem] border border-border bg-surface-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {result.enabled ? (
                <CircleCheck className="size-4 text-success" />
              ) : (
                <CircleSlash className="size-4 text-muted" />
              )}
              {result.enabled ? 'Enabled' : 'Not enabled'}
            </span>
            <Badge tone={result.enabled ? 'success' : 'neutral'}>
              {humanizeCode(result.reason)}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">Matched target</dt>
            <dd className="truncate text-right font-mono text-foreground">
              {result.matchedTargetId ?? '—'}
            </dd>
            <dt className="text-muted">Rollout bucket</dt>
            <dd className="text-right tabular-nums text-foreground">
              {result.rolloutBucket ?? '—'}
            </dd>
          </dl>
        </div>
      ) : null}
    </Card>
  )
}
