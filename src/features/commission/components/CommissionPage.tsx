import { RefreshCcw, Store, Truck, Users } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { useAuthStore } from '../../../store/authStore'
import { cn } from '../../../utils/cn'
import { DeliveryPartnerCommissionPanel } from './DeliveryPartnerCommissionPanel'
import { InfluencerCommissionPanel } from './InfluencerCommissionPanel'
import { VendorCommissionPanel } from './VendorCommissionPanel'

type CommissionTab = 'vendor' | 'influencer' | 'delivery-partner'

const tabs: {
  id: CommissionTab
  label: string
  icon: typeof Store
  permissions: string[]
}[] = [
  { id: 'vendor', label: 'Vendor', icon: Store, permissions: ['settings:read'] },
  { id: 'influencer', label: 'Influencer', icon: Users, permissions: ['settings:read'] },
  {
    id: 'delivery-partner',
    label: 'Delivery Partner',
    icon: Truck,
    permissions: ['settings:read'],
  },
]

export function CommissionPage() {
  const can = useAuthStore((state) => state.can)
  const [searchParams, setSearchParams] = useSearchParams()
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.permissions.some((permission) => can(permission))),
    [can],
  )
  const requestedTab = searchParams.get('tab') as CommissionTab | null
  const activeTab = visibleTabs.find((tab) => tab.id === requestedTab)?.id ?? visibleTabs[0]?.id

  if (!activeTab) {
    return (
      <PageContainer>
        <PageContextHeader layout="document" placement="topbar" title="Commission" />
        <ErrorState
          title="Permission required"
          description="You need settings read permission to open this operating area."
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-4">
      <PageContextHeader
        layout="document"
        placement="topbar"
        title="Commission"
        actionNode={
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
        }
      />
      <div
        className="flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Commission settings"
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon
          const selected = tab.id === activeTab
          return (
            <button
              aria-selected={selected}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
                selected
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted hover:text-foreground',
              )}
              key={tab.id}
              role="tab"
              type="button"
              onClick={() => setSearchParams({ tab: tab.id })}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>
      {activeTab === 'vendor' ? <VendorCommissionPanel /> : null}
      {activeTab === 'influencer' ? <InfluencerCommissionPanel /> : null}
      {activeTab === 'delivery-partner' ? <DeliveryPartnerCommissionPanel /> : null}
    </PageContainer>
  )
}
