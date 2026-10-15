import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { PolicyRuleActionModal, type PolicyRuleActionSelection } from '../../settings/components/SettingsPage'
import { PolicyRulesWorkspace } from '../../settings/policyRules/components/PolicyRulesWorkspace'
import { buildPolicyRuleAuditPath } from '../../settings/policyRules/utils/policyRulePresentation'
import { settingsService } from '../../settings/services/settings.service'
import type {
  PolicyRuleResponse,
  PolicyRulesListResponse,
  PolicyRulesQueryParams,
  PolicyScopeType,
  PolicyStatus,
  UpsertPolicyRulePayload,
} from '../../settings/types/settings.types'

const DEFAULT_PAGE_SIZE = 10
// Family is locked to COMMISSION_RULE and pricing preview is hidden on this tab (see
// hideFamilyFilter/hidePricingPreview below), so these handlers are intentionally inert.
const noop = () => undefined

export function VendorCommissionPanel() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { pushToast } = useToast()
  const canReadAudit = usePermission('audit:read')
  const canReadVendors = usePermission('vendors:read')
  const canUpdateSettings = usePermission('settings:update')

  const [search, setSearch] = useState('')
  const [policyScopeType, setPolicyScopeType] = useState<PolicyScopeType | ''>('')
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus | ''>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedPolicyAction, setSelectedPolicyAction] =
    useState<PolicyRuleActionSelection | null>(null)

  const policyQuery = useMemo(
    () =>
      ({
        family: 'COMMISSION_RULE',
        scopeType: policyScopeType || undefined,
        status: policyStatus || undefined,
      }) satisfies PolicyRulesQueryParams,
    [policyScopeType, policyStatus],
  )

  const policyResult = useQuery<PolicyRulesListResponse>({
    queryKey: ['settings-policy-rules', policyQuery],
    queryFn: () => settingsService.getPolicyRules(policyQuery),
  })

  const policyMutation = useMutation<PolicyRuleResponse, Error, UpsertPolicyRulePayload>({
    mutationFn: (payload) => settingsService.upsertPolicyRule(payload),
    onSuccess: (response) => {
      setSelectedPolicyAction(null)
      void policyResult.refetch()
      void queryClient.invalidateQueries({ queryKey: ['settings-policy-rules'] })
      const warnings = response.data.warnings ?? []
      pushToast(
        warnings.length
          ? {
              tone: 'warning',
              title: 'Commission rule saved with a warning',
              description: warnings.map((warning) => warning.message).join(' '),
            }
          : { tone: 'success', title: 'Commission rule saved' },
      )
    },
  })

  const policyRows = policyResult.data?.data ?? []
  const appliedFilterCount = [search, policyScopeType, policyStatus].filter(Boolean).length

  const resetFilters = () => {
    setSearch('')
    setPolicyScopeType('')
    setPolicyStatus('')
    setPage(1)
  }

  return (
    <div className="min-h-0 flex-1">
      <PolicyRulesWorkspace
        rows={policyRows}
        canReadAudit={canReadAudit}
        canReadVendors={canReadVendors}
        canUpdateSettings={canUpdateSettings}
        isError={policyResult.isError}
        isLoading={policyResult.isLoading && policyRows.length === 0}
        onRetry={() => void policyResult.refetch()}
        search={search}
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch)
          setPage(1)
        }}
        queueTabs={[{ key: 'vendor', label: 'Vendor commission', count: policyRows.length }]}
        activeQueue="vendor"
        onQueueChange={noop}
        policyFamily="COMMISSION_RULE"
        policyStatus={policyStatus}
        policyScopeType={policyScopeType}
        onPolicyFamilyChange={noop}
        onPolicyStatusChange={(value) => {
          setPolicyStatus(value as PolicyStatus | '')
          setPage(1)
        }}
        onPolicyScopeTypeChange={(value) => {
          setPolicyScopeType(value as PolicyScopeType | '')
          setPage(1)
        }}
        hideFamilyFilter
        hidePricingPreview
        appliedFilterCount={appliedFilterCount}
        onResetFilters={resetFilters}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onPageSizeChange={(nextLimit) => {
          setLimit(nextLimit)
          setPage(1)
        }}
        onPreview={(rule) => setSelectedPolicyAction({ action: 'EDIT', record: rule })}
        onCreate={() => setSelectedPolicyAction({ action: 'CREATE' })}
        onPreviewPricing={noop}
        onSelectAction={setSelectedPolicyAction}
        onOpenAudit={(rule) => navigate(buildPolicyRuleAuditPath(rule))}
        onOpenCategory={(categoryId) =>
          navigate(`${routePaths.settings}/categories/${encodeURIComponent(categoryId)}`)
        }
        onOpenZone={(zoneId) =>
          navigate(`${routePaths.settings}/zones/${encodeURIComponent(zoneId)}`)
        }
        onOpenVendor={(vendorId) =>
          navigate(`${routePaths.vendors}/${encodeURIComponent(vendorId)}`)
        }
      />
      <PolicyRuleActionModal
        action={selectedPolicyAction}
        error={policyMutation.error}
        isSubmitting={policyMutation.isPending}
        lockedFamily="COMMISSION_RULE"
        onClose={() => {
          if (!policyMutation.isPending) {
            policyMutation.reset()
            setSelectedPolicyAction(null)
          }
        }}
        onClearError={() => policyMutation.reset()}
        onSubmit={(payload) => policyMutation.mutate(payload)}
      />
    </div>
  )
}
