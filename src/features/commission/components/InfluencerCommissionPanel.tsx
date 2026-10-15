import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Skeleton } from '../../../components/ui/Skeleton'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { formatMoney } from '../../../utils/formatMoney'
import { settingsService } from '../../settings/services/settings.service'
import type { PlatformSetting, UpdateSettingResponse } from '../../settings/types/settings.types'
import {
  InfluencerCommissionEditModal,
  type InfluencerCommissionConfigValue,
} from './InfluencerCommissionEditModal'

const COMMISSION_SETTING_KEY = 'influencer.commission.phase1'

function formatPaise(amountPaise: number, currency = 'INR') {
  return formatMoney(amountPaise / 100, currency)
}

function formatCommissionValue(value: unknown) {
  if (!value || typeof value !== 'object') {
    return 'Not configured'
  }

  const config = value as {
    enabled?: boolean
    commissionType?: string
    commissionValue?: number
  }

  if (config.enabled === false) {
    return 'Disabled'
  }

  if (config.commissionType === 'FIXED') {
    return `${formatPaise(config.commissionValue ?? 0)} fixed`
  }

  const basisPoints = typeof config.commissionValue === 'number' ? config.commissionValue : 0
  return `${basisPoints / 100}% per booking`
}

export function InfluencerCommissionPanel() {
  const queryClient = useQueryClient()
  const { pushToast } = useToast()
  const canUpdateSettings = usePermission('settings:update')
  const [editingSetting, setEditingSetting] = useState<PlatformSetting | null>(null)

  const commissionSettingQuery = useQuery({
    queryKey: ['settings', 'influencer-commission-phase1'],
    queryFn: () =>
      settingsService.getSettings({ search: COMMISSION_SETTING_KEY, limit: 10 }),
  })

  const commissionSetting = commissionSettingQuery.data?.data.find(
    (setting) => setting.settingKey === COMMISSION_SETTING_KEY,
  )

  const mutation = useMutation<
    UpdateSettingResponse,
    Error,
    { value: InfluencerCommissionConfigValue; reason: string }
  >({
    mutationFn: (values) => {
      if (!commissionSetting) throw new Error('Commission setting not loaded yet.')
      return settingsService.updateSetting(commissionSetting.settingKey, {
        value: values.value,
        reason: values.reason,
      })
    },
    onSuccess: () => {
      setEditingSetting(null)
      void commissionSettingQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      pushToast({ tone: 'success', title: 'Influencer commission policy saved' })
    },
  })

  if (commissionSettingQuery.isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-16 w-full" />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3 p-5">
        <div className="rounded-full bg-surface-muted p-2.5 text-primary">
          <Settings2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Commission policy
          </p>
          <p className="truncate text-lg font-semibold text-foreground">
            {formatCommissionValue(commissionSetting?.value)}
          </p>
          <p className="mt-1 text-sm text-muted">
            One global rate applies to every influencer — there is no per-influencer
            override yet.
          </p>
        </div>
        {commissionSetting ? (
          <Button
            disabled={!canUpdateSettings}
            size="sm"
            type="button"
            onClick={() => setEditingSetting(commissionSetting)}
          >
            Edit
          </Button>
        ) : null}
      </Card>
      <InfluencerCommissionEditModal
        setting={editingSetting}
        error={mutation.error}
        isSubmitting={mutation.isPending}
        onClose={() => {
          if (!mutation.isPending) setEditingSetting(null)
        }}
        onSubmit={(values) => mutation.mutate(values)}
      />
    </div>
  )
}
